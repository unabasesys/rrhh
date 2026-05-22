/**
 * POST /api/rrhh/billing/checkout/mercadopago
 * Crea una preferencia de MercadoPago para la organización indicada.
 * Body: { orgId, successUrl, failureUrl, pendingUrl }
 * Retorna: { init_point }
 *
 * NOTA: Requiere instalar el paquete:
 *   npm install mercadopago
 */
import Organization from '../../../../models/Organization.js'
import Trabajador   from '../../../../models/Trabajador.js'
import { requireAuth } from '../../../../utils/requireAuth.js'
import { requireDb }   from '../../../../utils/db.js'

const CLP_PER_USD = 950 // Tasa de referencia estática

export default defineEventHandler(async (event) => {
  requireDb(event)
  const user = await requireAuth(event)

  const isSuperAdmin = user.esSuperAdmin === true || (user.rol === 'admin' && !user.orgId)
  if (!isSuperAdmin) {
    throw createError({ statusCode: 403, message: 'Solo el super-administrador puede crear sesiones de pago' })
  }

  if (!process.env.MP_ACCESS_TOKEN) {
    throw createError({
      statusCode: 503,
      message:    'MercadoPago no configurado. Define MP_ACCESS_TOKEN en las variables de entorno.',
    })
  }

  const { orgId, successUrl, failureUrl, pendingUrl } = await readBody(event)
  if (!orgId) throw createError({ statusCode: 400, message: 'orgId requerido' })

  const org = await Organization.findById(orgId).lean()
  if (!org) throw createError({ statusCode: 404, message: 'Organización no encontrada' })

  // Contar trabajadores activos
  const workers = await Trabajador.countDocuments({
    orgId,
    estado: { $in: ['activo', 'Activo'] },
  })

  const precioUSD   = org.planPrecioUSD ?? 40
  const totalUSD    = workers * precioUSD
  const totalCLP    = Math.round(totalUSD * CLP_PER_USD)

  // Importar mercadopago dinámicamente (se instala vía: npm install mercadopago)
  const { MercadoPagoConfig, Preference } = await import('mercadopago')

  const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN })
  const preferenceApi = new Preference(client)

  const preference = await preferenceApi.create({
    body: {
      items: [
        {
          id:          `rrhh-plan-${orgId}`,
          title:       `Plan Paid · ${org.nombre}`,
          description: `${workers} trabajador${workers !== 1 ? 'es' : ''} × $${precioUSD} USD/mes`,
          quantity:    1,
          unit_price:  totalCLP,
          currency_id: 'CLP',
        },
      ],
      payer: org.billingEmail ? { email: org.billingEmail } : undefined,
      back_urls: {
        success: successUrl || '/',
        failure: failureUrl || '/',
        pending: pendingUrl || '/',
      },
      auto_return:    'approved',
      external_reference: orgId,
    },
  })

  return { init_point: preference.init_point }
})
