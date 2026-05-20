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

/* ── Helpers ───────────────────────────────────────────────────── */

async function hashPassword(password) {
  const msgBuffer = new TextEncoder().encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function generateToken() {
  const arr = new Uint8Array(24)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

function newUserId() {
  return `u_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

/* ── localStorage keys ─────────────────────────────────────────── */
const LS_USERS   = 'rrhh_users'
const LS_SESSION = 'rrhh_session'

/* ── Store ─────────────────────────────────────────────────────── */

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user:           null,   // { id, nombre, email, rol, activo, orgId, esSuperAdmin }
    token:          null,
    currentOrgId:   null,   // org activa en sesión
    initialized:    false,
  }),

  getters: {
    isAuthenticated: (s) => !!s.user && !!s.token,
    isAdmin:         (s) => s.user?.rol === ROLES.ADMIN,

    // Super-admin: admin sin orgId asignado (accede a todas las orgs)
    isSuperAdmin: (s) => s.user?.esSuperAdmin === true || (s.user?.rol === ROLES.ADMIN && !s.user?.orgId),

    can: (s) => (permission) =>
      (PERMISSIONS[s.user?.rol] || []).includes(permission),
  },

  actions: {
    /* ── Inicializar ───────────────────────────────────────────── */
    async init() {
      if (this.initialized) return
      this.initialized = true

      await this._seedAdminIfEmpty()

      if (typeof localStorage === 'undefined') return
      const raw = localStorage.getItem(LS_SESSION)
      if (!raw) return
      try {
        const session = JSON.parse(raw)
        if (session.expires && Date.now() > session.expires) {
          localStorage.removeItem(LS_SESSION)
          return
        }
        const users = this._getUsers()
        const user  = users.find(u => u.id === session.userId)
        if (user && user.activo) {
          this.user         = _safeUser(user)
          this.token        = session.token
          this.currentOrgId = session.currentOrgId || user.orgId || null
        } else {
          localStorage.removeItem(LS_SESSION)
        }
      } catch {
        localStorage.removeItem(LS_SESSION)
      }
    },

    /* ── Login ─────────────────────────────────────────────────── */
    async login(email, password, remember = false) {
      const users = this._getUsers()
      const user  = users.find(u => u.email === email.toLowerCase())
      if (!user)        return { ok: false, message: 'Email no encontrado' }
      if (!user.activo) return { ok: false, message: 'Usuario desactivado' }

      const hash = await hashPassword(password)
      if (hash !== user.passwordHash)
        return { ok: false, message: 'Contraseña incorrecta' }

      const token   = generateToken()
      const expires = Date.now() + (remember ? 30 * 24 * 60 * 60 * 1000 : 8 * 60 * 60 * 1000)

      // currentOrgId: la org asignada al usuario, o null para super-admin
      const currentOrgId = user.orgId || null

      localStorage.setItem(LS_SESSION, JSON.stringify({
        token,
        userId:       user.id,
        currentOrgId,
        expires,
      }))

      this.user         = _safeUser(user)
      this.token        = token
      this.currentOrgId = currentOrgId
      return { ok: true }
    },

    /* ── Cambiar org activa (super-admin) ─────────────────────── */
    switchOrg(orgId) {
      if (!this.isSuperAdmin) return { ok: false, message: 'Sin permiso' }
      this.currentOrgId = orgId

      // Persistir en sesión
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(LS_SESSION)
        if (raw) {
          try {
            const session = JSON.parse(raw)
            session.currentOrgId = orgId
            localStorage.setItem(LS_SESSION, JSON.stringify(session))
          } catch { /* noop */ }
        }
      }
      return { ok: true }
    },

    /* ── Logout ────────────────────────────────────────────────── */
    logout() {
      localStorage.removeItem(LS_SESSION)
      this.user         = null
      this.token        = null
      this.currentOrgId = null
      return navigateTo('/login')
    },

    /* ── CRUD Usuarios ──────────────────────────────────────────── */
    getUsers(orgId = undefined) {
      const all = this._getUsers().map(_safeUser)
      if (orgId === undefined) return all
      // Filtrar por org si se especifica (null = super-admins)
      return all.filter(u => u.orgId === orgId)
    },

    async createUser({ nombre, email, password, rol, orgId = null }) {
      const users = this._getUsers()
      if (users.find(u => u.email === email.toLowerCase()))
        return { ok: false, message: 'Email ya registrado' }

      const passwordHash = await hashPassword(password)
      const newUser = {
        id:           newUserId(),
        nombre:       nombre.trim(),
        email:        email.toLowerCase().trim(),
        passwordHash,
        rol:          rol || ROLES.VIEWER,
        orgId:        orgId || null,
        esSuperAdmin: false,
        activo:       true,
        createdAt:    new Date().toISOString(),
      }
      users.push(newUser)
      this._saveUsers(users)
      return { ok: true, user: _safeUser(newUser) }
    },

    async updateUser(id, cambios) {
      const users = this._getUsers()
      const idx   = users.findIndex(u => u.id === id)
      if (idx === -1) return { ok: false, message: 'Usuario no encontrado' }

      if (cambios.email) {
        const dup = users.find(u => u.email === cambios.email.toLowerCase() && u.id !== id)
        if (dup) return { ok: false, message: 'Email ya registrado' }
        cambios.email = cambios.email.toLowerCase().trim()
      }

      users[idx] = { ...users[idx], ...cambios, updatedAt: new Date().toISOString() }
      this._saveUsers(users)

      if (this.user?.id === id) {
        this.user = _safeUser(users[idx])
      }
      return { ok: true, user: _safeUser(users[idx]) }
    },

    async changePassword(id, newPassword) {
      const users = this._getUsers()
      const idx   = users.findIndex(u => u.id === id)
      if (idx === -1) return { ok: false, message: 'Usuario no encontrado' }

      users[idx].passwordHash = await hashPassword(newPassword)
      users[idx].updatedAt    = new Date().toISOString()
      this._saveUsers(users)
      return { ok: true }
    },

    toggleUser(id) {
      const users = this._getUsers()
      const user  = users.find(u => u.id === id)
      if (!user) return { ok: false }

      if (user.rol === ROLES.ADMIN && user.activo) {
        const adminCount = users.filter(u => u.rol === ROLES.ADMIN && u.activo).length
        if (adminCount <= 1) return { ok: false, message: 'Debe haber al menos un admin activo' }
      }

      user.activo = !user.activo
      this._saveUsers(users)
      return { ok: true, activo: user.activo }
    },

    deleteUser(id) {
      const users = this._getUsers()
      const user  = users.find(u => u.id === id)
      if (!user) return { ok: false }

      if (user.rol === ROLES.ADMIN) {
        const adminCount = users.filter(u => u.rol === ROLES.ADMIN).length
        if (adminCount <= 1) return { ok: false, message: 'No puedes eliminar al único administrador' }
      }

      this._saveUsers(users.filter(u => u.id !== id))
      return { ok: true }
    },

    /* ── Privados ───────────────────────────────────────────────── */
    _getUsers() {
      if (typeof localStorage === 'undefined') return []
      try { return JSON.parse(localStorage.getItem(LS_USERS) || '[]') } catch { return [] }
    },

    _saveUsers(users) {
      localStorage.setItem(LS_USERS, JSON.stringify(users))
    },

    async _seedAdminIfEmpty() {
      if (typeof localStorage === 'undefined') return
      const users = this._getUsers()
      if (users.length > 0) return

      const passwordHash = await hashPassword('Admin1234!')
      this._saveUsers([{
        id:           newUserId(),
        nombre:       'Administrador',
        email:        'admin@rrhh.cl',
        passwordHash,
        rol:          ROLES.ADMIN,
        orgId:        null,       // super-admin: sin org asignada
        esSuperAdmin: true,
        activo:       true,
        createdAt:    new Date().toISOString(),
      }])
    },
  },
})

/* ── Helper: usuario sin hash ──────────────────────────────────── */
function _safeUser(u) {
  const { passwordHash, ...safe } = u
  return safe
}
