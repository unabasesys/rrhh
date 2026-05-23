/**
 * POST /api/portal/marcar
 * Body: { tipo: 'entrada' | 'salida', proyecto_nombre?, turno_id? }
 *
 * Crea o actualiza la marcación del día actual para el trabajador autenticado:
 * - 'entrada': crea una marcación nueva con hora actual si no existe una del día,
 *   o actualiza entrada si la existente no tiene aún.
 * - 'salida': busca la marcación abierta del día y completa la hora de salida,
 *   calculando horas trabajadas.
 */
import { requireDb, newId } from '../../utils/db.js'
import { requireAuth } from '../../utils/requireAuth.js'
import Marcacion from '../../models/Marcacion.js'

function todayStr() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
function nowHHMM() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function diffHoras(entrada, salida) {
  if (!entrada || !salida) return 0
  const [eh, em] = entrada.split(':').map(Number)
  const [sh, sm] = salida.split(':').map(Number)
  const mins = (sh * 60 + sm) - (eh * 60 + em)
  return Math.max(0, Math.round((mins / 60) * 100) / 100)
}

export default defineEventHandler(async (event) => {
  requireDb(event)
  const me = await requireAuth(event)
  if (!me.trabajador_id) {
    throw createError({ statusCode: 403, message: 'Tu cuenta no está vinculada a un trabajador' })
  }

  const body = await readBody(event)
  const tipo = body?.tipo
  if (!['entrada', 'salida'].includes(tipo)) {
    throw createError({ statusCode: 400, message: 'tipo debe ser "entrada" o "salida"' })
  }

  const fecha = todayStr()
  const hora  = nowHHMM()

  let m = await Marcacion.findOne({ trabajador_id: me.trabajador_id, fecha })

  if (tipo === 'entrada') {
    if (m && m.entrada) {
      throw createError({ statusCode: 409, message: `Ya marcaste entrada hoy a las ${m.entrada}` })
    }
    if (!m) {
      m = new Marcacion({
        _id:           newId('marc'),
        trabajador_id: me.trabajador_id,
        fecha,
        entrada:       hora,
        proyecto_nombre: body?.proyecto_nombre || null,
        turno_id:        body?.turno_id || null,
        tipo: 'normal',
        estado: 'pendiente',
      })
    } else {
      m.entrada = hora
      if (body?.proyecto_nombre) m.proyecto_nombre = body.proyecto_nombre
      if (body?.turno_id)        m.turno_id        = body.turno_id
    }
    await m.save()
    return { ok: true, action: 'entrada', marcacion: m.toObject() }
  }

  // tipo === 'salida'
  if (!m || !m.entrada) {
    throw createError({ statusCode: 400, message: 'No hay marcación de entrada para hoy' })
  }
  if (m.salida) {
    throw createError({ statusCode: 409, message: `Ya marcaste salida hoy a las ${m.salida}` })
  }
  m.salida = hora
  m.horas  = diffHoras(m.entrada, m.salida)
  await m.save()
  return { ok: true, action: 'salida', marcacion: m.toObject() }
})
