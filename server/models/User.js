import mongoose from 'mongoose'

const UserSchema = new mongoose.Schema(
  {
    _id:          { type: String },
    nombre:       { type: String, required: true, trim: true },
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    // passwordHash: null cuando el usuario sólo usa Google Sign-In
    passwordHash: { type: String, default: null },
    // Google Sign-In
    googleId:     { type: String, default: null, index: true },
    avatar:       { type: String, default: null },
    rol:          { type: String, enum: ['admin', 'manager', 'viewer'], default: 'viewer' },
    // orgId: legacy / "org primaria". Se mantiene por compat pero la fuente de
    // verdad para acceso es orgIds. Para admin global, ambos son nulos/vacíos.
    orgId:        { type: String, default: null, ref: 'Organization' },
    // orgIds: organizaciones a las que el usuario tiene acceso.
    //   - admin:   [] (vacío = acceso global a TODAS las orgs)
    //   - manager: 1 o más orgs (puede administrar varias)
    //   - viewer:  exactamente 1 (su empresa empleadora)
    orgIds:       { type: [String], default: [] },
    // Solo aplica a viewer: vínculo con su ficha de trabajador
    trabajador_id:{ type: String, default: null },
    // DEPRECATED: ahora se deriva de (rol === 'admin' && orgIds.length === 0).
    // Se conserva por compat con sesiones/usuarios antiguos.
    esSuperAdmin: { type: Boolean, default: false },
    activo:       { type: Boolean, default: true },
    // Onboarding wizard: true cuando el usuario cerró el tour (saltar o
    // completar). Fuente de verdad de cross-device, no localStorage.
    wizardCompleted: { type: Boolean, default: false },
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
