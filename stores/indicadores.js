/**
 * stores/indicadores.js
 * Indicadores previsionales Chile — persisten en localStorage.
 * Fuente: previred.com/indicadores-previsionales/
 * Actualizar mensualmente (o cuando PREVIRED publique cambios).
 */
import { defineStore } from 'pinia'

// ── Indicadores por defecto: Remuneraciones Abril 2026 ────────────────────────
// Fuente: https://www.previred.com/indicadores-previsionales/
// Vigencia: cotizaciones a pagar en Mayo 2026
// NOTA: Verificado el 2026-05-01. Al ejecutarse el script, Previred aún no
// publicaba los indicadores de Mayo 2026 (típicamente disponibles a mediados
// de mes). Los valores corresponden al último período publicado (Abril 2026)
// y coinciden 1:1 con el PDF oficial de Previred del 14-04-2026.
const DEFAULTS = {
  periodo:        'Abril 2026',
  pago:           'Mayo 2026',
  fuente:         'https://www.previred.com/indicadores-previsionales/',
  actualizado:    '2026-05-01',

  // ── Unidades de valor ──────────────────────────────────────────────────────
  uf_actual:      40120.20,    // UF al 30 de Abril 2026
  uf_fecha:       '30 de Abril 2026',
  uf_anterior:    39841.72,    // UF al 31 de Marzo 2026
  uf_fecha_ant:   '31 de Marzo 2026',
  utm:            69889,       // UTM Abril 2026
  uta:            838668,      // UTA Abril 2026
  smm:            500000,      // Sueldo Mínimo Mensual (a confirmar con decreto)

  // ── Rentas topes imponibles ────────────────────────────────────────────────
  tope_afp:       3610818,     // 90 UF
  tope_ips:       2390503,     // 60 UF (ex INP)
  tope_cesantia:  5424251,     // 135,2 UF

  // ── Rentas mínimas imponibles ──────────────────────────────────────────────
  renta_min_dependiente: 539000,
  renta_min_menor_65:    402082,
  renta_min_casa_part:   539000,
  renta_min_no_remun:    347434,

  // ── SIS (Seguro de Invalidez y Sobrevivencia) ──────────────────────────────
  // Oficio Ordinario N° 7429, publicado 14-04-2026
  sis_tasa:       0.0162,      // 1,62% cargo empleador

  // ── Salud ──────────────────────────────────────────────────────────────────
  salud_minima:   0.07,        // 7% legal mínimo
  ccaf_fonasa:    0.028,       // 2,8% → FONASA (empleadores con CCAF)
  ccaf_ccaf:      0.042,       // 4,2% → CCAF  (empleadores con CCAF)

  // ── AFP: tasas de comisión ─────────────────────────────────────────────────
  // Tasa total dependiente = 10% (jubilación) + comisión AFP
  // SIS (1,62%) es cargo del empleador, NO va en el descuento al trabajador
  afp: [
    { nombre: 'AFP Capital',    key: 'capital',   comision: 0.0144, trabajador_total: 0.1144, empleador_sis: 0.001 },
    { nombre: 'AFP Cuprum',     key: 'cuprum',    comision: 0.0144, trabajador_total: 0.1144, empleador_sis: 0.001 },
    { nombre: 'AFP Habitat',    key: 'habitat',   comision: 0.0127, trabajador_total: 0.1127, empleador_sis: 0.001 },
    { nombre: 'AFP PlanVital',  key: 'planvital', comision: 0.0116, trabajador_total: 0.1116, empleador_sis: 0.001 },
    { nombre: 'AFP ProVida',    key: 'provida',   comision: 0.0145, trabajador_total: 0.1145, empleador_sis: 0.001 },
    { nombre: 'AFP Modelo',     key: 'modelo',    comision: 0.0058, trabajador_total: 0.1058, empleador_sis: 0.001 },
    { nombre: 'AFP Uno',        key: 'uno',       comision: 0.0046, trabajador_total: 0.1046, empleador_sis: 0.001 },
    { nombre: 'AFP VidaSecurity', key: 'vidasecurity', comision: 0.0145, trabajador_total: 0.1145, empleador_sis: 0.001 },
  ],

  // ── Cesantía AFC ───────────────────────────────────────────────────────────
  cesantia: {
    indefinido_empleador:   0.024,
    indefinido_trabajador:  0.006,
    plazo_fijo_empleador:   0.030,
    plazo_fijo_trabajador:  0,
    proyecto_empleador:     0.030,
    proyecto_trabajador:    0,
    indefinido_11_empleador: 0.008,
    indefinido_11_trabajador: 0,
    casa_part_empleador:    0.030,
    casa_part_trabajador:   0,
  },

  // ── APV ───────────────────────────────────────────────────────────────────
  apv_tope_mensual:      2006010,  // 50 UF
  apv_tope_anual:       24072120,  // 600 UF
  deposito_convenido:   36108180,  // 900 UF

  // ── Asignación familiar ────────────────────────────────────────────────────
  asignacion_familiar: [
    { tramo: 'A', monto: 22007, renta_max: 631976  },
    { tramo: 'B', monto: 13505, renta_max: 923067  },
    { tramo: 'C', monto:  4267, renta_max: 1439668 },
    { tramo: 'D', monto:     0, renta_max: null     },
  ],

  // ── Trabajos pesados ───────────────────────────────────────────────────────
  trabajos_pesados: {
    pesado_empleador:       0.02,
    pesado_trabajador:      0.02,
    menos_pesado_empleador: 0.01,
    menos_pesado_trabajador:0.01,
  },

  // ── Mutual de Seguridad (base mínima — varía por actividad) ───────────────
  mutual_base: 0.0093,   // 0,93% base (puede llegar a 3,4% según riesgo)
}

const LS_KEY = 'unabase_indicadores_previsionales'

export const useIndicadoresStore = defineStore('indicadores', {
  state: () => {
    // Intentar cargar desde localStorage
    try {
      const saved = localStorage.getItem(LS_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        // Merge con defaults para garantizar que campos nuevos existan
        return { ...DEFAULTS, ...parsed }
      }
    } catch (_) {}
    return { ...DEFAULTS }
  },

  getters: {
    // Comisión AFP por nombre (busca en el array)
    getAfpComision: (state) => (nombre) => {
      if (!nombre) return state.afp.find(a => a.key === 'capital')?.comision ?? 0.0144
      const norm = nombre.toLowerCase().replace('afp ', '').trim()
      const found = state.afp.find(a =>
        a.key === norm ||
        a.nombre.toLowerCase().replace('afp ', '').trim() === norm ||
        a.nombre.toLowerCase() === nombre.toLowerCase()
      )
      return found?.comision ?? 0.0144
    },

    // Tasa total AFP trabajador (10% + comisión)
    getAfpTasaTotal: (state) => (nombre) => {
      if (!nombre) return 0.1144
      const norm = nombre.toLowerCase().replace('afp ', '').trim()
      const found = state.afp.find(a =>
        a.key === norm ||
        a.nombre.toLowerCase().replace('afp ', '').trim() === norm ||
        a.nombre.toLowerCase() === nombre.toLowerCase()
      )
      return found?.trabajador_total ?? 0.1144
    },

    // Tasas de cesantía por tipo de contrato
    getCesantia: (state) => (tipo_contrato) => {
      const c = state.cesantia
      switch (tipo_contrato) {
        case 'plazo_fijo':
          return { trabajador: 0, empleador: c.plazo_fijo_empleador }
        case 'proyecto':
          return { trabajador: 0, empleador: c.proyecto_empleador }
        case 'honorarios':
          return { trabajador: 0, empleador: 0 }
        default: // indefinido, part_time
          return { trabajador: c.indefinido_trabajador, empleador: c.indefinido_empleador }
      }
    },
  },

  actions: {
    // Guarda todo el estado actual en localStorage
    _persist() {
      try { localStorage.setItem(LS_KEY, JSON.stringify(this.$state)) } catch (_) {}
    },

    // Actualizar todo el período de una vez (desde la página de indicadores)
    actualizarIndicadores(datos) {
      Object.assign(this.$state, datos, { actualizado: new Date().toISOString().slice(0, 10) })
      this._persist()
    },

    // Actualizar un campo individual
    set(campo, valor) {
      this.$state[campo] = valor
      this._persist()
    },

    // Guardar datos iniciales si no hay nada en localStorage
    initIfEmpty() {
      try {
        const saved = localStorage.getItem(LS_KEY)
        if (!saved) {
          this._persist()
        }
      } catch (_) {}
    },
  },
})

// ── Exportar DEFAULTS para uso externo (ej. en rrhh.js) ──────────────────────
export { DEFAULTS as INDICADORES_DEFAULTS }
