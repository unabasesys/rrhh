import { defineStore } from 'pinia'

export const ROLES = {
  ADMIN:   'admin',
  MANAGER: 'manager',
  VIEWER:  'viewer',
}

export const ROLE_LABELS = {
  admin:   'Administrador',
  manager: 'Manager',
  viewer:  'Visualizador',
}

export const ROLE_COLORS = {
  admin:   '#2a9d8f',
  manager: '#3b82f6',
  viewer:  '#6b7280',
}

const PERMISSIONS = {
  admin:   ['ver', 'editar', 'crear', 'eliminar', 'usuarios', 'configuracion'],
  manager: ['ver', 'editar', 'crear'],
  viewer:  ['ver'],
}

/* ── localStorage key ──────────────────────────────────────────── */
const LS_SESSION = 'rrhh_session'

/* ── Store ─────────────────────────────────────────────────────── */

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user:           null,   // { _id, nombre, email, rol, activo, orgId, esSuperAdmin }
    token:          null,
    currentOrgId:   null,
    initialized:    false,
  }),

  getters: {
    isAuthenticated: (s) => !!s.user && !!s.token,
    isAdmin:         (s) => s.user?.rol === ROLES.ADMIN,
    isSuperAdmin:    (s) => s.user?.esSuperAdmin === true || (s.user?.rol === ROLES.ADMIN && !s.user?.orgId),
    can:             (s) => (permission) => (PERMISSIONS[s.user?.rol] || []).includes(permission),
  },

  actions: {
    /* ── Inicializar (restaurar sesión desde localStorage) ─────── */
    async init() {
      if (!import.meta.client) return

      // Si ya hay sesión en memoria, no hacer nada
      if (this.user && this.token) {
        this.initialized = true
        return
      }

      const raw = localStorage.getItem(LS_SESSION)
      if (!raw) {
        this.initialized = true
        return
      }

      try {
        const session = JSON.parse(raw)
        if (!session.token || !session.expires || Date.now() > session.expires) {
          localStorage.removeItem(LS_SESSION)
          this.initialized = true
          return
        }

        // Verificar token con el servidor
        const data = await $fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${session.token}` },
        }).catch(() => null)

        if (data?.ok && data.user) {
          this.user         = data.user
          this.token        = session.token
          this.currentOrgId = session.currentOrgId || data.user.orgId || null
        } else {
          localStorage.removeItem(LS_SESSION)
        }
      } catch {
        localStorage.removeItem(LS_SESSION)
      }

      this.initialized = true
    },

    /* ── Login ─────────────────────────────────────────────────── */
    async login(email, password, remember = false) {
      try {
        const data = await $fetch('/api/auth/login', {
          method: 'POST',
          body:   { email, password, remember },
        })

        if (!data?.ok) return { ok: false, message: data?.message || 'Error desconocido' }

        this.user         = data.user
        this.token        = data.token
        this.currentOrgId = data.user.orgId || null

        localStorage.setItem(LS_SESSION, JSON.stringify({
          token:        data.token,
          expires:      data.expires,
          currentOrgId: data.user.orgId || null,
        }))

        return { ok: true }
      } catch (err) {
        const msg = err?.data?.message || err?.message || 'Credenciales incorrectas'
        return { ok: false, message: msg }
      }
    },

    /* ── Cambiar org activa (super-admin) ─────────────────────── */
    switchOrg(orgId) {
      if (!this.isSuperAdmin) return { ok: false, message: 'Sin permiso' }
      this.currentOrgId = orgId
      if (typeof localStorage !== 'undefined') {
        try {
          const raw = localStorage.getItem(LS_SESSION)
          if (raw) {
            const session = JSON.parse(raw)
            session.currentOrgId = orgId
            localStorage.setItem(LS_SESSION, JSON.stringify(session))
          }
        } catch { /* noop */ }
      }
      return { ok: true }
    },

    /* ── Logout ────────────────────────────────────────────────── */
    async logout() {
      if (this.token) {
        await $fetch('/api/auth/logout', {
          method:  'POST',
          headers: { Authorization: `Bearer ${this.token}` },
        }).catch(() => {})
      }
      localStorage.removeItem(LS_SESSION)
      this.user         = null
      this.token        = null
      this.currentOrgId = null
      return navigateTo('/login')
    },

    /* ── CRUD Usuarios (llamadas a la API) ──────────────────────── */
    async getUsers() {
      if (!this.token) return []
      try {
        return await $fetch('/api/auth/users', {
          headers: { Authorization: `Bearer ${this.token}` },
        })
      } catch { return [] }
    },

    async createUser({ nombre, email, password, rol, orgId = null }) {
      try {
        return await $fetch('/api/auth/users', {
          method:  'POST',
          headers: { Authorization: `Bearer ${this.token}` },
          body:    { nombre, email, password, rol, orgId },
        })
      } catch (err) {
        return { ok: false, message: err?.data?.message || 'Error al crear usuario' }
      }
    },

    async updateUser(id, cambios) {
      try {
        return await $fetch(`/api/auth/users/${id}`, {
          method:  'PUT',
          headers: { Authorization: `Bearer ${this.token}` },
          body:    cambios,
        })
      } catch (err) {
        return { ok: false, message: err?.data?.message || 'Error al actualizar' }
      }
    },

    async changePassword(id, newPassword) {
      try {
        return await $fetch(`/api/auth/users/${id}`, {
          method:  'PATCH',
          headers: { Authorization: `Bearer ${this.token}` },
          body:    { action: 'password', password: newPassword },
        })
      } catch (err) {
        return { ok: false, message: err?.data?.message || 'Error al cambiar contraseña' }
      }
    },

    async toggleUser(id) {
      try {
        return await $fetch(`/api/auth/users/${id}`, {
          method:  'PATCH',
          headers: { Authorization: `Bearer ${this.token}` },
          body:    { action: 'toggle' },
        })
      } catch (err) {
        return { ok: false, message: err?.data?.message || 'Error al cambiar estado' }
      }
    },

    async deleteUser(id) {
      try {
        return await $fetch(`/api/auth/users/${id}`, {
          method:  'DELETE',
          headers: { Authorization: `Bearer ${this.token}` },
        })
      } catch (err) {
        return { ok: false, message: err?.data?.message || 'Error al eliminar' }
      }
    },
  },
})

export default useAuthStore
