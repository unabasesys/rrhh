/**
 * POST /api/rrhh/indicadores/sync
 * Fuerza una sincronización de UF/UTM desde mindicador.cl y recalcula topes.
 * Útil desde la página de indicadores ("Actualizar ahora"). Solo manager/admin.
 */
import { requireDb } from '../../../utils/db.js'
import { requireAuth } from '../../../utils/requireAuth.js'
import { syncIndicadores } from '../../../utils/previredSync.js'
import { INDICADORES_SEED } from '../../../utils/indicadoresSeed.js'
import Indicadores from '../../../models/Indicadores.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  await requireAuth(event, 'manager')
  const r = await syncIndicadores(INDICADORES_SEED)
  if (!r.ok) throw createError({ statusCode: 502, message: 'No se pudo sincronizar: ' + (r.error || 'error') })
  const doc = await Indicadores.findById('current').lean()
  return { ok: true, uf: r.uf, utm: r.utm, changed: r.changed, indicadores: doc }
})
