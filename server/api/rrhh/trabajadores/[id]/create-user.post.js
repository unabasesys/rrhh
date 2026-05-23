/**
 * POST /api/rrhh/trabajadores/:id/create-user
 *
 * Crea (o re-vincula) una cuenta de acceso para un trabajador.
 * - Si el trabajador ya tiene una cuenta vinculada, devuelve error.
 * - Si existe un User con ese email, lo enlaza al trabajador (rol viewer)
 *   en vez de duplicar.
 *
 * Body: { email, password }
 *
 * Permisos: admin global, o manager con acceso a la org del trabajador.
 */
import { requireDb, newId } from '../../../../utils/db.js'
import { requireManager, requireOrgAccess } from '../../../../utils/requireAuth.js'
import Trabajador from '../../../../models/Trabajador.js'
import User from '../../../../models/User.js'

async function hashPassword(password) {
  const msgBuffer = new TextEncoder().encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export default defineEventHandler(async (event) => {
  requireDb(event)
  const me = await requireManager(event)

  const id   = getRouterParam(event, 'id')
  const body = await readBody(event)
  const email    = (body?.email || '').toLowerCase().trim()
  const password = body?.password || ''
  const nombre   = body?.nombre || ''

  if (!email || !password) {
    throw createError({ statusCode: 400, message: 'Email y contraseña requeridos' })
  }
  if (password.length < 6) {
    throw createError({ statusCode: 400, message: 'La contraseña debe tener al menos 6 caracteres' })
  }

  const trab = await Trabajador.findById(id).lean()
  if (!trab) throw createError({ statusCode: 404, message: 'Trabajador no encontrado' })
  requireOrgAccess(me, trab.orgId)

  // ¿Ya hay una cuenta vinculada?
  const existing = await User.findOne({ trabajador_id: id }).lean()
  if (existing) {
    throw createError({ statusCode: 409, message: 'Este trabajador ya tiene una cuenta vinculada' })
  }

  // ¿Hay un usuario con ese email? → vincularlo
  const byEmail = await User.findOne({ email })
  if (byEmail) {
    if (byEmail.rol === 'admin') {
      throw createError({ statusCode: 409, message: 'Ese email pertenece a un administrador. Usa otro.' })
    }
    byEmail.trabajador_id = id
    byEmail.rol           = 'viewer'
    byEmail.orgId         = trab.orgId
    byEmail.orgIds        = [trab.orgId].filter(Boolean)
    byEmail.activo        = true
    await byEmail.save()
    const { passwordHash: _, token: _t, tokenExpires: _te, ...safeUser } = byEmail.toObject()
    return { ok: true, user: safeUser, linkedExisting: true }
  }

  // Crear nuevo
  const passwordHash = await hashPassword(password)
  const fullName = nombre || [trab.nombre, trab.apellido_paterno || trab.apellido].filter(Boolean).join(' ').trim() || trab.nombre || 'Trabajador'

  const newUser = new User({
    _id:           newId('u'),
    nombre:        fullName,
    email,
    passwordHash,
    rol:           'viewer',
    orgId:         trab.orgId || null,
    orgIds:        trab.orgId ? [trab.orgId] : [],
    trabajador_id: id,
    esSuperAdmin:  false,
    activo:        true,
  })
  await newUser.save()

  const { passwordHash: _, token: _t, tokenExpires: _te, ...safeUser } = newUser.toObject()
  return { ok: true, user: safeUser, created: true }
})
