import Vacacion from '../../../models/Vacacion.js'
import { requireDb } from '../../../utils/db.js'
import { requireAuth } from '../../../utils/requireAuth.js'
import { enviarEmail } from '../../../utils/mailer.js'
import User from '../../../models/User.js'

/**
 * PUT /api/rrhh/vacaciones/:id
 * Aprueba, rechaza o vuelve a pendiente una solicitud. Solo manager/admin.
 *
 * Body: { estado: 'aprobada'|'rechazada'|'pendiente'|'cancelada', notas_aprobacion? }
 */
export default defineEventHandler(async (event) => {
  requireDb(event)
  const user = await requireAuth(event, 'manager')
  const id = event.context.params.id
  const body = await readBody(event)

  const vac = await Vacacion.findById(id)
  if (!vac) throw createError({ statusCode: 404, message: 'Solicitud no encontrada' })

  if (body.estado) vac.estado = body.estado
  if (typeof body.notas_aprobacion === 'string') vac.notas_aprobacion = body.notas_aprobacion
  vac.revisado_por_id     = user._id || user.id || null
  vac.revisado_por_nombre = user.nombre || user.email || null
  vac.revisado_fecha      = new Date()

  await vac.save()

  // Notificar al trabajador si su user existe en la DB
  notificarTrabajador(vac.toObject()).catch(() => {})

  return vac.toObject()
})

async function notificarTrabajador(vacacion) {
  // Buscar usuario asociado al trabajador (por trabajador_id en User si existe)
  // Para MVP nos basamos en User.email del trabajador si está poblado.
  // En esta versión no requerimos que el trabajador tenga User — si no
  // tiene, simplemente no se notifica.
  if (!vacacion.trabajador_id) return
  const u = await User.findOne({ trabajador_id: vacacion.trabajador_id }).lean()
  if (!u?.email) return

  const titulo = vacacion.estado === 'aprobada' ? 'Tu solicitud fue aprobada ✅'
              : vacacion.estado === 'rechazada' ? 'Tu solicitud fue rechazada'
              : 'Actualización de tu solicitud'
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;padding:24px;background:#f8fafc;border-radius:12px">
      <h2 style="margin:0 0 12px;color:#0f172a">${titulo}</h2>
      <p style="color:#475569;line-height:1.55">Tu solicitud de vacaciones del <strong>${vacacion.fecha_inicio}</strong> al <strong>${vacacion.fecha_fin}</strong> (${vacacion.dias_habiles} día(s) hábiles) ahora está en estado <strong>${vacacion.estado}</strong>.</p>
      ${vacacion.notas_aprobacion ? `<p style="color:#475569"><em>Nota:</em> ${escapeHtml(vacacion.notas_aprobacion)}</p>` : ''}
    </div>
  `
  await enviarEmail({ to: u.email, subject: titulo, html })
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]))
}
