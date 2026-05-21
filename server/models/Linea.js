import mongoose from 'mongoose'

const LineaSchema = new mongoose.Schema(
  {
    _id:        { type: String },
    nombre:     { type: String, required: true, trim: true },
    codigo:     { type: String, trim: true, default: '' },
    categoria:  { type: String, trim: true, default: '' },
    proyectoId: { type: String, required: true },
    orgId:      { type: String, default: null },
    activo:     { type: Boolean, default: true },
  },
  { _id: false, versionKey: false, timestamps: true }
)

export default mongoose.models.Linea || mongoose.model('Linea', LineaSchema)
