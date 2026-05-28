/**
 * server/utils/pdfFooter.js
 * Pie de página común para todos los PDFs generados por Unabase:
 *
 *     People by [logo-unabase-color.png]
 *
 * El bloque completo es un enlace clickeable a https://www.unabase.com.
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

const COLOR_NAVY  = '#062D3A'
const COLOR_TEAL  = '#0DCFA8'
const COLOR_MUTED = '#9ca3af'
const UNABASE_URL = 'https://www.unabase.com'

// Cache del logo completo en memoria (se lee 1 vez por proceso)
let _logoBuffer = null
function getLogoBuffer() {
  if (_logoBuffer !== null) return _logoBuffer
  // logo-unabase-color.png: isotipo + wordmark "unabase" en color oficial
  const candidates = [
    path.join(process.cwd(), 'public', 'img', 'logo-unabase-color.png'),
    path.join(process.cwd(), '..', 'public', 'img', 'logo-unabase-color.png'),
    path.join(process.cwd(), '.output', 'public', 'img', 'logo-unabase-color.png'),
  ]
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        _logoBuffer = fs.readFileSync(p)
        return _logoBuffer
      }
    } catch {}
  }
  _logoBuffer = false
  return null
}

/**
 * Dibuja "People by [logo unabase]" como enlace clickeable a unabase.com
 * en todas las páginas del documento.
 */
export function drawPeopleByFooter(doc, opts = {}) {
  const {
    marginX = 28,
    marginBottom = 14,
    align = 'center',
  } = opts

  const logoBuf = getLogoBuffer()
  // Ratio del PNG es ~ ancho:alto = 4:1 (wordmark con isotipo a la izquierda).
  // Lo dibujamos a 16pt de alto, eso da ~64pt de ancho.
  const logoH = 16
  const logoW = logoH * 3.6   // proporción aprox del logo color
  const gap   = 6

  const range = doc.bufferedPageRange()
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i)

    const pageW = doc.page.width
    const pageH = doc.page.height
    const y     = pageH - marginBottom - logoH

    const labelText = 'People by'

    doc.save()
    doc.font('Helvetica').fontSize(8).fillColor(COLOR_MUTED)
    const labelW = doc.widthOfString(labelText)
    const totalW = labelW + gap + logoW

    let startX
    if (align === 'left')        startX = marginX
    else if (align === 'right')  startX = pageW - marginX - totalW
    else                         startX = (pageW - totalW) / 2

    // Label gris "People by"
    doc.font('Helvetica').fontSize(8).fillColor(COLOR_MUTED)
       .text(labelText, startX, y + (logoH - 8) / 2 + 1, { lineBreak: false })

    // Logo color completo "unabase"
    const logoX = startX + labelW + gap
    if (logoBuf) {
      try {
        doc.image(logoBuf, logoX, y, { fit: [logoW, logoH] })
      } catch {
        drawFallback(doc, logoX, y, logoH)
      }
    } else {
      drawFallback(doc, logoX, y, logoH)
    }
    doc.restore()

    // Toda el área del footer es clickeable
    doc.link(startX, y, totalW, logoH, UNABASE_URL)
  }
}

// Fallback dibujado con primitivas si no se puede cargar el PNG.
function drawFallback(doc, x, y, h) {
  doc.save()
  // chevron + dot + "unabase" texto
  const size = h
  doc.lineWidth(1.2).strokeColor(COLOR_NAVY).lineCap('round').lineJoin('round')
  doc.moveTo(x, y + size * 0.35)
     .lineTo(x + size / 2, y + size + 1)
     .lineTo(x + size, y + size * 0.35)
     .stroke()
  doc.circle(x + size / 2, y + size * 0.15, size * 0.18).fill(COLOR_TEAL)
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLOR_NAVY)
     .text('unabase', x + size + 6, y + 2, { lineBreak: false })
  doc.restore()
}
