/**
 * POST /api/rrhh/billing/checkout/stripe
 * Crea una sesión de Stripe Checkout para la organización indicada.
 * Body: { orgId, successUrl, cancelUrl }
 * Retorna: { url }
 *
 * NOTA: Requiere instalar el paquete:
 *   npm install stripe
 */
import Organization from '../../../../models/Organization.js'
import Trabajador   from '../../../../models/Trabajador.js'
import { requireAuth } from '../../../../utils/requireAuth.js'
import { requireDb }   from '../../../../utils/db.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const user = await requireAuth(event)

  const isSuperAdmin = user.esSuperAdmin === true || (user.rol === 'admin' && !user.orgId)
  if (!isSuperAdmin) {
    throw createError({ statusCode: 403, message: 'Solo el super-administrador puede crear sesiones de pago' })
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    throw createError({
      statusCode: 503,
      message:    'Stripe no configurado. Define STRIPE_SECRET_KEY en las variables de entorno.',
    })
  }

  const { orgId, successUrl, cancelUrl } = await readBody(event)
  if (!orgId) throw createError({ statusCode: 400, message: 'orgId requerido' })
  if (!successUrl || !cancelUrl) throw createError({ statusCode: 400, message: 'successUrl y cancelUrl son requeridos' })

  const org = await Organization.findById(orgId).lean()
  if (!org) throw createError({ statusCode: 404, message: 'Organización no encontrada' })

  // Contar trabajadores activos
  const workers = await Trabajador.countDocuments({
    orgId,
    estado: { $in: ['activo', 'Activo'] },
  })

  const precioUSD    = org.planPrecioUSD ?? 40
  const totalUSD     = workers * precioUSD
  const amountCents  = Math.round(totalUSD * 100) // Stripe usa centavos

  // Importar stripe dinámicamente (se instala vía: npm install stripe)
  const Stripe = (await import('stripe')).default
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' })

  // Buscar o crear el customer de Stripe
  let customerId = org.stripeCustomerId
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: org.billingEmail || undefined,
      name:  org.nombre,
      metadata: { orgId: org._id },
    })
    customerId = customer.id
    // Persistir el customerId
    await Organization.updateOne({ _id: orgId }, { $set: { stripeCustomerId: customerId } })
  }

  const session = await stripe.checkout.sessions.create({
    customer:    customerId,
    mode:        'payment',
    line_items: [
      {
        price_data: {
          currency:     'usd',
          unit_amount:  amountCents,
          product_data: {
            name:        `Plan Paid · ${org.nombre}`,
            description: `${workers} trabajador${workers !== 1 ? 'es' : ''} × $${precioUSD} USD/mes`,
          },
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url:  cancelUrl,
    metadata:    { orgId: org._id },
  })

  return { url: session.url }
})
