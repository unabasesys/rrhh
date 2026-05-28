/**
 * GET /api/rrhh/reportes/previred-txt?anio=YYYY&mes=MM[&orgId=...]
 *
 * Devuelve un archivo TXT con el formato estándar mensual Previred.
 * Cada línea = un trabajador con liquidación en ese período.
 * Los campos están delimitados por ';' siguiendo el orden oficial.
 *
 * Permisos:
 *   - admin: puede pedir cualquier orgId.
 *   - manager/viewer: solo orgs en su orgIds.
 */
import { requireDb } from '../../../utils/db.js'
import { requireAuth, orgScopeFilter } from '../../../utils/requireAuth.js'
import Liquidacion from '../../../models/Liquidacion.js'
import Trabajador from '../../../models/Trabajador.js'

// Códigos AFP oficiales Previred
const AFP_CODE = {
  'capital':   '33',
  'cuprum':    '03',
  'habitat':   '05',
  'modelo':    '34',
  'planvital': '29',
  'provida':   '08',
  'uno':       '35',
}
function afpCode(nombre) {
  const key = (nombre || '').toLowerCase().replace(/^afp\s+/, '').trim()
  return AFP_CODE[key] || '34' // default Modelo
}

// Códigos salud
function saludData(trab) {
  const nombre = (trab.sistema_salud || trab.isapre || 'FONASA').toUpperCase()
  if (nombre.includes('FONASA')) return { codigo: '07', monedaPactada: null }
  if (nombre.includes('BANMEDICA'))  return { codigo: '01', monedaPactada: '$' }
  if (nombre.includes('COLMENA'))    return { codigo: '02', monedaPactada: '$' }
  if (nombre.includes('CRUZ BLANCA'))return { codigo: '03', monedaPactada: '$' }
  if (nombre.includes('VIDA TRES'))  return { codigo: '04', monedaPactada: '$' }
  if (nombre.includes('NUEVA MASVIDA') || nombre.includes('MAS VIDA')) return { codigo: '12', monedaPactada: '$' }
  if (nombre.includes('CONSALUD'))   return { codigo: '05', monedaPactada: '$' }
  return { codigo: '07', monedaPactada: null }
}

function cleanRut(rut) {
  if (!rut) return { num: '0', dv: '0' }
  const clean = String(rut).replace(/[^0-9kK]/g, '').toUpperCase()
  if (clean.length < 2) return { num: '0', dv: '0' }
  return { num: clean.slice(0, -1), dv: clean.slice(-1) }
}

function up(s) { return (s || '').toUpperCase() }

function periodoMMAAAA(mes, anio) {
  return String(mes).padStart(2, '0') + String(anio)
}

/**
 * Construye una línea Previred según el ejemplo provisto.
 * Total: ~105 campos separados por ';'. Los campos no calculables quedan vacíos.
 *
 * Mapeo basado en el ejemplo:
 *   1 RUT   2 DV   3 ApPaterno   4 ApMaterno   5 Nombres   6 Sexo
 *   7 Nacionalidad (0=chileno)   8 Mov.Personal (01=normal)
 *   9 Período desde (MMAAAA)   10 Período hasta (MMAAAA)
 *  11 Régimen (AFP/INP)   12 Tipo trab (0)   13 Días trab (30)
 *  14 Tipo línea (00)   15-23 mov.personal vacíos / N
 *  24 Jubilado (N)   25 Cód AFP   26 Renta imp AFP   27 Cot AFP   28 SIS
 *  ... 60+ campos previsionales adicionales ...
 *  Salud: códigos en bloque ~ campo 60-72 (cód salud, renta imp salud, cot 7%, cot pactada, ...)
 *  Cesantía: bloque ~ campo 85-95
 *  CCAF / Mutual / IPS al final.
 */
function buildLine(liq, trab, mes, anio) {
  const { num, dv } = cleanRut(trab.rut)
  const periodo = periodoMMAAAA(mes, anio)
  const dias    = liq.dias_trabajados || 30
  const sueldoImp = liq.renta_imponible || liq.total_imponible || liq.sueldo_base || 0
  const cotAfp    = liq.afp_descuento  || 0
  const sis       = Math.round(sueldoImp * 0.0162)
  const cotSalud7 = liq.salud_descuento || Math.round(sueldoImp * 0.07)
  const afcTrab   = liq.cesantia_trabajador || 0
  const afcEmp    = liq.cesantia_empleador  || 0
  const apCode    = afpCode(trab.afp || liq.afp_nombre)
  const salud     = saludData(trab)
  const sexo      = up(trab.sexo) === 'F' ? 'F' : 'M'

  // Campos en el orden del ejemplo. '' = campo vacío.
  // (El ejemplo tiene ~105 columnas; los campos no esenciales van vacíos o en 0.)
  const f = []

  // 1-10: identificación + período
  f[0]  = num
  f[1]  = dv
  f[2]  = up(trab.apellido_paterno || trab.apellido || '')
  f[3]  = up(trab.apellido_materno || '')
  f[4]  = up(trab.nombre || '')
  f[5]  = sexo
  f[6]  = (trab.nacionalidad && /extran/i.test(trab.nacionalidad)) ? '1' : '0'
  f[7]  = '01' // movimiento personal: normal
  f[8]  = periodo
  f[9]  = periodo
  // 11-24: régimen + días + movimientos
  f[10] = 'AFP'
  f[11] = '0'
  f[12] = String(dias).padStart(2, '0')
  f[13] = '00'
  f[14] = '0'
  for (let i = 15; i <= 22; i++) f[i] = ''
  f[16] = ''
  f[17] = 'D'   // estado: D = dependiente
  f[18] = '0'; f[19] = '0'; f[20] = '0'; f[21] = '0'; f[22] = '0'; f[23] = '0'
  // 25: jubilado
  f[24] = 'N'
  // 26-29: AFP
  f[25] = apCode
  f[26] = String(sueldoImp)
  f[27] = String(cotAfp)
  f[28] = String(sis)
  // 30-59: bloque APV / cuentas / convenios (vacíos para MVP)
  for (let i = 29; i <= 49; i++) f[i] = ''
  // 51-58: APV vacíos
  for (let i = 50; i <= 58; i++) f[i] = ''
  f[59] = '0'
  // 60-72: Salud
  for (let i = 60; i <= 68; i++) f[i] = ''
  f[69] = salud.codigo === '07' ? String(sueldoImp) : '' // FONASA: renta imp salud
  for (let i = 70; i <= 74; i++) f[i] = ''
  f[75] = salud.codigo === '07' ? String(cotSalud7) : ''
  for (let i = 76; i <= 78; i++) f[i] = ''
  f[79] = '0'
  f[80] = salud.codigo
  for (let i = 81; i <= 84; i++) f[i] = ''
  f[85] = ''; f[86] = ''
  f[87] = '0'
  // Cesantía / AFC
  f[88] = '01'
  f[89] = String(sueldoImp)
  f[90] = ''
  f[91] = '0'
  f[92] = ''; f[93] = ''
  f[94] = '0'
  // Mutual
  f[95] = '0'
  f[96] = '0'
  f[97] = ''
  // CCAF / IPS
  f[98] = '1'
  f[99] = String(afcTrab)
  f[100] = ''
  f[101] = '01'
  f[102] = String(sueldoImp)
  f[103] = String(afcEmp)
  f[104] = '0'
  f[105] = String(sueldoImp)
  f[106] = '0'
  f[107] = String(afcTrab + afcEmp + sis)
  f[108] = ''
  f[109] = ''
  f[110] = ''

  // Limpiar undefined → ''
  for (let i = 0; i < f.length; i++) if (f[i] == null) f[i] = ''
  return f.join(';')
}

export default defineEventHandler(async (event) => {
  requireDb(event)
  const me = await requireAuth(event)
  const q = getQuery(event)
  const anio = Number(q.anio)
  const mes  = Number(q.mes)
  if (!anio || !mes || mes < 1 || mes > 12) {
    throw createError({ statusCode: 400, message: 'Parámetros anio/mes inválidos' })
  }

  // Scope por org (admin sin filtro; manager solo sus orgs)
  const scope = orgScopeFilter(me, q.orgId || null)

  // Cargar liquidaciones del período.
  // Para Sueldo Empresarial (Art. 31 N°6 LIR): solo incluir si tiene
  // cotizaciones voluntarias activas (la empresa las procesa por planilla).
  // Si no, el socio las paga aparte con su RUT personal y no aparece acá.
  const liqsRaw = await Liquidacion.find({ ...scope, anio, mes }).lean()
  const liqs    = liqsRaw.filter(l =>
    !l.esSueldoEmpresarial || l.cotiza_afp_voluntaria || l.cotiza_salud_voluntaria
  )
  if (!liqs.length) {
    setResponseHeader(event, 'content-type', 'text/plain; charset=utf-8')
    setResponseHeader(event, 'content-disposition',
      `attachment; filename="previred_${anio}${String(mes).padStart(2, '0')}.txt"`)
    return ''
  }

  // Cargar trabajadores referenciados
  const tIds = [...new Set(liqs.map(l => l.trabajador_id))]
  const trabs = await Trabajador.find({ _id: { $in: tIds } }).lean()
  const trabMap = Object.fromEntries(trabs.map(t => [t._id, t]))

  const lines = liqs
    .map(liq => {
      const trab = trabMap[liq.trabajador_id]
      if (!trab) return null
      return buildLine(liq, trab, mes, anio)
    })
    .filter(Boolean)

  // Ordenar por apellido paterno (igual que el ejemplo)
  lines.sort((a, b) => {
    const ap = a.split(';')[2] || ''
    const bp = b.split(';')[2] || ''
    return ap.localeCompare(bp)
  })

  const body = lines.join('\r\n') + '\r\n'

  setResponseHeader(event, 'content-type', 'text/plain; charset=utf-8')
  setResponseHeader(event, 'content-disposition',
    `attachment; filename="previred_${anio}${String(mes).padStart(2, '0')}.txt"`)
  return body
})
