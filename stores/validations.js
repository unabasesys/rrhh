import { defineStore } from 'pinia'

const useValidationStore = defineStore('validations', {
  state: () => ({
    showModalComment: false,
    validations: [],
  }),

  actions: {
    openModalComment() {
      this.showModalComment = true
    },
    closeModalComment() {
      this.showModalComment = false
    },
  },
})

export default useValidationStore
