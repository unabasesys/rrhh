/**
 * server/utils/pdfFooter.js
 * Pie de página común para todos los PDFs generados por Unabase:
 *
 *     ✓ unabase    ← "People by " + isotipo + wordmark
 *
 * Se dibuja en TODAS las páginas del documento.
 *
 * Uso:
 *   import { drawPeopleByFooter } from '../../utils/pdfFooter.js'
 *   const doc = new PDFDocument({ ..., bufferPages: true })  // ⚠ requerido
 *   ...
 *   drawPeopleByFooter(doc)
 *   doc.end()
 */
import fs from 'node:fs'
import path from 'node:path'

const COLOR_NAVY = '#062D3A'
const COLOR_TEAL = '#0DCFA8'
const COLOR_MUTED = '#9ca3af'

// Cache del isotipo en memoria (se lee 1 vez por proceso)
let _isotipoBuffer = null
function getIsotipoBuffer() {
  if (_isotipoBuffer !== null) return _isotipoBuffer
  // public/img/isotipo-color.png en el repo. cwd del runtime puede variar
  // (dev/build), así que probamos varias rutas plausibles.
  const candidates = [
    path.join(process.cwd(), 'public', 'img', 'isotipo-color.png'),
    path.join(process.cwd(), '..', 'public', 'img', 'isotipo-color.png'),
    path.join(process.cwd(), '.output', 'public', 'img', 'isotipo-color.png'),
  ]
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        _isotipoBuffer = fs.readFileSync(p)
        return _isotipoBuffer
      }
    } catch {}
  }
  _isotipoBuffer = false  // marca como "no encontrado" para no reintentar
  return null
}

/**
 * Dibuja el footer "People by [isotipo] unabase" en todas las páginas.
 * @param {PDFDocument} doc — el documento (debe tener bufferPages: true)
 * @param {object}   [opts]
 * @param {number}   [opts.marginX=28] — margen horizontal
 * @param {number}   [opts.marginBottom=14] — distancia desde el borde inferior
 * @param {string}   [opts.align='center'] — 'left' | 'center' | 'right'
 */
export function drawPeopleByFooter(doc, opts = {}) {
  const {
    marginX = 28,
    marginBottom = 14,
    align = 'center',
  } = opts

  const isotipo = getIsotipoBuffer()

  const range = doc.bufferedPageRange()  // { start, count }
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i)

    const pageW = doc.page.width
    const pageH = doc.page.height
    const y = pageH - marginBottom - 12  // alto del bloque

    // Bloque footer: "People by" + isotipo + "unabase"
    const labelText = 'People by'
    const wordmark  = 'unabase'
    const iconSize  = 11
    const gap       = 6

    doc.save()
    doc.font('Helvetica').fontSize(8).fillColor(COLOR_MUTED)
    const labelW = doc.widthOfString(labelText)

    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLOR_NAVY)
    const wordW = doc.widthOfString(wordmark)

    const totalW = labelW + gap + iconSize + gap + wordW

    let startX
    if (align === 'left')        startX = marginX
    else if (align === 'right')  startX = pageW - marginX - totalW
    else                          startX = (pageW - totalW) / 2

    // Label gris "People by"
    doc.font('Helvetica').fontSize(8).fillColor(COLOR_MUTED)
       .text(labelText, startX, y + 3, { lineBreak: false })

    // Isotipo (si disponible) o fallback geométrico
    const iconX = startX + labelW + gap
    if (isotipo) {
      try {
        doc.image(isotipo, iconX, y - 1, { fit: [iconSize, iconSize + 2] })
      } catch {
        drawFallbackIsotipo(doc, iconX, y, iconSize)
      }
    } else {
      drawFallbackIsotipo(doc, iconX, y, iconSize)
    }

    // Wordmark "unabase"
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLOR_NAVY)
       .text(wordmark, iconX + iconSize + gap, y + 2, { lineBreak: false })

    doc.restore()
  }
}

// Fallback dibujado con primitivas si no se puede cargar el PNG.
function drawFallbackIsotipo(doc, x, y, size) {
  doc.save()
  // chevron navy
  doc.lineWidth(1.2).strokeColor(COLOR_NAVY).lineCap('round').lineJoin('round')
  doc.moveTo(x, y + size * 0.35)
     .lineTo(x + size / 2, y + size + 1)
     .lineTo(x + size, y + size * 0.35)
     .stroke()
  // dot teal
  doc.circle(x + size / 2, y + size * 0.15, size * 0.18).fill(COLOR_TEAL)
  doc.restore()
}
