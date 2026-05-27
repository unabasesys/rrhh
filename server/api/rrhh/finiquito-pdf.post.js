import PDFDocument from "pdfkit";
import { drawPeopleByFooter } from "../../utils/pdfFooter.js";

// ── Helpers ───────────────────────────────────────────────────────────────────
const MESES_ES = [
  "", "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function fmtDate(d) {
  if (!d) return "—";
  try {
    const s = String(d).slice(0, 10);
    const [y, m, day] = s.split("-").map(Number);
    return `${day} de ${MESES_ES[m]} de ${y}`;
  } catch {
    return String(d);
  }
}

function fmtCLP(n) {
  if (n == null) return "$0";
  try {
    return "$" + parseInt(n).toLocaleString("es-CL");
  } catch {
    return String(n);
  }
}

// ── Causales ──────────────────────────────────────────────────────────────────
const MOTIVOS = {
  mutuo_acuerdo:        { label: "Mutuo Acuerdo de las Partes",                                    articulo: "artículo 159 N°1 del Código del Trabajo" },
  renuncia_voluntaria:  { label: "Renuncia Voluntaria del Trabajador",                             articulo: "artículo 159 N°2 del Código del Trabajo" },
  vencimiento_plazo:    { label: "Vencimiento del Plazo Convenido",                                articulo: "artículo 159 N°4 del Código del Trabajo" },
  conclusion_trabajo:   { label: "Conclusión del trabajo o servicio que dio origen al contrato",   articulo: "artículo 159 N°5 del Código del Trabajo" },
  muerte_trabajador:    { label: "Muerte del Trabajador",                                          articulo: "artículo 159 N°3 del Código del Trabajo" },
  caso_fortuito:        { label: "Caso Fortuito o Fuerza Mayor",                                   articulo: "artículo 159 N°6 del Código del Trabajo" },
  despido_disciplinario:{ label: "Despido por Justa Causa",                                        articulo: "artículo 160 del Código del Trabajo" },
  necesidades_empresa:  { label: "Necesidades de la Empresa",                                      articulo: "artículo 161 del Código del Trabajo" },
};

// ── PDF layout constants ───────────────────────────────────────────────────────
const FONT_NORMAL = "Helvetica";
const FONT_BOLD   = "Helvetica-Bold";
const SIZE_BODY   = 10;
const SIZE_SIGN   = 9.5;
const LINE_GAP    = 6;   // extra leading beyond font size

// ── Inline-bold text renderer ─────────────────────────────────────────────────
// Renders a string that may contain **bold** markers: text between ** is bold.
// Each segment is measured and word-wrapped manually within `maxWidth`.
function renderRichText(doc, text, opts = {}) {
  const {
    x,
    width,
    align = "justify",
    size = SIZE_BODY,
    paragraphGap = 10,
  } = opts;

  const pageLeft  = x ?? doc.page.margins.left;
  const maxWidth  = width ?? (doc.page.width - doc.page.margins.left - doc.page.margins.right);
  const lineHeight = size + LINE_GAP;

  // Parse into segments: [{text, bold}]
  const segments = [];
  const re = /\*\*(.*?)\*\*/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segments.push({ text: text.slice(last, m.index), bold: false });
    segments.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last), bold: false });

  // Tokenise into words keeping which segment they belong to
  const tokens = [];
  for (const seg of segments) {
    const words = seg.text.split(/(\s+)/);
    for (const w of words) {
      if (w) tokens.push({ word: w, bold: seg.bold });
    }
  }

  // Measure a word with the appropriate font
  function wordWidth(tok) {
    doc.font(tok.bold ? FONT_BOLD : FONT_NORMAL).fontSize(size);
    return doc.widthOfString(tok.word);
  }

  // Build lines
  const lines = [];
  let curLine = [];
  let curWidth = 0;

  for (const tok of tokens) {
    if (/^\s+$/.test(tok.word)) {
      // space token — only matters for width calculation between words
      if (curLine.length > 0) {
        doc.font(FONT_NORMAL).fontSize(size);
        const spaceW = doc.widthOfString(" ");
        curWidth += spaceW;
        curLine.push({ word: " ", bold: false, w: spaceW });
      }
      continue;
    }
    const ww = wordWidth(tok);
    if (curLine.length > 0 && curWidth + ww > maxWidth + 0.5) {
      lines.push(curLine);
      curLine  = [];
      curWidth = 0;
    }
    curLine.push({ ...tok, w: ww });
    curWidth += ww;
  }
  if (curLine.length > 0) lines.push(curLine);

  // Draw lines
  const startY = doc.y;
  for (let li = 0; li < lines.length; li++) {
    const line   = lines[li];
    const isLast = li === lines.length - 1;

    // Strip leading/trailing spaces
    const stripped = line.filter((t, i) => {
      if (t.word === " " && (i === 0 || i === line.length - 1)) return false;
      return true;
    });

    // Compute total natural width of printable tokens
    const naturalWidth = stripped.reduce((s, t) => s + t.w, 0);
    let extraSpace = 0;
    const spaces   = stripped.filter(t => t.word === " ").length;
    if (align === "justify" && !isLast && spaces > 0) {
      extraSpace = (maxWidth - naturalWidth) / spaces;
    }

    let cx = pageLeft;
    if (align === "center") cx = pageLeft + (maxWidth - naturalWidth) / 2;
    if (align === "right")  cx = pageLeft + maxWidth - naturalWidth;

    for (const tok of stripped) {
      doc.font(tok.bold ? FONT_BOLD : FONT_NORMAL).fontSize(size);
      doc.text(tok.word, cx, doc.y, { continued: false, lineBreak: false });
      cx += tok.w + (tok.word === " " ? extraSpace : 0);
    }

    if (li < lines.length - 1) {
      doc.moveDown(0);
      doc.y += lineHeight;
    }
  }

  doc.y += lineHeight + paragraphGap;
}

// Simple plain-text block (no bold markers)
function renderText(doc, text, opts = {}) {
  renderRichText(doc, text, opts);
}

// ── Signature table ────────────────────────────────────────────────────────────
function drawSignatureTable(doc, left, right) {
  const pageLeft  = doc.page.margins.left;
  const pageRight = doc.page.width - doc.page.margins.right;
  const totalW    = pageRight - pageLeft;
  const colW      = totalW / 2 - 6;
  const col1x     = pageLeft;
  const col2x     = pageLeft + totalW / 2 + 6;
  const rowH      = 18;
  const rows      = 3;
  const boxH      = rowH * rows + 14;
  const topY      = doc.y;

  // Draw boxes
  doc.rect(col1x, topY, colW, boxH).stroke();
  doc.rect(col2x, topY, colW, boxH).stroke();

  // Helper: centered text inside a box
  function cellText(text, bx, by, bw, bold, size) {
    doc.font(bold ? FONT_BOLD : FONT_NORMAL).fontSize(size);
    const tw = doc.widthOfString(text);
    const tx = bx + (bw - tw) / 2;
    doc.text(text, tx, by, { lineBreak: false });
  }

  const pad = 7;
  cellText(left.rep,  col1x, topY + pad,           colW, true,  SIZE_SIGN);
  cellText("EMPLEADOR",col1x, topY + pad + rowH,    colW, false, 9);
  cellText(left.emp,  col1x, topY + pad + rowH * 2, colW, true,  SIZE_SIGN);

  cellText(right.trab, col2x, topY + pad,            colW, true,  SIZE_SIGN);
  cellText("TRABAJADOR",col2x, topY + pad + rowH,    colW, false, 9);
  cellText(`RUT:  ${right.rut}`, col2x, topY + pad + rowH * 2, colW, false, 9);

  doc.y = topY + boxH + 4;
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  const org        = body.organizacion     || {};
  const trab       = body.trabajador       || {};
  const liq        = body.liquidacion      || {};
  const descuentos = body.descuentos_finiquito || [];
  const motivoKey  = body.motivo_termino   || "mutuo_acuerdo";
  const fTermino   = body.fecha_termino    || "";
  const ciudad     = body.ciudad           || "Santiago";

  const motivoInfo  = MOTIVOS[motivoKey] || MOTIVOS.mutuo_acuerdo;
  const motivoLabel = motivoInfo.label;
  const motivoArt   = motivoInfo.articulo;

  const nomEmp   = org.nombre        || "";
  const rutEmp   = org.rut           || "";
  const repEmp   = org.representante || "";
  const domEmp   = org.domicilio     || "";
  const nomTrab  = trab.nombre_completo || "";
  const rutTrab  = trab.rut          || "";
  const cargo    = trab.cargo        || "";
  const domTrab  = trab.domicilio    || "";
  const fIngreso = fmtDate(trab.fecha_ingreso || "");
  const fTerFmt  = fmtDate(fTermino);

  const sueldoProp   = parseInt(liq.sueldo_proporcional          || 0) || 0;
  const diasTrab     = parseInt(liq.dias_trabajados              || 0) || 0;
  const vacDias      = parseInt(liq.vacaciones_pendientes_dias   || 0) || 0;
  const vacMonto     = parseInt(liq.vacaciones_pendientes_monto  || 0) || 0;
  const gratificacion= parseInt(liq.gratificacion_proporcional   || 0) || 0;
  const indemAnos    = parseInt(liq.indemnizacion_anos_servicio  || 0) || 0;
  const sustitutiva  = parseInt(liq.sustitutiva_mes_aviso        || 0) || 0;
  const indemVol     = parseInt(liq.indemnizacion_voluntaria     || 0) || 0;
  const totalDesc    = descuentos.reduce((s, d) => s + (parseInt(d.monto || 0) || 0), 0);

  const totalHaberes = sueldoProp + vacMonto + gratificacion + indemAnos + sustitutiva + indemVol;
  const totalPagar   = Math.max(0, totalHaberes - totalDesc);

  // ── Build PDF ──────────────────────────────────────────────────────────────
  const buffer = await new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 85, bottom: 70, left: 85, right: 85 },
      bufferPages: true,
      info: { Title: "Finiquito de Trabajo" },
    });

    const chunks = [];
    doc.on("data",  chunk => chunks.push(chunk));
    doc.on("end",   ()    => resolve(Buffer.concat(chunks)));
    doc.on("error", err   => reject(err));

    const pw = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const px = doc.page.margins.left;

    // ── TÍTULO ───────────────────────────────────────────────────────────────
    doc.font(FONT_BOLD).fontSize(12);
    const titleText = "FINIQUITO";
    const titleW    = doc.widthOfString(titleText);
    const titleX    = px + (pw - titleW) / 2;
    doc.text(titleText, titleX, doc.y, { lineBreak: false, underline: true });
    doc.y += 12 + LINE_GAP + 16; // size + line gap + spaceAfter

    // ── PÁRRAFO INTRODUCTORIO ─────────────────────────────────────────────────
    const intro =
      `En ${ciudad} a **${fTerFmt}** entre **${nomEmp}**, ` +
      `empresa de su giro, RUT ${rutEmp} , representada por ` +
      `**${repEmp}**, con domicilio en **${domEmp}** ` +
      `por una parte, en forma indistinta “El Empleador”, y por la otra ` +
      `Don(a) **${nomTrab}** , Rut. ${rutTrab} ` +
      `domiciliado(a) en **${domTrab}**, quien en adelante se llamará ` +
      `“ El Trabajador”, se conviene el siguiente finiquito:`;

    renderRichText(doc, intro, { x: px, width: pw, align: "justify" });

    doc.y += 6; // Spacer 0.4 cm ≈ ~11pt; extra gap on top of paragraphGap

    // ── PRIMERO ───────────────────────────────────────────────────────────────
    const primero =
      `**PRIMERO.-** Don(a) **${nomTrab}** declara haber prestado servicios a ` +
      `**${nomEmp}.** en calidad de **${cargo}** ` +
      `desde el **${fIngreso},** hasta el **${fTerFmt},** ` +
      `fecha esta última de terminación de sus servicios, por la causa que se indica ` +
      `a continuación **${motivoLabel}, en virtud del ${motivoArt}.**`;

    renderRichText(doc, primero, { x: px, width: pw, align: "justify" });

    doc.y += 6;

    // ── SEGUNDO ───────────────────────────────────────────────────────────────
    const segundo =
      `**SEGUNDO.-** Don(a) **${nomTrab}** declara recibir en este acto, ` +
      `a su entera satisfacción de parte de El Empleador las sumas que a continuación ` +
      `se indican, por los siguientes conceptos:`;

    renderRichText(doc, segundo, { x: px, width: pw, align: "justify" });

    // Build item list (same logic as Python)
    const items = [];

    if (sueldoProp > 0) {
      const lblProp = diasTrab ? `Sueldo Proporcional (${diasTrab}/30 días)` : "Sueldo Proporcional";
      items.push([lblProp, sueldoProp]);
    }
    if (gratificacion > 0) {
      items.push(["Gratificación Proporcional", gratificacion]);
    }

    items.push(["Indemnización por Años de Servicio", indemAnos]);
    items.push(["Indemnización Sustitutiva Mes de Aviso", sustitutiva]);

    const lblVac = vacDias ? `Vacaciones Pendientes (${vacDias} días)` : "Vacaciones Pendientes";
    items.push([lblVac, vacMonto]);

    items.push(["Indemnización Voluntaria", indemVol]);

    // Render haber items
    const itemX = px + 25;
    const itemW = pw - 25;
    for (const [lbl, monto] of items) {
      renderRichText(doc, ` ${lbl}: **${fmtCLP(monto)}**`, {
        x: itemX, width: itemW, align: "left", paragraphGap: 3,
      });
    }

    // Descuentos
    for (const d of descuentos) {
      const m = parseInt(d.monto || 0) || 0;
      if (m > 0) {
        const lbl = d.motivo || "Descuento";
        renderRichText(doc, ` ${lbl} (descuento): **(${fmtCLP(m)})**`, {
          x: itemX, width: itemW, align: "left", paragraphGap: 3,
        });
      }
    }

    // Total
    doc.y += 4;
    renderRichText(doc, `**Total: ${fmtCLP(totalPagar)}**`, {
      x: itemX, width: itemW, align: "left", paragraphGap: 10,
    });

    doc.y += 6;

    // ── TERCERO ───────────────────────────────────────────────────────────────
    const tercero =
      `**TERCERO.-** Don(a) **${nomTrab}** deja constancia que durante todo el tiempo ` +
      `que le prestó servicios a **${nomEmp} ,** recibió de éste(a), ` +
      `correcta y oportunamente el total de las remuneraciones convenidas de acuerdo con su contrato de ` +
      `trabajo, clase de trabajo ejecutado, reajustes legales, pago de asignaciones familiares autorizadas ` +
      `por la respectiva Institución Previsional, feriados legales, en conformidad a la ley, y que nada se ` +
      `le adeuda por los conceptos antes indicados ni por ningún otro, sea de origen legal o contractual ` +
      `derivado de la prestación de sus servicios, y motivo por el cual no teniendo reclamo ni cargo alguno ` +
      `que formular en contra del empleador, le otorga el más amplio y total finiquito, declaración que ` +
      `formula libre y espontáneamente, en perfecto y cabal conocimiento de todos y cada uno de sus derechos.`;

    renderRichText(doc, tercero, { x: px, width: pw, align: "justify" });

    doc.y += 3;

    // ── CUARTO ────────────────────────────────────────────────────────────────
    const cuarto =
      `**CUARTO.-** **${nomEmp},** informa que a la fecha de término de la relación ` +
      `laboral, no ha sido notificado de resolución judicial que exija retener y pagar ` +
      `pensión por alimentos con cargo a la remuneración del trabajador según ley 21.389.-`;

    renderRichText(doc, cuarto, { x: px, width: pw, align: "justify" });

    doc.y += 8;

    // ── Cláusula de firmas ────────────────────────────────────────────────────
    renderText(
      doc,
      "Para constancia firman las partes el presente finiquito en dos ejemplares, " +
      "quedando uno de ellos en poder del empleador y el otro en poder del trabajador.",
      { x: px, width: pw, align: "justify" },
    );

    doc.y += 36; // ~2 cm spacer

    // ── Tabla de firmas ───────────────────────────────────────────────────────
    drawSignatureTable(doc, {
      rep: (repEmp  || "EMPLEADOR").toUpperCase(),
      emp: (nomEmp  || "").toUpperCase(),
    }, {
      trab: (nomTrab || "TRABAJADOR").toUpperCase(),
      rut:  rutTrab,
    });

    // ── Pie "People by unabase" en todas las páginas ──────────────────────
    drawPeopleByFooter(doc);

    doc.end();
  });

  // ── Response ───────────────────────────────────────────────────────────────
  const rut   = body.trabajador?.rut?.replace(/\./g, "").replace(/-/g, "") || "doc";
  const fecha = (body.fecha_termino || "").slice(0, 10).replace(/-/g, "");
  setResponseHeaders(event, {
    "Content-Type":        "application/pdf",
    "Content-Disposition": `attachment; filename="finiquito-${rut}-${fecha}.pdf"`,
  });
  return buffer;
});
