/**
 * GET /api/rrhh/reportes/centralizacion-xlsx?anio=YYYY&mes=MM[&orgId=...]
 *
 * Centralización contable de remuneraciones del período en formato Excel.
 * Cada concepto genera una fila con Debe/Haber listos para asentar en
 * contabilidad. Las cargas patronales se duplican: una al Debe (gasto) y
 * otra al Haber (pasivo por pagar).
 *
 * Columnas: Año · Mes · Rut Empresa · Concepto · Cód. Centro de Costo ·
 *           Centro de Costo · Cuenta Contable · Código Cuenta Contable ·
 *           Debe · Haber · Rut Destinatario
 */
import ExcelJS from 'exceljs'
import { requireDb } from '../../../utils/db.js'
import { requireAuth, orgScopeFilter } from '../../../utils/requireAuth.js'
import Liquidacion  from '../../../models/Liquidacion.js'
import Trabajador   from '../../../models/Trabajador.js'
import Organization from '../../../models/Organization.js'

const SHEET_HEADERS = [
  'Año', 'Mes', 'Rut de la Empresa', 'Concepto',
  'Código Centro de Costo', 'Centro de Costo',
  'Cuenta Contable', 'Código Cuenta Contable',
  'Debe', 'Haber', 'Rut Destinatario',
]

const CODIGO_CC = '0000'
const CENTRO_CC = 'raiz'

function sum(arr, fn) { return arr.reduce((s, x) => s + (fn(x) || 0), 0) }

/**
 * Devuelve un array de filas listas para escribir en la planilla a partir
 * de las liquidaciones del período. Mantiene el orden y la lógica del
 * ejemplo aportado por el cliente.
 */
function buildRows(liqs, anio, mes, rutEmpresa) {
  const a = anio
  const m = mes
  const ru = rutEmpresa
  // Helpers — empuja fila si el monto != 0
  const out = []
  const pushDebe  = (concepto, monto) => {
    if (!monto) return
    out.push([a, m, ru, concepto, CODIGO_CC, CENTRO_CC, null, null, monto, 0, null])
  }
  const pushHaber = (concepto, monto) => {
    if (!monto) return
    out.push([a, m, ru, concepto, CODIGO_CC, CENTRO_CC, null, null, 0, monto, null])
  }
  // Para cargas patronales que aparecen 2 veces (gasto + pasivo)
  const pushPatronal = (concepto, monto) => {
    if (!monto) return
    out.push([a, m, ru, concepto, CODIGO_CC, CENTRO_CC, null, null, monto, 0, null])
    out.push([a, m, ru, concepto, null,      null,      null, null, 0, monto, null])
  }

  // ── HABERES (Debe) ────────────────────────────────────────────────────────
  // Recorremos cada liquidación y acumulamos los conceptos detallados.
  let sueldoBase   = 0
  let gratif       = 0
  let comision     = 0
  let semCorrida   = 0
  let hExtra       = 0
  let bonosOtros   = 0

  // Descuentos legales
  let afp          = 0
  let saludFonasa  = 0
  let isapre7      = 0
  let isapreSobre7 = 0
  let cesTrab      = 0
  let impuesto     = 0
  let anticipos    = 0
  let otrosDescTrb = 0
  let creditoCCAF  = 0

  // Cargas patronales (Debe gasto / Haber pasivo)
  let cesEmpleador   = 0
  let cesFondoSolid  = 0
  let segAccidentes  = 0
  let sis            = 0
  let capInd         = 0
  let expVida        = 0

  let liquidoTotal = 0

  for (const liq of liqs) {
    sueldoBase += liq.sueldo_base || 0
    gratif     += liq.gratificacion || 0

    // Bonos custom
    const bonosArr = Array.isArray(liq.bonos) ? liq.bonos : []
    for (const b of bonosArr) {
      const monto = Number(b?.monto || b?.valor || 0)
      const nombre = String(b?.nombre || b?.concepto || '').toLowerCase()
      if (!monto) continue
      if (nombre.includes('comisi'))           comision   += monto
      else if (nombre.includes('semana'))      semCorrida += monto
      else if (nombre.includes('extra') ||
               nombre.includes('hora') ||
               nombre.includes('h.e'))          hExtra     += monto
      else                                      bonosOtros += monto
    }
    if (liq.semana_corrida) semCorrida += Number(liq.semana_corrida) || 0
    if (liq.horas_extra_valor) hExtra  += Number(liq.horas_extra_valor) || 0

    afp        += liq.afp_descuento   || 0
    // Salud: si es FONASA o ISAPRE depende del trabajador (no lo tenemos aquí,
    // se decide afuera por trabajador — ver loop separado abajo).
    cesTrab    += liq.cesantia_trabajador || 0
    impuesto   += liq.impuesto || 0

    // Descuentos custom
    const descArr = Array.isArray(liq.descuentos) ? liq.descuentos : []
    for (const d of descArr) {
      const monto = Number(d?.monto || d?.valor || 0)
      const nombre = String(d?.nombre || d?.concepto || '').toLowerCase()
      if (!monto) continue
      if (nombre.includes('anticip'))             anticipos    += monto
      else if (nombre.includes('ccaf') ||
               nombre.includes('crédito') ||
               nombre.includes('credito'))         creditoCCAF  += monto
      else                                          otrosDescTrb += monto
    }

    // Cargas patronales aproximadas
    const imp = liq.renta_imponible || liq.total_imponible || liq.sueldo_base || 0
    cesEmpleador  += liq.cesantia_empleador || Math.round(imp * 0.024)
    cesFondoSolid += Math.round(imp * 0.014)  // 1.4% AFC fondo solidario
    segAccidentes += Math.round(imp * 0.0093) // mutual estimado
    sis           += Math.round(imp * 0.0162)
    // Capitalización individual / expectativa de vida son comisiones AFP
    // estimadas; aprox 0.01 cada una sobre imp.
    capInd        += Math.round(imp * 0.001)
    expVida       += Math.round(imp * 0.007)

    liquidoTotal  += liq.liquido_a_pagar || 0
  }

  // ── Separar salud FONASA vs ISAPRE recorriendo trabajadores ──────────────
  // (lo hacemos afuera porque necesitamos el sistema_salud del trabajador)
  // — se setea por buildRows a través de un parámetro externo
  // Aquí dejamos el wiring; los acumuladores los seteamos en el caller.

  // Conceptos en el orden del ejemplo:
  pushDebe('Sueldo Base',           sueldoBase)
  pushDebe('Gratificación Mensual', gratif)
  pushDebe('Comisión Venta',        comision)
  pushDebe('Semana Corrida',        semCorrida)
  pushDebe('Horas Extra 50%',       hExtra)
  if (bonosOtros) pushDebe('Otros Haberes', bonosOtros)

  pushHaber('AFP',                          afp)
  pushHaber('Salud 7% (Fonasa)',            saludFonasa)
  pushHaber('Isapre',                       isapre7)
  pushHaber('Isapre sobre 7%',              isapreSobre7)
  pushHaber('Seguro Cesantia Trabajador',   cesTrab)
  pushHaber('Impuestos',                    impuesto)
  pushHaber('Descuento Anticipo',           anticipos)
  pushHaber('Otros Descuentos',             otrosDescTrb)
  pushHaber('Descuento Crédito Personal CCAF', creditoCCAF)

  pushPatronal('Seguro Cesantia Empleador',         cesEmpleador)
  pushPatronal('Seguro Cesantia (Fondo Solidario)', cesFondoSolid)
  pushPatronal('Seguro accidentes del Trabajo',     segAccidentes)
  pushPatronal('Seguro Invalidez y Supervivencia (SIS)', sis)

  pushDebe('Capitalización Individual AFP', capInd)
  pushDebe('Expectativa de Vida',           expVida)

  pushHaber('Liquido a Pago',               liquidoTotal)

  return { rows: out, totals: {
    sueldoBase, gratif, comision, semCorrida, hExtra, bonosOtros,
    afp, cesTrab, impuesto, anticipos, otrosDescTrb, creditoCCAF,
    cesEmpleador, cesFondoSolid, segAccidentes, sis, capInd, expVida,
    liquidoTotal,
  } }
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

  const scope = orgScopeFilter(me, q.orgId || null)
  const liqs  = await Liquidacion.find({ ...scope, anio, mes }).lean()

  // Resolver Rut de la Empresa (de la org en el scope, fallback al primero)
  let rutEmpresa = '—'
  let nombreEmpresa = ''
  if (scope.orgId && typeof scope.orgId === 'string') {
    const org = await Organization.findById(scope.orgId).lean()
    rutEmpresa = org?.rut || rutEmpresa
    nombreEmpresa = org?.nombre || ''
  } else if (me.rol !== 'admin') {
    const list = Array.isArray(me.orgIds) ? me.orgIds : (me.orgId ? [me.orgId] : [])
    if (list.length === 1) {
      const org = await Organization.findById(list[0]).lean()
      rutEmpresa = org?.rut || rutEmpresa
      nombreEmpresa = org?.nombre || ''
    }
  }

  // ── Salud: separar FONASA vs ISAPRE (depende del trabajador) ──────────────
  // Cargamos trabajadores referenciados para ver su sistema_salud.
  const tIds   = [...new Set(liqs.map(l => l.trabajador_id))]
  const trabs  = await Trabajador.find({ _id: { $in: tIds } }).lean()
  const tMap   = Object.fromEntries(trabs.map(t => [t._id, t]))
  let saludFonasa = 0, isapre7 = 0, isapreSobre7 = 0
  for (const liq of liqs) {
    const trab = tMap[liq.trabajador_id]
    const desc = liq.salud_descuento || 0
    const tope7 = Math.round((liq.renta_imponible || liq.total_imponible || liq.sueldo_base || 0) * 0.07)
    const isFonasa = /fonasa/i.test(trab?.sistema_salud || trab?.isapre || 'fonasa')
    if (isFonasa) {
      saludFonasa += desc
    } else {
      isapre7      += Math.min(desc, tope7)
      isapreSobre7 += Math.max(0, desc - tope7)
    }
  }

  // Build de filas (con saludes inyectadas)
  const { rows, totals } = buildRows(liqs, anio, mes, rutEmpresa)
  // Recolocar las filas de salud porque buildRows usa 0 para ese bloque
  // (no tenía el detalle trabajador→sistema_salud). Insertamos al lugar correcto.
  const cleaned = []
  for (const r of rows) {
    const concepto = r[3]
    if (concepto === 'Salud 7% (Fonasa)' || concepto === 'Isapre' || concepto === 'Isapre sobre 7%') {
      continue  // se reemplazan abajo
    }
    cleaned.push(r)
  }
  // Insertar las filas correctas de salud justo después de AFP
  const idxAfp = cleaned.findIndex(r => r[3] === 'AFP')
  const insertAt = idxAfp >= 0 ? idxAfp + 1 : cleaned.length
  const saludRows = []
  if (saludFonasa)  saludRows.push([anio, mes, rutEmpresa, 'Salud 7% (Fonasa)',  CODIGO_CC, CENTRO_CC, null, null, 0, saludFonasa, null])
  if (isapre7)      saludRows.push([anio, mes, rutEmpresa, 'Isapre',             CODIGO_CC, CENTRO_CC, null, null, 0, isapre7,     null])
  if (isapreSobre7) saludRows.push([anio, mes, rutEmpresa, 'Isapre sobre 7%',    CODIGO_CC, CENTRO_CC, null, null, 0, isapreSobre7, null])
  cleaned.splice(insertAt, 0, ...saludRows)

  // ── Build workbook ────────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Unabase RRHH'
  wb.created = new Date()

  const sheetName = `${anio}-${String(mes).padStart(2, '0')}`
  const ws = wb.addWorksheet(sheetName)

  ws.addRow(SHEET_HEADERS)
  const header = ws.getRow(1)
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF062D3A' } }
  header.alignment = { horizontal: 'center', vertical: 'middle' }
  header.height = 22

  // Anchos de columna
  const widths = [8, 6, 22, 38, 22, 14, 26, 22, 16, 16, 18]
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w })

  // Datos
  for (const r of cleaned) ws.addRow(r)

  // Formato número con separador miles para Debe / Haber
  const moneyFmt = '#,##0'
  ws.getColumn(9).numFmt  = moneyFmt
  ws.getColumn(10).numFmt = moneyFmt

  // Alineación
  ws.getColumn(1).alignment  = { horizontal: 'center' }
  ws.getColumn(2).alignment  = { horizontal: 'center' }
  ws.getColumn(9).alignment  = { horizontal: 'right' }
  ws.getColumn(10).alignment = { horizontal: 'right' }

  // Fila totales
  if (cleaned.length) {
    const totalDebe  = sum(cleaned, r => r[8])
    const totalHaber = sum(cleaned, r => r[9])
    const totalRow = ws.addRow(['', '', '', 'TOTAL', '', '', '', '', totalDebe, totalHaber, ''])
    totalRow.font = { bold: true }
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6FAF5' } }
  }

  // Bordes ligeros
  const totalRows = ws.rowCount
  for (let row = 1; row <= totalRows; row++) {
    for (let col = 1; col <= SHEET_HEADERS.length; col++) {
      ws.getCell(row, col).border = {
        top:    { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left:   { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right:  { style: 'thin', color: { argb: 'FFE5E7EB' } },
      }
    }
  }

  const buffer = await wb.xlsx.writeBuffer()

  setResponseHeader(event, 'content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  setResponseHeader(event, 'content-disposition',
    `attachment; filename="${anio}${String(mes).padStart(2, '0')}_centralizacion_contable.xlsx"`)
  return buffer
})
