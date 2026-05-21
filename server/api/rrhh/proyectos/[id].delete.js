import Proyecto from '../../../models/Proyecto.js'
import Linea from '../../../models/Linea.js'
import { requireDb } from '../../../utils/db.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const id = getRouterParam(event, 'id')
  await Linea.deleteMany({ proyectoId: id })
  await Proyecto.findByIdAndDelete(id)
  return { ok: true }
})
