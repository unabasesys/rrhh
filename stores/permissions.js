import { defineStore } from 'pinia'
export default defineStore('permissions', {
  state: () => ({}),
  getters: { can: () => () => true },
})
