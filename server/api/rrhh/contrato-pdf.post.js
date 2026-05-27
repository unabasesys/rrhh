import PDFDocument from "pdfkit";
import { PassThrough } from "stream";
import { drawPeopleByFooter } from "../../utils/pdfFooter.js";

// ── Colores ───────────────────────────────────────────────────────────────────
const TEAL       = "#2a9d8f";
const TEAL_DARK  = "#1f7a6e";
const GRAY_DARK  = "#1e2a35";
const GRAY_MID   = "#4a5568";
const GRAY_LIGHT = "#e2e8f0";

// ── Utilidades de fecha/moneda ────────────────────────────────────────────────
const MESES_ES = [
  "", "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function fmtDate(d) {
  if (!d) return "—";
  try {
    const [year, month, day] = String(d).slice(0, 10).split("-").map(Number);
    return `${day} de ${MESES_ES[month]} de ${year}`;
  } catch {
    return String(d);
  }
}

function fmtClp(n) {
  if (!n) return "$0";
  try {
    return "$" + parseInt(n).toLocaleString("es-CL");
  } catch {
    return String(n);
  }
}

// ── Helpers de dibujo en PDFKit ───────────────────────────────────────────────

/**
 * Draws a line of text that may contain simple inline bold markers.
 * We use a convention: text segments wrapped in ** are bold.
 * For simplicity, this renderer splits on ** and alternates normal/bold.
 */
function drawMixedText(doc, text, opts = {}) {
  const { x, y, width, align = "left", fontSize, color, bold = false } = opts;
  doc.fillColor(color || GRAY_DARK);
  if (fontSize) doc.fontSize(fontSize);
  const font = bold ? "Helvetica-Bold" : "Helvetica";
  doc.font(font).text(text, x, y, { width, align, lineGap: 2 });
}

/**
 * Draw a horizontal rule.
 */
function drawHR(doc, y, color = GRAY_LIGHT, thickness = 0.5) {
  const margin = doc.page.margins.left;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.save()
    .strokeColor(color)
    .lineWidth(thickness)
    .moveTo(margin, y)
    .lineTo(margin + pageWidth, y)
    .stroke()
    .restore();
}

/**
 * Returns current Y position with some bottom-of-page safety.
 * If a block of `neededHeight` won't fit, add a new page.
 */
function ensureSpace(doc, neededHeight = 60) {
  const bottomMargin = doc.page.margins.bottom;
  const available = doc.page.height - doc.y - bottomMargin;
  if (available < neededHeight) {
    doc.addPage();
  }
}

// ── Section/clause title ──────────────────────────────────────────────────────
function drawClauseTitle(doc, text) {
  ensureSpace(doc, 40);
  doc.moveDown(0.5);
  doc.font("Helvetica-Bold").fontSize(10).fillColor(TEAL_DARK).text(text, {
    align: "left",
    underline: true,
    lineGap: 2,
  });
  doc.moveDown(0.25);
}

// ── Clause body paragraph ─────────────────────────────────────────────────────
function drawBody(doc, text) {
  doc.font("Helvetica").fontSize(9.5).fillColor(GRAY_DARK).text(text, {
    align: "justify",
    lineGap: 2,
  });
  doc.moveDown(0.3);
}

// ── Numbered bullet ───────────────────────────────────────────────────────────
function drawBullet(doc, text) {
  const leftMargin = doc.page.margins.left;
  const pageWidth = doc.page.width - leftMargin - doc.page.margins.right;
  const indent = 18;
  doc.font("Helvetica").fontSize(9.5).fillColor(GRAY_DARK).text(text, leftMargin + indent, doc.y, {
    align: "justify",
    width: pageWidth - indent,
    lineGap: 2,
  });
  doc.moveDown(0.2);
}

// ── Header ────────────────────────────────────────────────────────────────────
function buildHeader(doc, data) {
  const org  = data.organizacion || {};
  const logo = data.logo_base64;
  const tipo = data.tipo_contrato || "indefinido";

  const TIPO_LABELS = {
    indefinido:         "CONTRATO DE TRABAJO\nDuración Indefinida",
    plazo_fijo:         "CONTRATO DE TRABAJO\nPlazo Fijo",
    proyecto:           "CONTRATO DE TRABAJO\nPor Proyecto / Obra",
    honorarios:         "CONTRATO DE PRESTACIÓN DE SERVICIOS A HONORARIOS",
    part_time:          "CONTRATO DE TRABAJO\nJornada Parcial (Part Time)",
    sueldo_empresarial: "ACTA DE ASIGNACIÓN DE SUELDO EMPRESARIAL\nArt. 31 N°6 Ley sobre Impuesto a la Renta",
  };
  const tituloLabel = TIPO_LABELS[tipo] || "CONTRATO DE TRABAJO";

  const leftMargin   = doc.page.margins.left;
  const rightMargin  = doc.page.margins.right;
  const pageWidth    = doc.page.width - leftMargin - rightMargin;
  const topY         = doc.page.margins.top;

  // Teal bar
  doc.save()
    .rect(leftMargin, topY, pageWidth, 14)
    .fill(TEAL)
    .restore();

  let currentY = topY + 14 + 10;

  // Logo + title row
  if (logo) {
    try {
      const imgBuf = Buffer.from(logo, "base64");
      const logoW  = 100;
      const logoH  = 40;
      const titleX = leftMargin + logoW + 12;
      const titleW = pageWidth - logoW - 12;
      doc.image(imgBuf, leftMargin, currentY, { width: logoW, height: logoH, fit: [logoW, logoH] });
      doc.font("Helvetica-Bold").fontSize(15).fillColor(GRAY_DARK)
        .text(tituloLabel, titleX, currentY + 2, { width: titleW, align: "center" });
      currentY += Math.max(logoH, doc.currentLineHeight(true) * (tituloLabel.split("\n").length)) + 8;
    } catch {
      doc.font("Helvetica-Bold").fontSize(15).fillColor(GRAY_DARK)
        .text(tituloLabel, leftMargin, currentY, { width: pageWidth, align: "center" });
      currentY = doc.y + 8;
    }
  } else {
    doc.font("Helvetica-Bold").fontSize(15).fillColor(GRAY_DARK)
      .text(tituloLabel, leftMargin, currentY, { width: pageWidth, align: "center" });
    currentY = doc.y + 8;
  }

  // Teal HR under title
  doc.save()
    .strokeColor(TEAL)
    .lineWidth(1.5)
    .moveTo(leftMargin, currentY)
    .lineTo(leftMargin + pageWidth, currentY)
    .stroke()
    .restore();
  currentY += 8;

  // Org subtitle line
  const orgLine = [
    org.nombre || "",
    org.rut ? `RUT: ${org.rut}` : "",
    org.direccion || "",
    org.ciudad || "Santiago",
  ].filter(Boolean).join("  ·  ");

  doc.font("Helvetica").fontSize(8).fillColor(GRAY_MID)
    .text(orgLine, leftMargin, currentY, { width: pageWidth, align: "center" });
  currentY = doc.y + 12;

  // Reset Y so content starts after header
  doc.y = currentY;
}

// ── Partes intro paragraph ────────────────────────────────────────────────────
function drawIntro(doc, text) {
  doc.font("Helvetica").fontSize(9.5).fillColor(GRAY_DARK).text(text, {
    align: "justify",
    lineGap: 2,
  });
  doc.moveDown(0.5);
}

// ── CLAUSULAS: INDEFINIDO / PLAZO FIJO / PART TIME ───────────────────────────
function buildClausulasIndefinido(doc, data, { plazofijo = false, partTime = false } = {}) {
  const emp  = data.empleador  || {};
  const trab = data.trabajador || {};
  const org  = data.organizacion || {};

  const nombreEmp     = org.nombre    || emp.nombre    || "";
  const rutEmp        = org.rut       || emp.rut       || "";
  const repNombre     = emp.representante     || "";
  const repRut        = emp.rut_representante || "";
  const domicilioEmp  = org.direccion || emp.domicilio  || "";
  const ciudadEmp     = org.ciudad    || "Santiago";

  const nombreTrab   = trab.nombre         || "";
  const rutTrab      = trab.rut            || "";
  const fnTrab       = fmtDate(trab.fecha_nacimiento);
  const domTrab      = trab.domicilio      || "";
  const emailTrab    = trab.email          || "";
  const afp          = trab.afp            || "";
  const salud        = trab.sistema_salud  || "FONASA";

  const cargo           = data.cargo          || "";
  const funciones       = data.funciones      || [];
  const modalidad       = data.modalidad      || "presencial";
  const lugarTrabajo    = data.lugar_trabajo    || domicilioEmp;
  const direccionTrabajo = data.direccion_trabajo || lugarTrabajo;
  const jornadaHoras    = data.jornada_horas   || (partTime ? 22 : 44);
  const horario         = data.horario         || "Lunes a jueves de 08:30 a 18:30 horas y viernes de 08:30 a 17:30 horas";
  const sueldoBase      = data.sueldo_base     || 0;
  const fechaInicio     = fmtDate(data.fecha_inicio);
  const fechaTermino    = plazofijo ? fmtDate(data.fecha_termino) : null;
  const fechaDoc        = fmtDate(data.fecha_documento || new Date().toISOString().slice(0, 10));

  const modalidadTexto = {
    teletrabajo: `en la modalidad de teletrabajo desde su domicilio particular ubicado en ${direccionTrabajo}`,
    presencial:  `en las dependencias del Empleador ubicadas en ${direccionTrabajo}`,
    hibrido:     `en modalidad híbrida, combinando trabajo presencial en ${direccionTrabajo} y teletrabajo según acuerdo de las Partes`,
  }[modalidad] || `en ${direccionTrabajo}`;

  // Intro
  drawIntro(doc,
    `En ${ciudadEmp}, a ${fechaDoc}, entre: por una parte, ${nombreEmp}, ` +
    `rol único tributario número ${rutEmp}, representada por don/ña ${repNombre}, ` +
    `cédula de identidad número ${repRut}, ambos domiciliados para estos efectos en ` +
    `${domicilioEmp} (en adelante, el "Empleador"); y don/ña ${nombreTrab}, ` +
    `cédula de identidad número ${rutTrab}, nacido/a el ${fnTrab}, ` +
    `domiciliado/a en ${domTrab} (en adelante el "Trabajador" y junto con el Empleador, ` +
    `como las "Partes"), han convenido la suscripción del siguiente contrato de trabajo ` +
    `(en adelante, el "Contrato"):`
  );

  // PRIMERO
  drawClauseTitle(doc, "PRIMERO: Naturaleza y Prestación de los Servicios.");
  drawBody(doc,
    `Uno. El Trabajador se compromete y obliga a prestar servicios bajo el cargo de "${cargo}". ` +
    `En el ejercicio de su cargo, deberá cumplir con todas las obligaciones y funciones inherentes a su cargo ` +
    `y que directa o indirectamente se relacionen con dicha labor${funciones.length ? ", en especial:" : "."}`
  );
  funciones.forEach((fn, i) => drawBullet(doc, `${i + 1}. ${fn}`));
  drawBody(doc,
    `Dos. El Trabajador desempeñará sus funciones ${modalidadTexto}. ` +
    `Sin perjuicio de lo anterior, el Empleador podrá requerir la presencia del Trabajador en sus instalaciones ` +
    `cuando las necesidades del servicio así lo ameriten, previa coordinación.`
  );
  drawBody(doc,
    `Tres. El Trabajador se obliga a ejecutar los trabajos de la manera más eficaz posible, ` +
    `empleando la mayor responsabilidad, eficiencia, dedicación y diligencia, evitando comprometer ` +
    `la seguridad y prestigio del Empleador, ciñéndose a las directrices e instrucciones impartidas.`
  );

  // SEGUNDO
  drawClauseTitle(doc, "SEGUNDO: Jornada de Trabajo.");
  if (partTime) {
    drawBody(doc,
      `Uno. El Trabajador estará sujeto a una jornada parcial de trabajo de ${jornadaHoras} horas semanales, ` +
      `distribuidas conforme al siguiente horario: ${horario}. ` +
      `Dentro de la jornada diaria, el Trabajador tendrá derecho a colación en los términos del artículo 34 del Código del Trabajo.`
    );
  } else {
    drawBody(doc,
      `Uno. El Trabajador estará sujeto a una jornada ordinaria de trabajo de ${jornadaHoras} horas semanales, ` +
      `distribuidas de la siguiente manera: ${horario}. ` +
      `Dentro de la jornada diaria el Trabajador tendrá derecho a 1 hora destinada a colación, ` +
      `tiempo que no se considerará trabajado conforme lo dispone el artículo 34 del Código del Trabajo.`
    );
  }
  drawBody(doc,
    `Dos. El Trabajador deberá registrar el cumplimiento de jornada en la plataforma que designe el Empleador. ` +
    `Todo trabajo en horas extraordinarias deberá pactarse previamente por escrito.`
  );

  // TERCERO
  drawClauseTitle(doc, "TERCERO: Remuneración.");
  drawBody(doc,
    `Uno. La remuneración base del Trabajador será de ${fmtClp(sueldoBase)}.- mensuales, ` +
    `de la cual el Empleador deducirá los montos legalmente correspondientes.`
  );
  drawBody(doc,
    `Dos. El Empleador pagará anualmente una gratificación equivalente al 25% de lo devengado ` +
    `por concepto de remuneraciones, con un tope de 4,75 ingresos mínimos mensuales (artículo 50 del Código del Trabajo). ` +
    `Mensualmente se anticipará un doceavo de dicha gratificación.`
  );
  drawBody(doc,
    `Tres. Las remuneraciones serán pagadas en moneda nacional, por mes calendario vencido, ` +
    `el último día hábil de cada mes, mediante transferencia electrónica bancaria a la cuenta que el Trabajador informe.`
  );
  drawBody(doc,
    `Cuatro. El Trabajador declara encontrarse afiliado a ${salud} y a ${afp} ` +
    `para efectos de las deducciones legales. Es responsabilidad del Trabajador notificar al Empleador ` +
    `cualquier cambio en sus instituciones previsionales.`
  );

  // CUARTO
  drawClauseTitle(doc, "CUARTO: Obligaciones del Trabajador.");
  const obligaciones = [
    "Cuidar y mantener en perfecto estado de conservación los bienes e instalaciones del Empleador.",
    "Cumplir con las instrucciones y órdenes impartidas por sus superiores.",
    "En caso de inasistencia por enfermedad, justificarla con certificado médico dentro de las 24 horas.",
    "Mantener estricta reserva sobre los antecedentes, negocios y asuntos del Empleador.",
    "Respetar el Reglamento Interno de Orden, Higiene y Seguridad, que se entiende parte integrante de este contrato.",
    "Registrar correctamente el control de asistencia al ingreso y salida.",
    "Acusar recibo de todas las comunicaciones escritas que el Empleador le entregue.",
  ];
  obligaciones.forEach((o, i) => drawBullet(doc, `${i + 1}. ${o}`));

  // QUINTO
  drawClauseTitle(doc, "QUINTO: Prohibiciones del Trabajador.");
  const prohibiciones = [
    "Entregar información falsa en el desempeño de su actividad.",
    "Utilizar en beneficio propio o de terceros los contratos, bases de datos, know-how y cualquier información del Empleador.",
    "Atender asuntos profesionales particulares dentro del horario de trabajo sin autorización expresa.",
    "Realizar actividades que signifiquen competencia desleal para el Empleador.",
  ];
  prohibiciones.forEach((pr, i) => drawBullet(doc, `${i + 1}. ${pr}`));

  // SEXTO
  drawClauseTitle(doc, "SEXTO: Vigencia.");
  if (plazofijo && fechaTermino) {
    drawBody(doc,
      `Uno. El presente contrato tendrá una vigencia de plazo fijo, iniciando el ${fechaInicio} ` +
      `y terminando el día ${fechaTermino}, fecha en que operará su extinción automática conforme ` +
      `al artículo 159 Nº 4 del Código del Trabajo.`
    );
  } else if (partTime) {
    drawBody(doc,
      `Uno. El presente contrato de trabajo a jornada parcial será de duración indefinida, ` +
      `iniciando la relación laboral el ${fechaInicio}.`
    );
  } else {
    drawBody(doc, `Uno. El presente contrato de trabajo será de duración indefinida.`);
    drawBody(doc,
      `Dos. Cualquiera de las partes podrá ponerle término cuando concurran causales ` +
      `establecidas en los artículos 159, 160 o 161 del Código del Trabajo.`
    );
  }
  drawBody(doc, `Las Partes dejan constancia que la relación laboral comienza el ${fechaInicio}.`);

  // SÉPTIMO
  drawClauseTitle(doc, "SÉPTIMO: Sanción por Incumplimiento.");
  drawBody(doc,
    `La infracción o incumplimiento de cualquiera de las obligaciones de este Contrato ` +
    `se estimará como incumplimiento grave, facultando al Empleador para poner término al Contrato ` +
    `sin derecho a indemnización, conforme a las normas laborales vigentes.`
  );

  // OCTAVO
  drawClauseTitle(doc, "OCTAVO: Modificaciones.");
  drawBody(doc,
    `Toda modificación acordada deberá constar por escrito en un anexo firmado por ambas Partes. ` +
    `Se entienden incorporadas al presente instrumento las disposiciones legales que se dicten con ` +
    `posterioridad a su suscripción.`
  );

  // NOVENO
  drawClauseTitle(doc, "NOVENO: Comunicaciones Electrónicas.");
  drawBody(doc,
    `De conformidad con el artículo 54 inciso 3º del Código del Trabajo, el Trabajador autoriza ` +
    `al Empleador para remitir liquidaciones de remuneraciones y demás documentos laborales a su ` +
    `correo electrónico personal: ${emailTrab}. ` +
    `Las Partes se autorizan recíprocamente a firmar mediante firma electrónica simple o avanzada ` +
    `todos los documentos de naturaleza laboral, conforme a la Ley 19.799.`
  );

  // DÉCIMO
  drawClauseTitle(doc, "DÉCIMO: Ejemplares.");
  drawBody(doc,
    `El presente Contrato se firma en 2 ejemplares, quedando uno en poder del Empleador y uno en poder del Trabajador.`
  );
}

// ── CLAUSULAS: PROYECTO ───────────────────────────────────────────────────────
function buildClausulasProyecto(doc, data) {
  const emp  = data.empleador  || {};
  const trab = data.trabajador || {};
  const org  = data.organizacion || {};

  const nombreEmp    = org.nombre    || emp.nombre    || "";
  const rutEmp       = org.rut       || emp.rut       || "";
  const repNombre    = emp.representante     || "";
  const repRut       = emp.rut_representante || "";
  const domicilioEmp = org.direccion || emp.domicilio  || "";
  const ciudadEmp    = org.ciudad    || "Santiago";

  const nombreTrab  = trab.nombre        || "";
  const rutTrab     = trab.rut           || "";
  const domTrab     = trab.domicilio     || "";
  const afp         = trab.afp           || "";
  const salud       = trab.sistema_salud || "FONASA";

  const cargo       = data.cargo          || "";
  const proyecto    = data.nombre_proyecto || data.proyecto || "";
  const sueldoBase  = data.sueldo_base    || 0;
  const fechaInicio = fmtDate(data.fecha_inicio);
  const fechaTerm   = fmtDate(data.fecha_termino);
  const lugar       = data.lugar_trabajo  || domicilioEmp;
  const horario     = data.horario        || "";
  const fechaDoc    = fmtDate(data.fecha_documento || new Date().toISOString().slice(0, 10));
  const funciones   = data.funciones      || [];

  drawIntro(doc,
    `En ${ciudadEmp}, a ${fechaDoc}, entre: ${nombreEmp}, RUT ${rutEmp}, ` +
    `representada por ${repNombre}, RUT ${repRut}, domiciliado/a en ${domicilioEmp} ` +
    `(en adelante el "Empleador"); y ${nombreTrab}, RUT ${rutTrab}, ` +
    `domiciliado/a en ${domTrab} (en adelante el "Trabajador"), acuerdan el siguiente contrato:`
  );

  drawClauseTitle(doc, "PRIMERO: Objeto y Cargo.");
  drawBody(doc,
    `El Empleador contrata al Trabajador para desempeñar el cargo de "${cargo}", ` +
    `en el proyecto denominado "${proyecto}", bajo subordinación y dependencia, ` +
    `prestando sus servicios en: ${lugar}.`
  );
  funciones.forEach((fn, i) => drawBullet(doc, `${i + 1}. ${fn}`));

  drawClauseTitle(doc, "SEGUNDO: Jornada de Trabajo.");
  drawBody(doc,
    `La jornada ordinaria diaria no excederá de 10 horas. ` +
    (horario ? `Horario: ${horario}. ` : "") +
    `La jornada se interrumpirá 60 minutos para colación, tiempo no imputable a la jornada. ` +
    `Las horas extraordinarias se pagarán conforme a la ley.`
  );

  drawClauseTitle(doc, "TERCERO: Remuneración.");
  drawBody(doc,
    `El Trabajador recibirá una remuneración de ${fmtClp(sueldoBase)}.- ` +
    `correspondiente al período del proyecto desde el ${fechaInicio} hasta el ${fechaTerm}. ` +
    `El pago se efectuará al término del contrato mediante transferencia electrónica, ` +
    `deduciéndose los descuentos legales y previsionales correspondientes.`
  );

  drawClauseTitle(doc, "CUARTO: Previsión Social.");
  drawBody(doc, `El Trabajador declara estar afiliado a ${salud} y a ${afp}.`);

  drawClauseTitle(doc, "QUINTO: Obligaciones y Confidencialidad.");
  drawBody(doc,
    `El Trabajador se obliga a cumplir sus funciones con eficiencia y confidencialidad respecto del proyecto, ` +
    `absteniéndose de divulgar información del proyecto, del cliente y del Empleador. ` +
    `Tiene expresa prohibición de publicar material relacionado con el proyecto en redes sociales ` +
    `o cualquier medio, hasta que el Empleador lo autorice expresamente.`
  );

  drawClauseTitle(doc, "SEXTO: Vigencia.");
  drawBody(doc,
    `El presente contrato se pacta exclusivamente para el proyecto indicado, ` +
    `iniciando el ${fechaInicio} y concluyendo el ${fechaTerm}. ` +
    `Podrá ponérsele término anticipado cuando concurran causas justificadas conforme a la ley.`
  );

  drawClauseTitle(doc, "SÉPTIMO: Ejemplares.");
  drawBody(doc,
    `El presente contrato se firma en 2 ejemplares, quedando uno en poder de cada Parte.`
  );
}

// ── CLAUSULAS: HONORARIOS ─────────────────────────────────────────────────────
function buildClausulasHonorarios(doc, data) {
  const emp  = data.empleador  || {};
  const trab = data.trabajador || {};
  const org  = data.organizacion || {};

  const nombreEmp    = org.nombre    || emp.nombre    || "";
  const rutEmp       = org.rut       || emp.rut       || "";
  const repNombre    = emp.representante     || "";
  const repRut       = emp.rut_representante || "";
  const domicilioEmp = org.direccion || emp.domicilio  || "";
  const ciudadEmp    = org.ciudad    || "Santiago";

  const nombreTrab  = trab.nombre    || "";
  const rutTrab     = trab.rut       || "";
  const domTrab     = trab.domicilio || "";

  const cargo       = data.cargo            || "";
  const proyecto    = data.nombre_proyecto  || data.proyecto || "";
  const valor       = data.sueldo_base      || data.honorario || 0;
  const fechaInicio = fmtDate(data.fecha_inicio);
  const fechaTerm   = fmtDate(data.fecha_termino);
  const servicios   = data.descripcion_servicios || cargo;
  const fechaDoc    = fmtDate(data.fecha_documento || new Date().toISOString().slice(0, 10));

  drawIntro(doc,
    `En ${ciudadEmp}, a ${fechaDoc}, entre ${nombreEmp}, RUT ${rutEmp}, ` +
    `domiciliada en ${domicilioEmp}, representada por ${repNombre}, RUT ${repRut} ` +
    `(en adelante el "Contratante"), y ${nombreTrab}, RUT ${rutTrab}, ` +
    `domiciliado/a en ${domTrab} (en adelante el "Contratista"), ` +
    `acuerdan celebrar el siguiente Contrato de Prestación de Servicios a Honorarios:`
  );

  drawClauseTitle(doc, "PRIMERA: Objeto.");
  drawBody(doc,
    `El Contratista, en su calidad de trabajador independiente, se obliga a ejecutar los servicios de ` +
    `"${servicios}"${proyecto ? `, para el proyecto ${proyecto}` : ""}, ` +
    `desde el ${fechaInicio} hasta el ${fechaTerm}, sin horario determinado, ni subordinación ni dependencia.`
  );

  drawClauseTitle(doc, "SEGUNDA: Duración.");
  drawBody(doc,
    `El plazo de ejecución comprende desde el ${fechaInicio} hasta el ${fechaTerm}, ` +
    `prorrogable por acuerdo escrito entre las Partes.`
  );

  drawClauseTitle(doc, "TERCERA: Precio y Forma de Pago.");
  drawBody(doc,
    `El valor del contrato es de ${fmtClp(valor)}.-. ` +
    `El pago se efectuará previa emisión de boleta o factura por parte del Contratista, ` +
    `dentro de los 5 días hábiles del mes siguiente. ` +
    `El Contratista deberá retener el porcentaje de impuesto a la renta que corresponda conforme a la ley.`
  );

  drawClauseTitle(doc, "CUARTA: Obligaciones.");
  drawBody(doc,
    `El Contratante facilitará acceso a la información necesaria para la ejecución del contrato. ` +
    `El Contratista deberá cumplir eficientemente los servicios encomendados, guardando confidencialidad ` +
    `respecto de toda información a la que acceda en virtud del presente contrato.`
  );

  drawClauseTitle(doc, "QUINTA: Confidencialidad.");
  drawBody(doc,
    `El Contratista se obliga a guardar estricta reserva sobre los términos del presente contrato ` +
    `y toda información del Contratante a que tenga acceso, tanto durante como después de la vigencia ` +
    `de este instrumento. Queda prohibida la divulgación de información del proyecto en redes sociales ` +
    `u otros medios sin autorización expresa.`
  );

  drawClauseTitle(doc, "SEXTA: Independencia.");
  drawBody(doc,
    `El Contratista actuará con autonomía, sin que exista relación laboral ni subordinación con el Contratante. ` +
    `Sus derechos se limitan a exigir el pago oportuno de la remuneración pactada. ` +
    `El Contratista no podrá ceder el contrato a terceros sin autorización escrita del Contratante.`
  );

  drawClauseTitle(doc, "SÉPTIMA: Terminación.");
  drawBody(doc,
    `El contrato terminará por acuerdo entre las Partes o unilateralmente por incumplimiento grave ` +
    `de las obligaciones derivadas del mismo.`
  );

  drawClauseTitle(doc, "OCTAVA: Domicilio.");
  drawBody(doc,
    `Para todos los efectos legales se fija como domicilio contractual la ciudad de ${ciudadEmp}.`
  );

  drawClauseTitle(doc, "NOVENA: Ejemplares.");
  drawBody(doc,
    `Las Partes suscriben el presente contrato en 2 ejemplares, quedando uno en poder de cada Parte.`
  );
}

// ── CLAUSULAS: SUELDO EMPRESARIAL (Art. 31 N°6 LIR) ──────────────────────────
// Acta de asignación de sueldo empresarial. NO es contrato de trabajo: el
// socio/dueño se asigna remuneración como gasto necesario para producir la
// renta. Documento de respaldo para el SII.
function buildClausulasSueldoEmpresarial(doc, data) {
  const trab = data.trabajador  || {};
  const org  = data.organizacion || {};
  const emp  = data.empleador   || {};

  const nombreEmp    = org.nombre    || emp.nombre || "";
  const rutEmp       = org.rut       || emp.rut    || "";
  const repNombre    = emp.representante     || "";
  const repRut       = emp.rut_representante || "";
  const domicilioEmp = org.direccion || emp.domicilio || "";
  const ciudadEmp    = org.ciudad    || "Santiago";

  const nombreSocio  = trab.nombre || "";
  const rutSocio     = data.rut_socio || trab.rut || "";
  const pctParticip  = Number(data.pct_participacion) || 0;
  const cargo        = data.cargo || "";
  const sueldoMensual = data.sueldo_base || 0;
  const fechaInicio  = fmtDate(data.fecha_inicio);
  const fechaDoc     = fmtDate(data.fecha_documento || new Date().toISOString().slice(0, 10));
  const justificacion = data.justificacion_monto || "";
  const cotAfp       = !!data.cotiza_afp_voluntaria;
  const cotSalud     = !!data.cotiza_salud_voluntaria;

  // Intro
  drawIntro(doc,
    `En ${ciudadEmp}, a ${fechaDoc}, ${nombreEmp}, ` +
    `rol único tributario número ${rutEmp}, representada por don/ña ${repNombre}, ` +
    `cédula de identidad número ${repRut}, ambos domiciliados para estos efectos en ` +
    `${domicilioEmp} (en adelante, la "Sociedad"); y don/ña ${nombreSocio}, ` +
    `cédula de identidad número ${rutSocio}, socio/a de la Sociedad con una participación ` +
    `del ${pctParticip}% del capital social, han acordado formalizar la siguiente ` +
    `Acta de Asignación de Sueldo Empresarial conforme al Art. 31 N°6 de la Ley sobre ` +
    `Impuesto a la Renta:`
  );

  // PRIMERA: Naturaleza
  drawClauseTitle(doc, "PRIMERA: Naturaleza Jurídica del Acuerdo.");
  drawBody(doc,
    `El presente instrumento NO constituye un contrato de trabajo regido por el Código del ` +
    `Trabajo, sino una figura tributaria contemplada en el Art. 31 N°6, inciso tercero, de ` +
    `la Ley sobre Impuesto a la Renta (D.L. 824), conocida como "Sueldo Empresarial". ` +
    `Entre las Partes NO existe relación de subordinación ni dependencia, por lo que no ` +
    `aplican las normas del Código del Trabajo en materia de jornada, gratificación legal, ` +
    `seguro de cesantía, ni indemnizaciones laborales.`
  );

  // SEGUNDA: Trabajo efectivo
  drawClauseTitle(doc, "SEGUNDA: Trabajo Efectivo, Permanente y Personal.");
  drawBody(doc,
    `El/la socio/a declara que desempeña en la Sociedad la función de "${cargo}" de manera ` +
    `efectiva, permanente y personal, dedicando su capacidad de trabajo a la generación de ` +
    `los ingresos del negocio. Este requisito es esencial para que la asignación sea aceptada ` +
    `como gasto necesario por el Servicio de Impuestos Internos.`
  );

  // TERCERA: Monto
  drawClauseTitle(doc, "TERCERA: Monto de la Asignación.");
  drawBody(doc,
    `Uno. La Sociedad asignará al/la socio/a una remuneración mensual de ${fmtClp(sueldoMensual)} ` +
    `(bruto), a partir del ${fechaInicio}. Este monto se pagará en la forma y oportunidad ` +
    `que acuerden las Partes y se contabilizará como gasto del giro de la Sociedad.`
  );
  if (justificacion) {
    drawBody(doc,
      `Dos. Las Partes dejan constancia de la siguiente justificación del monto asignado: ` +
      `${justificacion}`
    );
  }

  // CUARTA: Tributación
  drawClauseTitle(doc, "CUARTA: Tratamiento Tributario.");
  drawBody(doc,
    `Uno. La Sociedad retendrá mensualmente el Impuesto Único de Segunda Categoría que ` +
    `corresponda según la tabla vigente, declarándolo en el Formulario 29.`
  );
  drawBody(doc,
    `Dos. El monto se informará en el Libro de Remuneraciones Electrónico de la Dirección ` +
    `del Trabajo y será incluido en la Declaración Jurada 1887 anual ante el SII.`
  );
  drawBody(doc,
    `Tres. El/la socio/a tributará por estas rentas en su Declaración Anual de Impuesto a ` +
    `la Renta (Formulario 22) como renta del trabajo dependiente.`
  );

  // QUINTA: Cotizaciones
  drawClauseTitle(doc, "QUINTA: Cotizaciones Previsionales y de Salud.");
  drawBody(doc,
    `Las cotizaciones de AFP y de salud son de carácter VOLUNTARIO para el/la socio/a y ` +
    `deberán ser pagadas directamente por éste/a en el portal Previred con su RUT personal, ` +
    `bajo la modalidad de trabajador independiente, sin que la Sociedad efectúe descuento ni ` +
    `entero alguno por tales conceptos.`
  );
  if (cotAfp || cotSalud) {
    const items = [];
    if (cotAfp)   items.push("AFP (10% + comisión)");
    if (cotSalud) items.push("salud (7%)");
    drawBody(doc,
      `Las Partes declaran que el/la socio/a ha manifestado su intención de cotizar ` +
      `voluntariamente en: ${items.join(" y ")}.`
    );
  }

  // SEXTA: Vigencia
  drawClauseTitle(doc, "SEXTA: Vigencia.");
  drawBody(doc,
    `La presente asignación regirá a partir del ${fechaInicio} y se mantendrá vigente ` +
    `mientras subsista la calidad de socio/a y se cumplan los requisitos legales para su ` +
    `procedencia, pudiendo ser modificada o dejada sin efecto por acuerdo de las Partes.`
  );

  // SÉPTIMA: Ejemplares
  drawClauseTitle(doc, "SÉPTIMA: Ejemplares.");
  drawBody(doc,
    `Las Partes suscriben la presente acta en 2 ejemplares, quedando uno en poder de cada ` +
    `Parte para los fines tributarios y societarios correspondientes.`
  );
}

// ── Firmas ────────────────────────────────────────────────────────────────────
function buildSignatures(doc, data) {
  const emp  = data.empleador  || {};
  const trab = data.trabajador || {};
  const org  = data.organizacion || {};
  const tipo = data.tipo_contrato || "indefinido";

  const nombreEmp  = org.nombre    || emp.nombre    || "";
  const rutEmp     = org.rut       || emp.rut       || "";
  const repNombre  = emp.representante || nombreEmp;
  const nombreTrab = trab.nombre   || "";
  const rutTrab    = trab.rut      || "";

  const labelEmp  = tipo === "honorarios" ? "EL CONTRATANTE" : "EMPLEADOR";
  const labelTrab = tipo === "honorarios" ? "EL CONTRATISTA" : "TRABAJADOR";

  const leftMargin  = doc.page.margins.left;
  const rightMargin = doc.page.margins.right;
  const pageWidth   = doc.page.width - leftMargin - rightMargin;

  // Ensure we're not too close to bottom
  ensureSpace(doc, 120);

  doc.moveDown(2);

  // Separator line
  drawHR(doc, doc.y, GRAY_LIGHT, 0.5);
  doc.moveDown(0.5);

  const colW   = pageWidth / 2;
  const col1X  = leftMargin;
  const col2X  = leftMargin + colW;
  const startY = doc.y;

  // Signature lines
  doc.font("Helvetica").fontSize(9).fillColor(GRAY_DARK);
  const sigLine = "_______________________________";
  doc.text(sigLine, col1X, startY, { width: colW, align: "center" });
  doc.text(sigLine, col2X, startY, { width: colW, align: "center" });

  let rowY = startY + doc.currentLineHeight(true) + 6;

  // Names (bold)
  doc.font("Helvetica-Bold").fontSize(9).fillColor(GRAY_DARK);
  doc.text(repNombre, col1X, rowY, { width: colW, align: "center" });
  doc.text(nombreTrab, col2X, rowY, { width: colW, align: "center" });
  rowY += doc.currentLineHeight(true) + 4;

  // Role labels
  doc.font("Helvetica").fontSize(8.5).fillColor(GRAY_MID);
  doc.text(labelEmp, col1X, rowY, { width: colW, align: "center" });
  doc.text(labelTrab, col2X, rowY, { width: colW, align: "center" });
  rowY += doc.currentLineHeight(true) + 4;

  // Org name / worker name line
  doc.font("Helvetica").fontSize(8.5).fillColor(GRAY_MID);
  doc.text(nombreEmp, col1X, rowY, { width: colW, align: "center" });
  doc.text(`RUT: ${rutTrab}`, col2X, rowY, { width: colW, align: "center" });
  rowY += doc.currentLineHeight(true) + 4;

  // RUT line for employer
  doc.text(`RUT: ${rutEmp}`, col1X, rowY, { width: colW, align: "center" });
  rowY += doc.currentLineHeight(true) + 4;

  doc.y = rowY;
}

// ── Footer (page numbers) ─────────────────────────────────────────────────────
function addPageFooters(doc, data) {
  const orgNombre = (data.organizacion || {}).nombre || "";
  let pageCount = 0;

  doc.on("pageAdded", () => {
    pageCount++;
  });

  // We handle footer via the range event after document is ended.
  // PDFKit supports adding footer content on each page via the range event
  // but the easiest approach is to write it during content generation.
  // Instead, we'll use a different approach: we write footers after doc.end()
  // by intercepting the page event.
  return { getPageCount: () => pageCount, orgNombre };
}

// ── PDF generation ────────────────────────────────────────────────────────────
async function generatePDF(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 70, bottom: 70, left: 70, right: 70 },
      bufferPages: true, // enables retroactive footer writing
      autoFirstPage: true,
    });

    const passThrough = new PassThrough();
    const chunks = [];

    passThrough.on("data", (chunk) => chunks.push(chunk));
    passThrough.on("end", () => resolve(Buffer.concat(chunks)));
    passThrough.on("error", reject);

    doc.pipe(passThrough);

    const orgNombre = (data.organizacion || {}).nombre || "";

    try {
      // Build content on page 1 (already added by autoFirstPage)
      buildHeader(doc, data);

      const tipo = data.tipo_contrato || "indefinido";
      if (tipo === "indefinido") {
        buildClausulasIndefinido(doc, data);
      } else if (tipo === "plazo_fijo") {
        buildClausulasIndefinido(doc, data, { plazofijo: true });
      } else if (tipo === "part_time") {
        buildClausulasIndefinido(doc, data, { partTime: true });
      } else if (tipo === "proyecto") {
        buildClausulasProyecto(doc, data);
      } else if (tipo === "honorarios") {
        buildClausulasHonorarios(doc, data);
      } else if (tipo === "sueldo_empresarial") {
        buildClausulasSueldoEmpresarial(doc, data);
      } else {
        buildClausulasIndefinido(doc, data);
      }

      buildSignatures(doc, data);

      // Write footers on all pages using bufferPages
      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        const footerY = doc.page.height - doc.page.margins.bottom + 18;
        doc.font("Helvetica").fontSize(7.5).fillColor(GRAY_MID)
          .text(
            `Página ${i + 1} de ${totalPages} — Contrato de Trabajo — ${orgNombre}`,
            doc.page.margins.left,
            footerY,
            {
              width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
              align: "center",
            }
          );
      }

      // ── Pie "People by unabase" debajo del footer de paginación ─────
      drawPeopleByFooter(doc, { marginBottom: 4 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ── Nuxt 3 / Nitro event handler ──────────────────────────────────────────────
export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  try {
    const buffer = await generatePDF(body);
    const tipo = body.tipo_contrato || "contrato";
    const rut  = (body.trabajador?.rut || "doc").replace(/\./g, "").replace(/-/g, "");

    setResponseHeaders(event, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="contrato-${tipo}-${rut}.pdf"`,
      "Content-Length": buffer.length,
    });

    return buffer;
  } catch (err) {
    console.error("Contrato PDF error:", err);
    throw createError({ statusCode: 500, message: "Error generando contrato PDF: " + err.message });
  }
});
