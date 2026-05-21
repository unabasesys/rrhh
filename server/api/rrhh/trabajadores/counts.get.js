/**
 * GET /api/rrhh/trabajadores/counts
 * Devuelve un objeto { [orgId]: count } con el total de trabajadores por org.
 * Los huérfanos (sin org) quedan bajo la clave "__orphan__".
 */
import Trabajador from '../../../models/Trabajador.js'
import { requireDb } from '../../../utils/db.js'

export default defineEventHandler(async (event) => {
  requireDb(event)

  const rows = await Trabajador.aggregate([
    {
      $group: {
        _id: { $ifNull: ['$orgId', '__orphan__'] },
        count: { $sum: 1 },
      },
    },
  ])

  const counts = {}
  for (const row of rows) {
    counts[row._id] = row.count
  }

  return counts
})
