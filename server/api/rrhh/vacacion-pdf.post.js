/**
 * POST /api/rrhh/vacacion-pdf
 * Genera el "Certificado de Vacaciones" en PDF para una solicitud aprobada.
 *
 * Body: { vacacion_id }
 *  — toda la data adicional (empresa, saldo, trabajador) se resuelve en el
 *    servidor para garantizar que el PDF refleje el estado real.
 */
import PDFDocument from 'pdfkit'
import { PassThrough } from 'stream'
import Vacacion       from '../../models/Vacacion.js'
import Trabajador     from '../../models/Trabajador.js'
import Contrato       from '../../models/Contrato.js'
import Organization   from '../../models/Organization.js'
import { requireDb }  from '../../utils/db.js'
import { requireAuth, requireOrgAccess } from '../../utils/requireAuth.js'
import { getPolicy, calcularBalance } from '../../utils/vacacionesPolicy.js'

const C = {
  TEAL:        '#0DCFA8',
  DARK:        '#062D3A',
  DARK_TEXT:   '#0f1923',
  GRAY_TEXT:   '#6b7280',
  GRAY_BORDER: '#e5e7eb',
}

function fmtFechaCorta(iso) {
  if (!iso) return ''
  const s = String(iso).slice(0, 10)
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

function fmtRut(rut) {
  if (!rut) return '—'
  const clean = String(rut).replace(/[^0-9kK]/g, '').toUpperCase()
  if (clean.length < 2) return rut
  const dv  = clean.slice(-1)
  const num = clean.slice(0, -1)
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv
}

function sumaDiaUtil(isoFin) {
  // Próximo día hábil después de fecha_fin (para reincorporación)
  const d = new Date(isoFin + 'T12:00:00')
  d.setDate(d.getDate() + 1)
  while ([0, 6].includes(d.getDay())) d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

export default defineEventHandler(async (event) => {
  requireDb(event)
  const user = await requireAuth(event)
  const body = await readBody(event)
  if (!body?.vacacion_id) throw createError({ statusCode: 400, message: 'vacacion_id requerido' })

  const vac = await Vacacion.findById(body.vacacion_id).lean()
  if (!vac) throw createError({ statusCode: 404, message: 'Solicitud no encontrada' })
  requireOrgAccess(user, vac.orgId)

  const trab = await Trabajador.findById(vac.trabajador_id).lean()
  if (!trab) throw createError({ statusCode: 404, message: 'Trabajador no encontrado' })

  const org = vac.orgId ? await Organization.findById(vac.orgId).lean() : null

  // Calcular saldo a la fecha — si hay snapshot guardado lo usamos para que
  // el PDF refleje siempre lo mismo que se firmó.
  let saldo = vac.saldo_snapshot
  if (!saldo) {
    let fechaIngreso = trab.fecha_ingreso
    if (!fechaIngreso) {
      const c = await Contrato.find({ trabajador_id: trab._id, estado: { $ne: 'finiquitado' } })
        .sort({ fecha_inicio: 1 }).limit(1).lean()
      fechaIngreso = c[0]?.fecha_inicio
    }
    const todas = await Vacacion.find({ trabajador_id: trab._id }).lean()
    saldo = calcularBalance({ fechaIngreso, vacaciones: todas, policy: getPolicy('CL') })
  }

  const nombreTrab = [trab.nombre, trab.apellido, trab.apellido_paterno, trab.apellido_materno]
    .filter(Boolean).join(' ') || trab.nombres || vac.trabajador_nombre || 'Trabajador'

  const reincorpora = sumaDiaUtil(vac.fecha_fin)
  const hoyIso      = new Date().toISOString().slice(0, 10)

  // ── PDF ───────────────────────────────────────────────────────────────────
  const docPdf = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
  })
  const pass = new PassThrough()
  const chunks = []
  pass.on('data', (c) => chunks.push(c))
  docPdf.pipe(pass)

  const PW = docPdf.page.width    // 595.28
  const ML = 50
  const CW = PW - ML * 2

  // ── Cabecera con logo y título ────────────────────────────────────────────
  docPdf
    .save()
    .roundedRect(ML, 50, 18, 18, 3).fill(C.TEAL)
    .restore()

  docPdf.fillColor(C.DARK_TEXT)
       .font('Helvetica-Bold').fontSize(22)
       .text('unabase', ML + 26, 49)

  docPdf.fillColor(C.GRAY_TEXT)
       .font('Helvetica').fontSize(8)
       .text('SOFTWARE DE GESTIÓN', ML + 26, 75, { characterSpacing: 1.2 })

  // Título centrado
  docPdf.fillColor(C.DARK_TEXT)
       .font('Helvetica-Bold').fontSize(20)
       .text('Certificado de Vacaciones', ML, 110, { width: CW, align: 'center' })

  // ── Bloque de datos de cabecera ───────────────────────────────────────────
  let y = 170
  const labelStyle = (label, value) => {
    docPdf.fillColor(C.DARK_TEXT).font('Helvetica').fontSize(10).text(`${label}: `, ML, y, { continued: true })
         .font('Helvetica-Bold').text(String(value || '—'))
    y = docPdf.y + 6
  }
  labelStyle('Fecha de Emisión', fmtFechaCorta(hoyIso))
  labelStyle('Empresa',          (org?.nombre || '—').toUpperCase())
  labelStyle('RUT',              fmtRut(org?.rut))

  // ── Cuerpo del certificado ───────────────────────────────────────────────
  y += 12
  docPdf.fillColor(C.DARK_TEXT).font('Helvetica').fontSize(10)

  const cuerpo1 = [
    'Por medio del presente documento se deja constancia que Don/Doña ',
    { text: nombreTrab.toUpperCase(), bold: true },
    ', cédula de identidad ',
    { text: fmtRut(trab.rut), bold: true },
    ', hará uso de ',
    { text: `${vac.dias_habiles} días`, bold: true },
    ' de su feriado legal a contar de ',
    { text: fmtFechaCorta(vac.fecha_inicio), bold: true },
    ' hasta el ',
    { text: fmtFechaCorta(vac.fecha_fin), bold: true },
    ', ambas fechas inclusive.',
  ]
  renderInline(docPdf, cuerpo1, ML, y, CW)
  y = docPdf.y + 8

  const cuerpo2 = [
    'El trabajador deberá reingresar a sus labores el día ',
    { text: fmtFechaCorta(reincorpora), bold: true },
    '.',
  ]
  renderInline(docPdf, cuerpo2, ML, y, CW)
  y = docPdf.y + 20

  // ── Saldo ────────────────────────────────────────────────────────────────
  docPdf.fillColor(C.DARK_TEXT).font('Helvetica').fontSize(10)
       .text(`Saldo acumulado al "${fmtFechaCorta(hoyIso)}"`, ML, y)
  y += 16

  const saldoInicial   = +(saldo.acumulado || 0).toFixed(2)
  const diasProgresivos = 0  // pendiente — Chile: 1 día extra cada 3 años después de 10
  const diasSolicitados = vac.dias_habiles
  const saldoFinal     = +(saldoInicial + diasProgresivos - diasSolicitados).toFixed(2)

  const filas = [
    ['Saldo Inicial',     `${saldoInicial.toFixed(2)} días`],
    ['Días Progresivos',  `${diasProgresivos.toFixed(2)} días`],
    ['Días solicitados',  `${diasSolicitados.toFixed(2)} días`],
    ['Saldo Final',       `${saldoFinal.toFixed(2)} días`],
  ]
  for (const [lab, val] of filas) {
    docPdf.font('Helvetica').fontSize(10).fillColor(C.DARK_TEXT)
         .text(`${lab}: `, ML, y, { continued: true })
         .font('Helvetica-Bold').text(val)
    y = docPdf.y + 4
  }

  y += 8
  docPdf.fillColor(C.GRAY_TEXT).font('Helvetica-Oblique').fontSize(8)
       .text('* Recuerda que mientras estés de vacaciones, sigues acumulando días.', ML, y, { width: CW })
  y += 50

  // ── Firmas ──────────────────────────────────────────────────────────────
  const colW   = (CW - 40) / 2
  const colTX  = ML
  const colEX  = ML + colW + 40

  // Si hay firma del trabajador, dibujarla encima de la línea
  if (vac.firma_data) {
    try {
      const dataUri = vac.firma_data
      const match = dataUri.match(/^data:image\/[a-z+]+;base64,(.+)$/)
      if (match) {
        const buf = Buffer.from(match[1], 'base64')
        docPdf.image(buf, colTX + (colW - 100) / 2, y - 30, { width: 100, height: 28 })
      }
    } catch {}
  }

  docPdf.strokeColor(C.DARK_TEXT).lineWidth(0.8)
       .moveTo(colTX, y).lineTo(colTX + colW, y).stroke()
       .moveTo(colEX, y).lineTo(colEX + colW, y).stroke()

  y += 8
  docPdf.fillColor(C.DARK_TEXT).font('Helvetica-Bold').fontSize(10)
       .text('FIRMA TRABAJADOR', colTX, y, { width: colW })
       .text('FIRMA EMPLEADOR',  colEX, y, { width: colW })

  y += 18
  docPdf.font('Helvetica-Bold').fontSize(10).fillColor(C.DARK_TEXT)
       .text(fmtRut(trab.rut),         colTX, y, { width: colW })
       .text(fmtRut(org?.rut),         colEX, y, { width: colW })

  // Si está firmada digitalmente, dejarlo como sello bajo el nombre
  if (vac.firma_fecha) {
    y += 14
    docPdf.fillColor(C.TEAL).font('Helvetica-Oblique').fontSize(8)
         .text(`Firmado digitalmente · ${fmtFechaCorta(vac.firma_fecha)}`, colTX, y, { width: colW })
  }

  // ── Pie ─────────────────────────────────────────────────────────────────
  docPdf.fillColor(C.GRAY_TEXT).font('Helvetica').fontSize(7)
       .text(`Documento ID: ${vac._id}`, ML, 780, { width: CW, align: 'center' })

  docPdf.end()
  await new Promise(r => pass.on('end', r))
  const buffer = Buffer.concat(chunks)

  setHeader(event, 'Content-Type', 'application/pdf')
  setHeader(event, 'Content-Disposition', `inline; filename="certificado-vacaciones-${vac._id}.pdf"`)
  return buffer
})

/**
 * Renderiza un párrafo con segmentos mixtos (texto plano + { text, bold }).
 * Posiciona el cursor en (x, y) y luego encadena `continued: true` para que
 * los cambios de fuente queden inline con wrap natural por el width.
 */
function renderInline(doc, segments, x, y, width) {
  doc.fillColor('#0f1923').fontSize(10)
  // Set cursor explícitamente con un texto vacío para fijar (x, y, width)
  doc.font('Helvetica').text('', x, y, { width, continued: true })
  const last = segments.length - 1
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const isLast = i === last
    if (typeof seg === 'string') {
      doc.font('Helvetica').text(seg, { continued: !isLast })
    } else {
      doc.font(seg.bold ? 'Helvetica-Bold' : 'Helvetica').text(seg.text, { continued: !isLast })
    }
  }
}
