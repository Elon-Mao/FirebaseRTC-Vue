<script setup lang="ts">
import { signInWithPopup } from 'firebase/auth'
import { auth, provider } from '@/config/firebase'

const signInWithGoogle = () => {
  signInWithPopup(auth, provider)
}
</script>

<template>
  <el-button @click="signInWithGoogle">Sign In With Google</el-button>
</template>

<style scoped>
</style>
