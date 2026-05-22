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
      orgIds:       [],     // admin global = acceso a todas las orgs
      esSuperAdmin: true,   // legacy compat
      activo:       true,
    })
    console.log('[RRHH] Admin semilla creado: admin@rrhh.cl / Admin1234!')
  } catch (err) {
    console.error('[RRHH] Error creando admin semilla:', err.message)
  }
}

// Migración idempotente: corre en cada boot, solo modifica usuarios que lo necesitan.
//   1) Llena `orgIds` desde `orgId` si está vacío.
//   2) Reclasifica roles:
//      - admin con orgId (no super) → manager
//      - admin sin orgId / esSuperAdmin → admin global con orgIds=[]
async function migrateUserRoles() {
  try {
    const { default: User } = await import('../models/User.js')
    const all = await User.find({}).lean()
    let migrated = 0

    for (const u of all) {
      const updates = {}
      const isLegacySuperAdmin = u.esSuperAdmin === true || (u.rol === 'admin' && !u.orgId)

      // 1) Reclasificar: admin con orgId pero no super → manager
      if (u.rol === 'admin' && u.orgId && !isLegacySuperAdmin) {
        updates.rol = 'manager'
      }

      // 2) Construir orgIds si falta o está vacío
      const currentOrgIds = Array.isArray(u.orgIds) ? u.orgIds : []
      if (currentOrgIds.length === 0) {
        const targetRol = updates.rol || u.rol
        if (targetRol === 'admin' || isLegacySuperAdmin) {
          updates.orgIds = []  // admin global
        } else if (u.orgId) {
          updates.orgIds = [u.orgId]
        }
      }

      // 3) Asegurar esSuperAdmin coherente con rol final
      const finalRol = updates.rol || u.rol
      const finalOrgIds = updates.orgIds ?? currentOrgIds
      const shouldBeSuper = finalRol === 'admin' && finalOrgIds.length === 0
      if (Boolean(u.esSuperAdmin) !== shouldBeSuper) {
        updates.esSuperAdmin = shouldBeSuper
      }

      if (Object.keys(updates).length > 0) {
        await User.updateOne({ _id: u._id }, { $set: updates })
        migrated++
      }
    }

    if (migrated > 0) {
      console.log(`[RRHH] Migración roles/orgIds: ${migrated} usuarios actualizados`)
    }
  } catch (err) {
    console.error('[RRHH] Error migrando usuarios:', err.message)
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
    await migrateUserRoles()
  } catch (err) {
    console.error('[RRHH] Error conectando a MongoDB:', err.message)
  }
})

export function isDbConnected() {
  return isConnected && mongoose.connection.readyState === 1
}
