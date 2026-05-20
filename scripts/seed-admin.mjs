/**
 * Seed: crea el usuario administrador inicial en MongoDB.
 * Uso: node scripts/seed-admin.mjs
 *
 * Credenciales por defecto:
 *   Email:    admin@rrhh.cl
 *   Password: Admin1234!
 */
import mongoose from 'mongoose'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createHash } from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Leer .env manualmente
try {
  const envPath = resolve(__dirname, '../.env')
  const env = readFileSync(envPath, 'utf8')
  for (const line of env.split('\n')) {
    const [key, ...vals] = line.split('=')
    if (key && !key.startsWith('#') && vals.length) {
      process.env[key.trim()] = vals.join('=').trim()
    }
  }
} catch {
  console.log('No se encontró .env — usando variables de entorno del sistema')
}

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error('❌  MONGODB_URI no definida en .env')
  process.exit(1)
}

// SHA-256 usando el módulo nativo de Node (no Web Crypto)
function hashPassword(password) {
  return createHash('sha256').update(password).digest('hex')
}

// Schema mínimo
const UserSchema = new mongoose.Schema(
  {
    _id:          { type: String },
    nombre:       String,
    email:        { type: String, unique: true },
    passwordHash: String,
    rol:          String,
    orgId:        { type: String, default: null },
    esSuperAdmin: { type: Boolean, default: false },
    activo:       { type: Boolean, default: true },
  },
  { _id: false, versionKey: false, timestamps: true }
)

const ADMIN_EMAIL    = 'admin@rrhh.cl'
const ADMIN_PASSWORD = 'Admin1234!'

try {
  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB || 'rrhh' })
  console.log('✅  Conectado a MongoDB')

  const User = mongoose.model('User', UserSchema)

  const exists = await User.findOne({ email: ADMIN_EMAIL })
  if (exists) {
    console.log('ℹ️   El usuario admin ya existe en la base de datos')
    console.log('     Email:', ADMIN_EMAIL)
    console.log('     Rol:', exists.rol, exists.esSuperAdmin ? '(Super Admin)' : '')
    process.exit(0)
  }

  const adminId = `usr_${Date.now()}_admin`
  await User.create({
    _id:          adminId,
    nombre:       'Administrador',
    email:        ADMIN_EMAIL,
    passwordHash: hashPassword(ADMIN_PASSWORD),
    rol:          'admin',
    orgId:        null,
    esSuperAdmin: true,
    activo:       true,
  })

  console.log('')
  console.log('🎉  Usuario admin creado exitosamente!')
  console.log('   ┌─────────────────────────────────┐')
  console.log('   │  Email:    admin@rrhh.cl         │')
  console.log('   │  Password: Admin1234!            │')
  console.log('   │  Rol:      Admin (Super Admin)   │')
  console.log('   └─────────────────────────────────┘')
  console.log('')
  console.log('⚠️   Recuerda cambiar el password después del primer login.')
  console.log('')

  process.exit(0)
} catch (err) {
  console.error('❌  Error:', err.message)
  process.exit(1)
}
