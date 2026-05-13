import mongoose from 'mongoose'

const FiniquitoSchema = new mongoose.Schema({
  _id:              { type: String, required: true },
  trabajador_id:    { type: String, required: true, index: true },
  contrato_id:      { type: String },
  fecha_termino:    { type: String },
  causal:           { type: String },      // Art. 159, 160, 161...
  causal_texto:     { type: String },
  // Montos
  indemnizacion:    { type: Number, default: 0 },
  vacaciones_pend:  { type: Number, default: 0 },
  proporcional_mes: { type: Number, default: 0 },
  otros:            { type: Number, default: 0 },
  total:            { type: Number, default: 0 },
  // Estado
  estado:           { type: String, default: 'borrador', enum: ['borrador', 'firmado', 'pagado'] },
  pdf_generado:     { type: Boolean, default: false },
  creado:           { type: Date, default: Date.now },
}, { _id: false, versionKey: false })

export default mongoose.models.Finiquito
  || mongoose.model('Finiquito', FiniquitoSchema)
