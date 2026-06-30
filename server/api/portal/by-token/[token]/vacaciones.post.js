/**
 * POST /api/portal/by-token/:token/vacaciones
 * Endpoint PÚBLICO — el trabajador crea una solicitud desde su portal.
 * Quedan en estado 'pendiente' hasta que un manager las apruebe.
 *
 * Body: { fecha_inicio, fecha_fin, motivo? }
 */
import { requireDb, newId } from '../../../../utils/db.js'
import PortalToken          from '../../../../models/PortalToken.js'
import Trabajador           from '../../../../models/Trabajador.js'
import User                 from '../../../../models/User.js'
import Vacacion             from '../../../../models/Vacacion.js'
import { getPolicy }        from '../../../../utils/vacacionesPolicy.js'
import { enviarEmail }      from '../../../../utils/mailer.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const token = getRouterParam(event, 'token')
  const body  = await readBody(event)

  if (!token) throw createError({ statusCode: 400, message: 'Token requerido' })
  if (!body?.fecha_inicio || !body?.fecha_fin) {
    throw createError({ statusCode: 400, message: 'fecha_inicio y fecha_fin requeridas' })
  }
  if (body.fecha_fin < body.fecha_inicio) {
    throw createError({ statusCode: 400, message: 'fecha_fin no puede ser anterior a fecha_inicio' })
  }

  const tok = await PortalToken.findOne({ token, activo: true }).lean()
  if (!tok) throw createError({ statusCode: 404, message: 'Link inválido o expirado' })

  const trab = await Trabajador.findById(tok.trabajador_id).lean()
  if (!trab) throw createError({ statusCode: 404, message: 'Trabajador no encontrado' })

  const policy = getPolicy('CL')
  const dias = policy.diasHabiles(body.fecha_inicio, body.fecha_fin)

  const nombre = [trab.nombre, trab.apellido_paterno, trab.apellido_materno]
    .filter(Boolean).join(' ') || trab.nombres || 'Trabajador'

  const doc = new Vacacion({
    _id:                   newId('vac'),
    trabajador_id:         trab._id,
    trabajador_nombre:     nombre,
    orgId:                 trab.orgId || null,
    fecha_inicio:          body.fecha_inicio,
    fecha_fin:             body.fecha_fin,
    dias_habiles:          dias,
    motivo:                body.motivo || '',
    estado:                'pendiente',
    solicitado_por:        'trabajador',
    solicitado_por_id:     trab._id,
    solicitado_por_nombre: nombre,
  })
  await doc.save()

  // Email a los managers de la org
  notificarManagers(doc.toObject(), trab).catch(() => {})

  return doc.toObject()
})

async function notificarManagers(vacacion, trabajador) {
  if (!trabajador.orgId) return
  const managers = await User.find({
    orgIds: trabajador.orgId,
    rol:    { $in: ['admin', 'manager'] },
    activo: true,
  }).lean()
  const emails = managers.map(m => m.email).filter(Boolean)
  if (!emails.length) return

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;padding:24px;background:#f8fafc;border-radius:12px">
      <h2 style="margin:0 0 12px;color:#0f172a">Solicitud de vacaciones desde el portal</h2>
      <p style="color:#475569;line-height:1.55"><strong>${vacacion.trabajador_nombre}</strong> solicitó <strong>${vacacion.dias_habiles} día(s) hábil(es)</strong> entre el <strong>${vacacion.fecha_inicio}</strong> y el <strong>${vacacion.fecha_fin}</strong>.</p>
      ${vacacion.motivo ? `<p style="color:#475569"><em>Motivo:</em> ${escapeHtml(vacacion.motivo)}</p>` : ''}
      <p style="color:#94a3b8;font-size:12px;margin-top:24px">Aprueba o rechaza desde la ficha del trabajador en Unabase Personas.</p>
    </div>
  `
  await enviarEmail({
    to:      emails,
    subject: `Solicitud de vacaciones — ${vacacion.trabajador_nombre}`,
    html,
  })
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]))
}
