/**
 * PATCH /api/auth/users/:id
 * Operaciones parciales: toggle activo o cambio de contraseña.
 * Body: { action: 'toggle' | 'password', password?: string }
 */
import { requireDb } from '../../../utils/db.js'
import { requireAuth } from '../../../utils/requireAuth.js'
import User from '../../../models/User.js'

async function hashPassword(password) {
  const msgBuffer = new TextEncoder().encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export default defineEventHandler(async (event) => {
  requireDb(event)
  const me = await requireAuth(event, 'admin')

  const id     = getRouterParam(event, 'id')
  const body   = await readBody(event)
  const action = body?.action

  const user = await User.findById(id)
  if (!user) throw createError({ statusCode: 404, message: 'Usuario no encontrado' })

  if (action === 'toggle') {
    // No puedes desactivarte a ti mismo
    if (user._id === me._id) {
      throw createError({ statusCode: 400, message: 'No puedes desactivarte a ti mismo' })
    }
    // Debe haber al menos un admin activo
    if (user.rol === 'admin' && user.activo) {
      const activeAdmins = await User.countDocuments({ rol: 'admin', activo: true })
      if (activeAdmins <= 1) {
        throw createError({ statusCode: 400, message: 'Debe haber al menos un admin activo' })
      }
    }
    user.activo = !user.activo
    // Invalidar token al desactivar
    if (!user.activo) {
      user.token        = null
      user.tokenExpires = null
    }
    await user.save()
    return { ok: true, activo: user.activo }
  }

  if (action === 'password') {
    if (!body.password || body.password.length < 6) {
      throw createError({ statusCode: 400, message: 'La contraseña debe tener al menos 6 caracteres' })
    }
    user.passwordHash = await hashPassword(body.password)
    // Invalidar sesión activa
    user.token        = null
    user.tokenExpires = null
    await user.save()
    return { ok: true }
  }

  throw createError({ statusCode: 400, message: 'Acción no reconocida' })
})
