import { defineStore } from 'pinia'

/* ── localStorage key ──────────────────────────────────────────── */
const LS_ORGS = 'rrhh_orgs'

/* ── Helpers ───────────────────────────────────────────────────── */
function newOrgId() {
  return `org_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

/* ── Store ─────────────────────────────────────────────────────── */
export const useOrgStore = defineStore('org', {
  state: () => ({
    orgs:         [],
    initialized:  false,
  }),

  getters: {
    // Organización por ID
    getById: (s) => (id) => s.orgs.find(o => o.id === id) || null,

    // Solo orgs activas
    activeOrgs: (s) => s.orgs.filter(o => o.activo !== false),
  },

  actions: {
    /* ── Init ──────────────────────────────────────────────────── */
    init() {
      if (this.initialized) return
      this.initialized = true
      if (typeof localStorage === 'undefined') return
      try {
        this.orgs = JSON.parse(localStorage.getItem(LS_ORGS) || '[]')
      } catch {
        this.orgs = []
      }
    },

    /* ── CRUD ──────────────────────────────────────────────────── */
    createOrg({ nombre, rut, logo = null, direccion = '', comuna = '', ciudad = '', representanteLegal = null }) {
      const org = {
        id:                newOrgId(),
        nombre:            nombre?.trim() || '',
        rut:               rut?.trim() || '',
        logo,                              // base64 string o null
        direccion:         direccion?.trim() || '',
        comuna:            comuna?.trim() || '',
        ciudad:            ciudad?.trim() || '',
        representanteLegal: representanteLegal
          ? {
              nombre: representanteLegal.nombre?.trim() || '',
              rut:    representanteLegal.rut?.trim() || '',
            }
          : null,
        activo:    true,
        createdAt: new Date().toISOString(),
      }
      this.orgs.push(org)
      this._save()
      return { ok: true, org }
    },

    updateOrg(id, cambios) {
      const idx = this.orgs.findIndex(o => o.id === id)
      if (idx === -1) return { ok: false, message: 'Organización no encontrada' }

      this.orgs[idx] = {
        ...this.orgs[idx],
        ...cambios,
        updatedAt: new Date().toISOString(),
      }
      this._save()
      return { ok: true, org: this.orgs[idx] }
    },

    toggleOrg(id) {
      const org = this.orgs.find(o => o.id === id)
      if (!org) return { ok: false }
      org.activo = !org.activo
      this._save()
      return { ok: true, activo: org.activo }
    },

    deleteOrg(id) {
      this.orgs = this.orgs.filter(o => o.id !== id)
      this._save()
      return { ok: true }
    },

    /* ── Privado ───────────────────────────────────────────────── */
    _save() {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LS_ORGS, JSON.stringify(this.orgs))
      }
    },
  },
})
