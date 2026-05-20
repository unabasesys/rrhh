/**
 * Test de conexión a MongoDB Atlas
 * Uso: node scripts/test-db.mjs
 */
import mongoose from 'mongoose'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

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
  console.log('\nAgrega en tu .env:')
  console.log('MONGODB_URI=mongodb+srv://usuario:password@cluster.mongodb.net/?retryWrites=true&w=majority')
  process.exit(1)
}

console.log('🔗  Conectando a MongoDB...')
console.log('   URI:', uri.replace(/:([^@]+)@/, ':***@'))

try {
  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB || 'rrhh' })
  console.log('✅  Conexión exitosa!')

  // Insertar y leer un documento de prueba
  const TestSchema = new mongoose.Schema({ msg: String, ts: { type: Date, default: Date.now } })
  const Test = mongoose.model('_test_ping', TestSchema)

  const doc = await Test.create({ msg: 'ping desde RRHH' })
  console.log('✅  Escritura OK  →  _id:', doc._id)

  const found = await Test.findById(doc._id)
  console.log('✅  Lectura OK    →  msg:', found.msg)

  await Test.deleteOne({ _id: doc._id })
  console.log('✅  Borrado OK')
  console.log('\n🎉  MongoDB Atlas listo para usar!\n')
  process.exit(0)
} catch (err) {
  console.error('❌  Error:', err.message)
  process.exit(1)
}
