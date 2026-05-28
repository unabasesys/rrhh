import mongoose from 'mongoose'

/**
 * Token público que permite a un trabajador acceder al portal sin login.
 * La URL queda `/portal/trabajador/<token>`. El token resuelve al trabajador.
 */
const PortalTokenSchema = new mongoose.Schema({
  _id:           { type: String, required: true },             // ptok_timestamp_random
  token:         { type: String, required: true, unique: true, index: true },
  trabajador_id: { type: String, required: true, index: true },
  orgId:         { type: String, default: null, ref: 'Organization', index: true },
  activo:        { type: Boolean, default: true },
  creado:        { type: Date, default: Date.now },
  ultimo_uso:    { type: Date },
}, { _id: false, versionKey: false })

export default mongoose.models.PortalToken
  || mongoose.model('PortalToken', PortalTokenSchema)
