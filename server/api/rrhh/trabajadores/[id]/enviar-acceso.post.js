/**
 * POST /api/rrhh/trabajadores/:id/enviar-acceso
 * Envía al trabajador un email con su acceso al portal (URL + credenciales).
 * Funciona en dos modos:
 *   1. Si ya tiene cuenta vinculada → manda recordatorio del email + URL del
 *      portal personal (no manda la contraseña; sugiere recuperarla).
 *   2. Si NO tiene cuenta → genera/refresca un PortalToken (link mágico) y
 *      manda ese link al email del trabajador.
 *
 * Body: { incluirPassword?: string }  ← opcional, manager puede pasarla en
 *   el momento de crear la cuenta para que el primer email la incluya.
 */
import Trabajador  from '../../../../models/Trabajador.js'
import User        from '../../../../models/User.js'
import PortalToken from '../../../../models/PortalToken.js'
import { requireDb, newId } from '../../../../utils/db.js'
import { requireAuth }      from '../../../../utils/requireAuth.js'
import { enviarEmail }      from '../../../../utils/mailer.js'

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]))
}

function appBaseUrl(event) {
  const proto = getRequestProtocol(event) || 'https'
  const host  = getRequestHost(event)     || 'localhost'
  return `${proto}://${host}`
}

export default defineEventHandler(async (event) => {
  requireDb(event)
  const me = await requireAuth(event, 'manager')
  const trabajadorId = event.context.params.id
  const body = await readBody(event).catch(() => ({}))

  const trab = await Trabajador.findById(trabajadorId).lean()
  if (!trab) throw createError({ statusCode: 404, message: 'Trabajador no encontrado' })
  if (!trab.email) {
    throw createError({ statusCode: 400, message: 'El trabajador no tiene email cargado en su ficha' })
  }

  const nombre = [trab.nombre, trab.apellido, trab.apellido_paterno, trab.apellido_materno]
    .filter(Boolean).join(' ') || 'Trabajador'

  const base = appBaseUrl(event)
  const linkedUser = await User.findOne({ trabajador_id: trabajadorId }).lean()

  let html, subject

  if (linkedUser) {
    // Caso 1: ya tiene cuenta. Mandamos recordatorio con el email registrado.
    const loginUrl = `${base}/login`
    subject = 'Tu acceso a unabase Personas'
    html = `
      <div style="font-family:system-ui,sans-serif;max-width:560px;padding:24px;background:#f8fafc;border-radius:12px">
        <h2 style="margin:0 0 12px;color:#0f172a">Hola ${escapeHtml(nombre)} 👋</h2>
        <p style="color:#475569;line-height:1.55">Tu cuenta para acceder al portal de <strong>unabase Personas</strong> está activa.</p>
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin:18px 0">
          <p style="margin:0 0 8px;color:#64748b;font-size:12px;letter-spacing:0.04em;text-transform:uppercase">Tus datos de acceso</p>
          <p style="margin:4px 0;color:#0f172a"><strong>Email:</strong> ${escapeHtml(linkedUser.email)}</p>
          ${body?.incluirPassword ? `<p style="margin:4px 0;color:#0f172a"><strong>Contraseña inicial:</strong> ${escapeHtml(body.incluirPassword)}</p>` : ''}
          <p style="margin:12px 0 0">
            <a href="${loginUrl}" style="display:inline-block;background:#0DCFA8;color:#062D3A;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Iniciar sesión</a>
          </p>
        </div>
        <p style="color:#64748b;font-size:12px">Si no recuerdas tu contraseña, pídele a tu encargado que la restablezca desde tu ficha.</p>
      </div>
    `
  } else {
    // Caso 2: sin cuenta. Generamos un PortalToken y mandamos el link mágico.
    let token = await PortalToken.findOne({ trabajador_id: trabajadorId, activo: true }).lean()
    if (!token) {
      const arr = new Uint8Array(16)
      crypto.getRandomValues(arr)
      const tokenStr = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
      token = await PortalToken.create({
        _id:           newId('ptk'),
        trabajador_id: trabajadorId,
        orgId:         trab.orgId || null,
        token:         tokenStr,
        activo:        true,
      })
      token = token.toObject()
    }

    const portalUrl = `${base}/portal/trabajador/${token.token}`
    subject = 'Tu acceso al portal de unabase Personas'
    html = `
      <div style="font-family:system-ui,sans-serif;max-width:560px;padding:24px;background:#f8fafc;border-radius:12px">
        <h2 style="margin:0 0 12px;color:#0f172a">Hola ${escapeHtml(nombre)} 👋</h2>
        <p style="color:#475569;line-height:1.55">
          Tu empleador te dio acceso a <strong>unabase Personas</strong>, donde puedes
          marcar tu entrada y salida del trabajo, solicitar vacaciones, ver tus
          liquidaciones y más.
        </p>
        <p style="margin:18px 0">
          <a href="${portalUrl}" style="display:inline-block;background:#0DCFA8;color:#062D3A;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">Abrir mi portal →</a>
        </p>
        <p style="color:#64748b;font-size:12px;line-height:1.5">
          Este link es personal y único — guárdalo en favoritos. Si lo pierdes,
          pídele a tu encargado que te envíe uno nuevo.
        </p>
      </div>
    `
  }

  const result = await enviarEmail({
    to:      trab.email,
    subject,
    html,
  })

  return {
    ok:    result.ok,
    mode:  result.mode,   // 'sent' | 'logged' | 'failed'
    error: result.error || null,
    email: trab.email,
  }
})
