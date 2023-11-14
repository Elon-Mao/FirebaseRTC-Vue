import { defineStore } from 'pinia'
import { User } from 'firebase/auth'
import { auth } from '@/config/firebase'

export const useUserStore = defineStore('user', {
  state: () => {
    return {
      user: auth.currentUser
    }
  },
  actions: {
    setUser(user: User | null) {
      this.user = user
    }
  },
})