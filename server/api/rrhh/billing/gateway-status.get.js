/**
 * GET /api/rrhh/billing/gateway-status
 * Indica qué pasarelas de pago están configuradas (tienen su env var).
 * Público (no requiere auth) — solo devuelve booleanos, no expone keys.
 */
export default defineEventHandler(() => {
  return {
    stripe:      !!process.env.STRIPE_SECRET_KEY,
    mercadopago: !!process.env.MP_ACCESS_TOKEN,
    transbank:   !!(process.env.TB_COMMERCE_CODE && process.env.TB_API_KEY_SECRET),
  }
})
