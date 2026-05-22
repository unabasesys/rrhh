/**
 * PUT /api/rrhh/billing/:orgId
 * Actualiza campos de facturación de una organización.
 * Solo super-admin.
 * Body: { plan, billingEmail, billingStatus, billingRenovacion, planPrecioUSD }
 */
import Organization from '../../../models/Organization.js'
import { requireAuth } from '../../../utils/requireAuth.js'
import { requireDb }   from '../../../utils/db.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const user = await requireAuth(event)

  const isSuperAdmin = user.esSuperAdmin === true || (user.rol === 'admin' && !user.orgId)
  if (!isSuperAdmin) {
    throw createError({ statusCode: 403, message: 'Solo el super-administrador puede modificar facturación' })
  }

  const orgId = getRouterParam(event, 'orgId')
  if (!orgId) throw createError({ statusCode: 400, message: 'orgId requerido' })

  const org = await Organization.findById(orgId)
  if (!org) throw createError({ statusCode: 404, message: 'Organización no encontrada' })

  const body = await readBody(event)
  const allowed = ['plan', 'billingEmail', 'billingStatus', 'billingRenovacion', 'planPrecioUSD', 'stripeCustomerId', 'mpCustomerId']

  for (const key of allowed) {
    if (key in body) {
      org[key] = body[key]
    }
  }

  await org.save()

  return { ok: true, org: org.toObject() }
})
