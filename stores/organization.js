import { defineStore } from 'pinia'
export default defineStore('organization', {
  state: () => ({ name: 'Mi Empresa', rut: '', address: '', logoBase64: null }),
})
