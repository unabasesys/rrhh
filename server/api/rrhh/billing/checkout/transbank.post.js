/**
 * POST /api/rrhh/billing/checkout/transbank
 * Inicia una transacción Webpay Plus para la organización indicada.
 * Body: { orgId, returnUrl }
 * Retorna: { url, token }
 *
 * NOTA: Requiere instalar el paquete:
 *   npm install transbank-sdk
 *
 * Variables de entorno requeridas:
 *   TB_COMMERCE_CODE  — Código de comercio Transbank
 *   TB_API_KEY_SECRET — API Key secreta Transbank
 *   TB_ENV            — 'integration' (default) | 'production'
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

  if (!process.env.TB_COMMERCE_CODE || !process.env.TB_API_KEY_SECRET) {
    throw createError({
      statusCode: 503,
      message:    'Transbank no configurado. Define TB_COMMERCE_CODE y TB_API_KEY_SECRET en las variables de entorno.',
    })
  }

  const { orgId, returnUrl } = await readBody(event)
  if (!orgId)    throw createError({ statusCode: 400, message: 'orgId requerido' })
  if (!returnUrl) throw createError({ statusCode: 400, message: 'returnUrl requerido' })

  const org = await Organization.findById(orgId).lean()
  if (!org) throw createError({ statusCode: 404, message: 'Organización no encontrada' })

  // Contar trabajadores activos
  const workers = await Trabajador.countDocuments({
    orgId,
    estado: { $in: ['activo', 'Activo'] },
  })

  const precioUSD  = org.planPrecioUSD ?? 40
  const totalCLP   = Math.round(workers * precioUSD * CLP_PER_USD)

  // Importar transbank-sdk dinámicamente (se instala vía: npm install transbank-sdk)
  const { WebpayPlus, Environment, Options } = await import('transbank-sdk')

  const isProduction = process.env.TB_ENV === 'production'
  const tx = new WebpayPlus.Transaction(new Options(
    process.env.TB_COMMERCE_CODE,
    process.env.TB_API_KEY_SECRET,
    isProduction ? Environment.Production : Environment.Integration,
  ))

  // Generar orden única
  const buyOrder  = `rrhh-${orgId}-${Date.now()}`
  const sessionId = `sess-${orgId}`

  const response = await tx.create(buyOrder, sessionId, totalCLP, returnUrl)

  return { url: response.url, token: response.token }
})
