/**
 * POST /api/auth/register
 *
 * Crea una nueva cuenta de usuario y la deja loggeada con la org "Empresa
 * DEMO SPA" pre-seleccionada para que pueda probar el módulo de inmediato.
 *
 * Body: { nombre, email, password }
 * Retorna: { ok, token, expires, user, currentOrgId } igual que /login
 *
 * Este flujo es la onboarding inicial — el wizard real vendrá después.
 */
import { requireDb, newId } from '../../utils/db.js'
import User from '../../models/User.js'
import Organization from '../../models/Organization.js'

async function hashPassword(password) {
  const msgBuffer = new TextEncoder().encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function generateToken() {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default defineEventHandler(async (event) => {
  requireDb(event)
  const body = await readBody(event)
  const nombre   = String(body?.nombre || '').trim()
  const email    = String(body?.email  || '').toLowerCase().trim()
  const password = String(body?.password || '')

  if (!nombre || nombre.length < 2) {
    throw createError({ statusCode: 400, message: 'Nombre requerido' })
  }
  if (!EMAIL_RE.test(email)) {
    throw createError({ statusCode: 400, message: 'Email inválido' })
  }
  if (password.length < 8) {
    throw createError({ statusCode: 400, message: 'La contraseña debe tener al menos 8 caracteres' })
  }

  // No permitir duplicados
  const existing = await User.findOne({ email })
  if (existing) {
    throw createError({ statusCode: 409, message: 'Ya existe una cuenta con este email' })
  }

  // Org demo para que el usuario entre con datos pre-cargados
  const demoOrg = await Organization.findOne({ nombre: /^Empresa DEMO SPA$/i }).lean()

  const passwordHash = await hashPassword(password)
  const token        = generateToken()
  const tokenExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)  // 30 días

  const user = new User({
    _id:          newId('u'),
    email,
    nombre,
    passwordHash,
    // Manager → puede acceder al módulo completo. (No 'admin' para no dar
    // permisos globales a cuentas auto-creadas.)
    rol:          'manager',
    orgId:        demoOrg?._id || null,
    orgIds:       demoOrg ? [demoOrg._id] : [],
    activo:       true,
    token,
    tokenExpires,
    creado:       new Date(),
  })
  await user.save()

  const { passwordHash: _, token: _t, tokenExpires: _te, ...safeUser } = user.toObject()
  return {
    ok:            true,
    token,
    expires:       tokenExpires.getTime(),
    user:          safeUser,
    currentOrgId:  demoOrg?._id || null,
  }
})
