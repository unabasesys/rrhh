/**
 * GET /api/portal/by-token/:token/vacaciones
 * Endpoint PÚBLICO — el trabajador ve su balance y solicitudes.
 */
import { requireDb }   from '../../../../utils/db.js'
import PortalToken     from '../../../../models/PortalToken.js'
import Trabajador      from '../../../../models/Trabajador.js'
import Contrato        from '../../../../models/Contrato.js'
import Vacacion        from '../../../../models/Vacacion.js'
import { getPolicy, calcularBalance } from '../../../../utils/vacacionesPolicy.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const token = getRouterParam(event, 'token')
  if (!token) throw createError({ statusCode: 400, message: 'Token requerido' })

  const tok = await PortalToken.findOne({ token, activo: true }).lean()
  if (!tok) throw createError({ statusCode: 404, message: 'Link inválido o expirado' })

  const trab = await Trabajador.findById(tok.trabajador_id).lean()
  if (!trab) throw createError({ statusCode: 404, message: 'Trabajador no encontrado' })

  let fechaIngreso = trab.fecha_ingreso
  if (!fechaIngreso) {
    const c = await Contrato.find({ trabajador_id: trab._id, estado: { $ne: 'finiquitado' } })
      .sort({ fecha_inicio: 1 }).limit(1).lean()
    fechaIngreso = c[0]?.fecha_inicio
  }

  const vacaciones = await Vacacion.find({ trabajador_id: trab._id }).sort({ fecha_inicio: -1 }).lean()
  const policy = getPolicy('CL')
  const balance = calcularBalance({ fechaIngreso, vacaciones, policy })

  return {
    balance: { ...balance, fechaIngreso: fechaIngreso || null },
    solicitudes: vacaciones,
  }
})
