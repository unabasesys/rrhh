/**
 * GET /api/rrhh/trabajadores/counts
 * Devuelve un objeto { [orgId]: count } con el total de trabajadores por org.
 * Los huérfanos (sin org) quedan bajo la clave "__orphan__".
 */
import Trabajador from '../../../models/Trabajador.js'
import { requireDb } from '../../../utils/db.js'
import { requireAuth, orgScopeFilter } from '../../../utils/requireAuth.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const user = await requireAuth(event)

  // Scoping multi-tenant: manager/viewer solo cuentan sus propias orgs.
  const scope = orgScopeFilter(user, getQuery(event).orgId)

  const pipeline = []
  if (Object.keys(scope).length) pipeline.push({ $match: scope })
  pipeline.push({
    $group: {
      _id: { $ifNull: ['$orgId', '__orphan__'] },
      count: { $sum: 1 },
    },
  })

  const rows = await Trabajador.aggregate(pipeline)

  const counts = {}
  for (const row of rows) {
    counts[row._id] = row.count
  }

  return counts
})
