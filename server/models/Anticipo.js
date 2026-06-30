import mongoose from 'mongoose'

const AnticipoSchema = new mongoose.Schema({
  _id:               { type: String, required: true },  // ant_timestamp_random
  trabajador_id:     { type: String, required: true, index: true },
  trabajador_nombre: { type: String },
  orgId:             { type: String, default: null, ref: 'Organization', index: true },
  // Mes/año al que aplica el anticipo (para descontarlo en esa liquidación)
  mes:               { type: Number, required: true },
  anio:              { type: Number, required: true },
  fecha:             { type: String },   // 'YYYY-MM-DD' fecha de pago efectivo
  monto:             { type: Number, required: true },
  motivo:            { type: String, default: '' },
  // Estado para flujo futuro de aprobación
  estado:            { type: String, default: 'pagado', enum: ['pendiente', 'pagado', 'descontado', 'cancelado'] },
  // Si está descontado en una liquidación específica
  liquidacion_id:    { type: String, default: null },
  creado:            { type: Date, default: Date.now },
  creado_por_id:     { type: String, default: null },
  creado_por_nombre: { type: String, default: null },
}, { _id: false, versionKey: false })

AnticipoSchema.index({ trabajador_id: 1, anio: -1, mes: -1 })
AnticipoSchema.index({ orgId: 1, anio: -1, mes: -1 })

export default mongoose.models.Anticipo
  || mongoose.model('Anticipo', AnticipoSchema)
