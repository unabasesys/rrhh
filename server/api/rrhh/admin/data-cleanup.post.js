/**
 * POST /api/rrhh/admin/data-cleanup
 *
 * Elimina registros específicos identificados por sus IDs.
 * SOLO admin puede invocarlo. Las listas vienen del usuario después de
 * revisar el output de /admin/data-audit.
 *
 * Body: {
 *   trabajadores?:  [id, ...],
 *   contratos?:     [id, ...],
 *   liquidaciones?: [id, ...],
 *   marcaciones?:   [id, ...],
 *   turnos?:        [id, ...]
 * }
 *
 * Respuesta: contadores de cuántos se eliminaron por colección.
 */
import { requireDb } from '../../../utils/db.js'
import { requireAuth } from '../../../utils/requireAuth.js'
import Trabajador   from '../../../models/Trabajador.js'
import Contrato     from '../../../models/Contrato.js'
import Liquidacion  from '../../../models/Liquidacion.js'
import Marcacion    from '../../../models/Marcacion.js'
import Turno        from '../../../models/Turno.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  await requireAuth(event, 'admin')
  const body = await readBody(event)

  const ids = {
    trabajadores:  Array.isArray(body.trabajadores)  ? body.trabajadores  : [],
    contratos:     Array.isArray(body.contratos)     ? body.contratos     : [],
    liquidaciones: Array.isArray(body.liquidaciones) ? body.liquidaciones : [],
    marcaciones:   Array.isArray(body.marcaciones)   ? body.marcaciones   : [],
    turnos:        Array.isArray(body.turnos)        ? body.turnos        : [],
  }

  const result = {}
  if (ids.liquidaciones.length) {
    const r = await Liquidacion.deleteMany({ _id: { $in: ids.liquidaciones } })
    result.liquidaciones = r.deletedCount
  }
  if (ids.marcaciones.length) {
    const r = await Marcacion.deleteMany({ _id: { $in: ids.marcaciones } })
    result.marcaciones = r.deletedCount
  }
  if (ids.contratos.length) {
    const r = await Contrato.deleteMany({ _id: { $in: ids.contratos } })
    result.contratos = r.deletedCount
  }
  if (ids.turnos.length) {
    const r = await Turno.deleteMany({ _id: { $in: ids.turnos } })
    result.turnos = r.deletedCount
  }
  // Trabajadores se eliminan al final (por integridad referencial implícita)
  if (ids.trabajadores.length) {
    const r = await Trabajador.deleteMany({ _id: { $in: ids.trabajadores } })
    result.trabajadores = r.deletedCount
  }

  return { ok: true, eliminados: result }
})
