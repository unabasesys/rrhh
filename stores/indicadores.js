/**
 * stores/indicadores.js
 * Indicadores previsionales Chile — persisten en localStorage.
 * Fuente: previred.com/indicadores-previsionales/
 * Actualizar mensualmente (o cuando PREVIRED publique cambios).
 */
import { defineStore } from 'pinia'

// ── Indicadores por defecto: Remuneraciones Julio 2026 ────────────────────────
// Fuente: https://www.previred.com/indicadores-previsionales/
// Vigencia: cotizaciones a pagar en Agosto 2026
// Verificado el 2026-07-25 con Previred Julio 2026.
const DEFAULTS = {
  periodo:        'Julio 2026',
  pago:           'Agosto 2026',
  fuente:         'https://www.previred.com/indicadores-previsionales/',
  actualizado:    '2026-07-25',

  // ── Metadatos de la sincronización automática (los llena el servidor) ──────
  // Deben existir aquí aunque vengan vacíos: Pinia solo expone en el store las
  // claves declaradas en el state inicial, y sin ellas la página no vería la
  // fecha del último sync.
  sync_fecha:     null,        // ISO del último sync server-side
  sync_fuente:    null,        // 'mindicador.cl'
  utm_fecha:      '',          // fecha legible de la UTM vigente

  // ── Unidades de valor ──────────────────────────────────────────────────────
  uf_actual:      40844.79,    // UF al 31 de Julio 2026
  uf_fecha:       '31 de Julio 2026',
  uf_anterior:    40820.31,    // UF al 30 de Junio 2026
  uf_fecha_ant:   '30 de Junio 2026',
  utm:            71649,       // UTM Julio 2026
  uta:            859788,      // UTA Julio 2026
  smm:            553553,      // Sueldo Mínimo Mensual (renta mínima imponible)

  // ── Rentas topes imponibles ────────────────────────────────────────────────
  // Los valores en pesos se derivan de la base en UF × UF vigente (auto-sync).
  tope_afp_uf:      90,        // tope AFP/salud en UF
  tope_ips_uf:      60,        // tope IPS (ex INP) en UF
  tope_cesantia_uf: 135.2,     // tope seguro de cesantía en UF
  tope_afp:       3676031,     // 90 UF (recalculado con la UF vigente)
  tope_ips:       2449219,     // 60 UF
  tope_cesantia:  5522216,     // 135,2 UF

  // ── Rentas mínimas imponibles ──────────────────────────────────────────────
  renta_min_dependiente: 553553,
  renta_min_menor_65:    412938,
  renta_min_casa_part:   553553,
  renta_min_no_remun:    356815,

  // ── SIS (Seguro de Invalidez y Sobrevivencia) ──────────────────────────────
  // Oficio Ordinario N° 7429, publicado 14-04-2026
  sis_tasa:       0.0162,      // 1,62% cargo empleador (Superintendencia de Pensiones)

  // ── Otros cargos patronales (cuenta del empleador) ─────────────────────────
  // Aplican normalmente como costo del empleador. En el régimen Sueldo
  // Empresarial los paga el propio socio (asume rol patronal).
  // Fuentes: Previred / IPS / ChileAtiende
  expectativa_vida_tasa:   0.009,   // 0,9% — Seguro Social / Expectativa de Vida
  cap_individual_patronal: 0.001,   // 0,1% — Capitalización Individual Patronal

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
  apv_tope_mensual:      2042240,  // 50 UF
  apv_tope_anual:       24506874,  // 600 UF
  deposito_convenido:   36760311,  // 900 UF

  // ── Asignación familiar ────────────────────────────────────────────────────
  asignacion_familiar: [
    { tramo: 'A', monto: 22601, renta_max: 649039  },
    { tramo: 'B', monto: 13870, renta_max: 947990  },
    { tramo: 'C', monto:  4382, renta_max: 1478539 },
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
        // Si los DEFAULTS son más recientes que el cache (publicación
        // nueva de Previred), descartamos el cache. Si no, hacemos merge
        // (preserva ediciones manuales del usuario).
        const newer = !parsed?.actualizado || (parsed.actualizado < DEFAULTS.actualizado)
        if (newer) {
          try { localStorage.setItem(LS_KEY, JSON.stringify(DEFAULTS)) } catch (_) {}
          return { ...DEFAULTS }
        }
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
      // Refrescar desde el servidor (UF/UTM/topes auto-sincronizados)
      this.syncFromServer()
    },

    // Trae los indicadores vigentes del servidor (fuente de verdad, con UF/UTM
    // auto-actualizadas). Cae en silencio a los valores locales si falla.
    async syncFromServer() {
      if (!import.meta.client) return
      try {
        let headers = {}
        try {
          const s = JSON.parse(localStorage.getItem('rrhh_session') || '{}')
          if (s?.token) headers = { Authorization: `Bearer ${s.token}` }
        } catch (_) {}
        const data = await $fetch('/api/rrhh/indicadores', { headers })
        if (data && data.uf_actual) {
          Object.assign(this.$state, data)
          this._persist()
        }
      } catch (_) { /* offline / sin sesión: seguimos con lo local */ }
    },

    // Fuerza la sincronización en el servidor (UF/UTM desde mindicador.cl y
    // topes imponibles recalculados sobre su base en UF) y deja el resultado
    // en el store. Requiere rol manager/admin: si falla, propaga el error para
    // que la página pueda mostrarlo.
    async actualizarDesdePrevired() {
      let headers = {}
      try {
        const s = JSON.parse(localStorage.getItem('rrhh_session') || '{}')
        if (s?.token) headers = { Authorization: `Bearer ${s.token}` }
      } catch (_) {}
      const r = await $fetch('/api/rrhh/indicadores/sync', { method: 'POST', headers })
      if (r?.indicadores) {
        Object.assign(this.$state, r.indicadores)
        this._persist()
      }
      return r
    },
  },
})

// ── Exportar DEFAULTS para uso externo (ej. en rrhh.js) ──────────────────────
export { DEFAULTS as INDICADORES_DEFAULTS }
