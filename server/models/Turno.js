import mongoose from 'mongoose'

const TurnoSchema = new mongoose.Schema({
  _id:          { type: String, required: true },
  nombre:       { type: String, required: true },
  hora_entrada: { type: String },   // 'HH:MM'
  hora_salida:  { type: String },   // 'HH:MM'
  dias:         { type: [Number], default: [1, 2, 3, 4, 5] },  // 0=Dom, 1=Lun, ...
  color:        { type: String, default: '#2a9d8f' },
  descripcion:  { type: String },
  activo:       { type: Boolean, default: true },
  orgId:        { type: String, default: null, ref: 'Organization', index: true },
  creado:       { type: Date, default: Date.now },
}, { _id: false, versionKey: false })

export default mongoose.models.Turno
  || mongoose.model('Turno', TurnoSchema)
