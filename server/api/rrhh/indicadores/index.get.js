/**
 * GET /api/rrhh/indicadores
 * Devuelve los indicadores previsionales vigentes (documento `current`).
 * Si aún no existe, responde el seed (el plugin lo creará en breve).
 */
import Indicadores from '../../../models/Indicadores.js'
import { INDICADORES_SEED } from '../../../utils/indicadoresSeed.js'
import { requireDb } from '../../../utils/db.js'
import { requireAuth } from '../../../utils/requireAuth.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  await requireAuth(event)
  const doc = await Indicadores.findById('current').lean()
  return doc || { ...INDICADORES_SEED, _id: 'current' }
})
