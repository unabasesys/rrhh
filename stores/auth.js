import { defineStore } from 'pinia'
export default defineStore('auth', {
  state: () => ({ access_token: 'local', user: null }),
})
