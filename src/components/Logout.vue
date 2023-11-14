<script setup lang="ts">
import { signOut } from 'firebase/auth'
import { auth } from '@/config/firebase'

const logout = () => {
  signOut(auth)
}
</script>

<template>
  <el-button style="margin-left: 10px;" @click="logout">Logout</el-button>
</template>

<style scoped>
</style>
