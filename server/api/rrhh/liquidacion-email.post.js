/**
 * POST /api/rrhh/liquidacion-email
 * Genera el PDF de una liquidación y lo manda por email (vía Brevo) al
 * destinatario indicado.
 *
 * Body: { liquidacion_id, email, mensaje?, nombreDestinatario? }
 */
import { requireDb }   from '../../utils/db.js'
import { requireAuth, requireOrgAccess } from '../../utils/requireAuth.js'
import { enviarEmail } from '../../utils/mailer.js'
import { buildLiquidacionPdfBody } from '../../utils/buildLiquidacionPdfBody.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MES_NOMBRE = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]))
}

export default defineEventHandler(async (event) => {
  requireDb(event)
  const user = await requireAuth(event, 'manager')

  const body = await readBody(event)
  if (!body?.liquidacion_id) throw createError({ statusCode: 400, message: 'liquidacion_id requerido' })
  if (!body?.email || !EMAIL_RE.test(body.email)) {
    throw createError({ statusCode: 400, message: 'Email inválido' })
  }

  // Armar body de la liquidación
  let pdfBody
  try {
    pdfBody = await buildLiquidacionPdfBody(body.liquidacion_id)
  } catch (e) {
    throw createError({ statusCode: 404, message: e.message || 'Liquidación no encontrada' })
  }
  // Validar acceso a la org de la liquidación
  requireOrgAccess(user, pdfBody._liquidacionDoc?.orgId)

  // Pedir el PDF a nuestro propio endpoint vía $fetch (Nitro lo enrouta en
  // memoria sin salir a la red).
  let pdfBuffer
  try {
    const arr = await $fetch('/api/rrhh/liquidacion-pdf', {
      method: 'POST',
      body: pdfBody,
      responseType: 'arrayBuffer',
    })
    pdfBuffer = Buffer.from(arr)
  } catch (e) {
    throw createError({ statusCode: 500, message: 'No se pudo generar el PDF: ' + (e.message || 'error desconocido') })
  }

  const liq    = pdfBody._liquidacionDoc
  const nombre = body.nombreDestinatario || pdfBody.trabajador.nombre
  const periodo = liq ? `${MES_NOMBRE[liq.mes] || ''} de ${liq.anio}` : 'del mes'

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;padding:24px;background:#f8fafc;border-radius:12px">
      <h2 style="margin:0 0 12px;color:#0f172a">Hola ${escapeHtml(nombre.toString().toLowerCase().replace(/\b\w/g, c => c.toUpperCase()))} 👋</h2>
      <p style="color:#475569;line-height:1.55">
        Adjuntamos tu <strong>liquidación de remuneraciones</strong> correspondiente a
        <strong>${periodo}</strong>.
      </p>
      ${body.mensaje ? `<p style="color:#475569;line-height:1.55">${escapeHtml(body.mensaje)}</p>` : ''}
      <p style="color:#475569;line-height:1.55">
        Si tienes alguna duda sobre los montos o conceptos, contacta a tu encargado de
        Recursos Humanos.
      </p>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px">
        Enviado automáticamente desde unabase Personas.
      </p>
    </div>
  `

  const fileName = `liquidacion-${(pdfBody.trabajador.rut || 'doc').replace(/[^0-9kK-]/g,'')}-${liq?.anio || ''}-${String(liq?.mes || '').padStart(2,'0')}.pdf`

  const result = await enviarEmail({
    to:      body.email,
    subject: `Liquidación de remuneraciones — ${periodo}`,
    html,
    attachments: [{ name: fileName, content: pdfBuffer }],
  })

  return {
    ok:    result.ok,
    mode:  result.mode,
    error: result.error || null,
    email: body.email,
  }
})
