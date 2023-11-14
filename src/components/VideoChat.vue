<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { collection, doc, addDoc, getDoc, updateDoc, onSnapshot, DocumentData, DocumentReference } from 'firebase/firestore'
import { db } from '@/config/firebase'
import * as mdc from 'material-components-web'
import 'material-components-web/dist/material-components-web.css'

const cameraBtn = ref<HTMLButtonElement | null>(null)
const confirmJoinBtn = ref<HTMLButtonElement | null>(null)
const roomDialogRef = ref<HTMLDivElement | null>(null)
const createBtnDisabled = ref(true)
const joinBtnDisabled = ref(true)
const hangupBtnDisabled = ref(true)
const currentRoom = ref('')
const localVideo = ref<MediaStream | null>(null)
const remoteVideo = ref<MediaStream | null>(null)
const roomId = ref<string | null>(null)
let roomRef: DocumentReference<DocumentData, DocumentData> | null = null

onMounted(() => {
  mdc.ripple.MDCRipple.attachTo(cameraBtn.value!)
  roomDialog = new mdc.dialog.MDCDialog(roomDialogRef.value!)
})

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

let peerConnection: RTCPeerConnection | null = null
let roomDialog: mdc.dialog.MDCDialog | null = null

async function collectIceCandidates(localName: string, remoteName: string) {
  const candidatesCollection = collection(roomRef!, localName)
  const remoteCollection = collection(roomRef!, remoteName)

  peerConnection!.addEventListener('icecandidate', event => {
    if (event.candidate) {
      const json = event.candidate.toJSON()
      addDoc(candidatesCollection, json)
    }
  })

  // ;(await getDocs(remoteCollection)).forEach((doc) => {
  //   const candidate = new RTCIceCandidate(doc.data())
  //   debugger
  //   peerConnection!.addIceCandidate(candidate)
  // })
  onSnapshot(remoteCollection, async (snapshot) => {
    snapshot.docChanges().forEach(change => {
      console.log('remote change,', change)
      if (change.type === "added") {
        const candidate = new RTCIceCandidate(change.doc.data())
        peerConnection!.addIceCandidate(candidate)
      }
    })
  })
}

async function createRoom() {
  createBtnDisabled.value = true
  joinBtnDisabled.value = true

  roomRef = await addDoc(collection(db, "rooms"), {})
  roomId.value = roomRef.id
  currentRoom.value = `Current room is ${roomId.value} - You are the caller!`

  console.log('Create PeerConnection with configuration: ', configuration)
  peerConnection = new RTCPeerConnection(configuration)

  registerPeerConnectionListeners()
  collectIceCandidates('callerCandidates', 'calleeCandidates')

  localVideo.value!.getTracks().forEach(track => {
    peerConnection!.addTrack(track, localVideo.value!)
  })

  const offer = await peerConnection.createOffer({
    offerToReceiveAudio: true,
    offerToReceiveVideo: true
  })
  await peerConnection.setLocalDescription(offer)

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
    if (!peerConnection!.currentRemoteDescription && data!.answer) {
      console.log('Set remote description: ', data!.answer)
      const answer = new RTCSessionDescription(data!.answer)
      await peerConnection!.setRemoteDescription(answer)
      // localVideo.value!.getTracks().forEach(track => {
      //   peerConnection!.addTrack(track, localVideo.value!)
      // })
    }
  })

  // Code for creating room above

  // Code for creating a room below

  // Code for creating a room above

  // Code for collecting ICE candidates below

  // Code for collecting ICE candidates above

  peerConnection.addEventListener('track', event => {
    console.log('Got remote track:', event.streams[0])
    event.streams[0].getTracks().forEach(track => {
      console.log('Add a track to the remoteStream:', track)
      remoteVideo.value!.addTrack(track)
    })
  })

  // Listening for remote session description below

  // Listening for remote session description above

  // Listen for remote ICE candidates below

  // Listen for remote ICE candidates above
}

function joinRoom() {
  createBtnDisabled.value = true
  joinBtnDisabled.value = true

  confirmJoinBtn.value!.addEventListener('click', async () => {
    console.log('Join room: ', roomId.value)
    currentRoom.value = `Current room is ${roomId.value} - You are the callee!`
    await joinRoomById()
  }, { once: true })
  roomDialog!.open()
}

async function joinRoomById() {
  roomRef = doc(db, 'rooms', `${roomId.value}`)
  const roomSnapshot = await getDoc(roomRef)
  console.log('Got room:', roomSnapshot.exists)

  if (roomSnapshot.exists()) {
    console.log('Create PeerConnection with configuration: ', configuration)
    peerConnection = new RTCPeerConnection(configuration)
    registerPeerConnectionListeners()
    collectIceCandidates('calleeCandidates', 'callerCandidates')
    localVideo.value!.getTracks().forEach(track => {
      peerConnection!.addTrack(track, localVideo.value!)
    })

    // Code for collecting ICE candidates below

    // Code for collecting ICE candidates above
    peerConnection.addEventListener('track', event => {
      console.log('Got remote track:', event.streams[0])
      event.streams[0].getTracks().forEach(track => {
        console.log('Add a track to the remoteStream:', track)
        remoteVideo.value!.addTrack(track)
      })
    })

    // Code for creating SDP answer below
    const offer = roomSnapshot.data().offer
    await peerConnection.setRemoteDescription(offer)
    const answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer)

    const roomWithAnswer = {
      answer: {
        type: answer.type,
        sdp: answer.sdp
      }
    }
    await updateDoc(roomRef, roomWithAnswer)
    // Code for creating SDP answer above

    // Listening for remote ICE candidates below

    // Listening for remote ICE candidates above
  }
}

async function openUserMedia() {
  localVideo.value = await navigator.mediaDevices.getUserMedia({ video: true, audio: { 'echoCancellation': true } })
  remoteVideo.value = new MediaStream()

  console.log('Stream:', localVideo.value)
  cameraBtn.value!.disabled = true
  joinBtnDisabled.value = false
  createBtnDisabled.value = false
  hangupBtnDisabled.value = false
}

async function hangUp() {
  const tracks = localVideo.value!.getTracks()
  tracks.forEach(track => {
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
  cameraBtn.value!.disabled = false
  joinBtnDisabled.value = true
  createBtnDisabled.value = true
  hangupBtnDisabled.value = true
  currentRoom.value = ''

  // Delete room on hangup
  if (roomId.value) {
    // const roomRef = db.collection('rooms').doc(roomId.value)
    // const calleeCandidates = await roomRef.collection('calleeCandidates').get()
    // calleeCandidates.forEach(async candidate => {
    //   await candidate.delete()
    // })
    // const callerCandidates = await roomRef.collection('callerCandidates').get()
    // callerCandidates.forEach(async candidate => {
    //   await candidate.delete()
    // })
    // await roomRef.delete()
  }

  document.location.reload()
}

function registerPeerConnectionListeners() {
  peerConnection!.addEventListener('icegatheringstatechange', () => {
    console.log(
      `ICE gathering state changed: ${peerConnection!.iceGatheringState}`)
  })

  peerConnection!.addEventListener('connectionstatechange', () => {
    console.log(`Connection state change: ${peerConnection!.connectionState}`)
  })

  peerConnection!.addEventListener('signalingstatechange', () => {
    console.log(`Signaling state change: ${peerConnection!.signalingState}`)
  })

  peerConnection!.addEventListener('iceconnectionstatechange ', () => {
    console.log(
      `ICE connection state change: ${peerConnection!.iceConnectionState}`)
  })
}
</script>

<template>
  <div id="chat-body">
    <h1>Welcome to FirebaseRTC!</h1>
    <div id="buttons">
      <button ref="cameraBtn" class="mdc-button mdc-button--raised" @click="openUserMedia">
        <i class="material-icons mdc-button__icon" aria-hidden="true">perm_camera_mic</i>
        <span class="mdc-button__label">Open camera & microphone</span>
      </button>
      <button class="mdc-button mdc-button--raised" :disabled="createBtnDisabled" @click="createRoom">
        <i class="material-icons mdc-button__icon" aria-hidden="true">group_add</i>
        <span class="mdc-button__label">Create room</span>
      </button>
      <button class="mdc-button mdc-button--raised" :disabled="joinBtnDisabled" @click="joinRoom">
        <i class="material-icons mdc-button__icon" aria-hidden="true">group</i>
        <span class="mdc-button__label">Join room</span>
      </button>
      <button class="mdc-button mdc-button--raised" :disabled="hangupBtnDisabled" @click="hangUp">
        <i class="material-icons mdc-button__icon" aria-hidden="true">close</i>
        <span class="mdc-button__label">Hangup</span>
      </button>
    </div>
    <div>
      <span>{{ currentRoom }}</span>
    </div>
    <div id="videos">
      <video :srcObject="localVideo" muted autoplay playsinline></video>
      <video :srcObject="remoteVideo" autoplay playsinline></video>
    </div>
    <div ref="roomDialogRef" class="mdc-dialog" role="alertdialog" aria-modal="true" aria-labelledby="my-dialog-title"
      aria-describedby="my-dialog-content">
      <div class="mdc-dialog__container">
        <div class="mdc-dialog__surface">
          <h2 class="mdc-dialog__title" id="my-dialog-title">Join room</h2>
          <div class="mdc-dialog__content" id="my-dialog-content">
            Enter ID for room to join:
            <div class="mdc-text-field">
              <input type="text" v-model="roomId" class="mdc-text-field__input">
              <label class="mdc-floating-label" for="my-text-field">Room ID</label>
              <div class="mdc-line-ripple"></div>
            </div>
          </div>
          <footer class="mdc-dialog__actions">
            <button type="button" class="mdc-button mdc-dialog__button" data-mdc-dialog-action="no">
              <span class="mdc-button__label">Cancel</span>
            </button>
            <button ref="confirmJoinBtn" type="button" class="mdc-button mdc-dialog__button" data-mdc-dialog-action="yes">
              <span class="mdc-button__label">Join</span>
            </button>
          </footer>
        </div>
      </div>
      <div class="mdc-dialog__scrim"></div>
    </div>
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

#message {
  background: white;
  max-width: 360px;
  margin: 100px auto 16px;
  padding: 32px 24px;
  border-radius: 3px;
}

#message h2 {
  color: #ffa100;
  font-weight: bold;
  font-size: 16px;
  margin: 0 0 8px;
}

#message h1 {
  font-size: 22px;
  font-weight: 300;
  color: rgba(0, 0, 0, 0.6);
  margin: 0 0 16px;
}

#message p {
  line-height: 140%;
  margin: 16px 0 24px;
  font-size: 14px;
}

#message a {
  display: block;
  text-align: center;
  background: #039be5;
  text-transform: uppercase;
  text-decoration: none;
  color: white;
  padding: 16px;
  border-radius: 4px;
}

#message,
#message a {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24);
}

#load {
  color: rgba(0, 0, 0, 0.4);
  text-align: center;
  font-size: 13px;
}

@media (max-width: 600px) {

  #chat-body,
  #message {
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

#buttons i {
  display: none;
}
</style>
