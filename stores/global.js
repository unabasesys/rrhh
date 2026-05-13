// stores/global.js — stub mínimo standalone
import { defineStore } from 'pinia'

export default defineStore('global', {
  state: () => ({
    breadcrumb: [],
    title: '',
    namePage: '',
    loading: false,
    isDark: true,
    lang: 'es',
    organization: null,
    organizationId: null,
  }),
  actions: {
    updatedTitle(t) { this.title = t },
    updatedBreadcrumb(b) { this.breadcrumb = b },
    cleanHeader() { this.title = ''; this.breadcrumb = [] },
  },
})
