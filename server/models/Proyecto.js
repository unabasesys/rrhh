import mongoose from 'mongoose'

const ProyectoSchema = new mongoose.Schema(
  {
    _id:         { type: String },
    nombre:      { type: String, required: true, trim: true },
    codigo:      { type: String, trim: true, default: '' },
    tipo:        { type: String, enum: ['venta', 'gasto'], default: 'venta' },
    descripcion: { type: String, default: '' },
    orgId:       { type: String, default: null },
    activo:      { type: Boolean, default: true },
    unabase_id:  { type: String, default: null },  // future integration
  },
  { _id: false, versionKey: false, timestamps: true }
)

export default mongoose.models.Proyecto || mongoose.model('Proyecto', ProyectoSchema)
