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
  // admin = Soporte Unabase ("dios"). Acceso multi-org global.
  admin:   ['ver', 'editar', 'crear', 'eliminar', 'usuarios', 'configuracion', 'orgs', 'billing', 'admin_users'],
  // manager = administrador de una o más organizaciones del cliente.
  manager: ['ver', 'editar', 'crear', 'eliminar', 'usuarios'],
  // viewer = trabajador. Solo ve lo suyo en el portal.
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

    // ── Roles canónicos ──────────────────────────────────────────────────
    // admin   = Soporte Unabase. Acceso global. orgIds vacío = todas las orgs.
    // manager = Cliente que administra 1+ orgs.
    // viewer  = Trabajador. Solo ve sus datos en el portal.
    isAdmin:    (s) => s.user?.rol === ROLES.ADMIN,
    isManager:  (s) => s.user?.rol === ROLES.MANAGER,
    isViewer:   (s) => s.user?.rol === ROLES.VIEWER,

    // Compat: super-admin == admin global (multi-org). Se mantiene por
    // retrocompatibilidad con código que aún lo usa.
    isSuperAdmin: (s) => s.user?.rol === ROLES.ADMIN,

    // Lista de orgs a las que el usuario tiene acceso.
    //   - admin   → [] (vacío = TODAS, sin restricción)
    //   - manager → 1 o más
    //   - viewer  → exactamente 1
    accessibleOrgIds: (s) => {
      const u = s.user
      if (!u) return []
      if (Array.isArray(u.orgIds) && u.orgIds.length > 0) return u.orgIds
      // Fallback a orgId si orgIds no está cargado (sesiones viejas)
      return u.orgId ? [u.orgId] : []
    },

    // ── Capacidades específicas ──────────────────────────────────────────
    canManageOrgs:    (s) => s.user?.rol === ROLES.ADMIN,
    canManageBilling: (s) => s.user?.rol === ROLES.ADMIN,
    // Manager y admin pueden gestionar usuarios; viewer no.
    canManageUsers:   (s) => s.user?.rol === ROLES.ADMIN || s.user?.rol === ROLES.MANAGER,
    // Solo admin puede crear/editar otros admins.
    canManageAdmins:  (s) => s.user?.rol === ROLES.ADMIN,
    // Muestra el selector de org si el usuario tiene acceso a más de una
    // (o si es admin que puede saltar a cualquiera).
    canSwitchOrg: (s) => {
      if (s.user?.rol === ROLES.ADMIN) return true
      const list = Array.isArray(s.user?.orgIds) ? s.user.orgIds : []
      return list.length > 1
    },

    can: (s) => (permission) => (PERMISSIONS[s.user?.rol] || []).includes(permission),
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
        this.currentOrgId = data.user.orgId || (Array.isArray(data.user.orgIds) ? data.user.orgIds[0] : null)

        localStorage.setItem(LS_SESSION, JSON.stringify({
          token:         data.token,
          expires:       data.expires,
          currentOrgId:  this.currentOrgId,
          rol:           data.user.rol,             // cache para middleware
          trabajador_id: data.user.trabajador_id || null,
        }))

        return { ok: true }
      } catch (err) {
        const msg = err?.data?.message || err?.message || 'Credenciales incorrectas'
        return { ok: false, message: msg }
      }
    },

    /* ── Cambiar org activa ─────────────────────────────────────
     * admin   → puede saltar a cualquier org.
     * manager → solo entre las orgs en user.orgIds.
     * viewer  → no puede switch.
     */
    switchOrg(orgId) {
      if (this.isViewer) return { ok: false, message: 'Sin permiso' }
      if (this.isManager) {
        const list = Array.isArray(this.user?.orgIds) ? this.user.orgIds : []
        if (orgId && !list.includes(orgId)) {
          return { ok: false, message: 'No tienes acceso a esta organización' }
        }
      }
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

    async createUser(payload) {
      // payload puede incluir: nombre, email, password, rol, orgId, orgIds, trabajador_id
      try {
        return await $fetch('/api/auth/users', {
          method:  'POST',
          headers: { Authorization: `Bearer ${this.token}` },
          body:    payload,
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
