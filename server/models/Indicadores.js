import mongoose from 'mongoose'

/**
 * Indicadores previsionales vigentes (documento único `_id: 'current'`).
 * La UF y UTM se refrescan periódicamente desde mindicador.cl (ver
 * server/utils/previredSync.js + server/plugins/indicadores-sync.js).
 * Los topes imponibles en pesos se derivan de sus bases en UF.
 *
 * strict:false → guarda todo el objeto de indicadores sin declarar cada campo,
 * para poder evolucionar el set sin migraciones.
 */
const IndicadoresSchema = new mongoose.Schema({
  _id: { type: String, default: 'current' },
}, { strict: false, versionKey: false, minimize: false })

export default mongoose.models.Indicadores
  || mongoose.model('Indicadores', IndicadoresSchema)
