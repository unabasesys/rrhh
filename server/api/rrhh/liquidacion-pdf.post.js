/**
 * POST /api/rrhh/liquidacion-pdf
 * Genera un PDF de Liquidación de Remuneraciones con diseño Unabase (teal).
 *
 * Body: {
 *   organizacion: { nombre, rut, direccion, logo_base64 },
 *   trabajador:   { nombre, rut, cargo, fecha_ingreso, centro_costo },
 *   liquidacion: {
 *     periodo,            // "marzo de 2026"
 *     mes, anio,
 *     dias_trabajados, dias_licencia, dias_ausencia, horas_base,
 *     haberes: [{ concepto, monto }],
 *     descuentos_legales: [{ concepto, detalle?, monto }],
 *     otros_descuentos:   [{ concepto, monto }],
 *     totales: { haberes, descuentos },
 *     liquido_a_pagar,
 *     renta_imponible,
 *   }
 * }
 */
import PDFDocument from 'pdfkit'
import { PassThrough } from 'stream'

// ── Paleta Unabase ──────────────────────────────────────────────────────────
const C = {
  TEAL:        '#0DCFA8',
  TEAL_LIGHT:  '#e6faf5',
  TEAL_MID:    '#cdf5ec',
  TEAL_DARK:   '#0aa688',
  DARK:        '#062D3A',
  DARK_TEXT:   '#0f1923',
  GRAY_TEXT:   '#6b7280',
  GRAY_BORDER: '#e5e7eb',
  GRAY_ROW:    '#f3f4f6',
  WHITE:       '#ffffff',
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function fmtClp(value) {
  if (value === null || value === undefined || value === '') return '$0'
  const n = Math.round(Number(value))
  if (Number.isNaN(n)) return String(value)
  return (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('es-CL')
}

function formatRut(rut) {
  if (!rut) return '—'
  const clean = String(rut).replace(/[^0-9kK]/g, '').toUpperCase()
  if (clean.length < 2) return rut
  const dv = clean.slice(-1)
  const num = clean.slice(0, -1)
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv
}

function formatFecha(f) {
  if (!f) return ''
  try {
    const s = String(f)
    const d = new Date(s + (s.includes('T') ? '' : 'T12:00:00'))
    return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch { return String(f) }
}

function fillRect(doc, x, y, w, h, fill, stroke = null, lw = 0.5) {
  doc.save()
  if (stroke) doc.lineWidth(lw).rect(x, y, w, h).fillAndStroke(fill, stroke)
  else        doc.rect(x, y, w, h).fill(fill)
  doc.restore()
}

function drawText(doc, text, x, y, opts = {}) {
  const {
    font = 'Helvetica', fontSize = 9, color = C.DARK_TEXT,
    width = null, align = 'left',
  } = opts
  doc.save()
  doc.font(font).fontSize(fontSize).fillColor(color)
  const args = { lineBreak: false }
  if (width) { args.width = width; args.align = align }
  doc.text(text, x, y, args)
  doc.restore()
}

// Dibuja un globo aerostático minimalista (línea, sin relleno)
function drawHotAirBalloon(doc, x, y, size = 60) {
  doc.save()
  doc.lineWidth(1.5).strokeColor(C.DARK_TEXT)
  // Globo (círculo achatado)
  doc.ellipse(x + size / 2, y + size * 0.3, size * 0.4, size * 0.42).stroke()
  // Cuerdas
  doc.moveTo(x + size * 0.18, y + size * 0.55).lineTo(x + size * 0.38, y + size * 0.78).stroke()
  doc.moveTo(x + size * 0.82, y + size * 0.55).lineTo(x + size * 0.62, y + size * 0.78).stroke()
  // Canasta
  doc.rect(x + size * 0.36, y + size * 0.78, size * 0.28, size * 0.16).stroke()
  doc.restore()
}

// Patrón estilo QR — placeholder (cuadrícula de píxeles "ruidosos")
function drawQrPlaceholder(doc, x, y, size = 70) {
  doc.save()
  doc.lineWidth(0.4).strokeColor(C.GRAY_BORDER)
  doc.rect(x, y, size, size).stroke()
  // Cuadrícula 9x9 con patrón pseudo-determinístico
  const cells = 9
  const s = size / cells
  const grid = [
    '111000101',
    '101011010',
    '101001110',
    '000101000',
    '110010111',
    '100111001',
    '011000101',
    '101110010',
    '110101100',
  ]
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      if (grid[r][c] === '1') {
        doc.rect(x + c * s, y + r * s, s, s).fill(C.DARK_TEXT)
      }
    }
  }
  // Las 3 marcas de orientación (esquinas)
  const drawMarker = (mx, my) => {
    doc.rect(mx, my, s * 3, s * 3).fillAndStroke(C.WHITE, C.DARK_TEXT)
    doc.rect(mx + s, my + s, s, s).fill(C.DARK_TEXT)
  }
  drawMarker(x, y)
  drawMarker(x + size - s * 3, y)
  drawMarker(x, y + size - s * 3)
  doc.restore()
}

// ── Handler ─────────────────────────────────────────────────────────────────
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const org  = body.organizacion || {}
  const trab = body.trabajador   || {}
  const liq  = body.liquidacion  || {}

  // Datos extraídos
  const haberes   = liq.haberes             || body.haberes            || []
  const descLeg   = liq.descuentos_legales  || body.descuentos_legales || []
  const otrosDesc = liq.otros_descuentos    || body.otros_descuentos   || []
  const totales   = liq.totales || {
    haberes:    haberes.reduce((s, h) => s + (Number(h.monto) || 0), 0),
    descuentos: [...descLeg, ...otrosDesc].reduce((s, d) => s + (Number(d.monto) || 0), 0),
  }
  const liquido = liq.liquido_a_pagar
    ?? Math.max(0, (totales.haberes || 0) - (totales.descuentos || 0))

  const logoB64 = body.logo_base64 || org.logo_base64 || org.logo || null
  const nombreTrab = (trab.nombre || trab.nombre_completo || '').toUpperCase()
  const rut    = trab.rut || ''

  // ── PDF setup ─────────────────────────────────────────────────────────────
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 36, bottom: 36, left: 40, right: 40 },
    bufferPages: true,
  })
  const pass = new PassThrough()
  const chunks = []
  pass.on('data', (c) => chunks.push(c))
  doc.pipe(pass)

  const PW = doc.page.width     // 595.28
  const ML = 40
  const MR = 40
  const CW = PW - ML - MR       // 515

  let y = 40

  // ══════════════════════════════════════════════════════════════════════════
  // TÍTULO
  // ══════════════════════════════════════════════════════════════════════════
  drawText(doc, 'Liquidación de Remuneraciones', ML, y, {
    font: 'Helvetica-Bold', fontSize: 22, color: C.DARK_TEXT,
  })
  // Logo en la esquina superior derecha si viene en base64
  if (logoB64) {
    try {
      const cleanB64 = String(logoB64).replace(/^data:image\/\w+;base64,/, '')
      const buf = Buffer.from(cleanB64, 'base64')
      const lw = 90, lh = 32
      doc.image(buf, PW - MR - lw, y - 4, { fit: [lw, lh], align: 'right' })
    } catch { /* ignore */ }
  }

  y += 32
  drawText(doc, `Mes: ${liq.periodo || ''}`, ML, y, {
    font: 'Helvetica-Bold', fontSize: 12, color: C.DARK_TEXT,
  })

  y += 28

  // ══════════════════════════════════════════════════════════════════════════
  // DOS BLOQUES: TRABAJADOR (IZQ) + EMPRESA (DER)
  // ══════════════════════════════════════════════════════════════════════════
  const blkW = (CW - 14) / 2
  const blkH = 105
  const blkY = y

  // ── Izquierdo: Trabajador ────────────────────────────────────────────────
  // Barra teal vertical
  fillRect(doc, ML, blkY, 4, blkH, C.TEAL)

  drawText(doc, nombreTrab, ML + 14, blkY + 8, {
    font: 'Helvetica-Bold', fontSize: 11, color: C.DARK_TEXT,
    width: blkW - 18,
  })
  const labelLeft = ML + 14
  let ly = blkY + 26
  const lineH = 16

  const drawKV = (label, value) => {
    drawText(doc, label, labelLeft, ly, {
      font: 'Helvetica-Bold', fontSize: 9, color: C.DARK_TEXT,
    })
    const labelW = doc.widthOfString(label) + 4
    drawText(doc, value || '—', labelLeft + labelW, ly, {
      font: 'Helvetica', fontSize: 9, color: C.DARK_TEXT,
      width: blkW - 18 - labelW, align: 'left',
    })
    ly += lineH
  }
  drawKV('Rut:', formatRut(rut))
  drawKV('Fecha de Ingreso:', formatFecha(trab.fecha_ingreso))
  drawKV('Cargo:', trab.cargo || '')
  drawKV('C. Costo:', trab.centro_costo || trab.cc || '')

  // ── Derecho: Empresa ─────────────────────────────────────────────────────
  const rightX = ML + blkW + 14
  // Banner teal con título
  const bannerH = 26
  fillRect(doc, rightX, blkY, blkW, bannerH, C.TEAL_LIGHT)
  drawText(doc, 'INFORMACIÓN EMPRESA', rightX + 12, blkY + 9, {
    font: 'Helvetica-Bold', fontSize: 10, color: C.DARK,
  })

  let ry = blkY + bannerH + 12
  const drawKVRight = (label, value) => {
    drawText(doc, label, rightX + 12, ry, {
      font: 'Helvetica-Bold', fontSize: 9, color: C.DARK_TEXT,
    })
    const lw = doc.widthOfString(label) + 4
    drawText(doc, value || '—', rightX + 12 + lw, ry, {
      font: 'Helvetica', fontSize: 9, color: C.DARK_TEXT,
      width: blkW - 24 - lw, align: 'left',
    })
    ry += lineH
  }
  drawKVRight('Razón Social:', org.nombre || org.razon_social || '—')
  drawKVRight('Rut:',          formatRut(org.rut))
  drawKVRight('Dirección:',    org.direccion || '—')

  y = blkY + blkH + 24

  // ══════════════════════════════════════════════════════════════════════════
  // KPI ROW: Días Trabajados | Días Licencia | Días Ausencia | Horas Base
  // ══════════════════════════════════════════════════════════════════════════
  const kpis = [
    { label: 'Días Trabajados:', value: String(liq.dias_trabajados ?? 30) },
    { label: 'Días Licencia',    value: String(liq.dias_licencia   ?? 0) },
    { label: 'Días Ausencia',    value: String(liq.dias_ausencia   ?? 0) },
    { label: 'Horas Base',       value: liq.horas_base ? String(liq.horas_base).replace('.', ',') : '45,0' },
  ]
  const kpiW = (CW - 3 * 8) / 4
  const kpiH = 56
  kpis.forEach((k, i) => {
    const kx = ML + i * (kpiW + 8)
    // Label superior con fondo teal claro
    fillRect(doc, kx, y, kpiW, 22, C.TEAL_LIGHT)
    drawText(doc, k.label, kx, y + 7, {
      fontSize: 9, color: C.DARK, font: 'Helvetica-Bold',
      width: kpiW, align: 'center',
    })
    drawText(doc, k.value, kx, y + 32, {
      fontSize: 13, color: C.DARK_TEXT, font: 'Helvetica',
      width: kpiW, align: 'center',
    })
  })
  y += kpiH + 16

  // ══════════════════════════════════════════════════════════════════════════
  // TABLA DETALLE
  // ══════════════════════════════════════════════════════════════════════════
  const tblX = ML
  const tblW = CW
  // Anchos columnas: Detalle (60%), Haberes (20%), Descuentos (20%)
  const colDet = Math.round(tblW * 0.60)
  const colHab = Math.round(tblW * 0.20)
  const colDes = tblW - colDet - colHab

  // Header
  const headerH2 = 26
  fillRect(doc, tblX, y, tblW, headerH2, C.TEAL_LIGHT)
  drawText(doc, 'Detalle',     tblX + 12,           y + 9, { font: 'Helvetica-Bold', fontSize: 10, color: C.DARK })
  drawText(doc, 'Haberes',     tblX + colDet,       y + 9, { font: 'Helvetica-Bold', fontSize: 10, color: C.DARK, width: colHab - 12, align: 'right' })
  drawText(doc, 'Descuentos',  tblX + colDet + colHab, y + 9, { font: 'Helvetica-Bold', fontSize: 10, color: C.DARK, width: colDes - 12, align: 'right' })
  y += headerH2

  const rowH = 20
  function drawSectionHeader(label) {
    fillRect(doc, tblX, y, tblW, rowH, C.GRAY_ROW, C.GRAY_BORDER, 0.5)
    drawText(doc, label, tblX + 12, y + 6, {
      font: 'Helvetica-Bold', fontSize: 9.5, color: C.DARK_TEXT,
    })
    y += rowH
  }
  function drawRow(concepto, haberMonto, descMonto, detalle = '') {
    fillRect(doc, tblX, y, tblW, rowH, C.WHITE, C.GRAY_BORDER, 0.5)
    let label = concepto
    if (detalle) label += ` ( ${detalle} )`
    drawText(doc, label, tblX + 24, y + 6, {
      fontSize: 9, color: C.DARK_TEXT,
      width: colDet - 24, align: 'left',
    })
    if (haberMonto) {
      drawText(doc, fmtClp(haberMonto), tblX + colDet, y + 6, {
        fontSize: 9, color: C.DARK_TEXT,
        width: colHab - 12, align: 'right',
      })
    }
    if (descMonto) {
      drawText(doc, fmtClp(descMonto), tblX + colDet + colHab, y + 6, {
        fontSize: 9, color: C.DARK_TEXT,
        width: colDes - 12, align: 'right',
      })
    }
    y += rowH
  }

  // ── Haberes ──────────────────────────────────────────────────────────────
  drawSectionHeader('Haberes')
  if (haberes.length === 0) {
    // Default: Sueldo Base si no se mandan
    drawRow('Sueldo Base', totales.haberes || 0, 0)
  } else {
    haberes.forEach(h => drawRow(h.concepto || h.nombre, Number(h.monto) || 0, 0, h.detalle))
  }

  // ── Descuentos legales ───────────────────────────────────────────────────
  if (descLeg.length) {
    drawSectionHeader('Descuentos Legales')
    descLeg.forEach(d => drawRow(d.concepto || d.nombre, 0, Number(d.monto) || 0, d.detalle))
  }

  // ── Otros descuentos ─────────────────────────────────────────────────────
  drawSectionHeader('Otros Descuentos')
  if (otrosDesc.length) {
    otrosDesc.forEach(d => drawRow(d.concepto || d.nombre, 0, Number(d.monto) || 0, d.detalle))
  }

  // ── Totales ──────────────────────────────────────────────────────────────
  fillRect(doc, tblX, y, tblW, rowH + 2, C.WHITE, C.GRAY_BORDER, 0.5)
  drawText(doc, 'Totales:', tblX + 12, y + 6, {
    font: 'Helvetica-Bold', fontSize: 10, color: C.DARK_TEXT,
    width: colDet - 12, align: 'right',
  })
  drawText(doc, fmtClp(totales.haberes), tblX + colDet, y + 6, {
    font: 'Helvetica-Bold', fontSize: 10, color: C.DARK_TEXT,
    width: colHab - 12, align: 'right',
  })
  drawText(doc, fmtClp(totales.descuentos), tblX + colDet + colHab, y + 6, {
    font: 'Helvetica-Bold', fontSize: 10, color: C.DARK_TEXT,
    width: colDes - 12, align: 'right',
  })
  y += rowH + 2

  // ── ALCANCE LÍQUIDO ──────────────────────────────────────────────────────
  fillRect(doc, tblX, y, tblW, rowH + 6, C.TEAL_LIGHT)
  drawText(doc, 'ALCANCE LÍQUIDO:', tblX + 12, y + 9, {
    font: 'Helvetica-Bold', fontSize: 11, color: C.DARK,
    width: colDet + colHab - 12, align: 'right',
  })
  drawText(doc, fmtClp(liquido), tblX + colDet + colHab, y + 9, {
    font: 'Helvetica-Bold', fontSize: 12, color: C.DARK,
    width: colDes - 12, align: 'right',
  })
  y += rowH + 16

  // ── Pie pequeño ──────────────────────────────────────────────────────────
  drawText(doc,
    'Liquidación generada automáticamente por Unabase',
    ML, y, { fontSize: 8.5, color: C.GRAY_TEXT, font: 'Helvetica-Bold' })

  y += 36

  // ══════════════════════════════════════════════════════════════════════════
  // RECIBO (globo + texto + V°B° + QR)
  // ══════════════════════════════════════════════════════════════════════════
  const recY = Math.max(y, doc.page.height - 160)
  const balloonX = ML
  const balloonY = recY
  drawHotAirBalloon(doc, balloonX, balloonY, 70)

  const certX = balloonX + 90
  const certW = 260
  // Texto certificación (con wrap automático — usamos doc.text directo para
  // que respete lineBreak:true; drawText fuerza lineBreak:false).
  doc.save()
  doc.font('Helvetica').fontSize(8.5).fillColor(C.DARK_TEXT)
  doc.text(
    `Certifico que he recibido a mi entera satisfacción la suma de ${fmtClp(liquido)} indicada en la presente liquidación, y no tengo cargo ni cobro posterior que hacer por los conceptos de esta liquidación.`,
    certX, balloonY + 6, { width: certW, align: 'left', lineBreak: true, lineGap: 1.5 }
  )
  doc.restore()

  // Línea para firma V°B°
  const firmaX = certX + certW + 24
  const firmaY = balloonY + 50
  const firmaW = 100
  doc.save()
  doc.lineWidth(1).strokeColor(C.DARK_TEXT)
  doc.moveTo(firmaX, firmaY).lineTo(firmaX + firmaW, firmaY).stroke()
  doc.restore()
  drawText(doc, 'V°.B°.', firmaX, firmaY + 6, {
    fontSize: 9, color: C.DARK_TEXT, width: firmaW, align: 'center',
  })

  // QR placeholder
  const qrX = PW - MR - 70
  const qrY = balloonY
  drawQrPlaceholder(doc, qrX, qrY, 70)

  // ── Fin ──────────────────────────────────────────────────────────────────
  doc.end()
  await new Promise((resolve) => pass.on('end', resolve))
  const buffer = Buffer.concat(chunks)

  const filename = `liquidacion_${(rut || 'doc').replace(/[^0-9kK]/g, '')}_${liq.mes || ''}_${liq.anio || ''}.pdf`
  setResponseHeader(event, 'content-type', 'application/pdf')
  setResponseHeader(event, 'content-disposition', `attachment; filename="${filename}"`)
  return buffer
})
