/**
 * GET /api/rrhh/reportes/previred-pdf?anio=YYYY&mes=MM[&orgId=...]
 *
 * Devuelve un PDF con el detalle de leyes sociales (formato similar al que
 * emite Previred al pagar las cotizaciones del mes).
 *
 * Columnas: RUT · Nombre · Cargo · F. Ingreso · AFP · Cot. AFP · Salud ·
 *           Cot. Salud · AFC trab · AFC emp · SIS · Sueldo imp.
 */
import PDFDocument from 'pdfkit'
import { PassThrough } from 'stream'
import { requireDb } from '../../../utils/db.js'
import { requireAuth, orgScopeFilter } from '../../../utils/requireAuth.js'
import Liquidacion  from '../../../models/Liquidacion.js'
import Trabajador   from '../../../models/Trabajador.js'
import Organization from '../../../models/Organization.js'

const C = {
  TEAL:      '#0DCFA8',
  TEAL_BG:   '#e6faf5',
  DARK:      '#062D3A',
  DARK_TEXT: '#0f1923',
  GRAY:      '#6b7280',
  GRAY_BG:   '#f3f4f6',
  BORDER:    '#d1d5db',
  WHITE:     '#ffffff',
}

const MESES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function fmt(n) {
  if (!n) return '0'
  return Math.round(Number(n)).toLocaleString('es-CL')
}
function formatRut(rut) {
  if (!rut) return '—'
  const clean = String(rut).replace(/[^0-9kK]/g, '').toUpperCase()
  if (clean.length < 2) return rut
  const dv = clean.slice(-1)
  const num = clean.slice(0, -1)
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv
}
function shortName(t) {
  const nombres   = (t.nombre || '').split(/\s+/).filter(Boolean)
  const apellidos = [t.apellido_paterno, t.apellido_materno, t.apellido].filter(Boolean)
  return [...nombres.slice(0, 2), ...apellidos.slice(0, 2)].join(' ').trim() || (t.nombre || '—')
}
function fmtFechaIngreso(t) {
  const f = t.fecha_ingreso
  if (!f) return '—'
  try {
    const d = new Date(f + (f.includes('T') ? '' : 'T12:00:00'))
    return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch { return f }
}
function afpDisplay(name) {
  if (!name) return 'Modelo'
  return String(name).replace(/^afp\s+/i, '').trim()
}
function saludDisplay(t) {
  return t.sistema_salud || t.isapre || 'Fonasa'
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

  const tIds  = [...new Set(liqs.map(l => l.trabajador_id))]
  const trabs = await Trabajador.find({ _id: { $in: tIds } }).lean()
  const trabMap = Object.fromEntries(trabs.map(t => [t._id, t]))

  // Org para el header (si hay scope, tomamos la primera)
  let org = null
  if (scope.orgId && typeof scope.orgId === 'string') {
    org = await Organization.findById(scope.orgId).lean()
  } else if (me.rol !== 'admin') {
    const list = Array.isArray(me.orgIds) ? me.orgIds : (me.orgId ? [me.orgId] : [])
    if (list.length === 1) org = await Organization.findById(list[0]).lean()
  }

  // ── Build PDF ──────────────────────────────────────────────────────────────
  const doc = new PDFDocument({ size: 'LEGAL', layout: 'landscape', margin: 28 })
  const stream = new PassThrough()
  doc.pipe(stream)

  const pageW = doc.page.width
  const pageH = doc.page.height
  const margin = 28

  // ── Header ───────────────────────────────────────────────────────────────
  doc.rect(0, 0, pageW, 64).fill(C.DARK)

  doc.fillColor(C.WHITE).font('Helvetica-Bold').fontSize(16)
     .text('Detalle Leyes Sociales', margin, 18, { width: pageW - 2 * margin })

  doc.fillColor(C.TEAL).font('Helvetica').fontSize(10)
     .text(`Período: ${MESES[mes]} ${anio}`, margin, 40)

  if (org?.nombre) {
    doc.fillColor(C.WHITE).font('Helvetica').fontSize(10)
       .text(org.nombre, margin, 40, { width: pageW - 2 * margin, align: 'right' })
  }

  // ── Tabla ────────────────────────────────────────────────────────────────
  const cols = [
    { key: 'rut',    label: 'RUT',         w: 78,  align: 'left' },
    { key: 'nombre', label: 'Nombre',      w: 130, align: 'left' },
    { key: 'cargo',  label: 'Cargo',       w: 110, align: 'left' },
    { key: 'fing',   label: 'F. Ingreso',  w: 90,  align: 'left' },
    { key: 'afp',    label: 'AFP',         w: 70,  align: 'left' },
    { key: 'cotAfp', label: 'Cot. AFP',    w: 60,  align: 'right' },
    { key: 'salud',  label: 'Salud',       w: 60,  align: 'left' },
    { key: 'cotSal', label: 'Cot. Salud',  w: 65,  align: 'right' },
    { key: 'afcT',   label: 'AFC trab',    w: 55,  align: 'right' },
    { key: 'afcE',   label: 'AFC emp',     w: 55,  align: 'right' },
    { key: 'sis',    label: 'SIS',         w: 50,  align: 'right' },
    { key: 'imp',    label: 'Imponible',   w: 65,  align: 'right' },
  ]
  const totalW = cols.reduce((s, c) => s + c.w, 0)
  // Centrar la tabla horizontalmente
  const tableX = margin + Math.max(0, (pageW - 2 * margin - totalW) / 2)

  let y = 88
  const rowH = 22
  const headerH = 24

  function drawTableHeader() {
    doc.rect(tableX, y, totalW, headerH).fill(C.TEAL)
    doc.font('Helvetica-Bold').fontSize(8).fillColor(C.WHITE)
    let x = tableX
    for (const c of cols) {
      doc.text(c.label, x + 4, y + 8, { width: c.w - 8, align: c.align, lineBreak: false })
      x += c.w
    }
    y += headerH
  }

  drawTableHeader()

  // ── Filas ────────────────────────────────────────────────────────────────
  const totales = { cotAfp: 0, cotSal: 0, afcT: 0, afcE: 0, sis: 0, imp: 0 }

  function drawRow(row, isZebra) {
    if (y + rowH > pageH - 60) {
      doc.addPage()
      y = margin
      drawTableHeader()
    }
    if (isZebra) {
      doc.rect(tableX, y, totalW, rowH).fill(C.GRAY_BG)
    }
    doc.font('Helvetica').fontSize(8).fillColor(C.DARK_TEXT)
    let x = tableX
    for (const c of cols) {
      const val = row[c.key] ?? ''
      doc.text(String(val), x + 4, y + 7, {
        width: c.w - 8, align: c.align, lineBreak: false, ellipsis: true,
      })
      x += c.w
    }
    y += rowH
  }

  const rows = liqs
    .map(liq => {
      const t = trabMap[liq.trabajador_id]
      if (!t) return null
      const sueldoImp = liq.renta_imponible || liq.total_imponible || liq.sueldo_base || 0
      const sis       = Math.round(sueldoImp * 0.0162)
      const apPaterno = t.apellido_paterno || t.apellido || ''
      return {
        sortKey: apPaterno.toLowerCase(),
        rut:    formatRut(t.rut),
        nombre: shortName(t),
        cargo:  t.cargo || '—',
        fing:   fmtFechaIngreso(t),
        afp:    afpDisplay(t.afp || liq.afp_nombre),
        cotAfp: fmt(liq.afp_descuento),
        salud:  saludDisplay(t),
        cotSal: fmt(liq.salud_descuento),
        afcT:   fmt(liq.cesantia_trabajador),
        afcE:   fmt(liq.cesantia_empleador),
        sis:    fmt(sis),
        imp:    fmt(sueldoImp),
        _tot:   { cotAfp: liq.afp_descuento||0, cotSal: liq.salud_descuento||0,
                  afcT: liq.cesantia_trabajador||0, afcE: liq.cesantia_empleador||0,
                  sis, imp: sueldoImp },
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))

  rows.forEach((r, i) => {
    totales.cotAfp += r._tot.cotAfp
    totales.cotSal += r._tot.cotSal
    totales.afcT   += r._tot.afcT
    totales.afcE   += r._tot.afcE
    totales.sis    += r._tot.sis
    totales.imp    += r._tot.imp
    drawRow(r, i % 2 === 1)
  })

  // ── Fila de totales ──────────────────────────────────────────────────────
  if (y + rowH > pageH - 60) {
    doc.addPage()
    y = margin
    drawTableHeader()
  }
  doc.rect(tableX, y, totalW, rowH).fill(C.TEAL_BG)
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.DARK_TEXT)
  let x = tableX
  // "Totales" abarca las 5 primeras columnas
  let preW = cols[0].w + cols[1].w + cols[2].w + cols[3].w + cols[4].w
  doc.text('Totales', tableX + 4, y + 7, { width: preW - 8, align: 'left', lineBreak: false })
  x += preW
  const totVals = [
    fmt(totales.cotAfp),
    '',
    fmt(totales.cotSal),
    fmt(totales.afcT),
    fmt(totales.afcE),
    fmt(totales.sis),
    fmt(totales.imp),
  ]
  // Columnas a partir de la 6ª (índice 5)
  for (let i = 5; i < cols.length; i++) {
    const c = cols[i]
    doc.text(totVals[i - 5] || '', x + 4, y + 7,
      { width: c.w - 8, align: c.align, lineBreak: false })
    x += c.w
  }
  y += rowH

  // ── Footer ───────────────────────────────────────────────────────────────
  doc.font('Helvetica').fontSize(7).fillColor(C.GRAY)
     .text(`Generado por Unabase RRHH — ${new Date().toLocaleString('es-CL')}`,
           margin, pageH - 30, { width: pageW - 2 * margin, align: 'center' })

  doc.end()

  // Recolectar el stream y devolver como buffer
  const chunks = []
  for await (const c of stream) chunks.push(c)
  const buffer = Buffer.concat(chunks)

  setResponseHeader(event, 'content-type', 'application/pdf')
  setResponseHeader(event, 'content-disposition',
    `attachment; filename="${anio}${String(mes).padStart(2, '0')}_detalle_leyes_sociales.pdf"`)
  return buffer
})
