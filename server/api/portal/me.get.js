/**
 * GET /api/portal/me
 * Devuelve el perfil completo del trabajador asociado a este usuario:
 * datos personales, organización empleadora y contratos vigentes.
 *
 * Solo puede usarse con un usuario rol=viewer que tenga trabajador_id.
 */
import { requireDb } from '../../utils/db.js'
import { requireAuth } from '../../utils/requireAuth.js'
import Trabajador  from '../../models/Trabajador.js'
import Contrato    from '../../models/Contrato.js'
import Organization from '../../models/Organization.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const me = await requireAuth(event)
  if (!me.trabajador_id) {
    throw createError({ statusCode: 403, message: 'Tu cuenta no está vinculada a un trabajador' })
  }

  const trab = await Trabajador.findById(me.trabajador_id).lean()
  if (!trab) throw createError({ statusCode: 404, message: 'Trabajador no encontrado' })

  const [contratos, org] = await Promise.all([
    Contrato.find({ trabajador_id: trab._id }).sort({ fecha_inicio: -1 }).lean(),
    trab.orgId ? Organization.findById(trab.orgId).lean() : null,
  ])

  // Filtramos campos sensibles del trabajador antes de enviarlo
  const safe = { ...trab }
  delete safe.passwordHash

  return {
    ok: true,
    trabajador: safe,
    contratos,
    organizacion: org ? {
      _id: org._id,
      nombre: org.nombre,
      rut: org.rut,
      direccion: org.direccion,
      logo: org.logo,
    } : null,
  }
})
