import Anticipo  from '../../../models/Anticipo.js'
import Trabajador from '../../../models/Trabajador.js'
import { requireDb, newId } from '../../../utils/db.js'
import { requireAuth, requireOrgAccess } from '../../../utils/requireAuth.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const user = await requireAuth(event, 'manager')
  const body = await readBody(event)

  if (!body?.trabajador_id || !body?.monto || !body?.mes || !body?.anio) {
    throw createError({ statusCode: 400, message: 'trabajador_id, monto, mes y anio son requeridos' })
  }

  const trab = await Trabajador.findById(body.trabajador_id).lean()
  if (!trab) throw createError({ statusCode: 404, message: 'Trabajador no encontrado' })
  requireOrgAccess(user, trab.orgId)

  const nombre = [trab.nombre, trab.apellido, trab.apellido_paterno, trab.apellido_materno]
    .filter(Boolean).join(' ') || 'Trabajador'

  const doc = new Anticipo({
    _id:                newId('ant'),
    trabajador_id:      body.trabajador_id,
    trabajador_nombre:  nombre,
    orgId:              trab.orgId || user.orgId || null,
    mes:                Number(body.mes),
    anio:               Number(body.anio),
    fecha:              body.fecha || new Date().toISOString().slice(0, 10),
    monto:              Number(body.monto),
    motivo:             body.motivo || '',
    estado:             body.estado || 'pagado',
    creado_por_id:      user._id || user.id || null,
    creado_por_nombre:  user.nombre || user.email || null,
  })
  await doc.save()
  return doc.toObject()
})
