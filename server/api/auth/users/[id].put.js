/**
 * PUT /api/auth/users/:id
 * Actualizar nombre, email, rol u orgId de un usuario — requiere admin.
 */
import { requireDb } from '../../../utils/db.js'
import { requireAuth } from '../../../utils/requireAuth.js'
import User from '../../../models/User.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  await requireAuth(event, 'admin')

  const id      = getRouterParam(event, 'id')
  const cambios = await readBody(event)

  const user = await User.findById(id)
  if (!user) throw createError({ statusCode: 404, message: 'Usuario no encontrado' })

  if (cambios.email) {
    const dup = await User.findOne({ email: cambios.email.toLowerCase().trim(), _id: { $ne: id } })
    if (dup) throw createError({ statusCode: 409, message: 'Email ya registrado' })
    user.email = cambios.email.toLowerCase().trim()
  }
  if (cambios.nombre)  user.nombre  = cambios.nombre.trim()
  if (cambios.rol)     user.rol     = cambios.rol
  if ('orgId' in cambios) user.orgId = cambios.orgId || null

  await user.save()

  const { passwordHash: _, token: _t, tokenExpires: _te, ...safeUser } = user.toObject()
  return { ok: true, user: safeUser }
})
