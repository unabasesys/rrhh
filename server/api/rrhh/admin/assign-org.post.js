/**
 * POST /api/rrhh/admin/assign-org
 * Asigna todos los trabajadores sin orgId a la organización indicada.
 * Uso único de migración. Body: { orgId: 'org_xxx' }
 */
import Organization from '@/server/models/Organization'
import Trabajador    from '@/server/models/Trabajador'
import { requireDb } from '@/server/utils/db'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const { orgId } = await readBody(event)

  if (!orgId) throw createError({ statusCode: 400, message: 'orgId requerido' })

  // Verificar que la org existe
  const org = await Organization.findById(orgId).lean()
  if (!org) throw createError({ statusCode: 404, message: `Org ${orgId} no encontrada` })

  // Actualizar trabajadores sin orgId (o con orgId null/undefined)
  const result = await Trabajador.updateMany(
    { $or: [{ orgId: null }, { orgId: { $exists: false } }] },
    { $set: { orgId } }
  )

  return {
    ok:       true,
    orgNombre: org.nombre,
    updated:  result.modifiedCount,
    matched:  result.matchedCount,
  }
})
