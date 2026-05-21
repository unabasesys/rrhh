/**
 * POST /api/auth/users
 * Crear nuevo usuario — requiere ser admin.
 */
import { requireDb, newId } from '../../utils/db.js'
import { requireAuth } from '../../utils/requireAuth.js'
import User from '../../models/User.js'

async function hashPassword(password) {
  const msgBuffer = new TextEncoder().encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export default defineEventHandler(async (event) => {
  requireDb(event)
  await requireAuth(event, 'admin')

  const { nombre, email, password, rol = 'viewer', orgId = null } = await readBody(event)

  if (!nombre || !email || !password) {
    throw createError({ statusCode: 400, message: 'Faltan campos requeridos' })
  }

  const exists = await User.findOne({ email: email.toLowerCase().trim() })
  if (exists) {
    throw createError({ statusCode: 409, message: 'Email ya registrado' })
  }

  const passwordHash = await hashPassword(password)
  const user = new User({
    _id:  newId('u'),
    nombre:       nombre.trim(),
    email:        email.toLowerCase().trim(),
    passwordHash,
    rol,
    orgId:        orgId || null,
    esSuperAdmin: false,
    activo:       true,
  })

  await user.save()

  const { passwordHash: _, token: _t, tokenExpires: _te, ...safeUser } = user.toObject()
  return { ok: true, user: safeUser }
})
