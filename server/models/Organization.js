import mongoose from 'mongoose'

const RepresentanteSchema = new mongoose.Schema(
  {
    nombre: { type: String, trim: true, default: '' },
    rut:    { type: String, trim: true, default: '' },
  },
  { _id: false }
)

const OrganizationSchema = new mongoose.Schema(
  {
    _id:                { type: String },
    nombre:             { type: String, required: true, trim: true },
    rut:                { type: String, trim: true, default: '' },
    logo:               { type: String, default: null },   // base64 o URL
    direccion:          { type: String, trim: true, default: '' },
    comuna:             { type: String, trim: true, default: '' },
    ciudad:             { type: String, trim: true, default: '' },
    representanteLegal: { type: RepresentanteSchema, default: null },
    activo:             { type: Boolean, default: true },
  },
  {
    _id:        false,
    versionKey: false,
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  }
)

export default mongoose.models.Organization ||
  mongoose.model('Organization', OrganizationSchema)
