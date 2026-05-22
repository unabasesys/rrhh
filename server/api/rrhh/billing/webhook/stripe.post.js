/**
 * POST /api/rrhh/billing/webhook/stripe
 * Webhook de Stripe — verifica firma y maneja eventos.
 * Configura en Stripe Dashboard → Webhooks → este endpoint.
 *
 * Variable de entorno requerida:
 *   STRIPE_WEBHOOK_SECRET — Signing secret del webhook
 *
 * NOTA: Requiere instalar el paquete:
 *   npm install stripe
 */
import Organization from '../../../../models/Organization.js'
import { requireDb } from '../../../../utils/db.js'

export default defineEventHandler(async (event) => {
  requireDb(event)

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    throw createError({
      statusCode: 503,
      message:    'Stripe webhook no configurado. Define STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET.',
    })
  }

  // Leer el body crudo (necesario para verificar la firma de Stripe)
  const rawBody = await readRawBody(event)
  const sig     = getHeader(event, 'stripe-signature')

  // Importar stripe dinámicamente
  const Stripe = (await import('stripe')).default
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' })

  let stripeEvent
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    throw createError({ statusCode: 400, message: `Webhook signature inválida: ${err.message}` })
  }

  // Manejar eventos relevantes
  switch (stripeEvent.type) {
    case 'invoice.payment_succeeded': {
      const invoice    = stripeEvent.data.object
      const customerId = invoice.customer

      if (customerId) {
        const org = await Organization.findOne({ stripeCustomerId: customerId })
        if (org) {
          // Calcular próxima renovación (1 mes desde ahora)
          const renovacion = new Date()
          renovacion.setMonth(renovacion.getMonth() + 1)

          org.plan              = 'paid'
          org.billingStatus     = 'active'
          org.billingRenovacion = renovacion
          await org.save()
          console.log(`[stripe-webhook] Pago exitoso para org ${org._id}`)
        }
      }
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = stripeEvent.data.object
      const customerId   = subscription.customer

      if (customerId) {
        const org = await Organization.findOne({ stripeCustomerId: customerId })
        if (org) {
          org.plan          = 'free'
          org.billingStatus = 'canceled'
          await org.save()
          console.log(`[stripe-webhook] Suscripción cancelada para org ${org._id}`)
        }
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice    = stripeEvent.data.object
      const customerId = invoice.customer

      if (customerId) {
        const org = await Organization.findOne({ stripeCustomerId: customerId })
        if (org) {
          org.billingStatus = 'past_due'
          await org.save()
          console.log(`[stripe-webhook] Pago fallido para org ${org._id}`)
        }
      }
      break
    }

    default:
      // Evento no manejado — responder OK de todas formas
      console.log(`[stripe-webhook] Evento no manejado: ${stripeEvent.type}`)
  }

  return { received: true }
})
