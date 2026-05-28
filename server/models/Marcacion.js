import mongoose from 'mongoose'

const MarcacionSchema = new mongoose.Schema({
  _id:              { type: String, required: true },  // marc_timestamp_random
  trabajador_id:    { type: String, required: true, index: true },
  fecha:            { type: String, required: true },  // 'YYYY-MM-DD'
  entrada:          { type: String },   // 'HH:MM'
  salida:           { type: String },   // 'HH:MM'
  horas:            { type: Number, default: 0 },
  horas_extra:      { type: Number, default: 0 },
  atraso:           { type: Number, default: 0 },   // minutos
  proyecto_nombre:  { type: String },
  turno_id:         { type: String },
  tipo:             { type: String, default: 'normal', enum: ['normal', 'extra', 'permiso', 'feriado'] },
  estado:           { type: String, default: 'pendiente', enum: ['pendiente', 'confirmada', 'rechazada'] },
  notas:            { type: String },
  orgId:            { type: String, default: null, ref: 'Organization', index: true },
  // Metadatos
  creado:           { type: Date, default: Date.now },
}, { _id: false, versionKey: false })

MarcacionSchema.index({ trabajador_id: 1, fecha: -1 })
MarcacionSchema.index({ fecha: -1 })

export default mongoose.models.Marcacion
  || mongoose.model('Marcacion', MarcacionSchema)
