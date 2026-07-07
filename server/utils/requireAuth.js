/**
 * server/utils/requireAuth.js
 * Helpers de autenticación y autorización para los handlers Nitro.
 *
 * Roles:
 *   - admin   = Soporte Unabase. Acceso multi-org global. orgIds == [].
 *   - manager = Administrador de una o más orgs del cliente. orgIds == [...].
 *   - viewer  = Trabajador. Solo ve sus datos en el portal. orgIds == [orgX].
 */
import User from '../models/User.js'

/**
 * Verifica el token Bearer y devuelve el usuario.
 * `requiredRole` puede ser 'admin' | 'manager' | 'viewer' o array.
 * - Si es 'admin', el usuario DEBE ser admin.
 * - Si es 'manager', acepta admin o manager (admin >= manager).
 * - Si es array, acepta cualquier rol incluido.
 */
/**
 * Resuelve el usuario a partir del Bearer token. Devuelve el user (lean, sin
 * passwordHash) o null si el token falta/expiró/usuario desactivado.
 * Extraído para que el middleware global y requireAuth compartan la lógica.
 */
export async function resolveUserFromToken(event) {
  const authHeader = getHeader(event, 'authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const user = await User.findOne(
    { token, tokenExpires: { $gt: new Date() } },
    { passwordHash: 0 }
  ).lean()
  if (!user || !user.activo) return null
  return user
}

export async function requireAuth(event, requiredRole = null) {
  // Reusar el usuario ya validado por el middleware global (evita doble query).
  let user = event.context?.authUser || null

  if (!user) {
    const authHeader = getHeader(event, 'authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) {
      throw createError({ statusCode: 401, message: 'No autenticado' })
    }
    user = await User.findOne(
      { token, tokenExpires: { $gt: new Date() } },
      { passwordHash: 0 }
    ).lean()
    if (!user) {
      throw createError({ statusCode: 401, message: 'Sesión inválida o expirada' })
    }
    if (!user.activo) {
      throw createError({ statusCode: 403, message: 'Usuario desactivado' })
    }
  }

  if (requiredRole) {
    if (Array.isArray(requiredRole)) {
      if (!requiredRole.includes(user.rol)) {
        throw createError({ statusCode: 403, message: `Rol requerido: ${requiredRole.join(' o ')}` })
      }
    } else if (requiredRole === 'admin' && user.rol !== 'admin') {
      throw createError({ statusCode: 403, message: 'Se requiere rol Admin' })
    } else if (requiredRole === 'manager' && !(user.rol === 'admin' || user.rol === 'manager')) {
      throw createError({ statusCode: 403, message: 'Se requiere rol Manager o superior' })
    } else if (requiredRole === 'viewer' && !user.rol) {
      throw createError({ statusCode: 403, message: 'Sesión inválida' })
    }
  }

  return user
}

/** Atajo: requireAuth con rol admin. */
export async function requireAdmin(event) {
  return requireAuth(event, 'admin')
}

/** Atajo: requireAuth con rol manager o superior (admin también vale). */
export async function requireManager(event) {
  return requireAuth(event, 'manager')
}

/**
 * Verifica que `user` tenga acceso a `orgId`.
 * - admin: siempre OK (acceso global).
 * - manager: orgId debe estar en user.orgIds.
 * - viewer: orgId debe coincidir con su única org.
 * Lanza 403 si no tiene acceso. Si orgId es null/undefined, no valida nada.
 */
export function requireOrgAccess(user, orgId) {
  if (!orgId) return  // sin filtro de org, no aplica
  if (user.rol === 'admin') return  // admin = acceso global
  const list = Array.isArray(user.orgIds) ? user.orgIds : (user.orgId ? [user.orgId] : [])
  if (!list.includes(orgId)) {
    throw createError({ statusCode: 403, message: 'Sin acceso a esta organización' })
  }
}

/**
 * Devuelve un filtro Mongo {orgId: ...} apropiado para el usuario.
 *   - admin: no filtra (devuelve {})
 *   - manager: filtra por orgIds (uno o varios)
 *   - viewer: filtra por su única org
 * Si `requestedOrgId` viene como query param, valida acceso y lo usa.
 */
export function orgScopeFilter(user, requestedOrgId = null) {
  if (user.rol === 'admin') {
    if (requestedOrgId) return { orgId: requestedOrgId }
    return {}  // admin sin filtro = ver todo
  }
  const list = Array.isArray(user.orgIds) ? user.orgIds : (user.orgId ? [user.orgId] : [])
  if (requestedOrgId) {
    if (!list.includes(requestedOrgId)) {
      throw createError({ statusCode: 403, message: 'Sin acceso a esta organización' })
    }
    return { orgId: requestedOrgId }
  }
  if (list.length === 1) return { orgId: list[0] }
  if (list.length > 1)  return { orgId: { $in: list } }
  // Sin orgs (manager/viewer mal configurado): no devolver nada
  return { orgId: '__no_access__' }
}
