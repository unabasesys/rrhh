import { defineStore } from "pinia";
import api from "@/composables/api";

// ─── Constantes previsionales Chile ───────────────────────────────────────────
// Tasas vigentes 2026 (fuente: Previred / SII)
// Actualizar 2x/mes con tarea programada

export const INDICADORES_PREVISIONALES = {
  utm: 68306,           // UTM Abril 2026
  uf: 38567,            // UF Abril 2026 (valor referencial)
  smm: 500000,          // Sueldo Mínimo Mensual 2026
  actualizado: "2026-04-01",
};

export const AFP_CHILE = [
  { nombre: "AFP Capital",    comision: 0.0144 },
  { nombre: "AFP Cuprum",     comision: 0.0148 },
  { nombre: "AFP Habitat",    comision: 0.0127 },
  { nombre: "AFP Modelo",     comision: 0.0077 },
  { nombre: "AFP PlanVital",  comision: 0.0116 },
  { nombre: "AFP ProVida",    comision: 0.0145 },
  { nombre: "AFP Uno",        comision: 0.0049 },
  { nombre: "AFP VidaSecurity", comision: 0.0145 },
];

export const SISTEMAS_SALUD = [
  { nombre: "FONASA", porcentaje: 0.07 },
  { nombre: "ISAPRE", porcentaje: 0.07 }, // mínimo legal, puede ser mayor
];

export const TIPOS_CONTRATO = [
  { value: "indefinido",  label: "Contrato Indefinido" },
  { value: "proyecto",    label: "Contrato por Proyecto (Ley 19.981)" },
  { value: "plazo_fijo",  label: "Contrato a Plazo Fijo" },
  { value: "honorarios",  label: "Honorarios" },
  { value: "part_time",   label: "Part Time" },
];

// Tipos de bonos predefinidos
export const TIPOS_BONOS = [
  { tipo: "comision_venta",      nombre: "Comisión Venta",         imponible: true  },
  { tipo: "semana_corrida",      nombre: "Semana Corrida",         imponible: true, autoCalc: true },
  { tipo: "aguinaldo_navidad",   nombre: "Aguinaldo Navidad",      imponible: false },
  { tipo: "aguinaldo_fiestas",   nombre: "Aguinaldo Fiestas Patrias", imponible: false },
  { tipo: "bono_desempeno",      nombre: "Bono Desempeño Anual",   imponible: true  },
  { tipo: "bono_productividad",  nombre: "Bono Productividad",     imponible: true  },
  { tipo: "bono_asistencia",     nombre: "Bono Asistencia",        imponible: true  },
  { tipo: "bono_responsabilidad",nombre: "Bono Responsabilidad",   imponible: true  },
  { tipo: "bono_zona",           nombre: "Bono de Zona",           imponible: false },
  { tipo: "horas_extra",         nombre: "Horas Extra",            imponible: true  },
  { tipo: "colacion",            nombre: "Asig. Colación",         imponible: false },
  { tipo: "movilizacion",        nombre: "Asig. Movilización",     imponible: false },
  { tipo: "viatico",             nombre: "Viático",                imponible: false },
  { tipo: "otro_bono",           nombre: "Otro Bono",              imponible: true  },
];

/**
 * Semana Corrida (Art. 45 Código del Trabajo)
 * Se paga a trabajadores que reciben remuneraciones variables (comisiones).
 * Fórmula: Total Comisiones / Días Hábiles × Días de Descanso del Mes
 *
 * @param {number} totalComisiones - Suma de todas las comisiones/variables del mes
 * @param {number} diasHabiles     - Días efectivamente trabajados en el mes (default 22)
 * @param {number} diasDescanso    - Domingos + festivos del mes (default 5 para mes de 30 días)
 */
export const calcularSemanaCorrida = (totalComisiones, diasHabiles = 22, diasDescanso = 5) => {
  if (!totalComisiones || totalComisiones <= 0 || diasHabiles <= 0) return 0;
  return Math.round((totalComisiones / diasHabiles) * diasDescanso);
};

// Tipos de descuentos adicionales predefinidos
export const TIPOS_DESCUENTOS = [
  { tipo: "anticipo",           nombre: "Anticipo Manual"          },
  { tipo: "prestamo_empresa",   nombre: "Préstamo Empresa"         },
  { tipo: "credito_ccaf",       nombre: "Crédito CCAF"             },
  { tipo: "caja_compensacion",  nombre: "Caja de Compensación"     },
  { tipo: "cuota_sindical",     nombre: "Cuota Sindical"           },
  { tipo: "descuento_celular",  nombre: "Descuento Celular"        },
  { tipo: "seguro_colectivo",   nombre: "Seguro Colectivo"         },
  { tipo: "uniforme",           nombre: "Descuento Uniforme"       },
  { tipo: "otro_descuento",     nombre: "Otro Descuento"           },
];

// ─── Funciones de cálculo ─────────────────────────────────────────────────────

export const getAfpComision = (nombreAfp) => {
  const afp = AFP_CHILE.find(a => a.nombre.toLowerCase() === (nombreAfp || "").toLowerCase());
  return afp ? afp.comision : 0.0144;
};

export const calcularAFP = (imponible, comision = 0.0144) =>
  Math.round(imponible * (0.10 + comision));

export const calcularSalud = (imponible, porcentaje = 0.07) =>
  Math.round(imponible * porcentaje);

export const calcularCesantia = (imponible, tipo_contrato = "indefinido") => {
  // Plazo fijo: solo empleador paga (3%), trabajador NO descuenta
  if (tipo_contrato === "plazo_fijo") {
    return { trabajador: 0, empleador: Math.round(imponible * 0.03) };
  }
  // Honorarios: no aplica
  if (tipo_contrato === "honorarios") {
    return { trabajador: 0, empleador: 0 };
  }
  // Indefinido, proyecto, part_time: trabajador 0.6%, empleador 2.4%
  return {
    trabajador: Math.round(imponible * 0.006),
    empleador:  Math.round(imponible * 0.024),
  };
};

export const calcularImpuesto = (rentaTributable) => {
  const UTM = INDICADORES_PREVISIONALES.utm;
  // Tabla Impuesto Único 2ª Categoría vigente 2026 (en UTM)
  const tramos = [
    { desde: 0,    hasta: 13.5,     tasa: 0,      rebaja: 0      },
    { desde: 13.5, hasta: 30,       tasa: 0.04,   rebaja: 0.54   },
    { desde: 30,   hasta: 50,       tasa: 0.08,   rebaja: 1.74   },
    { desde: 50,   hasta: 70,       tasa: 0.135,  rebaja: 4.49   },
    { desde: 70,   hasta: 90,       tasa: 0.23,   rebaja: 11.14  },
    { desde: 90,   hasta: 120,      tasa: 0.304,  rebaja: 17.80  },
    { desde: 120,  hasta: 150,      tasa: 0.355,  rebaja: 23.92  },
    { desde: 150,  hasta: Infinity, tasa: 0.40,   rebaja: 30.67  },
  ];
  const utms = rentaTributable / UTM;
  const tramo = tramos.find((t) => utms > t.desde && utms <= t.hasta) || tramos[0];
  const imp = rentaTributable * tramo.tasa - tramo.rebaja * UTM;
  return Math.max(0, Math.round(imp));
};

export const calcularLiquidacion = (datos) => {
  const {
    // acepta snake_case (desde el form del frontend)
    sueldo_base = 0,
    afp,
    sistema_salud,
    tipo_contrato = "indefinido",
    gratificacion: tipoGratificacion = "mensual",
    dias_trabajados = 30,
    horas_extra = 0,
    // bonos: [{ nombre, monto, imponible }]
    bonos = [],
    // descuentos: [{ nombre, monto }]
    descuentos = [],
  } = datos;

  const SMM = INDICADORES_PREVISIONALES.smm;

  // Proporcional si no trabajó mes completo
  const sueldoProporcional = Math.round((sueldo_base / 30) * dias_trabajados);

  // Horas extra = sueldo / 30 / 8 × 1.5
  const valorHoraExtra = Math.round(sueldo_base / 30 / 8 * 1.5);
  const montoHorasExtra = valorHoraExtra * horas_extra;

  // Gratificación legal mensual: 25% sueldo, tope 4.75 SMM / 12 ≈ $197.917
  const topeGratificacion = Math.round((SMM * 4.75) / 12);
  const gratificacion = tipoGratificacion === "mensual"
    ? Math.min(Math.round(sueldoProporcional * 0.25), topeGratificacion)
    : 0;

  // Separar bonos imponibles y no imponibles
  const bonosImponibles    = bonos.filter(b => b.imponible).reduce((s, b) => s + (b.monto || 0), 0);
  const bonosNoImponibles  = bonos.filter(b => !b.imponible).reduce((s, b) => s + (b.monto || 0), 0);

  // Renta imponible = base de cálculo AFP/Salud/Cesantía
  const rentaImponible = sueldoProporcional + montoHorasExtra + gratificacion + bonosImponibles;

  // Total haberes = todo lo que recibe
  const totalHaberes = rentaImponible + bonosNoImponibles;

  // Descuentos legales
  const afpComision = getAfpComision(afp);
  const saludPct    = sistema_salud === "ISAPRE" ? 0.07 : 0.07; // mínimo legal
  const afpDesc     = calcularAFP(rentaImponible, afpComision);
  const saludDesc   = calcularSalud(rentaImponible, saludPct);
  const ces         = calcularCesantia(rentaImponible, tipo_contrato);

  // Renta tributable = base para impuesto segunda categoría
  const rentaTributable = Math.max(0, rentaImponible - afpDesc - saludDesc - ces.trabajador);
  const impuesto        = calcularImpuesto(rentaTributable);

  // Otros descuentos (anticipo, créditos, etc.)
  const totalOtrosDesc = descuentos.reduce((s, d) => s + (d.monto || 0), 0);

  const totalDescuentos = afpDesc + saludDesc + ces.trabajador + impuesto + totalOtrosDesc;
  const liquidoAPagar   = Math.max(0, totalHaberes - totalDescuentos);

  // Costo empresa = totalHaberes + aportes patronales
  const mutual = Math.round(rentaImponible * 0.0093); // Mutual de Seguridad ~0.93%
  const costoEmpresa = totalHaberes + ces.empleador + mutual;

  return {
    sueldoProporcional,
    montoHorasExtra,
    valorHoraExtra,
    gratificacion,
    rentaImponible,
    bonosImponibles,
    bonosNoImponibles,
    totalHaberes,
    afp_descuento:        afpDesc,
    salud_descuento:      saludDesc,
    cesantia_trabajador:  ces.trabajador,
    cesantia_empleador:   ces.empleador,
    rentaTributable,
    impuesto,
    totalOtrosDesc,
    totalDescuentos,
    liquidoAPagar,
    costoEmpresa,
    mutual,
    // para compatibilidad PDF
    totalImponible: rentaImponible,
  };
};

// ─── Motivos de término de contrato ─────────────────────────────────────────

export const MOTIVOS_TERMINO = [
  {
    value: "mutuo_acuerdo",
    label: "Mutuo Acuerdo de las Partes",
    articulo: "Art. 159 N°1 CT",
    aplica_mes_aviso: false,
    aplica_indemnizacion: false,
  },
  {
    value: "renuncia_voluntaria",
    label: "Renuncia Voluntaria del Trabajador",
    articulo: "Art. 159 N°2 CT",
    aplica_mes_aviso: false,
    aplica_indemnizacion: false,
  },
  {
    value: "vencimiento_plazo",
    label: "Vencimiento del Plazo Convenido",
    articulo: "Art. 159 N°4 CT",
    aplica_mes_aviso: false,
    aplica_indemnizacion: false,
  },
  {
    value: "conclusion_trabajo",
    label: "Conclusión del Trabajo o Servicio",
    articulo: "Art. 159 N°5 CT",
    aplica_mes_aviso: false,
    aplica_indemnizacion: false,
  },
  {
    value: "muerte_trabajador",
    label: "Muerte del Trabajador",
    articulo: "Art. 159 N°3 CT",
    aplica_mes_aviso: false,
    aplica_indemnizacion: false,
  },
  {
    value: "caso_fortuito",
    label: "Caso Fortuito o Fuerza Mayor",
    articulo: "Art. 159 N°6 CT",
    aplica_mes_aviso: false,
    aplica_indemnizacion: false,
  },
  {
    value: "despido_disciplinario",
    label: "Despido Disciplinario (Justa Causa)",
    articulo: "Art. 160 CT",
    aplica_mes_aviso: false,
    aplica_indemnizacion: false,
  },
  {
    value: "necesidades_empresa",
    label: "Necesidades de la Empresa",
    articulo: "Art. 161 CT",
    aplica_mes_aviso: true,
    aplica_indemnizacion: true,
  },
];

/**
 * Calcula los montos del finiquito según el motivo de término.
 *
 * @param {object} datos
 *   - sueldo_base          {number}  Último sueldo base mensual
 *   - fecha_ingreso        {string}  "YYYY-MM-DD"
 *   - fecha_termino        {string}  "YYYY-MM-DD"
 *   - motivo_termino       {string}  valor de MOTIVOS_TERMINO
 *   - dias_trabajados_mes  {number}  Días trabajados en el mes del término (default 0 = mes completo)
 *   - vacaciones_dias      {number}  Días de vacaciones pendientes al término
 *   - mes_aviso            {boolean} true = empleador NO dio aviso previo (debe pagar sustitutiva)
 *   - indemnizacion_vol    {number}  Monto adicional voluntario ingresado manualmente
 */
export const calcularFiniquito = (datos) => {
  const {
    sueldo_base = 0,
    fecha_ingreso,
    fecha_termino,
    motivo_termino = "mutuo_acuerdo",
    dias_trabajados_mes = 0,
    vacaciones_dias = 0,
    mes_aviso = false,       // true = debe pagar sustitutiva mes de aviso
    indemnizacion_vol = 0,
  } = datos;

  const motivo = MOTIVOS_TERMINO.find(m => m.value === motivo_termino) || MOTIVOS_TERMINO[0];

  // ── Sueldo proporcional del mes de término ─────────────────────────────────
  const diasProp = dias_trabajados_mes > 0 ? dias_trabajados_mes : 30;
  const sueldo_proporcional = Math.round((sueldo_base / 30) * diasProp);

  // ── Años de servicio (para indemnización) ──────────────────────────────────
  let anos_servicio = 0;
  if (fecha_ingreso && fecha_termino) {
    const ini = new Date(fecha_ingreso);
    const fin = new Date(fecha_termino);
    const diffMs = fin - ini;
    anos_servicio = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25));
  }
  // Tope legal: 11 años (Art. 163 CT)
  const anos_tope = Math.min(anos_servicio, 11);

  // ── Indemnización por años de servicio ────────────────────────────────────
  // Solo si motivo aplica (necesidades_empresa) con al menos 1 año
  const indemnizacion_anos_servicio = (motivo.aplica_indemnizacion && anos_tope >= 1)
    ? Math.round(sueldo_base * anos_tope)
    : 0;

  // ── Sustitutiva del mes de aviso ──────────────────────────────────────────
  // Solo si aplica_mes_aviso y empleador NO dio aviso previo
  const sustitutiva_mes_aviso = (motivo.aplica_mes_aviso && mes_aviso)
    ? sueldo_base
    : 0;

  // ── Vacaciones pendientes ──────────────────────────────────────────────────
  // Valor día = sueldo_base / 30; vacaciones = días acumulados no tomados
  const valor_dia_vacacion = Math.round(sueldo_base / 30);
  const vacaciones_monto   = Math.round(valor_dia_vacacion * vacaciones_dias);

  // ── Gratificación proporcional (meses trabajados en el año en curso) ───────
  const meses_anio_curso = fecha_termino
    ? new Date(fecha_termino).getMonth() + 1   // 1–12
    : 12;
  const SMM = INDICADORES_PREVISIONALES.smm;
  const tope_grat_anual = Math.round(SMM * 4.75);
  const grat_anual_25   = Math.round(sueldo_base * 12 * 0.25);
  const grat_anual      = Math.min(grat_anual_25, tope_grat_anual);
  const gratificacion_proporcional = Math.round((grat_anual / 12) * meses_anio_curso);

  // ── Totales ────────────────────────────────────────────────────────────────
  const total_haberes = (
    sueldo_proporcional +
    vacaciones_monto +
    gratificacion_proporcional +
    indemnizacion_anos_servicio +
    sustitutiva_mes_aviso +
    indemnizacion_vol
  );

  return {
    sueldo_proporcional,
    vacaciones_dias,
    vacaciones_monto,
    valor_dia_vacacion,
    gratificacion_proporcional,
    meses_anio_curso,
    anos_servicio,
    anos_tope,
    indemnizacion_anos_servicio,
    sustitutiva_mes_aviso,
    indemnizacion_vol,
    total_haberes,
    aplica_indemnizacion: motivo.aplica_indemnizacion,
    aplica_mes_aviso: motivo.aplica_mes_aviso,
  };
};

// ─── Store ────────────────────────────────────────────────────────────────────

const useRrhhStore = defineStore("rrhh", {
  state: () => ({
    // Trabajadores
    trabajadores: [],
    trabajadorSelected: null,

    // Contratos
    contratos: [],

    // Liquidaciones
    liquidaciones: [],

    // Reportes
    periodoReporte: null,

    // UI
    loading: false,
    error: null,
  }),

  getters: {
    trabajadoresActivos: (state) =>
      state.trabajadores.filter((t) => t.estado === "activo"),

    trabajadoresPorVencer: (state) => {
      const hoy = new Date();
      const en30 = new Date(hoy.getTime() + 30 * 24 * 60 * 60 * 1000);
      return state.trabajadores.filter((t) => {
        if (!t.fechaFinContrato) return false;
        const fin = new Date(t.fechaFinContrato);
        return fin >= hoy && fin <= en30;
      });
    },

    costoMensualTotal: (state) =>
      state.trabajadores
        .filter((t) => t.estado === "activo")
        .reduce((acc, t) => {
          const base = t.sueldoBase || 0;
          const ces  = base * 0.024;
          const acc2 = base * 0.0093;
          return acc + base + (t.movilizacion || 0) + (t.colacion || 0) + ces + acc2;
        }, 0),

    vacacionesTotales: (state) =>
      state.trabajadores.reduce((acc, t) => acc + (t.vacacionesPendientes || 0), 0),
  },

  actions: {
    // ── LocalStorage helpers ──────────────────────────────────────────────────
    _lsGet(key) {
      if (typeof window === "undefined") return [];
      try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
    },
    _lsSet(key, data) {
      if (typeof window === "undefined") return;
      localStorage.setItem(key, JSON.stringify(data));
    },
    _lsSave(key, record) {
      const all = this._lsGet(key);
      const idx = all.findIndex((r) => r._id === record._id);
      if (idx === -1) all.push(record);
      else all[idx] = { ...all[idx], ...record };
      this._lsSet(key, all);
    },
    _lsDel(key, id) {
      this._lsSet(key, this._lsGet(key).filter((r) => r._id !== id));
    },
    _lsId(prefix = "ls") {
      return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    },

    // ── Trabajadores ──────────────────────────────────────────────────────────
    async getTrabajadores() {
      this.loading = true;
      try {
        const config = useRuntimeConfig();
        const token  = useCookie("access_token").value;
        const org    = useCookie("organization").value;
        const res = await $fetch(`${config.public.API_URL}/rrhh/trabajadores`, {
          headers: { Authorization: `Bearer ${token}`, organization: org },
        });
        const apiData = res.data || res || [];
        // Mergear con registros locales (creados offline o en modo demo)
        const localData = this._lsGet("rrhh_trabajadores");
        const apiIds = new Set(apiData.map(t => t._id || t.id));
        const soloLocales = localData.filter(t => !apiIds.has(t._id || t.id));
        this.trabajadores = [...apiData, ...soloLocales];
        // Actualizar LS con la data más reciente de la API
        const merged = [...apiData, ...soloLocales];
        this._lsSet("rrhh_trabajadores", merged);
      } catch (e) {
        // Sin API: usar solo localStorage (con seed si está vacío)
        let data = this._lsGet("rrhh_trabajadores");
        if (!data.length) {
          data = this._mockTrabajadores();
          this._lsSet("rrhh_trabajadores", data);
        }
        this.trabajadores = data;
      } finally {
        this.loading = false;
      }
    },

    async createTrabajador(datos) {
      this.loading = true;
      try {
        const config = useRuntimeConfig();
        const token  = useCookie("access_token").value;
        const org    = useCookie("organization").value;
        const res = await $fetch(`${config.public.API_URL}/rrhh/trabajadores`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, organization: org },
          body: datos,
        });
        const nuevo = res.data || res;
        this.trabajadores.push(nuevo);
        return nuevo;
      } catch (e) {
        const nuevo = { ...datos, _id: this._lsId("w"), creado: new Date().toISOString() };
        this._lsSave("rrhh_trabajadores", nuevo);
        this.trabajadores.push(nuevo);
        return nuevo;
      } finally {
        this.loading = false;
      }
    },

    async updateTrabajador(id, datos) {
      this.loading = true;
      try {
        const config = useRuntimeConfig();
        const token  = useCookie("access_token").value;
        const org    = useCookie("organization").value;
        const res = await $fetch(`${config.public.API_URL}/rrhh/trabajadores/${id}`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}`, organization: org },
          body: datos,
        });
        const updated = res.data || res;
        const idx = this.trabajadores.findIndex((t) => t._id === id);
        if (idx !== -1) this.trabajadores[idx] = updated;
        return updated;
      } catch (e) {
        const partial = { ...datos, _id: id };
        this._lsSave("rrhh_trabajadores", partial);   // _lsSave ya hace merge en LS
        const idx = this.trabajadores.findIndex((t) => t._id === id);
        const updated = idx !== -1 ? { ...this.trabajadores[idx], ...partial } : partial;
        if (idx !== -1) this.trabajadores[idx] = updated;
        return updated;
      } finally {
        this.loading = false;
      }
    },

    deleteTrabajador(id) {
      this._lsDel("rrhh_trabajadores", id);
      this.trabajadores = this.trabajadores.filter((t) => t._id !== id);
    },

    // ── Liquidaciones ─────────────────────────────────────────────────────────
    async getLiquidaciones(params = {}) {
      this.loading = true;
      try {
        const config = useRuntimeConfig();
        const token  = useCookie("access_token").value;
        const org    = useCookie("organization").value;
        const query  = new URLSearchParams(params).toString();
        const res = await $fetch(
          `${config.public.API_URL}/rrhh/liquidaciones?${query}`,
          { headers: { Authorization: `Bearer ${token}`, organization: org } }
        );
        this.liquidaciones = res.data || res || [];
      } catch (e) {
        let data = this._lsGet("rrhh_liquidaciones");
        if (!data.length) {
          data = this._mockLiquidaciones();
          this._lsSet("rrhh_liquidaciones", data);
        }
        this.liquidaciones = data;
      } finally {
        this.loading = false;
      }
    },

    async createLiquidacion(datos) {
      this.loading = true;
      try {
        const config = useRuntimeConfig();
        const token  = useCookie("access_token").value;
        const org    = useCookie("organization").value;
        const res = await $fetch(`${config.public.API_URL}/rrhh/liquidaciones`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, organization: org },
          body: { ...datos, calculos: calcularLiquidacion(datos) },
        });
        const nueva = res.data || res;
        this._lsSave("rrhh_liquidaciones", nueva);
        this.liquidaciones.unshift(nueva);
        return nueva;
      } catch (e) {
        const calculos = calcularLiquidacion(datos);
        const nueva = {
          ...datos,
          ...calculos,
          _id: this._lsId("liq"),
          estado: datos.estado || "pendiente",
          creado: new Date().toISOString(),
        };
        this._lsSave("rrhh_liquidaciones", nueva);
        this.liquidaciones.unshift(nueva);
        return nueva;
      } finally {
        this.loading = false;
      }
    },

    updateLiquidacion(id, cambios) {
      const updated = { ...cambios, _id: id };
      this._lsSave("rrhh_liquidaciones", updated);
      const idx = this.liquidaciones.findIndex((l) => l._id === id);
      if (idx !== -1) this.liquidaciones[idx] = { ...this.liquidaciones[idx], ...cambios };
    },

    deleteLiquidacion(id) {
      this._lsDel("rrhh_liquidaciones", id);
      this.liquidaciones = this.liquidaciones.filter((l) => l._id !== id);
    },

    // ── Contratos ─────────────────────────────────────────────────────────────
    async getContratos() {
      this.loading = true;
      try {
        const config = useRuntimeConfig();
        const token  = useCookie("access_token").value;
        const org    = useCookie("organization").value;
        const res = await $fetch(`${config.public.API_URL}/rrhh/contratos`, {
          headers: { Authorization: `Bearer ${token}`, organization: org },
        });
        const apiData = res.data || res || [];
        const localData = this._lsGet("rrhh_contratos");
        const apiIds = new Set(apiData.map(c => c._id || c.id));
        const soloLocales = localData.filter(c => !apiIds.has(c._id || c.id));
        const merged = [...apiData, ...soloLocales];
        this.contratos = merged;
        this._lsSet("rrhh_contratos", merged);
      } catch (e) {
        let data = this._lsGet("rrhh_contratos");
        if (!data.length) {
          data = this._mockContratos();
          this._lsSet("rrhh_contratos", data);
        }
        this.contratos = data;
      } finally {
        this.loading = false;
      }
    },

    async createContrato(datos) {
      try {
        const config = useRuntimeConfig();
        const token  = useCookie("access_token").value;
        const org    = useCookie("organization").value;
        const res = await $fetch(`${config.public.API_URL}/rrhh/contratos`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, organization: org },
          body: datos,
        });
        const nuevo = res.data || res;
        this._lsSave("rrhh_contratos", nuevo);
        this.contratos.push(nuevo);
        return nuevo;
      } catch (e) {
        const nuevo = { ...datos, _id: this._lsId("c"), estado: datos.estado || "vigente", creado: new Date().toISOString() };
        this._lsSave("rrhh_contratos", nuevo);
        this.contratos.push(nuevo);
        return nuevo;
      }
    },

    updateContrato(id, cambios) {
      const updated = { ...cambios, _id: id };
      this._lsSave("rrhh_contratos", updated);
      const idx = this.contratos.findIndex((c) => c._id === id);
      if (idx !== -1) this.contratos[idx] = { ...this.contratos[idx], ...cambios };
    },

    deleteContrato(id) {
      this._lsDel("rrhh_contratos", id);
      this.contratos = this.contratos.filter((c) => c._id !== id);
    },

    // ── Helpers ───────────────────────────────────────────────────────────────
    calcularLiquidacion,

    marcarContactoComoTrabajador(contacto, datosContrato = {}) {
      const nuevo = {
        _id: `local_${Date.now()}`,
        contactId: contacto._id,
        nombre: `${contacto.firstName || ""} ${contacto.lastName || ""}`.trim(),
        email: contacto.email,
        telefono: contacto.phone,
        rut: contacto.rut || "",
        cargo: datosContrato.cargo || "",
        tipoContrato: datosContrato.tipoContrato || "indefinido",
        sueldoBase: datosContrato.sueldoBase || 0,
        movilizacion: datosContrato.movilizacion || 0,
        colacion: datosContrato.colacion || 0,
        afp: datosContrato.afp || "AFP Capital",
        afpComision: datosContrato.afpComision || 0.0144,
        salud: datosContrato.salud || "FONASA",
        saludPorcentaje: datosContrato.saludPorcentaje || 0.07,
        fechaInicioContrato: datosContrato.fechaInicio || new Date().toISOString(),
        vacacionesPendientes: 0,
        estado: "activo",
      };
      this.trabajadores.push(nuevo);
      return nuevo;
    },

    // ── Mock data (fallback sin API) ──────────────────────────────────────────
    _mockTrabajadores() {
      return [
        {
          _id: "1", nombre: "María Jesús", apellido: "Ramila", email: "info@mramila.cl",
          rut: "12.345.678-9", cargo: "Directora de Arte", departamento: "Arte",
          tipo_contrato: "indefinido", sueldo_base: 1200000, gratificacion: "mensual",
          bono_mensual: 0, movilizacion: 50000, colacion: 40000,
          afp: "AFP Capital", sistema_salud: "FONASA",
          fecha_ingreso: "2023-03-01", vacaciones_dias: 15,
          vacaciones_ganados: 15, vacaciones_tomados: 0, estado: "activo",
        },
        {
          _id: "2", nombre: "Carlos", apellido: "Rodríguez", email: "carlo@r.cl",
          rut: "11.222.333-4", cargo: "Director de Fotografía", departamento: "Producción",
          tipo_contrato: "proyecto", sueldo_base: 950000, gratificacion: "mensual",
          bono_mensual: 0, movilizacion: 50000, colacion: 35000,
          afp: "AFP Habitat", sistema_salud: "FONASA",
          fecha_ingreso: "2026-01-15", fecha_termino: "2026-04-30",
          nombre_proyecto: "Serie Documental Patagonia",
          vacaciones_dias: 3, vacaciones_ganados: 3, vacaciones_tomados: 0, estado: "activo",
        },
        {
          _id: "3", nombre: "Ana", apellido: "Valdés", email: "avaldes@bp.cl",
          rut: "9.876.543-2", cargo: "Productora Ejecutiva", departamento: "Producción",
          tipo_contrato: "indefinido", sueldo_base: 1450000, gratificacion: "mensual",
          bono_mensual: 100000, movilizacion: 50000, colacion: 40000,
          afp: "AFP ProVida", sistema_salud: "FONASA",
          fecha_ingreso: "2021-06-01",
          vacaciones_dias: 18, vacaciones_ganados: 18, vacaciones_tomados: 0, estado: "activo",
        },
        {
          _id: "4", nombre: "Jorge", apellido: "Pedraza", email: "jpedraza@edit.cl",
          rut: "14.567.890-1", cargo: "Editor", departamento: "Post Producción",
          tipo_contrato: "proyecto", sueldo_base: 800000, gratificacion: "mensual",
          bono_mensual: 0, movilizacion: 40000, colacion: 30000,
          afp: "AFP Uno", sistema_salud: "FONASA",
          fecha_ingreso: "2026-02-01", fecha_termino: "2026-04-15",
          nombre_proyecto: "Serie Documental Patagonia",
          vacaciones_dias: 2, vacaciones_ganados: 2, vacaciones_tomados: 0, estado: "activo",
        },
      ];
    },

    _mockLiquidaciones() {
      return [
        {
          _id: "l1", trabajador_id: "1",
          mes: 3, anio: 2026, sueldo_base: 1200000,
          total_haberes: 1342000, total_descuentos: 247890,
          liquido_a_pagar: 1094110, costo_empresa: 1430000,
          afp_descuento: 132000, salud_descuento: 84000,
          cesantia_trabajador: 7200, impuesto: 24690, estado: "pagada",
        },
        {
          _id: "l2", trabajador_id: "2",
          mes: 3, anio: 2026, sueldo_base: 950000,
          total_haberes: 1035000, total_descuentos: 189210,
          liquido_a_pagar: 845790, costo_empresa: 1130000,
          afp_descuento: 104500, salud_descuento: 66500,
          cesantia_trabajador: 5700, impuesto: 12510, estado: "pagada",
        },
        {
          _id: "l3", trabajador_id: "3",
          mes: 3, anio: 2026, sueldo_base: 1450000,
          total_haberes: 1565000, total_descuentos: 298450,
          liquido_a_pagar: 1266550, costo_empresa: 1720000,
          afp_descuento: 159500, salud_descuento: 101500,
          cesantia_trabajador: 8700, impuesto: 28750, estado: "pendiente",
        },
      ];
    },

    _mockContratos() {
      return [
        {
          _id: "c1", trabajador_id: "1",
          tipo_contrato: "indefinido", fecha_inicio: "2023-03-01",
          fecha_termino: null, estado: "vigente",
        },
        {
          _id: "c2", trabajador_id: "2",
          tipo_contrato: "proyecto", nombre_proyecto: "Serie Documental Patagonia",
          fecha_inicio: "2026-01-15", fecha_termino: "2026-04-30", estado: "vigente",
        },
        {
          _id: "c3", trabajador_id: "3",
          tipo_contrato: "indefinido", fecha_inicio: "2021-06-01",
          fecha_termino: null, estado: "vigente",
        },
        {
          _id: "c4", trabajador_id: "4",
          tipo_contrato: "proyecto", nombre_proyecto: "Serie Documental Patagonia",
          fecha_inicio: "2026-02-01", fecha_termino: "2026-04-15", estado: "vigente",
        },
      ];
    },
  },
});

export default useRrhhStore;
