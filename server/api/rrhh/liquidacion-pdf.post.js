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
import { drawPeopleByFooter } from '../../utils/pdfFooter.js'
import { buildLiquidacionPdfBody } from '../../utils/buildLiquidacionPdfBody.js'
import { requireDb } from '../../utils/db.js'

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

// Dibuja un sello "FIRMADA" o "PENDIENTE DE FIRMA" rotado
function drawFirmaSello(doc, x, y, estado, fecha, tipo) {
  doc.save()
  const w = 130, h = 50
  const isFirmada = estado === 'firmada'
  const color   = isFirmada ? '#0DCFA8' : '#9ca3af'
  const text1   = isFirmada ? 'FIRMADA' : 'PENDIENTE'
  const text2   = isFirmada
    ? (tipo === 'manual' ? 'manualmente' : 'digitalmente')
    : 'de firma'

  // Rotar -8° alrededor del centro del sello
  doc.translate(x + w / 2, y + h / 2)
  doc.rotate(-8)
  doc.translate(-w / 2, -h / 2)

  // Doble borde redondeado tipo sello
  doc.lineWidth(2.2).strokeColor(color)
  doc.roundedRect(0, 0, w, h, 7).stroke()
  doc.lineWidth(0.8).strokeColor(color)
  doc.roundedRect(4, 4, w - 8, h - 8, 5).stroke()

  // Texto principal
  doc.font('Helvetica-Bold').fontSize(15).fillColor(color)
  doc.text(text1, 0, 10, { width: w, align: 'center', lineBreak: false })
  // Subtítulo
  doc.font('Helvetica').fontSize(9).fillColor(color)
  doc.text(text2, 0, 28, { width: w, align: 'center', lineBreak: false })
  // Fecha si firmada
  if (isFirmada && fecha) {
    let f = fecha
    try { f = new Date(fecha).toLocaleDateString('es-CL') } catch {}
    doc.font('Helvetica').fontSize(7).fillColor(color)
    doc.text(f, 0, 40, { width: w, align: 'center', lineBreak: false })
  }
  doc.restore()
}

function drawText(doc, text, x, y, opts = {}) {
  const {
    font = 'Helvetica', fontSize = 9, color = C.DARK_TEXT,
    width = null, align = 'left', wrap = false,
  } = opts
  doc.save()
  doc.font(font).fontSize(fontSize).fillColor(color)
  const args = { lineBreak: wrap }
  if (width) { args.width = width; args.align = align }
  doc.text(text, x, y, args)
  doc.restore()
}

// Devuelve la altura en puntos que ocuparía el texto con wrap activo
function measureTextHeight(doc, text, opts = {}) {
  const { font = 'Helvetica', fontSize = 9, width } = opts
  doc.save()
  doc.font(font).fontSize(fontSize)
  const h = doc.heightOfString(String(text || '—'), { width })
  doc.restore()
  return h
}

// ── Handler ─────────────────────────────────────────────────────────────────
export default defineEventHandler(async (event) => {
  let body = await readBody(event)

  // Shortcut: si viene solo { liquidacion_id }, armar el body desde la DB.
  // Esto deja que el módulo Pagos pida el PDF sin tener que replicar toda
  // la lógica de armado del body (haberes, descuentos legales, etc.) que
  // vive en pages/rrhh/liquidaciones.
  if (body?.liquidacion_id && !body.liquidacion) {
    requireDb(event)
    try {
      body = await buildLiquidacionPdfBody(body.liquidacion_id)
    } catch (e) {
      throw createError({ statusCode: 404, message: e.message || 'Liquidación no encontrada' })
    }
  }

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

  // Estado de firma para el sello: 'firmada' | 'pendiente' | 'sin_firma'
  // Si hay firma.data (base64 PNG), se dibuja la firma real en el PDF.
  const firma = body.firma || liq.firma || {}
  const firmaEstado = firma.estado || (firma.data || firma.firmada ? 'firmada' : 'pendiente')
  const firmaFecha  = firma.fecha || null
  const firmaTipo   = firma.tipo  || 'digital'

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
  drawText(doc, 'Liquidación de Remuneraciones', ML, y + 4, {
    font: 'Helvetica-Bold', fontSize: 17, color: C.DARK_TEXT,
  })
  // Logo en la esquina superior derecha — más grande y visible
  if (logoB64) {
    try {
      const cleanB64 = String(logoB64).replace(/^data:image\/\w+;base64,/, '')
      const buf = Buffer.from(cleanB64, 'base64')
      const lw = 140, lh = 55
      doc.image(buf, PW - MR - lw, y - 8, { fit: [lw, lh], align: 'right' })
    } catch { /* ignore */ }
  }

  y += 28
  drawText(doc, `Mes: ${liq.periodo || ''}`, ML, y, {
    font: 'Helvetica-Bold', fontSize: 11, color: C.DARK_TEXT,
  })

  y += 26

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
    const valW   = blkW - 18 - labelW
    drawText(doc, value || '—', labelLeft + labelW, ly, {
      font: 'Helvetica', fontSize: 9, color: C.DARK_TEXT,
      width: valW, align: 'left', wrap: true,
    })
    const h = measureTextHeight(doc, value || '—', { width: valW })
    ly += Math.max(lineH, h + 2)
  }
  drawKV('Rut:', formatRut(rut))
  drawKV('Fecha de Ingreso:', formatFecha(trab.fecha_ingreso))
  drawKV('Cargo:', trab.cargo || '')
  drawKV('C. Costo:', trab.centro_costo || trab.cc || '')

  // ── Derecho: Empresa ─────────────────────────────────────────────────────
  const rightX = ML + blkW + 14
  // Banner teal con título + logo de la organización a la derecha
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
    const lw  = doc.widthOfString(label) + 4
    const vw  = blkW - 24 - lw
    drawText(doc, value || '—', rightX + 12 + lw, ry, {
      font: 'Helvetica', fontSize: 9, color: C.DARK_TEXT,
      width: vw, align: 'left', wrap: true,
    })
    const h = measureTextHeight(doc, value || '—', { width: vw })
    ry += Math.max(lineH, h + 2)
  }
  drawKVRight('Razón Social:', org.nombre || org.razon_social || '—')
  drawKVRight('Rut:',          formatRut(org.rut))
  drawKVRight('Dirección:',    org.direccion || '—')

  y = blkY + blkH + 24

  // ══════════════════════════════════════════════════════════════════════════
  // KPI ROW: Días Trabajados | Días Licencia | Días Ausencia
  // (Horas Base removida — Días Trabajados queda a la izquierda)
  // ══════════════════════════════════════════════════════════════════════════
  const allKpis = [
    { label: 'Días Trabajados', value: String(liq.dias_trabajados ?? 30), always: true },
    { label: 'Días Licencia',   value: String(liq.dias_licencia   ?? 0) },
    { label: 'Días Ausencia',   value: String(liq.dias_ausencia   ?? 0) },
  ]
  const kpis = allKpis.filter(k => k.always || (k.value && k.value !== '0' && k.value !== '0,0'))

  if (kpis.length > 0) {
    const gap  = 8
    const kpiW = 130                                 // ancho fijo — no estira para llenar
    const kpiH = 42
    kpis.forEach((k, i) => {
      const kx = ML + i * (kpiW + gap)               // ← alineados a la izquierda
      // Label superior con fondo teal claro
      fillRect(doc, kx, y, kpiW, 16, C.TEAL_LIGHT)
      drawText(doc, k.label, kx, y + 5, {
        fontSize: 7.5, color: C.DARK, font: 'Helvetica-Bold',
        width: kpiW, align: 'center',
      })
      drawText(doc, k.value, kx, y + 22, {
        fontSize: 11, color: C.DARK_TEXT, font: 'Helvetica',
        width: kpiW, align: 'center',
      })
    })
    y += kpiH + 12
  }

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
  // RECIBO (texto certificación + V°B°)
  // ══════════════════════════════════════════════════════════════════════════
  const recY = Math.max(y, doc.page.height - 130)

  // Texto certificación a la izquierda (ocupa ~60% del ancho)
  const certX = ML
  const certW = Math.round(CW * 0.58)
  doc.save()
  doc.font('Helvetica').fontSize(8.5).fillColor(C.DARK_TEXT)
  doc.text(
    `Certifico que he recibido a mi entera satisfacción la suma de ${fmtClp(liquido)} indicada en la presente liquidación, y no tengo cargo ni cobro posterior que hacer por los conceptos de esta liquidación.`,
    certX, recY, { width: certW, align: 'left', lineBreak: true, lineGap: 1.5 }
  )
  doc.restore()

  // Línea de firma V°B° centrada en el lado derecho
  const firmaW = 160
  const firmaX = PW - MR - firmaW
  const firmaY = recY + 38
  doc.save()
  doc.lineWidth(1).strokeColor(C.DARK_TEXT)
  doc.moveTo(firmaX, firmaY).lineTo(firmaX + firmaW, firmaY).stroke()
  doc.restore()
  drawText(doc, 'V°.B°.', firmaX, firmaY + 6, {
    fontSize: 9, color: C.DARK_TEXT, width: firmaW, align: 'center',
  })

  // ── Firma del trabajador ─────────────────────────────────────────────────
  // Si hay imagen de firma (canvas digital o foto manual), la dibujamos
  // sobre la línea V°B° + fecha/hora de firma debajo. Sino, sello "PENDIENTE".
  if (firma.data) {
    try {
      const cleaned = String(firma.data).replace(/^data:image\/[a-zA-Z+]+;base64,/, '')
      const firmaBuf = Buffer.from(cleaned, 'base64')
      doc.image(firmaBuf, firmaX, firmaY - 42, { fit: [firmaW, 42] })
    } catch (e) {
      drawFirmaSello(doc, firmaX + 15, firmaY - 50, 'firmada', firmaFecha, firmaTipo)
    }
    // Fecha y hora de firma debajo del V°B°
    if (firmaFecha) {
      let stamp = ''
      try {
        const d = new Date(firmaFecha)
        stamp = d.toLocaleString('es-CL', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })
      } catch {}
      drawText(doc, `Firmado el ${stamp}`, firmaX, firmaY + 20, {
        fontSize: 7.5, color: C.GRAY_TEXT, width: firmaW, align: 'center',
      })
    }
  } else {
    drawFirmaSello(doc, firmaX + 15, firmaY - 50, firmaEstado, firmaFecha, firmaTipo)
  }

  // ── Pie "People by unabase" en todas las páginas ────────────────────────
  drawPeopleByFooter(doc)

  // ── Fin ──────────────────────────────────────────────────────────────────
  doc.end()
  await new Promise((resolve) => pass.on('end', resolve))
  const buffer = Buffer.concat(chunks)

  const filename = `liquidacion_${(rut || 'doc').replace(/[^0-9kK]/g, '')}_${liq.mes || ''}_${liq.anio || ''}.pdf`
  setResponseHeader(event, 'content-type', 'application/pdf')
  setResponseHeader(event, 'content-disposition', `attachment; filename="${filename}"`)
  return buffer
})
