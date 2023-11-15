<script setup lang="ts">
import { ref } from 'vue'
import { collection, doc, addDoc, getDoc, updateDoc, deleteDoc, onSnapshot, DocumentData, DocumentReference, getDocs } from 'firebase/firestore'
import { db } from '@/config/firebase'

const localVideo = ref<MediaStream | null>(null)
const remoteVideo = ref<MediaStream | null>(null)
const roomId = ref<string | null>(null)
const currentRoom = ref('')
const dialogVisible = ref(false)
const mediaOpened = ref(false)
const loading = ref(false)
let roomRef: DocumentReference<DocumentData, DocumentData> | null = null
let peerConnection: RTCPeerConnection | null = null

// DEfault configuration - Change these if you have a different STUN or TURN server.
const configuration = {
  iceServers: [
    {
      urls: [
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
      ],
    },
  ],
  iceCandidatePoolSize: 10,
  offerToReceiveAudio: true,
  offerToReceiveVideo: true
}

async function createRoom() {
  loading.value = true
  roomRef = await addDoc(collection(db, "rooms"), {})
  roomId.value = roomRef.id
  currentRoom.value = `Current room is ${roomId.value} - You are the caller!`

  registerPeerConnectionListeners('callerCandidates', 'calleeCandidates')
  const offer = await peerConnection!.createOffer({
    offerToReceiveAudio: true,
    offerToReceiveVideo: true
  })
  await peerConnection!.setLocalDescription(offer)

  const roomWithOffer = {
    offer: {
      type: offer.type,
      sdp: offer.sdp
    }
  }
  await updateDoc(roomRef, roomWithOffer)

  onSnapshot(doc(db, "rooms", roomId.value), async (snapshot) => {
    console.log('Got updated room:', snapshot.data())
    const data = snapshot.data()
    if (!peerConnection!.currentRemoteDescription && data && data.answer) {
      console.log('Set remote description: ', data.answer)
      await peerConnection!.setRemoteDescription(new RTCSessionDescription(data.answer))
    }
  })
  loading.value = false
}

async function joinRoom() {
  loading.value = true
  console.log('Join room: ', roomId.value)
  currentRoom.value = `Current room is ${roomId.value} - You are the callee!`
  roomRef = doc(db, 'rooms', `${roomId.value}`)
  const roomSnapshot = await getDoc(roomRef)
  console.log('Got room:', roomSnapshot.exists)

  if (roomSnapshot.exists()) {
    registerPeerConnectionListeners('calleeCandidates', 'callerCandidates')

    // Code for creating SDP answer below
    await peerConnection!.setRemoteDescription(roomSnapshot.data().offer)
    const answer = await peerConnection!.createAnswer()
    await peerConnection!.setLocalDescription(answer)
    await updateDoc(roomRef, {
      answer: {
        type: answer.type,
        sdp: answer.sdp
      }
    })
    // Code for creating SDP answer above
  }
  dialogVisible.value = false
  loading.value = false
}

async function openUserMedia() {
  loading.value = true
  localVideo.value = await navigator.mediaDevices.getUserMedia({ video: true, audio: { 'echoCancellation': true } })
  remoteVideo.value = new MediaStream()

  console.log('Stream:', localVideo.value)
  mediaOpened.value = true
  loading.value = false
}

async function hangUp() {
  loading.value = true
  localVideo.value!.getTracks().forEach(track => {
    track.stop()
  })
  if (remoteVideo.value) {
    remoteVideo.value.getTracks().forEach(track => track.stop())
  }
  if (peerConnection) {
    peerConnection.close()
  }

  localVideo.value = null
  remoteVideo.value = null
  roomId.value = null
  currentRoom.value = ''

  // Delete room on hangup
  if (roomId.value) {
    const calleeCandidates = collection(roomRef!, 'calleeCandidates')
      ; (await getDocs(calleeCandidates)).forEach((candidate) => {
        deleteDoc(doc(calleeCandidates, candidate.id))
      })
    const callerCandidates = collection(roomRef!, 'callerCandidates')
      ; (await getDocs(callerCandidates)).forEach((candidate) => {
        deleteDoc(doc(callerCandidates, candidate.id))
      })
    await deleteDoc(roomRef!)
  }
  loading.value = false
}

function registerPeerConnectionListeners(localName: string, remoteName: string) {
  console.log('Create PeerConnection with configuration: ', configuration)
  peerConnection = new RTCPeerConnection(configuration)

  peerConnection.addEventListener('icegatheringstatechange', () => {
    console.log(
      `ICE gathering state changed: ${peerConnection!.iceGatheringState}`)
  })

  peerConnection.addEventListener('connectionstatechange', () => {
    console.log(`Connection state change: ${peerConnection!.connectionState}`)
  })

  peerConnection.addEventListener('signalingstatechange', () => {
    console.log(`Signaling state change: ${peerConnection!.signalingState}`)
  })

  peerConnection.addEventListener('iceconnectionstatechange ', () => {
    console.log(
      `ICE connection state change: ${peerConnection!.iceConnectionState}`)
  })

  peerConnection.addEventListener('track', event => {
    console.log('Got remote track:', event.streams[0])
    event.streams[0].getTracks().forEach(track => {
      console.log('Add a track to the remoteStream:', track)
      remoteVideo.value!.addTrack(track)
    })
  })

  const candidatesCollection = collection(roomRef!, localName)
  const remoteCollection = collection(roomRef!, remoteName)

  peerConnection.addEventListener('icecandidate', event => {
    if (event.candidate) {
      addDoc(candidatesCollection, event.candidate.toJSON())
    }
  })

  onSnapshot(remoteCollection, async (snapshot) => {
    snapshot.docChanges().forEach(change => {
      console.log('remote change,', change)
      if (change.type === "added") {
        peerConnection!.addIceCandidate(new RTCIceCandidate(change.doc.data()))
      }
    })
  })

  localVideo.value!.getTracks().forEach(track => {
    peerConnection!.addTrack(track, localVideo.value!)
  })
}
</script>

<template>
  <div id="chat-body" v-loading="loading">
    <h1>Welcome to FirebaseRTC!</h1>
    <el-button-group>
      <el-button type="primary" :disabled="mediaOpened" @click="openUserMedia">Open camera & microphone</el-button>
      <el-button type="primary" :disabled="!mediaOpened || roomId" @click="createRoom">Create room</el-button>
      <el-button type="primary" :disabled="!mediaOpened || roomId" @click="dialogVisible = true">Join room</el-button>
      <el-button type="primary" :disabled="!mediaOpened || !roomId" @click="hangUp">Hangup</el-button>
    </el-button-group>
    <div>
      <span>{{ currentRoom }}</span>
    </div>
    <div id="videos">
      <video :srcObject="localVideo" muted autoplay playsinline></video>
      <video :srcObject="remoteVideo" autoplay playsinline></video>
    </div>
    <el-dialog v-model="dialogVisible" title="Join room" width="30%">
      <div class="dialog-form">
        <span>Enter ID for room to join:</span>
        <el-input v-model="roomId" />
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">Cancel</el-button>
          <el-button type="primary" @click="joinRoom">Join</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
#chat-body {
  background: #ECEFF1;
  color: rgba(0, 0, 0, 0.87);
  font-family: Roboto, Helvetica, Arial, sans-serif;
  padding: 0;
  margin: 1em;
}

@media (max-width: 600px) {

  #chat-body {
    margin-top: 0;
    background: white;
    box-shadow: none;
  }

  #chat-body {
    border-top: 16px solid #ffa100;
  }
}

button {
  margin: 0.2em 0.1em;
}

div#videos {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
}

div#videos>video {
  background: black;
  width: 640px;
  height: 100%;
  display: block;
  margin: 1em;
}

.dialog-form {
  display: flex;
  align-items: center;
}

.dialog-form>div {
  margin-left: 10px;
  width: 200px;
}
</style>
