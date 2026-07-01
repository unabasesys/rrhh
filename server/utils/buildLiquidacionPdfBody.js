/**
 * Construye el body completo (organizacion + trabajador + liquidacion con
 * haberes/descuentos legales/otros_descuentos) que el endpoint
 * /api/rrhh/liquidacion-pdf espera, partiendo solo del liquidacion_id.
 *
 * Lo usan dos handlers:
 *   - liquidacion-pdf.post.js (cuando body trae solo liquidacion_id)
 *   - liquidacion-email.post.js (que arma el PDF para adjuntarlo)
 *
 * El armado de las filas (haberes, descuentos legales) refleja la lógica
 * histórica de pages/rrhh/liquidaciones — campos pre-calculados que ya
 * vienen en el documento Liquidacion. No re-ejecuta calcularLiquidacion;
 * confía en lo que ya se persistió al generar la liquidación.
 */
import Liquidacion  from '../models/Liquidacion.js'
import Trabajador   from '../models/Trabajador.js'
import Organization from '../models/Organization.js'

const MES_NOMBRE = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function fmtClp(n) { return Number(n || 0) }

export async function buildLiquidacionPdfBody(liquidacionId) {
  const liq  = await Liquidacion.findById(liquidacionId).lean()
  if (!liq) throw new Error('Liquidación no encontrada')
  const trab = await Trabajador.findById(liq.trabajador_id).lean()
  const org  = liq.orgId ? await Organization.findById(liq.orgId).lean() : null

  // ── Haberes ─────────────────────────────────────────────────────────────
  const haberes = []
  const dias = liq.dias_trabajados || 30
  const sueldoBase = Number(liq.sueldo_base || 0)
  const sueldoMostrar = liq.sueldo_proporcional || Math.round((sueldoBase / 30) * dias)

  if (sueldoMostrar) {
    haberes.push({
      nombre: dias === 30 ? 'Sueldo Base' : `Sueldo Base (${dias}/30 días)`,
      monto:  fmtClp(sueldoMostrar),
    })
  }

  // Gratificación: si no vino guardada pero podemos inferirla desde
  // renta_imponible - sueldo - bonosImp, la mostramos. Esto rescata PDFs
  // de liquidaciones antiguas (antes de guardar gratificacion en DB).
  let gratif = Number(liq.gratificacion || 0)
  if (!gratif && liq.renta_imponible && sueldoMostrar) {
    const bonosImp = (liq.bonos || []).filter(b => b.imponible).reduce((s, b) => s + (Number(b.monto) || 0), 0)
    const horasExtra = Number(liq.monto_horas_extra || liq.horas_extra_monto || 0)
    const inferido = liq.renta_imponible - sueldoMostrar - bonosImp - horasExtra
    if (inferido > 0 && inferido < sueldoMostrar) gratif = inferido
  }
  if (gratif > 0) haberes.push({ nombre: 'Gratificación Legal', monto: fmtClp(gratif) })

  if (liq.monto_horas_extra || liq.horas_extra_monto) {
    haberes.push({ nombre: 'Horas Extra', monto: fmtClp(liq.monto_horas_extra || liq.horas_extra_monto) })
  }
  for (const b of (liq.bonos || [])) {
    if (b.monto > 0) haberes.push({ nombre: b.nombre || 'Bono', monto: fmtClp(b.monto) })
  }

  // ── Descuentos legales ──────────────────────────────────────────────────
  const descLegales = []
  if (liq.afp_descuento)        descLegales.push({ nombre: 'AFP',                monto: fmtClp(liq.afp_descuento) })
  if (liq.salud_descuento)      descLegales.push({ nombre: 'Salud',              monto: fmtClp(liq.salud_descuento) })
  if (liq.cesantia_trabajador)  descLegales.push({ nombre: 'Seguro Cesantía',    monto: fmtClp(liq.cesantia_trabajador) })
  if (liq.impuesto)             descLegales.push({ nombre: 'Imp. Único 2ª Cat.', monto: fmtClp(liq.impuesto) })

  // ── Otros descuentos ─────────────────────────────────────────────────────
  const otrosDesc = []
  for (const d of (liq.descuentos || [])) {
    if (d.monto > 0) otrosDesc.push({ nombre: d.nombre || 'Descuento', monto: fmtClp(d.monto) })
  }
  if (liq.anticipo_descontado > 0) {
    otrosDesc.push({ nombre: 'Anticipo', monto: fmtClp(liq.anticipo_descontado) })
  }

  // ── Periodo ──────────────────────────────────────────────────────────────
  const periodo = `${MES_NOMBRE[liq.mes] || ''} de ${liq.anio}`

  // ── Nombre del trabajador completo ───────────────────────────────────────
  const nombreCompleto = trab
    ? [trab.nombre, trab.apellido, trab.apellido_paterno, trab.apellido_materno]
        .filter(Boolean).join(' ').toUpperCase()
    : (liq.trabajador_nombre || 'TRABAJADOR').toUpperCase()

  return {
    logo_base64: org?.logo_base64 || org?.logo || null,
    organizacion: {
      nombre:      org?.nombre    || 'Mi Empresa',
      rut:         org?.rut       || '',
      direccion:   org?.direccion || '',
      logo_base64: org?.logo_base64 || org?.logo || null,
    },
    trabajador: {
      nombre:          nombreCompleto,
      rut:             trab?.rut    || '',
      cargo:           trab?.cargo  || '',
      fecha_ingreso:   trab?.fecha_ingreso
        ? new Date(trab.fecha_ingreso).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
        : '',
      lugar_trabajo:   org?.nombre || '',
      centro_costo:    trab?.centro_costo || '',
      dias_trabajados: liq.dias_trabajados || 30,
    },
    liquidacion: {
      periodo,
      mes:  liq.mes,
      anio: liq.anio,
      haberes,
      descuentos_legales: descLegales,
      otros_descuentos:   otrosDesc,
      aportes: [],
      totales: {
        haberes:    haberes.reduce((s, h) => s + h.monto, 0),
        descuentos: descLegales.reduce((s, d) => s + d.monto, 0) + otrosDesc.reduce((s, d) => s + d.monto, 0),
      },
      liquido_a_pagar: liq.liquido_a_pagar,
      renta_imponible: liq.renta_imponible,
      pago: {
        banco:         trab?.banco         || '',
        tipo_cuenta:   trab?.tipo_cuenta   || '',
        numero_cuenta: trab?.numero_cuenta || '',
      },
    },
    firma: liq.firma_data
      ? { data: liq.firma_data, tipo: liq.firma_tipo || 'digital', fecha: liq.firma_fecha, estado: 'firmada' }
      : { estado: 'pendiente' },
    _liquidacionDoc: liq,
    _trabajadorDoc:  trab,
    _orgDoc:         org,
  }
}
