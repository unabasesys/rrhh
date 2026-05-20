/**
 * POST /api/auth/users
 * Crear nuevo usuario (solo Admin).
 */
import { requireDb, newId } from '@/server/utils/db'
import User from '@/server/models/User'

async function hashPassword(password) {
  const msgBuffer = new TextEncoder().encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export default defineEventHandler(async (event) => {
  requireDb(event)

  const { nombre, email, password, rol = 'viewer' } = await readBody(event)

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
    nombre: nombre.trim(),
    email:  email.toLowerCase().trim(),
    passwordHash,
    rol,
    activo: true,
  })

  await user.save()

  const { passwordHash: _, ...safeUser } = user.toObject()
  return { ok: true, user: safeUser }
})
