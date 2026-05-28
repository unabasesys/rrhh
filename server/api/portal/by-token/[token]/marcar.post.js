/**
 * POST /api/portal/by-token/:token/marcar
 * Endpoint PÚBLICO — el portal del trabajador marca entrada o salida.
 * Body: { tipo: 'entrada' | 'salida', turno_id?, proyecto_id?, linea_id?, ubicacion? }
 *
 * - 'entrada': crea una nueva Marcacion para el día de hoy (si no existe).
 * - 'salida': completa la salida y calcula horas trabajadas / horas extra.
 */
import { requireDb, newId } from '../../../../utils/db.js'
import PortalToken from '../../../../models/PortalToken.js'
import Marcacion   from '../../../../models/Marcacion.js'
import Turno       from '../../../../models/Turno.js'
import Proyecto    from '../../../../models/Proyecto.js'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function nowHHMM() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function horaToMin(hhmm) {
  if (!hhmm) return 0
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
function diffHoras(entrada, salida) {
  const mins = horaToMin(salida) - horaToMin(entrada)
  return Math.max(0, Math.round((mins / 60) * 100) / 100)
}

export default defineEventHandler(async (event) => {
  requireDb(event)
  const token = getRouterParam(event, 'token')
  const body  = await readBody(event)

  if (!token) throw createError({ statusCode: 400, message: 'Token requerido' })
  if (!['entrada', 'salida'].includes(body?.tipo)) {
    throw createError({ statusCode: 400, message: 'tipo debe ser "entrada" o "salida"' })
  }

  const tok = await PortalToken.findOne({ token, activo: true }).lean()
  if (!tok) throw createError({ statusCode: 404, message: 'El link no es válido o ha expirado' })

  const fecha = todayStr()
  const hora  = nowHHMM()

  let m = await Marcacion.findOne({ trabajador_id: tok.trabajador_id, fecha })

  if (body.tipo === 'entrada') {
    if (m && m.entrada) {
      throw createError({ statusCode: 409, message: `Ya marcaste entrada hoy a las ${m.entrada}`, data: { marcacion: m.toObject() } })
    }

    // Calcular atraso a partir del turno (si se envió)
    let atraso_minutos = 0
    if (body.turno_id) {
      const turno = await Turno.findById(body.turno_id).lean()
      if (turno) {
        atraso_minutos = Math.max(0,
          horaToMin(hora) - horaToMin(turno.hora_entrada) - (turno.tolerancia_atraso_min || 0)
        )
      }
    }

    // Nombre del proyecto si se envió
    let proyecto_nombre = null
    if (body.proyecto_id) {
      const p = await Proyecto.findById(body.proyecto_id).lean()
      proyecto_nombre = p?.nombre || null
    }

    if (!m) {
      m = new Marcacion({
        _id:             newId('marc'),
        trabajador_id:   tok.trabajador_id,
        orgId:           tok.orgId,
        fecha,
        entrada:         hora,
        salida:          null,
        horas_trabajadas: 0,
        horas_extra:     0,
        atraso_minutos,
        tipo:            atraso_minutos > 0 ? 'tardanza' : 'normal',
        estado:          'pendiente',
        turno_id:        body.turno_id || null,
        proyecto_id:     body.proyecto_id || null,
        proyecto_nombre,
        linea_id:        body.linea_id || null,
        ubicacion:       body.ubicacion || null,
      })
    } else {
      m.entrada         = hora
      m.atraso_minutos  = atraso_minutos
      m.tipo            = atraso_minutos > 0 ? 'tardanza' : 'normal'
      m.turno_id        = body.turno_id    || m.turno_id
      m.proyecto_id     = body.proyecto_id || m.proyecto_id
      m.proyecto_nombre = proyecto_nombre  || m.proyecto_nombre
      m.linea_id        = body.linea_id    || m.linea_id
      m.ubicacion       = body.ubicacion   || m.ubicacion
      m.orgId           = m.orgId || tok.orgId
    }
    await m.save()
    return { ok: true, action: 'entrada', marcacion: m.toObject() }
  }

  // tipo === 'salida'
  if (!m || !m.entrada) {
    throw createError({ statusCode: 400, message: 'No hay marcación de entrada para hoy' })
  }
  if (m.salida) {
    throw createError({ statusCode: 409, message: `Ya marcaste salida hoy a las ${m.salida}`, data: { marcacion: m.toObject() } })
  }

  m.salida = hora

  // Cálculo de horas (con colación si hay turno)
  let horasContrato = 8
  let colacionHoras = 1
  if (m.turno_id) {
    const turno = await Turno.findById(m.turno_id).lean()
    if (turno) {
      horasContrato = turno.horas_diarias || 8
      colacionHoras = (turno.colacion_min || 0) / 60
    }
  }
  const horasBrutas    = diffHoras(m.entrada, m.salida)
  const horasEfectivas = Math.max(0, horasBrutas - colacionHoras)
  m.horas_trabajadas   = Math.round(horasEfectivas * 100) / 100
  m.horas_extra        = Math.max(0, Math.round((horasEfectivas - horasContrato) * 100) / 100)
  if (m.horas_extra > 0 && m.tipo !== 'tardanza') m.tipo = 'extra'
  m.ubicacion_salida   = body.ubicacion || m.ubicacion_salida

  await m.save()
  return { ok: true, action: 'salida', marcacion: m.toObject() }
})
