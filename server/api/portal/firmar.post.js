/**
 * POST /api/portal/firmar
 *
 * Guarda la firma del trabajador para un documento (liquidación o contrato).
 * Solo el trabajador autenticado puede firmar sus propios documentos.
 *
 * Body: {
 *   tipo: 'liquidacion' | 'contrato',
 *   documento_id: string,
 *   firma_data:   string (base64 PNG, data: URL),
 *   firma_tipo:   'digital' | 'manual'
 * }
 */
import { requireDb } from '../../utils/db.js'
import { requireAuth } from '../../utils/requireAuth.js'
import Liquidacion from '../../models/Liquidacion.js'
import Contrato    from '../../models/Contrato.js'

const MAX_BASE64 = 1.5 * 1024 * 1024  // ~1.5 MB de base64 ≈ 1 MB de imagen

export default defineEventHandler(async (event) => {
  requireDb(event)
  const me = await requireAuth(event)
  if (!me.trabajador_id) {
    throw createError({ statusCode: 403, message: 'Tu cuenta no está vinculada a un trabajador' })
  }
  const body = await readBody(event)

  if (!['liquidacion', 'contrato'].includes(body?.tipo)) {
    throw createError({ statusCode: 400, message: 'tipo debe ser "liquidacion" o "contrato"' })
  }
  if (!body?.documento_id) throw createError({ statusCode: 400, message: 'documento_id requerido' })
  if (!body?.firma_data || !/^data:image\/[a-z+]+;base64,/.test(body.firma_data)) {
    throw createError({ statusCode: 400, message: 'firma_data inválida' })
  }
  if (body.firma_data.length > MAX_BASE64) {
    throw createError({ statusCode: 413, message: 'Firma muy grande. Máx 1 MB.' })
  }

  const Model = body.tipo === 'liquidacion' ? Liquidacion : Contrato
  const doc = await Model.findById(body.documento_id).lean()
  if (!doc) throw createError({ statusCode: 404, message: 'Documento no encontrado' })
  if (doc.trabajador_id !== me.trabajador_id) {
    throw createError({ statusCode: 403, message: 'Este documento no te pertenece' })
  }

  const update = {
    firma_data:  body.firma_data,
    firma_tipo:  body.firma_tipo === 'manual' ? 'manual' : 'digital',
    firma_fecha: new Date(),
  }
  const updated = await Model.findByIdAndUpdate(body.documento_id, update, { new: true }).lean()
  return { ok: true, documento: updated }
})
