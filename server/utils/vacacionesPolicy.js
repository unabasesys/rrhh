/**
 * Cálculo de saldo y derecho a vacaciones — diseñado para soportar varios
 * países a futuro. Cada policy expone:
 *
 *   - codigo          : id estable ('CL', 'AR', 'PE', ...)
 *   - diasPorAnio     : días base por año completo de servicio
 *   - calcularAcumulado(antiguedadMeses) → días devengados a la fecha
 *   - diasHabiles(fechaInicio, fechaFin) → días hábiles del rango (excl. fin de semana)
 *
 * Cómo extender: agregar otra constante POLICY_XX y exportar en POLICIES.
 * Llamar getPolicy(codigo) o getPolicyForOrg(orgDoc) en el resto del código.
 */

// ── Chile (default actual) ──────────────────────────────────────────────
// Código del Trabajo Art. 67: 15 días hábiles por cada año de servicio.
// Se devengan 15/12 = 1.25 días/mes y se "ganan" a partir del mes 1.
export const POLICY_CL = {
  codigo:        'CL',
  nombre:        'Chile · 15 días hábiles / año',
  diasPorAnio:   15,
  // Acumulado lineal mes a mes (proporcional). Para "después de 10 años, 1 día
  // extra cada 3 nuevos" — pendiente; lo agregamos cuando un cliente lo pida.
  calcularAcumulado(antiguedadMeses) {
    const ant = Math.max(0, Number(antiguedadMeses) || 0)
    return +(ant * (15 / 12)).toFixed(2)
  },
  diasHabiles(fechaInicio, fechaFin) {
    return contarHabilesExcluyendoFinDeSemana(fechaInicio, fechaFin)
  },
}

// Helper compartido — días lun a vie en el rango [inicio, fin] inclusive
function contarHabilesExcluyendoFinDeSemana(fechaInicio, fechaFin) {
  if (!fechaInicio || !fechaFin) return 0
  const ini = new Date(fechaInicio + 'T00:00:00')
  const fin = new Date(fechaFin   + 'T00:00:00')
  if (isNaN(ini) || isNaN(fin) || fin < ini) return 0
  let dias = 0
  const cursor = new Date(ini)
  while (cursor <= fin) {
    const dow = cursor.getDay() // 0=dom, 6=sab
    if (dow !== 0 && dow !== 6) dias++
    cursor.setDate(cursor.getDate() + 1)
  }
  return dias
}

export const POLICIES = {
  CL: POLICY_CL,
}

export function getPolicy(codigo = 'CL') {
  return POLICIES[codigo] || POLICY_CL
}

export function getPolicyForOrg(org) {
  // Si la org tiene un código de país configurado, usarlo; si no, default.
  return getPolicy(org?.paisCodigo || org?.policyVacaciones || 'CL')
}

/**
 * Calcula el balance completo de un trabajador a la fecha de hoy:
 *   acumulado / aprobadas / pendientes / disponible
 *
 * @param {Object} args
 * @param {string} args.fechaIngreso   ISO 'YYYY-MM-DD' del contrato
 * @param {Array}  args.vacaciones     lista de Vacacion del trabajador
 * @param {Object} args.policy         policy del país (default CL)
 * @param {Date}   [args.hoy]          fecha de referencia (default ahora)
 */
export function calcularBalance({ fechaIngreso, vacaciones = [], policy = POLICY_CL, hoy = new Date() }) {
  const antiguedadMeses = mesesEntre(fechaIngreso, hoy)
  const acumulado = policy.calcularAcumulado(antiguedadMeses)

  let tomadas    = 0   // aprobadas con fecha_fin <= hoy
  let aprobadas  = 0   // aprobadas con fecha_fin > hoy (todavía no realizadas)
  let pendientes = 0
  for (const v of vacaciones) {
    const dias = Number(v.dias_habiles) || 0
    if (v.estado === 'aprobada') {
      const fin = new Date(v.fecha_fin + 'T00:00:00')
      if (!isNaN(fin) && fin <= hoy) tomadas    += dias
      else                            aprobadas  += dias
    } else if (v.estado === 'pendiente') {
      pendientes += dias
    }
  }

  // Disponible = acumulado − ya tomadas − ya aprobadas a futuro − pendientes
  // (Las pendientes se descuentan provisoriamente para evitar over-booking
  //  mientras el manager decide.)
  const disponible = Math.max(0, +(acumulado - tomadas - aprobadas - pendientes).toFixed(2))

  return {
    antiguedadMeses,
    diasPorAnio: policy.diasPorAnio,
    acumulado,
    tomadas,
    aprobadas,
    pendientes,
    disponible,
    policyCodigo: policy.codigo,
  }
}

function mesesEntre(fechaDesdeIso, hasta) {
  if (!fechaDesdeIso) return 0
  const desde = new Date(fechaDesdeIso + (fechaDesdeIso.length === 10 ? 'T00:00:00' : ''))
  if (isNaN(desde)) return 0
  const a = desde.getFullYear() * 12 + desde.getMonth()
  const b = hasta.getFullYear() * 12 + hasta.getMonth()
  let meses = b - a
  // Ajuste por el día del mes (si todavía no se cumplió el "mes" actual)
  if (hasta.getDate() < desde.getDate()) meses -= 1
  return Math.max(0, meses)
}
