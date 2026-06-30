import mongoose from 'mongoose'

/**
 * Solicitud de vacaciones del trabajador.
 *
 * Flujo:
 *   1. Trabajador (desde el portal) o manager (desde la app) crea una
 *      solicitud — estado 'pendiente'.
 *   2. Manager la aprueba/rechaza — pasa a 'aprobada' / 'rechazada'.
 *   3. Cuando la fecha_fin queda en el pasado, el cálculo (no la DB) la
 *      considera 'realizada'.
 *
 * Los días se calculan en hábiles (lun–vie) — la lógica vive en
 * server/utils/vacacionesPolicy.js para poder cambiar la regla por país.
 */
const VacacionSchema = new mongoose.Schema({
  _id:                { type: String, required: true },  // vac_timestamp_random
  trabajador_id:      { type: String, required: true, index: true },
  trabajador_nombre:  { type: String },
  orgId:              { type: String, default: null, ref: 'Organization', index: true },
  // Rango solicitado (ISO 'YYYY-MM-DD')
  fecha_inicio:       { type: String, required: true },
  fecha_fin:          { type: String, required: true },
  dias_habiles:       { type: Number, default: 0 },  // calculado al crear
  // Estado
  estado:             { type: String, default: 'pendiente', enum: ['pendiente', 'aprobada', 'rechazada', 'cancelada'] },
  motivo:             { type: String, default: '' },     // texto libre del solicitante
  // Quién solicitó (worker desde portal o manager desde app)
  solicitado_por:     { type: String, enum: ['trabajador', 'manager'], default: 'manager' },
  solicitado_por_id:  { type: String, default: null },
  solicitado_por_nombre: { type: String, default: null },
  // Revisión
  revisado_por_id:    { type: String, default: null },
  revisado_por_nombre:{ type: String, default: null },
  revisado_fecha:     { type: Date,   default: null },
  notas_aprobacion:   { type: String, default: '' },
  // Firma del trabajador (capturada desde el portal, mismo flujo que liquidaciones)
  firma_data:         { type: String, default: null },   // base64 PNG (data URL)
  firma_tipo:         { type: String, default: null },   // 'digital' | 'manual'
  firma_fecha:        { type: Date,   default: null },
  // Snapshot del saldo al momento de generar el comprobante — fija los números
  // del PDF y evita que cambien si después se aprueba otra solicitud.
  saldo_snapshot:     { type: mongoose.Schema.Types.Mixed, default: null },
  // Metadatos
  creado:             { type: Date, default: Date.now },
}, { _id: false, versionKey: false })

VacacionSchema.index({ trabajador_id: 1, fecha_inicio: -1 })
VacacionSchema.index({ orgId: 1, estado: 1 })

export default mongoose.models.Vacacion
  || mongoose.model('Vacacion', VacacionSchema)
