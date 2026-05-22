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

    // ── Billing ─────────────────────────────────────────────────────
    plan:              { type: String, enum: ['free', 'paid'], default: 'free' },
    planPrecioUSD:     { type: Number, default: 40 },   // USD por trabajador/mes
    billingEmail:      { type: String, default: '' },
    stripeCustomerId:  { type: String, default: null },
    mpCustomerId:      { type: String, default: null },
    billingStatus:     { type: String, enum: ['active', 'past_due', 'canceled', 'trialing'], default: 'active' },
    billingRenovacion: { type: Date, default: null },    // próxima fecha de facturación
  },
  {
    _id:        false,
    versionKey: false,
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  }
)

export default mongoose.models.Organization ||
  mongoose.model('Organization', OrganizationSchema)
