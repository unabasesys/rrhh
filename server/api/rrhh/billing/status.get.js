/**
 * GET /api/rrhh/billing/status
 *
 * Devuelve las organizaciones (accesibles al usuario) que tienen pago
 * pendiente. Una org se considera "impaga" si:
 *   - billingStatus = 'past_due' o 'canceled', O
 *   - plan = 'paid' Y billingRenovacion existe y ya pasó.
 *
 * Para cada org incluye el monto estimado del mes (trabajadores × precio)
 * y la fecha de vencimiento para mostrar en el banner.
 *
 * Acceso:
 *   - admin global: ve todas las orgs impagas.
 *   - manager: ve solo las suyas.
 *   - viewer: ve solo la suya (la org de su trabajador).
 */
import { requireDb } from '../../../utils/db.js'
import { requireAuth } from '../../../utils/requireAuth.js'
import Organization from '../../../models/Organization.js'
import Trabajador   from '../../../models/Trabajador.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const me = await requireAuth(event)

  // Determinar qué orgs revisar
  let filter = {}
  if (me.rol === 'admin') {
    filter = {}
  } else {
    const list = Array.isArray(me.orgIds) ? me.orgIds : (me.orgId ? [me.orgId] : [])
    if (!list.length) return { ok: true, overdueOrgs: [] }
    filter = { _id: { $in: list } }
  }

  const orgs = await Organization.find(filter).lean()
  const now = new Date()

  // Filtramos las impagas
  const impagas = orgs.filter(o => {
    if (o.plan !== 'paid') return false
    if (o.billingStatus === 'past_due' || o.billingStatus === 'canceled') return true
    if (o.billingRenovacion && new Date(o.billingRenovacion) < now) return true
    return false
  })

  if (!impagas.length) return { ok: true, overdueOrgs: [] }

  // Para cada org impaga calculamos el monto estimado del mes
  const workerCounts = await Trabajador.aggregate([
    { $match: { orgId: { $in: impagas.map(o => o._id) }, estado: { $in: ['activo', 'Activo'] } } },
    { $group: { _id: '$orgId', count: { $sum: 1 } } },
  ])
  const countsMap = Object.fromEntries(workerCounts.map(c => [c._id, c.count]))

  const CLP_PER_USD = 950  // mismo factor que usa billing.vue
  const overdueOrgs = impagas.map(o => {
    const workers      = countsMap[o._id] || 0
    const precioUSD    = o.planPrecioUSD ?? 40
    const monthlyUSD   = workers * precioUSD
    const monthlyCLP   = monthlyUSD * CLP_PER_USD
    const fechaVenc    = o.billingRenovacion || null
    const diasVencido  = fechaVenc ? Math.floor((now - new Date(fechaVenc)) / (1000 * 60 * 60 * 24)) : null
    return {
      _id:              o._id,
      nombre:           o.nombre,
      rut:              o.rut,
      plan:             o.plan,
      billingStatus:    o.billingStatus,
      billingRenovacion: fechaVenc,
      diasVencido,
      workers,
      monthlyUSD,
      monthlyCLP,
      billingEmail:     o.billingEmail || '',
    }
  })

  return { ok: true, overdueOrgs }
})
