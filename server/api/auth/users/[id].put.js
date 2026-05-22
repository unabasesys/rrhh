/**
 * PUT /api/auth/users/:id
 * Actualizar usuario.
 *   - admin   → puede editar cualquier usuario incluyendo otros admins.
 *   - manager → solo usuarios que estén en sus orgIds y no sean admin.
 *               No puede promover a admin.
 */
import { requireDb } from '../../../utils/db.js'
import { requireManager } from '../../../utils/requireAuth.js'
import User from '../../../models/User.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const me = await requireManager(event)

  const id      = getRouterParam(event, 'id')
  const cambios = await readBody(event)

  const user = await User.findById(id)
  if (!user) throw createError({ statusCode: 404, message: 'Usuario no encontrado' })

  // ── Permisos de manager ──────────────────────────────────────────────
  if (me.rol === 'manager') {
    if (user.rol === 'admin') {
      throw createError({ statusCode: 403, message: 'No puedes editar a un administrador' })
    }
    const myOrgs = Array.isArray(me.orgIds) ? me.orgIds : (me.orgId ? [me.orgId] : [])
    const userOrgs = Array.isArray(user.orgIds) ? user.orgIds : (user.orgId ? [user.orgId] : [])
    const overlap = userOrgs.some(o => myOrgs.includes(o))
    if (!overlap) {
      throw createError({ statusCode: 403, message: 'Sin acceso a este usuario' })
    }
    if (cambios.rol === 'admin') {
      throw createError({ statusCode: 403, message: 'Solo el administrador global puede crear admins' })
    }
    // Manager solo puede asignar orgs propias.
    if (Array.isArray(cambios.orgIds)) {
      const invalid = cambios.orgIds.filter(o => !myOrgs.includes(o))
      if (invalid.length) {
        throw createError({ statusCode: 403, message: 'No puedes asignar orgs que no administras' })
      }
    }
  }

  if (cambios.email) {
    const dup = await User.findOne({ email: cambios.email.toLowerCase().trim(), _id: { $ne: id } })
    if (dup) throw createError({ statusCode: 409, message: 'Email ya registrado' })
    user.email = cambios.email.toLowerCase().trim()
  }
  if (cambios.nombre)     user.nombre = cambios.nombre.trim()
  if (cambios.rol)        user.rol    = cambios.rol
  if ('orgId' in cambios) user.orgId  = cambios.orgId || null
  if (Array.isArray(cambios.orgIds)) user.orgIds = cambios.orgIds
  if ('trabajador_id' in cambios) user.trabajador_id = cambios.trabajador_id || null

  // Mantener coherencia: admin global => orgIds=[], esSuperAdmin=true
  if (user.rol === 'admin') {
    user.orgIds = []
    user.orgId  = null
    user.esSuperAdmin = true
  } else {
    user.esSuperAdmin = false
    if ((!user.orgIds || !user.orgIds.length) && user.orgId) {
      user.orgIds = [user.orgId]
    }
  }

  await user.save()

  const { passwordHash: _, token: _t, tokenExpires: _te, ...safeUser } = user.toObject()
  return { ok: true, user: safeUser }
})
