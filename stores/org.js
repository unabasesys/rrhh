import { defineStore } from 'pinia'

/* ── Normalizar objeto de org (API devuelve _id, nosotros usamos id) ────── */
function normalize(org) {
  if (!org) return null
  return { ...org, id: org._id || org.id }
}

/* ── Token Bearer desde localStorage (compat con auth store) ───────────── */
function authHeaders() {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem('rrhh_session')
    if (!raw) return {}
    const session = JSON.parse(raw)
    return session?.token ? { Authorization: `Bearer ${session.token}` } : {}
  } catch { return {} }
}

/* ── Store ─────────────────────────────────────────────────────────────── */
export const useOrgStore = defineStore('org', {
  state: () => ({
    orgs:        [],
    initialized: false,
    loading:     false,
  }),

  getters: {
    getById:    (s) => (id) => s.orgs.find(o => o.id === id) || null,
    activeOrgs: (s) => s.orgs.filter(o => o.activo !== false),
  },

  actions: {
    /* ── Init: carga orgs desde MongoDB ──────────────────────────────── */
    async init() {
      if (this.initialized) return
      if (!import.meta.client) return
      this.initialized = true
      await this.fetchOrgs()
    },

    async fetchOrgs() {
      try {
        this.loading = true
        const data = await $fetch('/api/orgs', { headers: authHeaders() })
        this.orgs = (data || []).map(normalize)
      } catch {
        this.orgs = []
      } finally {
        this.loading = false
      }
    },

    /* ── CRUD (llamadas a la API) ─────────────────────────────────────── */
    async createOrg({ nombre, rut, logo = null, direccion = '', comuna = '', ciudad = '', representanteLegal = null }) {
      const payload = {
        nombre:             nombre?.trim() || '',
        rut:                rut?.trim()    || '',
        logo,
        direccion:          direccion?.trim()  || '',
        comuna:             comuna?.trim()     || '',
        ciudad:             ciudad?.trim()     || '',
        representanteLegal: representanteLegal
          ? {
              nombre: representanteLegal.nombre?.trim() || '',
              rut:    representanteLegal.rut?.trim()    || '',
            }
          : null,
        activo: true,
      }
      try {
        const created = await $fetch('/api/orgs', { method: 'POST', body: payload, headers: authHeaders() })
        const org = normalize(created)
        this.orgs.push(org)
        return { ok: true, org }
      } catch (err) {
        return { ok: false, message: err?.data?.message || 'Error al crear organización' }
      }
    },

    async updateOrg(id, cambios) {
      try {
        const updated = await $fetch(`/api/orgs/${id}`, { method: 'PUT', body: cambios, headers: authHeaders() })
        const org = normalize(updated)
        const idx = this.orgs.findIndex(o => o.id === id)
        if (idx !== -1) this.orgs[idx] = org
        return { ok: true, org }
      } catch (err) {
        return { ok: false, message: err?.data?.message || 'Error al actualizar' }
      }
    },

    async toggleOrg(id) {
      const org = this.orgs.find(o => o.id === id)
      if (!org) return { ok: false }
      const nuevoActivo = !org.activo
      try {
        await $fetch(`/api/orgs/${id}`, { method: 'PUT', body: { activo: nuevoActivo }, headers: authHeaders() })
        org.activo = nuevoActivo
        return { ok: true, activo: nuevoActivo }
      } catch (err) {
        return { ok: false, message: err?.data?.message || 'Error al actualizar' }
      }
    },

    async deleteOrg(id) {
      try {
        await $fetch(`/api/orgs/${id}`, { method: 'DELETE', headers: authHeaders() })
        this.orgs = this.orgs.filter(o => o.id !== id)
        return { ok: true }
      } catch (err) {
        return { ok: false, message: err?.data?.message || 'Error al eliminar' }
      }
    },
  },
})
