/**
 * Semilla de indicadores previsionales (server-side, fuente de verdad).
 * La UF/UTM y los topes en pesos los refresca previredSync.js desde
 * mindicador.cl. El resto (comisiones AFP, SMM, tasas, asignación familiar)
 * se actualiza manualmente cuando Previred publica cambios.
 *
 * Mantener en sync conceptual con el fallback offline de stores/indicadores.js.
 */
export const INDICADORES_SEED = {
  periodo:     'Agosto 2026',
  fuente:      'https://www.previred.com/indicadores-previsionales/',
  actualizado: '2026-08-01',

  uf_actual:   40844.79,
  utm:         71649,
  uta:         859788,
  smm:         553553,

  // Bases en UF de los topes → los pesos los deriva el sync con la UF vigente
  tope_afp_uf:      90,
  tope_ips_uf:      60,
  tope_cesantia_uf: 135.2,
  tope_afp:         3676031,
  tope_ips:         2449219,
  tope_cesantia:    5522216,

  renta_min_dependiente: 553553,
  renta_min_menor_65:    412938,
  renta_min_casa_part:   553553,
  renta_min_no_remun:    356815,

  sis_tasa:                0.0162,
  expectativa_vida_tasa:   0.009,
  cap_individual_patronal: 0.001,

  salud_minima: 0.07,
  ccaf_fonasa:  0.028,
  ccaf_ccaf:    0.042,

  afp: [
    { nombre: 'AFP Capital',      key: 'capital',      comision: 0.0144, trabajador_total: 0.1144 },
    { nombre: 'AFP Cuprum',       key: 'cuprum',       comision: 0.0144, trabajador_total: 0.1144 },
    { nombre: 'AFP Habitat',      key: 'habitat',      comision: 0.0127, trabajador_total: 0.1127 },
    { nombre: 'AFP PlanVital',    key: 'planvital',    comision: 0.0116, trabajador_total: 0.1116 },
    { nombre: 'AFP ProVida',      key: 'provida',      comision: 0.0145, trabajador_total: 0.1145 },
    { nombre: 'AFP Modelo',       key: 'modelo',       comision: 0.0058, trabajador_total: 0.1058 },
    { nombre: 'AFP Uno',          key: 'uno',          comision: 0.0046, trabajador_total: 0.1046 },
    { nombre: 'AFP VidaSecurity', key: 'vidasecurity', comision: 0.0145, trabajador_total: 0.1145 },
  ],

  cesantia: {
    indefinido_empleador:   0.024,
    indefinido_trabajador:  0.006,
    plazo_fijo_empleador:   0.030,
    plazo_fijo_trabajador:  0,
    proyecto_empleador:     0.030,
    proyecto_trabajador:    0,
  },

  asignacion_familiar: [
    { tramo: 'A', monto: 22601, renta_max: 649039  },
    { tramo: 'B', monto: 13870, renta_max: 947990  },
    { tramo: 'C', monto:  4382, renta_max: 1478539 },
    { tramo: 'D', monto:     0, renta_max: null     },
  ],

  mutual_base: 0.0093,
}
