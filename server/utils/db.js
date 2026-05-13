/**
 * Helper: devuelve true si MongoDB está conectado.
 * Las rutas API usan esto para decidir si usar DB o responder con error claro.
 */
import mongoose from 'mongoose'

export function dbReady() {
  return mongoose.connection.readyState === 1
}

export function requireDb(event) {
  if (!dbReady()) {
    throw createError({
      statusCode: 503,
      message: 'Base de datos no conectada. Configura MONGODB_URI.',
    })
  }
}

/** Genera un _id único estilo localStorage: prefix_timestamp_random */
export function newId(prefix = 'doc') {
  const ts = Date.now()
  const rand = Math.random().toString(36).slice(2, 7)
  return `${prefix}_${ts}_${rand}`
}
