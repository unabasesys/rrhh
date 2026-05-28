/**
 * GET /api/portal/by-token/:token
 * Endpoint PÚBLICO — no requiere auth. Resuelve el trabajador desde un token
 * único en la URL y devuelve datos seguros para el portal del trabajador:
 *   - perfil básico (nombre, cargo, foto)
 *   - marcación de hoy (si existe)
 *   - turnos y proyectos disponibles para su organización
 */
import { requireDb } from '../../../utils/db.js'
import PortalToken from '../../../models/PortalToken.js'
import Trabajador  from '../../../models/Trabajador.js'
import Marcacion   from '../../../models/Marcacion.js'
import Turno       from '../../../models/Turno.js'
import Proyecto    from '../../../models/Proyecto.js'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default defineEventHandler(async (event) => {
  requireDb(event)
  const token = getRouterParam(event, 'token')
  if (!token) throw createError({ statusCode: 400, message: 'Token requerido' })

  const tok = await PortalToken.findOne({ token, activo: true }).lean()
  if (!tok) throw createError({ statusCode: 404, message: 'El link no es válido o ha expirado' })

  const trab = await Trabajador.findById(tok.trabajador_id).lean()
  if (!trab) throw createError({ statusCode: 404, message: 'Trabajador no encontrado' })

  // Datos visibles (sin info sensible bancaria)
  const trabajador = {
    _id:        trab._id,
    nombre:     trab.nombre,
    apellido:   trab.apellido,
    cargo:      trab.cargo,
    foto:       trab.foto,
    orgId:      trab.orgId,
  }

  const fecha = todayStr()
  const [marcacionHoy, turnos, proyectos] = await Promise.all([
    Marcacion.findOne({ trabajador_id: trab._id, fecha }).lean(),
    Turno.find({ orgId: trab.orgId, activo: true }).sort({ nombre: 1 }).lean(),
    Proyecto.find({ orgId: trab.orgId, activo: true }).sort({ createdAt: 1 }).lean(),
  ])

  // Marcar último uso (no bloqueante)
  PortalToken.findByIdAndUpdate(tok._id, { ultimo_uso: new Date() }).catch(() => {})

  return {
    token,
    trabajador,
    marcacionHoy: marcacionHoy || null,
    turnos: turnos || [],
    proyectos: proyectos || [],
    fecha,
  }
})
