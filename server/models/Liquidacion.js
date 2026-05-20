import mongoose from 'mongoose'

const LiquidacionSchema = new mongoose.Schema({
  _id:                  { type: String, required: true },  // liq_timestamp_random
  trabajador_id:        { type: String, required: true, index: true },
  trabajador_nombre:    { type: String },
  contrato_id:          { type: String },
  contratos_sel:        { type: mongoose.Schema.Types.Mixed },
  negocio_nombre:       { type: String },
  // Período
  mes:                  { type: Number, required: true },
  anio:                 { type: Number, required: true },
  // Cálculos
  dias_trabajados:      { type: Number, default: 30 },
  horas_extra:          { type: Number, default: 0 },
  sueldo_base:          { type: Number, default: 0 },
  total_haberes:        { type: Number, default: 0 },
  total_descuentos:     { type: Number, default: 0 },
  liquido_a_pagar:      { type: Number, default: 0 },
  costo_empresa:        { type: Number, default: 0 },
  // Descuentos detallados
  afp_descuento:        { type: Number, default: 0 },
  salud_descuento:      { type: Number, default: 0 },
  cesantia_trabajador:  { type: Number, default: 0 },
  cesantia_empleador:   { type: Number, default: 0 },
  impuesto:             { type: Number, default: 0 },
  renta_imponible:      { type: Number, default: 0 },
  renta_tributable:     { type: Number, default: 0 },
  // Bonos y descuentos adicionales
  bonos:                { type: mongoose.Schema.Types.Mixed, default: [] },
  descuentos:           { type: mongoose.Schema.Types.Mixed, default: [] },
  notas:                { type: String },
  // Estado
  estado:               { type: String, default: 'borrador', enum: ['borrador', 'pagada', 'pendiente'] },
  // Org (multi-empresa)
  orgId:                { type: String, default: null, ref: 'Organization' },
  // Metadatos
  creado:               { type: Date, default: Date.now },
}, { _id: false, versionKey: false })

LiquidacionSchema.index({ trabajador_id: 1, mes: 1, anio: 1 })

export default mongoose.models.Liquidacion
  || mongoose.model('Liquidacion', LiquidacionSchema)
