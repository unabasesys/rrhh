import PDFDocument from "pdfkit";
import { PassThrough } from "stream";

// ── Palette ──────────────────────────────────────────────────────────────────
const C = {
  TEAL:       "#2a9d8f",
  TEAL_LIGHT: "#e8f7f5",
  TEAL_MID:   "#c5ede9",
  DARK:       "#0f1923",
  DARK2:      "#1e2d3a",
  GRAY_TEXT:  "#6b7280",
  GRAY_BG:    "#f3f4f6",
  WHITE:      "#ffffff",
  BLACK:      "#111827",
};

function fmtClp(value) {
  if (!value && value !== 0) return "$0";
  try {
    const n = Math.round(Number(value));
    const s = Math.abs(n).toLocaleString("es-CL");
    return n < 0 ? `-$${s}` : `$${s}`;
  } catch {
    return String(value);
  }
}

// Helper: draw a filled rectangle (pdfkit uses bottom-left origin, but we work
// top-to-bottom so we accept (x, y_top, w, h) and convert internally)
function fillRect(doc, x, yTop, w, h, fillColor, strokeColor = null, lineWidth = 0.5) {
  doc.save();
  if (strokeColor) {
    doc.lineWidth(lineWidth).rect(x, yTop, w, h).fillAndStroke(fillColor, strokeColor);
  } else {
    doc.rect(x, yTop, w, h).fill(fillColor);
  }
  doc.restore();
}

// Draw a single text cell in the table
function tableCell(doc, text, x, yTop, w, h, opts = {}) {
  const {
    font = "Helvetica",
    fontSize = 8,
    color = C.BLACK,
    align = "left",
    paddingX = 5,
    paddingY = 3.5,
  } = opts;

  doc.save();
  doc.font(font).fontSize(fontSize).fillColor(color);

  const textY = yTop + paddingY;
  const textW = w - paddingX * 2;

  if (align === "right") {
    doc.text(text, x + paddingX, textY, { width: textW, align: "right", lineBreak: false });
  } else if (align === "center") {
    doc.text(text, x + paddingX, textY, { width: textW, align: "center", lineBreak: false });
  } else {
    doc.text(text, x + paddingX, textY, { width: textW, align: "left", lineBreak: false });
  }
  doc.restore();
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  // ── Extract data ────────────────────────────────────────────────────────────
  const org      = body.organizacion || {};
  const trab     = body.trabajador   || {};
  const liq      = body.liquidacion  || {};

  const haberes      = liq.haberes             || body.haberes            || [];
  const descLeg      = liq.descuentos_legales  || body.descuentos_legales || [];
  const otrosDesc    = liq.otros_descuentos    || body.otros_descuentos   || [];
  const aportes      = liq.aportes             || [];
  const totales      = liq.totales             || {};
  const pago         = liq.pago                || {};
  const logoB64      = body.logo_base64        || liq.logo_base64         || null;

  const liquido      = liq.liquido_a_pagar  || 0;
  const periodo      = liq.periodo          || "";
  const rentaImp     = liq.renta_imponible  || 0;
  const costoEmp     = liq.costo_empresa    || 0;
  const nombreTrab   = trab.nombre          || trab.nombre_completo || "";
  const rut          = trab.rut             || "doc";

  // ── Build PDF ───────────────────────────────────────────────────────────────
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 40, bottom: 40, left: 50, right: 50 },
    bufferPages: true,
    autoFirstPage: true,
  });

  const pass = new PassThrough();
  const chunks = [];
  pass.on("data", (chunk) => chunks.push(chunk));

  doc.pipe(pass);

  const PAGE_W = doc.page.width;   // 595.28
  const PAGE_H = doc.page.height;  // 841.89
  const ML = 50;
  const MR = 50;
  const CW = PAGE_W - ML - MR;     // ~495

  let y = 0; // current top-of-cursor (we go downward)

  // ══════════════════════════════════════════════════════════════════════════
  // HEADER
  // ══════════════════════════════════════════════════════════════════════════
  const headerH = 62; // ~22mm
  // Dark background
  fillRect(doc, 0, 0, PAGE_W, headerH, C.DARK);
  // Teal left bar
  fillRect(doc, 0, 0, 11, headerH, C.TEAL);

  // Title
  const htY = 22;
  doc.save()
    .font("Helvetica-Bold").fontSize(13).fillColor(C.WHITE)
    .text("Liquidación de Remuneraciones", ML, htY, { lineBreak: false });
  doc.font("Helvetica").fontSize(9).fillColor(C.TEAL)
    .text(periodo, ML, htY + 16, { lineBreak: false });
  doc.restore();

  // Company name (right side)
  const orgName = org.nombre || "";
  if (orgName) {
    doc.save()
      .font("Helvetica-Bold").fontSize(9).fillColor(C.WHITE)
      .text(orgName, ML, htY, { width: CW, align: "right", lineBreak: false });
    doc.font("Helvetica").fontSize(8).fillColor(C.TEAL)
      .text(org.rut || "", ML, htY + 16, { width: CW, align: "right", lineBreak: false });
    doc.restore();
  }

  // Logo
  if (logoB64) {
    try {
      const logoBuffer = Buffer.from(logoB64, "base64");
      const logoW = 91; // ~32mm
      const logoH = 28; // ~10mm
      doc.image(logoBuffer, PAGE_W - MR - logoW, 8, {
        width: logoW,
        height: logoH,
        fit: [logoW, logoH],
      });
    } catch {
      // ignore logo errors
    }
  }

  y = headerH + 17; // ~6mm gap

  // ══════════════════════════════════════════════════════════════════════════
  // WORKER BLOCK
  // ══════════════════════════════════════════════════════════════════════════
  const blkH = 68; // ~24mm
  fillRect(doc, ML, y, CW, blkH, C.TEAL_LIGHT, C.TEAL_MID, 0.5);
  // Teal left stripe
  fillRect(doc, ML, y, 7, blkH, C.TEAL);

  const pad = 11; // ~4mm
  const col1W = CW * 0.55;

  // Left column: name, cargo, AFP/salud
  let ty = y + 15;
  doc.save()
    .font("Helvetica-Bold").fontSize(10.5).fillColor(C.DARK)
    .text(nombreTrab.toUpperCase(), ML + pad, ty, { lineBreak: false });
  doc.restore();

  ty += 14;
  if (trab.cargo) {
    doc.save()
      .font("Helvetica").fontSize(8.5).fillColor(C.GRAY_TEXT)
      .text(trab.cargo, ML + pad, ty, { lineBreak: false });
    doc.restore();
  }

  ty += 14;
  doc.save()
    .font("Helvetica").fontSize(8).fillColor(C.GRAY_TEXT)
    .text(
      `AFP: ${trab.afp || ""}   |   Salud: ${trab.sistema_salud || "FONASA"}`,
      ML + pad, ty, { lineBreak: false }
    );
  doc.restore();

  // Right column: RUT, días, período
  const rx = ML + col1W;
  const labelW = 34; // ~12mm label offset
  let ry = y + 15;

  const rightPairs = [
    ["RUT",     trab.rut            || ""],
    ["Días",    String(trab.dias_trabajados ?? 30)],
    ["Período", periodo],
  ];
  for (const [label, val] of rightPairs) {
    doc.save()
      .font("Helvetica-Bold").fontSize(8.5).fillColor(C.GRAY_TEXT)
      .text(label, rx, ry, { lineBreak: false });
    doc.font("Helvetica").fontSize(8.5).fillColor(C.DARK)
      .text(val, rx + labelW, ry, { lineBreak: false });
    doc.restore();
    ry += 14;
  }

  y += blkH + 14; // ~5mm gap

  // ══════════════════════════════════════════════════════════════════════════
  // TABLE: Detalle / Aportes / Haberes / Descuentos
  // ══════════════════════════════════════════════════════════════════════════
  const colWidths = [CW * 0.52, CW * 0.16, CW * 0.16, CW * 0.16];
  const ROW_H = 20; // row height in pts

  // Build row data
  // type: "header" | "section" | "item" | "total"
  const rows = [];

  rows.push({ type: "header", cells: ["Detalle", "Aportes", "Haberes", "Descuentos"] });

  rows.push({ type: "section", cells: ["Haberes", "", "", ""] });
  for (const h of haberes) {
    let label = `  ${h.nombre || ""}`;
    if (h.detalle) label += `  —  ${h.detalle}`;
    rows.push({ type: "item", cells: [label, "", fmtClp(h.monto), ""] });
  }

  rows.push({ type: "section", cells: ["Descuentos Legales", "", "", ""] });
  for (const d of descLeg) {
    rows.push({ type: "item", cells: [`  ${d.nombre || ""}`, "", "", fmtClp(d.monto)] });
  }

  if (otrosDesc.length > 0) {
    rows.push({ type: "section", cells: ["Otros Descuentos", "", "", ""] });
    for (const d of otrosDesc) {
      rows.push({ type: "item", cells: [`  ${d.nombre || ""}`, "", "", fmtClp(d.monto)] });
    }
  }

  if (aportes.length > 0) {
    rows.push({ type: "section", cells: ["Aportes Empleador", "", "", ""] });
    for (const a of aportes) {
      rows.push({ type: "item", cells: [`  ${a.nombre || ""}`, fmtClp(a.monto), "", ""] });
    }
  }

  rows.push({
    type: "total",
    cells: [
      "Totales:",
      fmtClp(totales.aportes || 0),
      fmtClp(totales.haberes || 0),
      fmtClp(totales.descuentos || 0),
    ],
  });

  // Draw table rows
  for (const row of rows) {
    const { type, cells } = row;

    // Choose background
    let bg = null;
    if (type === "header") bg = C.DARK2;
    else if (type === "section") bg = C.TEAL_LIGHT;
    else if (type === "total") bg = C.DARK2;

    if (bg) fillRect(doc, ML, y, CW, ROW_H, bg);

    // Outer border (box)
    doc.save()
      .rect(ML, y, CW, ROW_H)
      .lineWidth(0.5)
      .stroke(C.TEAL_MID);
    doc.restore();

    // Draw cells
    let cx = ML;
    for (let ci = 0; ci < cells.length; ci++) {
      const cellW = colWidths[ci];
      const text = cells[ci];

      // Cell divider (inner grid)
      if (ci > 0) {
        doc.save()
          .moveTo(cx, y).lineTo(cx, y + ROW_H)
          .lineWidth(0.25).stroke(C.GRAY_BG);
        doc.restore();
      }

      // Cell text style
      let font      = "Helvetica";
      let fontSize  = 8;
      let color     = C.BLACK;
      let align     = ci === 0 ? "left" : "right";

      if (type === "header") {
        font  = "Helvetica-Bold";
        color = C.TEAL;
        align = ci === 0 ? "left" : "center";
      } else if (type === "section") {
        font  = "Helvetica-Bold";
        color = C.TEAL;
        align = "left";
      } else if (type === "total") {
        font  = "Helvetica-Bold";
        color = C.WHITE;
        align = ci === 0 ? "right" : "right";
      }

      tableCell(doc, text, cx, y, cellW, ROW_H, {
        font, fontSize, color, align, paddingX: 5, paddingY: 4,
      });

      cx += cellW;
    }

    y += ROW_H;
  }

  y += 11; // ~4mm

  // ══════════════════════════════════════════════════════════════════════════
  // RENTA IMPONIBLE + COSTO EMPRESA
  // ══════════════════════════════════════════════════════════════════════════
  if (rentaImp || costoEmp) {
    const rowH = 17; // ~6mm
    fillRect(doc, ML, y, CW, rowH, C.GRAY_BG, C.TEAL_MID, 0.4);

    doc.save()
      .font("Helvetica").fontSize(7.5).fillColor(C.GRAY_TEXT)
      .text(`Renta Imponible: ${fmtClp(rentaImp)}`, ML + pad, y + 4, { lineBreak: false });
    doc.restore();

    if (costoEmp) {
      doc.save()
        .font("Helvetica").fontSize(7.5).fillColor(C.GRAY_TEXT)
        .text(`Costo Empresa: ${fmtClp(costoEmp)}`, ML, y + 4, {
          width: CW - pad,
          align: "right",
          lineBreak: false,
        });
      doc.restore();
    }
    y += rowH + 11;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LÍQUIDO A PAGAR
  // ══════════════════════════════════════════════════════════════════════════
  const liqH = 31; // ~11mm
  fillRect(doc, ML, y, CW, liqH, C.TEAL);

  doc.save()
    .font("Helvetica-Bold").fontSize(11).fillColor(C.WHITE)
    .text("Líquido a Pagar", ML + pad, y + 9, { lineBreak: false });
  doc.font("Helvetica-Bold").fontSize(11).fillColor(C.WHITE)
    .text(fmtClp(liquido), ML, y + 9, { width: CW - pad, align: "right", lineBreak: false });
  doc.restore();

  y += liqH + 17; // ~6mm

  // ══════════════════════════════════════════════════════════════════════════
  // PAYMENT INFO + SIGNATURE BLOCK
  // ══════════════════════════════════════════════════════════════════════════
  const pagoH = 74; // ~26mm
  const col1PagoW = CW * 0.5;

  fillRect(doc, ML, y, CW, pagoH, C.GRAY_BG, C.TEAL_MID, 0.5);
  // Divider between payment and signature
  doc.save()
    .moveTo(ML + col1PagoW, y)
    .lineTo(ML + col1PagoW, y + pagoH)
    .lineWidth(0.5).stroke(C.TEAL_MID);
  doc.restore();

  // Payment data (left side)
  const labelP = 68; // ~24mm offset for value
  let yp = y + 14;
  const pagoFields = [
    ["Fecha de pago:", pago.fecha_pago    || ""],
    ["Banco:",         pago.banco         || ""],
    ["Tipo cuenta:",   pago.tipo_cuenta   || ""],
    ["Nº cuenta:",     pago.numero_cuenta || ""],
  ];
  for (const [label, val] of pagoFields) {
    doc.save()
      .font("Helvetica-Bold").fontSize(8).fillColor(C.GRAY_TEXT)
      .text(label, ML + pad, yp, { lineBreak: false });
    doc.font("Helvetica").fontSize(8).fillColor(C.BLACK)
      .text(val, ML + pad + labelP, yp, { lineBreak: false });
    doc.restore();
    yp += 15.5;
  }

  // Signature (right side)
  const sigLeft  = ML + col1PagoW + pad + 22;
  const sigRight = ML + CW - pad;
  const sigY     = y + 37; // ~13mm from top of block

  doc.save()
    .moveTo(sigLeft, sigY).lineTo(sigRight, sigY)
    .lineWidth(0.7).stroke(C.DARK2);
  doc.restore();

  const sigCX = (sigLeft + sigRight) / 2;
  doc.save()
    .font("Helvetica-Bold").fontSize(8).fillColor(C.DARK)
    .text("Firma Trabajador", sigLeft, sigY + 7, {
      width: sigRight - sigLeft,
      align: "center",
      lineBreak: false,
    });
  doc.font("Helvetica").fontSize(7.5).fillColor(C.GRAY_TEXT)
    .text("Declaro recibir conforme y sin reclamo", sigLeft, sigY + 19, {
      width: sigRight - sigLeft,
      align: "center",
      lineBreak: false,
    })
    .text("alguno mi remuneración mensual", sigLeft, sigY + 29, {
      width: sigRight - sigLeft,
      align: "center",
      lineBreak: false,
    });
  doc.restore();

  // ── Finalize ─────────────────────────────────────────────────────────────
  doc.end();

  const buffer = await new Promise((resolve, reject) => {
    pass.on("end", () => resolve(Buffer.concat(chunks)));
    pass.on("error", reject);
  });

  const periodoSafe = periodo.replace(/\s+/g, "-");
  setResponseHeaders(event, {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="liquidacion-${rut}-${periodoSafe}.pdf"`,
    "Content-Length": buffer.length,
  });

  return buffer;
});
