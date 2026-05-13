#!/usr/bin/env python3
"""
generate_finiquito.py
Genera finiquitos de trabajo en formato legal chileno (PRIMERO/SEGUNDO/TERCERO/CUARTO).
Lee JSON desde stdin, escribe bytes PDF a stdout.
"""

import sys, json, io
from datetime import datetime
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
)
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT

# ── Utilidades ────────────────────────────────────────────────────────────────
MESES_ES = [
    "", "enero","febrero","marzo","abril","mayo","junio",
    "julio","agosto","septiembre","octubre","noviembre","diciembre"
]

def fmt_date(d):
    if not d: return "—"
    try:
        dt = datetime.strptime(str(d)[:10], "%Y-%m-%d")
        return f"{dt.day} de {MESES_ES[dt.month]} de {dt.year}"
    except:
        return str(d)

def fmt_clp(n):
    """Formato $ 1.234.567"""
    if n is None: return "$ 0"
    try:
        return f"$ {int(n):,}".replace(",", ".")
    except:
        return str(n)

# ── Causales ──────────────────────────────────────────────────────────────────
MOTIVOS = {
    "mutuo_acuerdo": {
        "label": "Mutuo Acuerdo de las Partes",
        "articulo": "artículo 159 N°1 del Código del Trabajo",
    },
    "renuncia_voluntaria": {
        "label": "Renuncia Voluntaria del Trabajador",
        "articulo": "artículo 159 N°2 del Código del Trabajo",
    },
    "vencimiento_plazo": {
        "label": "Vencimiento del Plazo Convenido",
        "articulo": "artículo 159 N°4 del Código del Trabajo",
    },
    "conclusion_trabajo": {
        "label": "Conclusión del trabajo o servicio que dio origen al contrato",
        "articulo": "artículo 159 N°5 del Código del Trabajo",
    },
    "muerte_trabajador": {
        "label": "Muerte del Trabajador",
        "articulo": "artículo 159 N°3 del Código del Trabajo",
    },
    "caso_fortuito": {
        "label": "Caso Fortuito o Fuerza Mayor",
        "articulo": "artículo 159 N°6 del Código del Trabajo",
    },
    "despido_disciplinario": {
        "label": "Despido por Justa Causa",
        "articulo": "artículo 160 del Código del Trabajo",
    },
    "necesidades_empresa": {
        "label": "Necesidades de la Empresa",
        "articulo": "artículo 161 del Código del Trabajo",
    },
}

# ── Estilos ───────────────────────────────────────────────────────────────────
def make_styles():
    base = getSampleStyleSheet()
    s = {}

    s["title"] = ParagraphStyle(
        "title", parent=base["Normal"],
        fontSize=12, fontName="Helvetica-Bold",
        alignment=TA_CENTER, spaceAfter=16,
    )
    s["body"] = ParagraphStyle(
        "body", parent=base["Normal"],
        fontSize=10, fontName="Helvetica",
        alignment=TA_JUSTIFY, leading=17,
        spaceAfter=10,
    )
    s["item"] = ParagraphStyle(
        "item", parent=base["Normal"],
        fontSize=10, fontName="Helvetica",
        alignment=TA_LEFT, leading=17,
        leftIndent=25, spaceAfter=3,
    )
    s["total"] = ParagraphStyle(
        "total", parent=base["Normal"],
        fontSize=10, fontName="Helvetica-Bold",
        alignment=TA_LEFT, leading=17,
        leftIndent=25, spaceAfter=10,
        spaceBefore=4,
    )
    s["sign_name"] = ParagraphStyle(
        "sign_name", parent=base["Normal"],
        fontSize=9.5, fontName="Helvetica-Bold",
        alignment=TA_CENTER, leading=14,
    )
    s["sign_role"] = ParagraphStyle(
        "sign_role", parent=base["Normal"],
        fontSize=9, fontName="Helvetica",
        alignment=TA_CENTER, leading=13,
    )
    return s


# ── Generador principal ───────────────────────────────────────────────────────
def generate_pdf(data):
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=LETTER,
        leftMargin=3*cm, rightMargin=3*cm,
        topMargin=3*cm, bottomMargin=2.5*cm,
        title="Finiquito de Trabajo",
    )

    S = make_styles()
    story = []

    org        = data.get("organizacion", {})
    trab       = data.get("trabajador", {})
    liq        = data.get("liquidacion", {})
    motivo_key = data.get("motivo_termino", "mutuo_acuerdo")
    f_termino  = data.get("fecha_termino", "")
    descuentos = data.get("descuentos_finiquito", [])
    ciudad     = data.get("ciudad", "Santiago")

    motivo_info  = MOTIVOS.get(motivo_key, MOTIVOS["mutuo_acuerdo"])
    motivo_label = motivo_info["label"]
    motivo_art   = motivo_info["articulo"]

    # ── Datos del trabajador / empleador ──────────────────────────────────────
    nom_emp   = org.get("nombre", "")
    rut_emp   = org.get("rut", "")
    rep_emp   = org.get("representante", "")
    dom_emp   = org.get("domicilio", "")
    nom_trab  = trab.get("nombre_completo", "")
    rut_trab  = trab.get("rut", "")
    cargo     = trab.get("cargo", "")
    dom_trab  = trab.get("domicilio", "")
    f_ingreso = fmt_date(trab.get("fecha_ingreso", ""))
    f_ter_fmt = fmt_date(f_termino)

    # ── Montos ────────────────────────────────────────────────────────────────
    sueldo_prop   = int(liq.get("sueldo_proporcional", 0) or 0)
    dias_trab     = int(liq.get("dias_trabajados", 0) or 0)
    vac_dias      = int(liq.get("vacaciones_pendientes_dias", 0) or 0)
    vac_monto     = int(liq.get("vacaciones_pendientes_monto", 0) or 0)
    gratificacion = int(liq.get("gratificacion_proporcional", 0) or 0)
    indem_anos    = int(liq.get("indemnizacion_anos_servicio", 0) or 0)
    sustitutiva   = int(liq.get("sustitutiva_mes_aviso", 0) or 0)
    indem_vol     = int(liq.get("indemnizacion_voluntaria", 0) or 0)
    total_desc    = sum(int(d.get("monto", 0) or 0) for d in descuentos)

    total_haberes = sueldo_prop + vac_monto + gratificacion + indem_anos + sustitutiva + indem_vol
    total_pagar   = max(0, total_haberes - total_desc)

    # ═════════════════════════════════════════════════════════════════════════
    # TÍTULO
    # ═════════════════════════════════════════════════════════════════════════
    story.append(Paragraph("<u><b>FINIQUITO</b></u>", S["title"]))

    # ═════════════════════════════════════════════════════════════════════════
    # PÁRRAFO INTRODUCTORIO
    # ═════════════════════════════════════════════════════════════════════════
    story.append(Paragraph(
        f"En {ciudad} a <b>{f_ter_fmt}</b> entre <b>{nom_emp}</b>, "
        f"empresa de su giro, RUT {rut_emp} , representada por "
        f"<b>{rep_emp}</b>, con domicilio en <b>{dom_emp}</b> "
        f"por una parte, en forma indistinta \u201cEl Empleador\u201d, y por la otra "
        f"Don(a) <b>{nom_trab}</b> , Rut. {rut_trab} "
        f"domiciliado(a) en <b>{dom_trab}</b>, quien en adelante se llamará "
        f"\u201c El Trabajador\u201d, se conviene el siguiente finiquito:",
        S["body"]
    ))

    story.append(Spacer(1, 0.4*cm))

    # ═════════════════════════════════════════════════════════════════════════
    # PRIMERO
    # ═════════════════════════════════════════════════════════════════════════
    story.append(Paragraph(
        f"<b>PRIMERO.-</b> Don(a) <b>{nom_trab}</b> declara haber prestado servicios a "
        f"<b>{nom_emp}.</b> en calidad de <b>{cargo}</b> "
        f"desde el <b>{f_ingreso},</b> hasta el <b>{f_ter_fmt},</b> "
        f"fecha esta última de terminación de sus servicios, por la causa que se indica "
        f"a continuación <b>{motivo_label}, en virtud del {motivo_art}.</b>",
        S["body"]
    ))

    story.append(Spacer(1, 0.4*cm))

    # ═════════════════════════════════════════════════════════════════════════
    # SEGUNDO
    # ═════════════════════════════════════════════════════════════════════════
    story.append(Paragraph(
        f"<b>SEGUNDO.-</b> Don(a) <b>{nom_trab}</b> declara recibir en este acto, "
        f"a su entera satisfacción de parte de El Empleador las sumas que a continuación "
        f"se indican, por los siguientes conceptos:",
        S["body"]
    ))

    # Listado de haberes — se muestran todos, incluso en $0, como en el formato legal
    items = []

    if sueldo_prop > 0:
        lbl_prop = f"Sueldo Proporcional ({dias_trab}/30 días)" if dias_trab else "Sueldo Proporcional"
        items.append((lbl_prop, sueldo_prop))
    if gratificacion > 0:
        items.append(("Gratificación Proporcional", gratificacion))

    # Indemnizaciones siempre visibles (aunque sean $0)
    items.append(("Indemnización por Años de Servicio", indem_anos))
    items.append(("Indemnización Sustitutiva Mes de Aviso", sustitutiva))
    items.append(("Vacaciones Pendientes", vac_monto if not (vac_monto > 0 and sueldo_prop == 0) else vac_monto))

    # Ajuste: si vacaciones ya está entre los haberes de arriba, no duplicar
    vac_already = vac_monto > 0
    if vac_already:
        # reemplazar la entrada genérica por una con días
        items_final = []
        for lbl, monto in items:
            if lbl == "Vacaciones Pendientes":
                lbl_vac = f"Vacaciones Pendientes ({vac_dias} días)" if vac_dias else "Vacaciones Pendientes"
                items_final.append((lbl_vac, vac_monto))
            else:
                items_final.append((lbl, monto))
        items = items_final

    items.append(("Indemnización Voluntaria", indem_vol))

    # Descuentos
    desc_items = [(d.get("motivo", "Descuento"), -int(d.get("monto", 0) or 0))
                  for d in descuentos if d.get("monto", 0) > 0]

    for lbl, monto in items:
        story.append(Paragraph(f" {lbl}: <b>{fmt_clp(monto)}</b>", S["item"]))

    for lbl, monto in desc_items:
        story.append(Paragraph(f" {lbl} (descuento): <b>({fmt_clp(-monto)})</b>", S["item"]))

    story.append(Paragraph(f"<b>Total: {fmt_clp(total_pagar)}</b>", S["total"]))

    story.append(Spacer(1, 0.4*cm))

    # ═════════════════════════════════════════════════════════════════════════
    # TERCERO
    # ═════════════════════════════════════════════════════════════════════════
    story.append(Paragraph(
        f"<b>TERCERO.-</b> Don(a) <b>{nom_trab}</b> deja constancia que durante todo el tiempo "
        f"que le prest\u00f3 servicios a <b>{nom_emp} ,</b> recibió de éste(a), "
        f"correcta y oportunamente el total de las remuneraciones convenidas de acuerdo con su contrato de "
        f"trabajo, clase de trabajo ejecutado, reajustes legales, pago de asignaciones familiares autorizadas "
        f"por la respectiva Institución Previsional, feriados legales, en conformidad a la ley, y que nada se "
        f"le adeuda por los conceptos antes indicados ni por ningún otro, sea de origen legal o contractual "
        f"derivado de la prestación de sus servicios, y motivo por el cual no teniendo reclamo ni cargo alguno "
        f"que formular en contra del empleador, le otorga el más amplio y total finiquito, declaración que "
        f"formula libre y espontáneamente, en perfecto y cabal conocimiento de todos y cada uno de sus derechos.",
        S["body"]
    ))

    story.append(Spacer(1, 0.2*cm))

    # ═════════════════════════════════════════════════════════════════════════
    # CUARTO
    # ═════════════════════════════════════════════════════════════════════════
    story.append(Paragraph(
        f"<b>CUARTO.-</b> <b>{nom_emp},</b> informa que a la fecha de término de la relación "
        f"laboral, no ha sido notificado de resolución judicial que exija retener y pagar "
        f"pensión por alimentos con cargo a la remuneración del trabajador según ley 21.389.-",
        S["body"]
    ))

    story.append(Spacer(1, 0.5*cm))

    # ═════════════════════════════════════════════════════════════════════════
    # Cláusula de firmas
    # ═════════════════════════════════════════════════════════════════════════
    story.append(Paragraph(
        "Para constancia firman las partes el presente finiquito en dos ejemplares, "
        "quedando uno de ellos en poder del empleador y el otro en poder del trabajador.",
        S["body"]
    ))

    story.append(Spacer(1, 2*cm))

    # ═════════════════════════════════════════════════════════════════════════
    # Tabla de firmas
    # ═════════════════════════════════════════════════════════════════════════
    rep_upper  = rep_emp.upper() if rep_emp else "EMPLEADOR"
    trab_upper = nom_trab.upper() if nom_trab else "TRABAJADOR"
    emp_upper  = nom_emp.upper() if nom_emp else ""

    firma_data = [
        [Paragraph(f"<b>{rep_upper}</b>", S["sign_name"]),
         Paragraph(f"<b>{trab_upper}</b>", S["sign_name"])],
        [Paragraph("EMPLEADOR", S["sign_role"]),
         Paragraph("TRABAJADOR", S["sign_role"])],
        [Paragraph(f"<b>{emp_upper}</b>", S["sign_name"]),
         Paragraph(f"RUT:  {rut_trab}", S["sign_role"])],
    ]

    firma_tbl = Table(firma_data, colWidths=[7*cm, 7*cm])
    firma_tbl.setStyle(TableStyle([
        ("BOX",          (0, 0), (0, -1), 1, colors.black),
        ("BOX",          (1, 0), (1, -1), 1, colors.black),
        ("LINEAFTER",    (0, 0), (0, -1), 1, colors.black),
        ("ALIGN",        (0, 0), (-1, -1), "CENTER"),
        ("VALIGN",       (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",   (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 7),
        ("LEFTPADDING",  (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))

    story.append(KeepTogether([firma_tbl]))

    doc.build(story)
    buf.seek(0)
    return buf.read()


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    raw = sys.stdin.buffer.read()
    data = json.loads(raw.decode("utf-8"))
    pdf_bytes = generate_pdf(data)
    sys.stdout.buffer.write(pdf_bytes)
