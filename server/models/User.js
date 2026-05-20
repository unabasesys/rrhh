import mongoose from 'mongoose'

const UserSchema = new mongoose.Schema(
  {
    _id:          { type: String },
    nombre:       { type: String, required: true, trim: true },
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    rol:          { type: String, enum: ['admin', 'manager', 'viewer'], default: 'viewer' },
    activo:       { type: Boolean, default: true },
  },
  {
    _id:        false,
    versionKey: false,
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  }
)

// Índice para búsqueda rápida por email
UserSchema.index({ email: 1 }, { unique: true })

export default mongoose.models.User || mongoose.model('User', UserSchema)
