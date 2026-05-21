import mongoose from 'mongoose'

let isConnected = false

async function hashPassword(password) {
  const msgBuffer = new TextEncoder().encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

async function seedAdminIfEmpty() {
  try {
    // Import dinámico para evitar problemas de orden de carga
    const { default: User } = await import('../models/User.js')
    const count = await User.countDocuments()
    if (count > 0) return

    const ts   = Date.now()
    const rand = Math.random().toString(36).slice(2, 7)
    const _id  = `u_${ts}_${rand}`
    const passwordHash = await hashPassword('Admin1234!')

    await User.create({
      _id,
      nombre:       'Administrador',
      email:        'admin@rrhh.cl',
      passwordHash,
      rol:          'admin',
      orgId:        null,
      esSuperAdmin: true,
      activo:       true,
    })
    console.log('[RRHH] Admin semilla creado: admin@rrhh.cl / Admin1234!')
  } catch (err) {
    console.error('[RRHH] Error creando admin semilla:', err.message)
  }
}

export default defineNitroPlugin(async () => {
  if (isConnected) return

  const uri = process.env.MONGODB_URI

  if (!uri) {
    console.warn('[RRHH] MONGODB_URI no definido — modo localStorage activo')
    return
  }

  try {
    await mongoose.connect(uri, {
      dbName: process.env.MONGODB_DB || 'rrhh',
    })
    isConnected = true
    console.log('[RRHH] MongoDB conectado ✓')
    await seedAdminIfEmpty()
  } catch (err) {
    console.error('[RRHH] Error conectando a MongoDB:', err.message)
  }
})

export function isDbConnected() {
  return isConnected && mongoose.connection.readyState === 1
}
