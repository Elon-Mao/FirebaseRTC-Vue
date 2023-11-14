<script setup lang="ts">
import { onAuthStateChanged } from 'firebase/auth'
import VideoChat from '@/components/VideoChat.vue'
import Login from '@/components/Login.vue'
import Logout from '@/components/Logout.vue'
import { useUserStore } from '@/stores/user'
import { auth } from '@/config/firebase'

const userStore = useUserStore()
onAuthStateChanged(auth, (user) => {
  userStore.setUser(user)
})

</script>

<template>
  <el-container class="app-container">
    <el-header class="app-header">
      <template v-if="userStore.user">
        <p>{{ userStore.user?.displayName }}</p>
        <Logout></Logout>
      </template>
      <template v-else>
        <Login />
      </template>
    </el-header>
    <el-main class="app-main">
      <template v-if="userStore.user">
        <VideoChat></VideoChat>
      </template>
      <template v-else>
        <h1>Sign In to chat</h1>
      </template>
    </el-main>
  </el-container>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.app-main {
  height: 100vh;
}
</style>
