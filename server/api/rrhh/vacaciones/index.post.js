import Vacacion from '../../../models/Vacacion.js'
import Trabajador from '../../../models/Trabajador.js'
import User from '../../../models/User.js'
import { requireDb, newId } from '../../../utils/db.js'
import { requireAuth } from '../../../utils/requireAuth.js'
import { getPolicy } from '../../../utils/vacacionesPolicy.js'
import { enviarEmail } from '../../../utils/mailer.js'

/**
 * POST /api/rrhh/vacaciones
 * Crea una solicitud (estado pendiente). Manager o admin crean en nombre
 * del trabajador desde la app; el portal usa otro endpoint.
 *
 * Body: { trabajador_id, fecha_inicio, fecha_fin, motivo? }
 */
export default defineEventHandler(async (event) => {
  requireDb(event)
  const user = await requireAuth(event, 'manager')
  const body = await readBody(event)

  if (!body?.trabajador_id || !body?.fecha_inicio || !body?.fecha_fin) {
    throw createError({ statusCode: 400, message: 'trabajador_id, fecha_inicio y fecha_fin son requeridos' })
  }
  if (body.fecha_fin < body.fecha_inicio) {
    throw createError({ statusCode: 400, message: 'fecha_fin no puede ser anterior a fecha_inicio' })
  }

  const trabajador = await Trabajador.findById(body.trabajador_id).lean()
  if (!trabajador) throw createError({ statusCode: 404, message: 'Trabajador no encontrado' })

  // Días hábiles según policy (por ahora Chile)
  const policy = getPolicy('CL')
  const dias = policy.diasHabiles(body.fecha_inicio, body.fecha_fin)

  const nombreTrabajador = [trabajador.nombre, trabajador.apellido_paterno, trabajador.apellido_materno]
    .filter(Boolean).join(' ') || trabajador.nombres || 'Trabajador'

  const doc = new Vacacion({
    _id:                  newId('vac'),
    trabajador_id:        body.trabajador_id,
    trabajador_nombre:    nombreTrabajador,
    orgId:                trabajador.orgId || user.orgId || null,
    fecha_inicio:         body.fecha_inicio,
    fecha_fin:            body.fecha_fin,
    dias_habiles:         dias,
    motivo:               body.motivo || '',
    estado:               'pendiente',
    solicitado_por:       'manager',
    solicitado_por_id:    user._id || user.id || null,
    solicitado_por_nombre: user.nombre || user.email || null,
  })
  await doc.save()

  // Notificar al/los manager de la org (al que solicitó no, para evitar ruido)
  notificarSolicitud({ vacacion: doc.toObject(), trabajador, solicitante: user }).catch(() => {})

  return doc.toObject()
})

async function notificarSolicitud({ vacacion, trabajador, solicitante }) {
  if (!trabajador.orgId) return
  const managers = await User.find({
    orgIds: trabajador.orgId,
    rol:    { $in: ['admin', 'manager'] },
    activo: true,
    _id:    { $ne: solicitante._id || solicitante.id },
  }).lean()
  const emails = managers.map(m => m.email).filter(Boolean)
  if (!emails.length) return

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;padding:24px;background:#f8fafc;border-radius:12px">
      <h2 style="margin:0 0 12px;color:#0f172a">Nueva solicitud de vacaciones</h2>
      <p style="color:#475569;line-height:1.55"><strong>${vacacion.trabajador_nombre}</strong> solicitó <strong>${vacacion.dias_habiles} día(s) hábil(es)</strong> entre el <strong>${vacacion.fecha_inicio}</strong> y el <strong>${vacacion.fecha_fin}</strong>.</p>
      ${vacacion.motivo ? `<p style="color:#475569"><em>Motivo:</em> ${escapeHtml(vacacion.motivo)}</p>` : ''}
      <p style="color:#94a3b8;font-size:12px;margin-top:24px">Aprueba o rechaza desde la ficha del trabajador en Unabase Personas.</p>
    </div>
  `
  await enviarEmail({
    to:      emails,
    subject: `Nueva solicitud de vacaciones — ${vacacion.trabajador_nombre}`,
    html,
  })
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]))
}
