import Vacacion from '../../../models/Vacacion.js'
import Trabajador from '../../../models/Trabajador.js'
import Contrato from '../../../models/Contrato.js'
import { requireDb } from '../../../utils/db.js'
import { requireAuth } from '../../../utils/requireAuth.js'
import { getPolicy, calcularBalance } from '../../../utils/vacacionesPolicy.js'

/**
 * GET /api/rrhh/vacaciones/balance?trabajador_id=...
 * Devuelve acumulado, tomadas, aprobadas a futuro, pendientes y disponible.
 */
export default defineEventHandler(async (event) => {
  requireDb(event)
  await requireAuth(event)
  const { trabajador_id } = getQuery(event)
  if (!trabajador_id) throw createError({ statusCode: 400, message: 'trabajador_id requerido' })

  const trabajador = await Trabajador.findById(trabajador_id).lean()
  if (!trabajador) throw createError({ statusCode: 404, message: 'Trabajador no encontrado' })

  // Fecha de ingreso: la del contrato más antiguo activo, o el fecha_ingreso
  // del trabajador, o un fallback razonable.
  let fechaIngreso = trabajador.fecha_ingreso
  if (!fechaIngreso) {
    const contratos = await Contrato.find({ trabajador_id, estado: { $ne: 'finiquitado' } })
      .sort({ fecha_inicio: 1 }).limit(1).lean()
    fechaIngreso = contratos[0]?.fecha_inicio
  }

  const vacaciones = await Vacacion.find({ trabajador_id }).lean()
  const policy = getPolicy('CL')
  const balance = calcularBalance({ fechaIngreso, vacaciones, policy })

  return {
    trabajador_id,
    fechaIngreso: fechaIngreso || null,
    ...balance,
  }
})
