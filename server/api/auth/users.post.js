/**
 * POST /api/auth/users
 * Crear nuevo usuario.
 *   - admin   → puede crear cualquier rol (admin, manager, viewer) en cualquier org.
 *   - manager → puede crear solo manager/viewer EN SUS orgIds.
 */
import { requireDb, newId } from '../../utils/db.js'
import { requireManager } from '../../utils/requireAuth.js'
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
  const me = await requireManager(event)

  const body = await readBody(event)
  let { nombre, email, password, rol = 'viewer', orgId = null, orgIds = null, trabajador_id = null } = body

  if (!nombre || !email || !password) {
    throw createError({ statusCode: 400, message: 'Faltan campos requeridos' })
  }
  if (!['admin', 'manager', 'viewer'].includes(rol)) {
    throw createError({ statusCode: 400, message: 'Rol inválido' })
  }

  // Normalizar orgIds: si solo viene orgId, convertir a array.
  if (!Array.isArray(orgIds)) {
    orgIds = orgId ? [orgId] : []
  }

  // ── Permisos ─────────────────────────────────────────────────────────
  if (me.rol === 'manager') {
    // Manager NO puede crear admins.
    if (rol === 'admin') {
      throw createError({ statusCode: 403, message: 'Solo el administrador global puede crear admins' })
    }
    // Manager solo puede asignar orgs que él mismo administra.
    const myOrgs = Array.isArray(me.orgIds) ? me.orgIds : (me.orgId ? [me.orgId] : [])
    const invalid = orgIds.filter(o => !myOrgs.includes(o))
    if (invalid.length) {
      throw createError({ statusCode: 403, message: 'No puedes asignar usuarios a orgs que no administras' })
    }
    if (!orgIds.length) {
      throw createError({ statusCode: 400, message: 'Debes asignar al menos una organización' })
    }
  }

  // Reglas por rol del nuevo usuario:
  if (rol === 'admin') {
    orgIds = []  // admin global siempre vacío
  } else if (rol === 'viewer' && orgIds.length !== 1) {
    throw createError({ statusCode: 400, message: 'Un viewer debe tener exactamente una organización' })
  } else if (rol === 'manager' && !orgIds.length) {
    throw createError({ statusCode: 400, message: 'Un manager debe tener al menos una organización' })
  }

  const exists = await User.findOne({ email: email.toLowerCase().trim() })
  if (exists) {
    throw createError({ statusCode: 409, message: 'Email ya registrado' })
  }

  const passwordHash = await hashPassword(password)
  const user = new User({
    _id:           newId('u'),
    nombre:        nombre.trim(),
    email:         email.toLowerCase().trim(),
    passwordHash,
    rol,
    orgId:         orgIds[0] || null,   // primaria por compat
    orgIds,
    trabajador_id: rol === 'viewer' ? trabajador_id : null,
    esSuperAdmin:  rol === 'admin',
    activo:        true,
  })

  await user.save()

  const { passwordHash: _, token: _t, tokenExpires: _te, ...safeUser } = user.toObject()
  return { ok: true, user: safeUser }
})
