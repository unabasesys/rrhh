import Turno from '../../../models/Turno.js'
import { requireDb } from '../../../utils/db.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  return Turno.find({ activo: true }).sort({ nombre: 1 }).lean()
})
