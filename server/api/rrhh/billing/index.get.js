/**
 * GET /api/rrhh/billing
 * Devuelve todas las organizaciones con su resumen de facturación.
 * Solo super-admin (requiere token válido con esSuperAdmin=true).
 */
import Organization from '../../../models/Organization.js'
import Trabajador   from '../../../models/Trabajador.js'
import { requireAdmin } from '../../../utils/requireAuth.js'
import { requireDb }   from '../../../utils/db.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  await requireAdmin(event)   // solo admin global puede ver facturación

  // Obtener todas las organizaciones con campos de billing
  const orgs = await Organization.find({}).lean()

  // Conteo de trabajadores por org (estado activo)
  const counts = await Trabajador.aggregate([
    { $match: { estado: { $in: ['activo', 'Activo'] } } },
    { $group: { _id: '$orgId', count: { $sum: 1 } } },
  ])
  const workerCounts = {}
  for (const row of counts) {
    if (row._id) workerCounts[row._id] = row.count
  }

  const summary = orgs.map((org) => {
    const workers = workerCounts[org._id] || 0
    const precioUSD = org.planPrecioUSD ?? 40
    const monthlyCostUSD = org.plan === 'paid' ? workers * precioUSD : 0
    return {
      _id:               org._id,
      nombre:            org.nombre,
      rut:               org.rut,
      logo:              org.logo,
      activo:            org.activo,
      plan:              org.plan || 'free',
      planPrecioUSD:     precioUSD,
      billingEmail:      org.billingEmail || '',
      stripeCustomerId:  org.stripeCustomerId || null,
      mpCustomerId:      org.mpCustomerId || null,
      billingStatus:     org.billingStatus || 'active',
      billingRenovacion: org.billingRenovacion || null,
      workersActivos:    workers,
      monthlyCostUSD,
    }
  })

  return { ok: true, orgs: summary }
})
