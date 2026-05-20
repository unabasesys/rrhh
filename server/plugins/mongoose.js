import mongoose from 'mongoose'

let isConnected = false

export default defineNitroPlugin(async () => {
  if (isConnected) return

  const uri = process.env.MONGODB_URI

  if (!uri) {
    console.warn('[RRHH] MONGODB_URI no definido — modo localStorage activo')
    return
  }

  try {
    await mongoose.connect(uri, {
      dbName: process.env.MONGODB_DB || 'rrhh',
    })
    isConnected = true
    console.log('[RRHH] MongoDB conectado ✓')
  } catch (err) {
    console.error('[RRHH] Error conectando a MongoDB:', err.message)
  }
})

export function isDbConnected() {
  return isConnected && mongoose.connection.readyState === 1
}
