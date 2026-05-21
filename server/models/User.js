import mongoose from 'mongoose'

const UserSchema = new mongoose.Schema(
  {
    _id:          { type: String },
    nombre:       { type: String, required: true, trim: true },
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    rol:          { type: String, enum: ['admin', 'manager', 'viewer'], default: 'viewer' },
    orgId:        { type: String, default: null, ref: 'Organization' }, // null = super-admin
    esSuperAdmin: { type: Boolean, default: false },
    activo:       { type: Boolean, default: true },
    // Sesión activa
    token:        { type: String, default: null },
    tokenExpires: { type: Date,   default: null },
  },
  {
    _id:        false,
    versionKey: false,
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  }
)

UserSchema.index({ email: 1 }, { unique: true })
UserSchema.index({ token: 1 }, { sparse: true })

export default mongoose.models.User || mongoose.model('User', UserSchema)
