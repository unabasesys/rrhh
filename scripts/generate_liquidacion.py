#!/usr/bin/env python3
"""
Generador de Liquidación de Remuneraciones — Unabase RRHH
Recibe JSON por stdin, devuelve PDF bytes por stdout.
Diseño moderno con paleta teal/oscura.
"""
import sys
import json
import io
import base64
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.platypus import Table, TableStyle
from reportlab.lib.utils import ImageReader

# ── Paleta ────────────────────────────────────────────────────────────────────
TEAL       = colors.HexColor("#2a9d8f")
TEAL_LIGHT = colors.HexColor("#e8f7f5")
TEAL_MID   = colors.HexColor("#c5ede9")
DARK       = colors.HexColor("#0f1923")
DARK2      = colors.HexColor("#1e2d3a")
GRAY_TEXT  = colors.HexColor("#6b7280")
GRAY_BG    = colors.HexColor("#f3f4f6")
RED        = colors.HexColor("#ef4444")
WHITE      = colors.white
BLACK      = colors.HexColor("#111827")

FONT      = "Helvetica"
FONT_BOLD = "Helvetica-Bold"

def fmt_clp(value):
    if not value:
        return "$0"
    try:
        n = int(round(float(value)))
        s = f"{abs(n):,}".replace(",", ".")
        return f"-${s}" if n < 0 else f"${s}"
    except:
        return str(value)

def draw_rounded_rect(c, x, y, w, h, r=3*mm, fill_color=None, stroke_color=None, line_width=0.5):
    """Rectángulo con esquinas redondeadas."""
    p = c.beginPath()
    p.moveTo(x + r, y)
    p.lineTo(x + w - r, y)
    p.arcTo(x + w - 2*r, y, x + w, y + 2*r, 270, 90)
    p.lineTo(x + w, y + h - r)
    p.arcTo(x + w - 2*r, y + h - 2*r, x + w, y + h, 0, 90)
    p.lineTo(x + r, y + h)
    p.arcTo(x, y + h - 2*r, x + 2*r, y + h, 90, 90)
    p.lineTo(x, y + r)
    p.arcTo(x, y, x + 2*r, y + 2*r, 180, 90)
    p.close()
    c.setLineWidth(line_width)
    if fill_color:
        c.setFillColor(fill_color)
    if stroke_color:
        c.setStrokeColor(stroke_color)
    if fill_color and stroke_color:
        c.drawPath(p, fill=1, stroke=1)
    elif fill_color:
        c.drawPath(p, fill=1, stroke=0)
    elif stroke_color:
        c.drawPath(p, fill=0, stroke=1)

def generate_pdf(data: dict) -> bytes:
    buf    = io.BytesIO()
    PAGE_W, PAGE_H = A4
    cv     = canvas.Canvas(buf, pagesize=A4)

    ML = 18 * mm
    MR = 18 * mm
    MT = 14 * mm
    CW = PAGE_W - ML - MR   # content width ~559 pt

    # ── Extraer datos (compatible con ambas estructuras de payload) ────────────
    org        = data.get("organizacion", {})
    trab       = data.get("trabajador", {})
    liq        = data.get("liquidacion", {})

    # Haberes / descuentos pueden venir dentro de liq o al nivel raíz
    haberes      = liq.get("haberes")      or data.get("haberes", [])
    desc_leg     = liq.get("descuentos_legales") or data.get("descuentos_legales", [])
    otros_desc   = liq.get("otros_descuentos")   or data.get("otros_descuentos", [])
    aportes      = liq.get("aportes", [])
    totales      = liq.get("totales", {})
    pago         = liq.get("pago", {})
    logo_b64     = data.get("logo_base64") or liq.get("logo_base64")

    liquido      = liq.get("liquido_a_pagar", 0)
    periodo      = liq.get("periodo", "")
    renta_imp    = liq.get("renta_imponible", 0)
    costo_emp    = liq.get("costo_empresa", 0)

    # Nombre trabajador: acepta "nombre" o "nombre_completo"
    nombre_trab  = trab.get("nombre") or trab.get("nombre_completo", "")

    y = PAGE_H - MT

    # ══════════════════════════════════════════════════════════════════════════
    # HEADER OSCURO con teal
    # ══════════════════════════════════════════════════════════════════════════
    header_h = 22 * mm
    # Fondo oscuro
    cv.setFillColor(DARK)
    cv.rect(0, PAGE_H - header_h, PAGE_W, header_h, fill=1, stroke=0)
    # Barra teal izquierda
    cv.setFillColor(TEAL)
    cv.rect(0, PAGE_H - header_h, 4*mm, header_h, fill=1, stroke=0)

    # Título
    hty = PAGE_H - 8 * mm
    cv.setFillColor(WHITE)
    cv.setFont(FONT_BOLD, 13)
    cv.drawString(ML, hty, "Liquidación de Remuneraciones")
    cv.setFont(FONT, 9)
    cv.setFillColor(TEAL)
    cv.drawString(ML, hty - 5.5*mm, periodo)

    # Nombre empresa (derecha del header)
    org_name = org.get("nombre", "")
    if org_name:
        cv.setFont(FONT_BOLD, 9)
        cv.setFillColor(WHITE)
        cv.drawRightString(PAGE_W - MR, hty, org_name)
        cv.setFont(FONT, 8)
        cv.setFillColor(TEAL)
        cv.drawRightString(PAGE_W - MR, hty - 5*mm, org.get("rut", ""))

    # Logo (si hay)
    if logo_b64:
        try:
            logo_data = base64.b64decode(logo_b64)
            logo_img  = ImageReader(io.BytesIO(logo_data))
            lw, lh    = 32*mm, 10*mm
            cv.drawImage(logo_img, PAGE_W - MR - lw, PAGE_H - header_h + 3*mm,
                         width=lw, height=lh, preserveAspectRatio=True, mask="auto")
        except:
            pass

    y = PAGE_H - header_h - 6*mm

    # ══════════════════════════════════════════════════════════════════════════
    # BLOQUE TRABAJADOR
    # ══════════════════════════════════════════════════════════════════════════
    blk_h = 24 * mm
    # Fondo suave teal
    cv.setFillColor(TEAL_LIGHT)
    cv.setStrokeColor(TEAL_MID)
    cv.setLineWidth(0.5)
    cv.rect(ML, y - blk_h, CW, blk_h, fill=1, stroke=1)
    # Franja teal izquierda
    cv.setFillColor(TEAL)
    cv.rect(ML, y - blk_h, 2.5*mm, blk_h, fill=1, stroke=0)

    pad = 4 * mm
    col1 = CW * 0.55
    col2 = CW * 0.45

    # Nombre grande
    ty = y - 5.5 * mm
    cv.setFont(FONT_BOLD, 10.5)
    cv.setFillColor(DARK)
    cv.drawString(ML + pad, ty, nombre_trab.upper())
    ty -= 5 * mm
    cv.setFont(FONT, 8.5)
    cv.setFillColor(GRAY_TEXT)
    cargo = trab.get("cargo", "")
    if cargo:
        cv.drawString(ML + pad, ty, cargo)
    ty -= 5 * mm
    cv.setFont(FONT, 8)
    cv.drawString(ML + pad, ty, f"AFP: {trab.get('afp', '')}   |   Salud: {trab.get('sistema_salud', 'FONASA')}")

    # Derecha: RUT + Días + Período
    rx = ML + col1
    ry = y - 5.5 * mm
    cv.setFont(FONT_BOLD, 8.5)
    cv.setFillColor(GRAY_TEXT)
    cv.drawString(rx, ry, "RUT")
    cv.setFont(FONT, 8.5)
    cv.setFillColor(DARK)
    cv.drawString(rx + 12*mm, ry, trab.get("rut", ""))
    ry -= 5 * mm
    cv.setFont(FONT_BOLD, 8.5)
    cv.setFillColor(GRAY_TEXT)
    cv.drawString(rx, ry, "Días")
    cv.setFont(FONT, 8.5)
    cv.setFillColor(DARK)
    cv.drawString(rx + 12*mm, ry, str(trab.get("dias_trabajados", 30)))
    ry -= 5 * mm
    cv.setFont(FONT_BOLD, 8.5)
    cv.setFillColor(GRAY_TEXT)
    cv.drawString(rx, ry, "Período")
    cv.setFont(FONT, 8.5)
    cv.setFillColor(DARK)
    cv.drawString(rx + 12*mm, ry, periodo)

    y -= blk_h + 5*mm

    # ══════════════════════════════════════════════════════════════════════════
    # TABLA HABERES / DESCUENTOS
    # ══════════════════════════════════════════════════════════════════════════
    COL_W = [CW * 0.52, CW * 0.16, CW * 0.16, CW * 0.16]

    def section_row(label):
        return [label, "", "", ""]

    def item_row(label, aportes_val="", haberes_val="", desc_val="", detalle=""):
        full_label = f"  {label}"
        if detalle:
            full_label = f"  {label}  —  {detalle}"
        return [full_label, aportes_val, haberes_val, desc_val]

    rows = []

    # Header
    rows.append(["Detalle", "Aportes", "Haberes", "Descuentos"])

    # Haberes
    rows.append(section_row("Haberes"))
    for h in (haberes or []):
        rows.append(item_row(
            h.get("nombre", ""),
            haberes_val=fmt_clp(h.get("monto", 0)),
            detalle=h.get("detalle", ""),
        ))

    # Descuentos legales
    rows.append(section_row("Descuentos Legales"))
    for d in (desc_leg or []):
        rows.append(item_row(d.get("nombre", ""), desc_val=fmt_clp(d.get("monto", 0))))

    # Otros descuentos
    if otros_desc:
        rows.append(section_row("Otros Descuentos"))
        for d in otros_desc:
            rows.append(item_row(d.get("nombre", ""), desc_val=fmt_clp(d.get("monto", 0))))

    # Aportes empleador
    if aportes:
        rows.append(section_row("Aportes Empleador"))
        for a in aportes:
            rows.append(item_row(a.get("nombre", ""), aportes_val=fmt_clp(a.get("monto", 0))))

    # Totales
    total_hab  = totales.get("haberes", 0)
    total_desc = totales.get("descuentos", 0)
    total_ap   = totales.get("aportes", 0)
    rows.append(["Totales:", fmt_clp(total_ap), fmt_clp(total_hab), fmt_clp(total_desc)])

    # Identificar filas de sección y totales
    section_indices = []
    total_idx = len(rows) - 1
    for i, r in enumerate(rows):
        if i > 0 and r[1] == "" and r[2] == "" and r[3] == "" and not r[0].startswith("  "):
            section_indices.append(i)

    tbl = Table(rows, colWidths=COL_W)
    style = [
        # Header
        ("BACKGROUND",    (0, 0), (-1, 0),  DARK2),
        ("TEXTCOLOR",     (0, 0), (-1, 0),  TEAL),
        ("FONTNAME",      (0, 0), (-1, 0),  FONT_BOLD),
        ("FONTSIZE",      (0, 0), (-1, 0),  8),
        ("ALIGN",         (1, 0), (-1, 0),  "CENTER"),
        # Body
        ("FONTNAME",      (0, 1), (-1, -2), FONT),
        ("FONTSIZE",      (0, 1), (-1, -1), 8),
        ("TEXTCOLOR",     (0, 1), (-1, -2), BLACK),
        ("ALIGN",         (1, 1), (-1, -1), "RIGHT"),
        ("TOPPADDING",    (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 5),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 5),
        # Grid
        ("BOX",           (0, 0), (-1, -1), 0.5, TEAL_MID),
        ("INNERGRID",     (0, 0), (-1, -1), 0.25, GRAY_BG),
        # Totales
        ("BACKGROUND",    (0, total_idx), (-1, total_idx), DARK2),
        ("TEXTCOLOR",     (0, total_idx), (-1, total_idx), WHITE),
        ("FONTNAME",      (0, total_idx), (-1, total_idx), FONT_BOLD),
        ("ALIGN",         (0, total_idx), (0, total_idx),  "RIGHT"),
    ]
    # Filas de sección
    for si in section_indices:
        style += [
            ("BACKGROUND", (0, si), (-1, si), TEAL_LIGHT),
            ("FONTNAME",   (0, si), (-1, si), FONT_BOLD),
            ("TEXTCOLOR",  (0, si), (-1, si), TEAL),
            ("SPAN",       (0, si), (-1, si)),
        ]

    tbl.setStyle(TableStyle(style))
    tw, th = tbl.wrapOn(cv, CW, PAGE_H)
    tbl.drawOn(cv, ML, y - th)
    y -= th + 4*mm

    # ══════════════════════════════════════════════════════════════════════════
    # RENTA IMPONIBLE + COSTO EMPRESA (fila compacta)
    # ══════════════════════════════════════════════════════════════════════════
    if renta_imp or costo_emp:
        row_h = 6*mm
        cv.setFillColor(GRAY_BG)
        cv.setStrokeColor(TEAL_MID)
        cv.setLineWidth(0.4)
        cv.rect(ML, y - row_h, CW, row_h, fill=1, stroke=1)
        cv.setFont(FONT, 7.5)
        cv.setFillColor(GRAY_TEXT)
        cv.drawString(ML + pad, y - 4*mm, f"Renta Imponible: {fmt_clp(renta_imp)}")
        if costo_emp:
            cv.drawRightString(ML + CW - pad, y - 4*mm, f"Costo Empresa: {fmt_clp(costo_emp)}")
        y -= row_h + 4*mm

    # ══════════════════════════════════════════════════════════════════════════
    # LÍQUIDO A PAGAR — caja destacada teal
    # ══════════════════════════════════════════════════════════════════════════
    liq_h = 11*mm
    cv.setFillColor(TEAL)
    cv.setStrokeColor(TEAL)
    cv.setLineWidth(0)
    cv.rect(ML, y - liq_h, CW, liq_h, fill=1, stroke=0)
    cv.setFont(FONT_BOLD, 11)
    cv.setFillColor(WHITE)
    cv.drawString(ML + pad, y - 7.5*mm, "Líquido a Pagar")
    cv.drawRightString(ML + CW - pad, y - 7.5*mm, fmt_clp(liquido))
    y -= liq_h + 6*mm

    # ══════════════════════════════════════════════════════════════════════════
    # BLOQUE PAGO + FIRMA
    # ══════════════════════════════════════════════════════════════════════════
    pago_h = 26*mm
    col1_w = CW * 0.5
    cv.setFillColor(GRAY_BG)
    cv.setStrokeColor(TEAL_MID)
    cv.setLineWidth(0.5)
    cv.rect(ML, y - pago_h, CW, pago_h, fill=1, stroke=1)
    cv.setStrokeColor(TEAL_MID)
    cv.line(ML + col1_w, y - pago_h, ML + col1_w, y)

    # Datos de pago (izquierda)
    LABEL_P = 24*mm
    yp = y - 5*mm
    for label, val in [
        ("Fecha de pago:", pago.get("fecha_pago", "")),
        ("Banco:",         pago.get("banco", "")),
        ("Tipo cuenta:",   pago.get("tipo_cuenta", "")),
        ("Nº cuenta:",     pago.get("numero_cuenta", "")),
    ]:
        cv.setFont(FONT_BOLD, 8)
        cv.setFillColor(GRAY_TEXT)
        cv.drawString(ML + pad, yp, label)
        cv.setFont(FONT, 8)
        cv.setFillColor(BLACK)
        cv.drawString(ML + pad + LABEL_P, yp, val)
        yp -= 5.5*mm

    # Firma (derecha)
    rx = ML + col1_w + pad
    firma_y = y - 13*mm
    rx2 = ML + CW - pad
    cv.setStrokeColor(DARK2)
    cv.setLineWidth(0.7)
    cv.line(rx + 8*mm, firma_y, rx2, firma_y)
    cv.setFont(FONT_BOLD, 8)
    cv.setFillColor(DARK)
    cv.drawCentredString((rx + 8*mm + rx2) / 2, firma_y + 2.5*mm, "Firma Trabajador")
    cv.setFont(FONT, 7.5)
    cv.setFillColor(GRAY_TEXT)
    cx = (rx + 8*mm + rx2) / 2
    cv.drawCentredString(cx, firma_y - 5*mm,   "Declaro recibir conforme y sin reclamo")
    cv.drawCentredString(cx, firma_y - 9.5*mm, "alguno mi remuneración mensual")

    cv.save()
    buf.seek(0)
    return buf.read()


if __name__ == "__main__":
    raw  = sys.stdin.read()
    data = json.loads(raw)
    pdf_bytes = generate_pdf(data)
    sys.stdout.buffer.write(pdf_bytes)
