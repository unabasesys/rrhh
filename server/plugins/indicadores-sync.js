/**
 * server/plugins/indicadores-sync.js
 * Mantiene los indicadores previsionales actualizados de forma periódica:
 *   1. Al arrancar: siembra el documento `current` si no existe.
 *   2. Ejecuta una sincronización inmediata (UF/UTM desde mindicador.cl).
 *   3. Repite cada 12 horas mientras el proceso viva (Railway lo mantiene up).
 *
 * Así la UF/UTM y los topes imponibles se refrescan solos, sin edición manual.
 */
import Indicadores from '../models/Indicadores.js'
import { INDICADORES_SEED } from '../utils/indicadoresSeed.js'
import { syncIndicadores } from '../utils/previredSync.js'

const DOCE_HORAS = 12 * 60 * 60 * 1000

export default defineNitroPlugin((nitroApp) => {
  // No bloquear el arranque: correr en segundo plano.
  const arrancar = async () => {
    try {
      // Seed si el documento no existe todavía
      const existe = await Indicadores.findById('current').lean()
      if (!existe) {
        await Indicadores.updateOne(
          { _id: 'current' },
          { $set: { ...INDICADORES_SEED, _id: 'current' } },
          { upsert: true },
        )
        console.log('[indicadores] documento sembrado')
      }

      // Sincronización inmediata
      const r = await syncIndicadores(INDICADORES_SEED)
      if (r.ok) console.log(`[indicadores] sync OK · UF ${r.uf} · UTM ${r.utm}${r.changed ? ' (actualizado)' : ''}`)
      else      console.warn('[indicadores] sync falló:', r.error)
    } catch (e) {
      console.error('[indicadores] arranque falló:', e.message)
    }
  }

  // Esperar un momento a que Mongoose conecte, luego arrancar + programar
  setTimeout(arrancar, 4000)
  setInterval(() => { syncIndicadores(INDICADORES_SEED).catch(() => {}) }, DOCE_HORAS)
})
