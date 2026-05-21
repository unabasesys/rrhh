import mongoose from 'mongoose'

const TrabajadorSchema = new mongoose.Schema({
  _id:          { type: String, required: true },   // w_timestamp_random
  nombre:       { type: String, required: true },
  apellido:     { type: String, required: true },
  rut:          { type: String },
  email:        { type: String },
  telefono:     { type: String },
  cargo:        { type: String },
  departamento: { type: String },
  profesion:    { type: String },
  sexo:         { type: String },
  fecha_nacimiento: { type: String },
  nacionalidad: { type: String, default: 'Chilena' },
  direccion:    { type: String },
  // Previsión
  afp:          { type: String, default: 'AFP Capital' },
  sistema_salud:{ type: String, default: 'FONASA' },
  // Banco
  banco:        { type: String },
  tipo_cuenta:  { type: String },
  numero_cuenta:{ type: String },
  // Estado
  estado:       { type: String, default: 'activo', enum: ['activo', 'inactivo'] },
  fecha_ingreso:{ type: String },
  // Org (multi-empresa)
  orgId:        { type: String, default: null, ref: 'Organization' },
  // Metadatos
  creado:       { type: Date, default: Date.now },
  actualizado:  { type: Date, default: Date.now },
}, { _id: false, versionKey: false })

TrabajadorSchema.pre('save', async function () {
  this.actualizado = new Date()
})

export default mongoose.models.Trabajador
  || mongoose.model('Trabajador', TrabajadorSchema)
