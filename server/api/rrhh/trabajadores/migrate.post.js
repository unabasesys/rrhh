/**
 * POST /api/rrhh/trabajadores/migrate
 * Asigna una organización a todos los trabajadores que no tienen orgId.
 * Body: { toOrgId: 'org_xxx' }
 */
import Trabajador from '../../../models/Trabajador.js'
import { requireDb } from '../../../utils/db.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const { toOrgId } = await readBody(event)

  if (!toOrgId) {
    throw createError({ statusCode: 400, statusMessage: 'toOrgId requerido' })
  }

  const result = await Trabajador.updateMany(
    { $or: [{ orgId: null }, { orgId: { $exists: false } }] },
    { $set: { orgId: toOrgId, actualizado: new Date() } }
  )

  return { ok: true, updated: result.modifiedCount }
})
