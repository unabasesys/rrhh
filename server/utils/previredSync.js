/**
 * server/utils/previredSync.js
 * Sincroniza los indicadores previsionales. La UF y UTM (lo que cambia mes a
 * mes) se traen de mindicador.cl — API pública y estable de indicadores
 * chilenos. Los topes imponibles en pesos se derivan de su base en UF.
 *
 * Los valores que cambian con poca frecuencia (comisiones AFP, SMM, asignación
 * familiar, tasas) se conservan del documento actual o del seed, y se editan
 * manualmente desde la página de indicadores cuando Previred publica cambios.
 */
import Indicadores from '../models/Indicadores.js'

const MINDICADOR = 'https://mindicador.cl/api'
const TIMEOUT_MS = 12000
const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

/**
 * Trae UF y UTM actuales desde mindicador.cl.
 * @returns {Promise<{uf:number, ufFecha:string, utm:number, utmFecha:string}|null>}
 */
async function fetchUfUtm() {
  // mindicador.cl a veces responde en decenas de segundos: sin timeout el
  // botón "Actualizar" de la página quedaría colgado. Cortamos y reintentamos
  // una vez; si falla, el sync devuelve error y el plugin lo repite después.
  let ultimoError = null
  for (let intento = 1; intento <= 2; intento++) {
    try {
      const res = await fetch(MINDICADOR, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (!res.ok) throw new Error(`mindicador HTTP ${res.status}`)
      const data = await res.json()
      const uf  = Number(data?.uf?.valor)
      const utm = Number(data?.utm?.valor)
      if (!uf || !utm) throw new Error('mindicador: UF/UTM inválidos')
      return {
        uf, utm,
        ufFecha:  data.uf.fecha  || null,
        utmFecha: data.utm.fecha || null,
      }
    } catch (e) {
      ultimoError = e.name === 'TimeoutError'
        ? new Error(`mindicador.cl no respondió en ${TIMEOUT_MS / 1000}s`)
        : e
    }
  }
  throw ultimoError
}

function fechaLegible(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return ''
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth() + 1]} ${d.getUTCFullYear()}`
}

/**
 * Ejecuta la sincronización: lee el doc actual (o usa el seed), refresca
 * UF/UTM/UTA y recalcula los topes en pesos. Upsert en Mongo.
 *
 * @param {object} [seed] indicadores por defecto (para primer arranque)
 * @returns {Promise<{ok:boolean, uf?:number, changed?:boolean, error?:string}>}
 */
export async function syncIndicadores(seed = null) {
  try {
    // Base: doc actual en DB, o seed si aún no existe
    let doc = await Indicadores.findById('current').lean()
    if (!doc) {
      if (!seed) return { ok: false, error: 'sin doc ni seed' }
      doc = { ...seed, _id: 'current' }
    }

    const { uf, utm, ufFecha, utmFecha } = await fetchUfUtm()

    // Bases en UF de los topes (con fallback a las del seed/actual)
    const topeAfpUf      = doc.tope_afp_uf      ?? 90
    const topeIpsUf      = doc.tope_ips_uf      ?? 60
    const topeCesantiaUf = doc.tope_cesantia_uf ?? 135.2

    const update = {
      ...doc,
      _id:            'current',
      uf_actual:      uf,
      uf_fecha:       fechaLegible(ufFecha),
      utm:            utm,
      utm_fecha:      fechaLegible(utmFecha),
      uta:            utm * 12,
      // Topes en pesos derivados de la UF vigente
      tope_afp:       Math.round(topeAfpUf * uf),
      tope_ips:       Math.round(topeIpsUf * uf),
      tope_cesantia:  Math.round(topeCesantiaUf * uf),
      // Metadatos de sincronización
      sync_fuente:    'mindicador.cl',
      sync_fecha:     new Date().toISOString(),
      actualizado:    new Date().toISOString().slice(0, 10),
    }

    const changed = doc.uf_actual !== uf || doc.utm !== utm
    await Indicadores.updateOne({ _id: 'current' }, { $set: update }, { upsert: true })
    return { ok: true, uf, utm, changed }
  } catch (e) {
    console.error('[previredSync] error:', e.message)
    return { ok: false, error: e.message }
  }
}
