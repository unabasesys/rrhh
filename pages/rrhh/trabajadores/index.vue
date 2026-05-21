<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import useRrhhStore from "@/stores/rrhh";

const rrhhStore   = useRrhhStore();

definePageMeta({
  name: "rrhh-trabajadores",
  layout: 'rrhh',
  middleware: ["auth"],
});

useHead({ title: "Personas – RRHH" });

// ── Migración huérfanos ───────────────────────────────────────────────────────
const orphanDismissed = ref(false)
const migrating = ref(false)

const orphanCount = computed(() => {
  if (orphanDismissed.value) return 0
  return (rrhhStore.trabajadores || []).filter(t => !t.orgId).length
})

async function migrateOrphans() {
  migrating.value = true
  try {
    const res = await rrhhStore.migrateOrphanWorkers(rrhhStore.currentOrgId)
    if (res?.ok) orphanDismissed.value = true
  } finally {
    migrating.value = false
  }
}

// ── Estado local ──────────────────────────────────────────────────────────────
const busqueda       = ref("");
const filtroEstado   = ref("activo");
const filtroContrato = ref("todos");
const vistaActual    = ref("lista"); // "lista" | "fijos" | "proyectos"
const filtroMes      = ref(new Date().toISOString().slice(0, 7)); // YYYY-MM, por defecto mes actual

// Laboral defaults (para inicializar el form de Info Contrato)
const laboralDefaults = {
  tipo_contrato: "indefinido",
  fecha_ingreso: "",
  fecha_termino: "",
  cargo: "",
  departamento: "",
  sueldo_base: 0,
  movilizacion: 50000,
  colacion: 40000,
  afp: "",
  sistema_salud: "FONASA",
  gratificacion: "mensual",
  vacaciones_dias: 15,
};

// ── Computed ──────────────────────────────────────────────────────────────────

// Todos los contratos agrupados por trabajador_id (para filtro de mes histórico)
const contratosPortrabajador = computed(() => {
  const map = {};
  (rrhhStore.contratos || []).forEach(c => {
    const tid = c.trabajador_id;
    if (!tid) return;
    if (!map[tid]) map[tid] = [];
    map[tid].push(c);
  });
  return map;
});

// ¿Tenía este trabajador algún contrato vivo durante el mes YYYY-MM?
function tieniaContratoEnMes(tid, mes) {
  const contratos = contratosPortrabajador.value[tid];
  if (!contratos?.length) return false;
  // Primer y último día del mes seleccionado
  const primerDia = new Date(mes + '-01T00:00:00');
  const ultimoDia = new Date(primerDia);
  ultimoDia.setMonth(ultimoDia.getMonth() + 1);
  ultimoDia.setDate(ultimoDia.getDate() - 1);
  ultimoDia.setHours(23, 59, 59);

  return contratos.some(c => {
    const inicio = c.fecha_inicio || c.fecha_ingreso;
    const fin    = c.fecha_termino;
    // El contrato empezó antes o durante el mes
    const inicioOk = !inicio || new Date(inicio + 'T12:00:00') <= ultimoDia;
    // El contrato termina durante o después del mes (o es indefinido)
    const finOk    = !fin    || new Date(fin    + 'T12:00:00') >= primerDia;
    return inicioOk && finOk;
  });
}

const trabajadoresFiltrados = computed(() => {
  let lista = rrhhStore.trabajadores;
  if (busqueda.value) {
    const q = busqueda.value.toLowerCase();
    lista = lista.filter(
      (t) => t.nombre?.toLowerCase().includes(q) || t.cargo?.toLowerCase().includes(q)
    );
  }
  if (filtroEstado.value !== "todos")
    lista = lista.filter((t) => t.estado === filtroEstado.value);
  if (filtroContrato.value !== "todos")
    lista = lista.filter((t) => t.tipoContrato === filtroContrato.value);

  // Filtro por mes: personas con contrato vivo en ese período
  // Los trabajadores SIN contratos asignados siempre se muestran (ej: recién creados)
  lista = lista.filter(t => {
    const tid = t._id || t.id;
    const tieneContratos = !!(contratosPortrabajador.value[tid]?.length);
    return !tieneContratos || tieniaContratoEnMes(tid, filtroMes.value);
  });

  // Ordenar por modalidad: indefinido → plazo_fijo → part_time → proyecto → honorarios → sin contrato
  const modalidadOrder = { indefinido: 0, plazo_fijo: 1, part_time: 2, proyecto: 3, honorarios: 4 }
  lista = [...lista].sort((a, b) => {
    const ca = contratoVigenteMap.value[a._id || a.id]
    const cb = contratoVigenteMap.value[b._id || b.id]
    const oa = ca ? (modalidadOrder[ca.tipo_contrato] ?? 5) : 6
    const ob = cb ? (modalidadOrder[cb.tipo_contrato] ?? 5) : 6
    if (oa !== ob) return oa - ob
    return (a.nombre || '').localeCompare(b.nombre || '')
  })

  return lista;
});

// ── KPIs pie de página ────────────────────────────────────────────────────────

// Devuelve el contrato que estaba activo para un trabajador en un mes dado
function contratoEnMes(tid, mes) {
  const contratos = contratosPortrabajador.value[tid];
  if (!contratos?.length) return null;
  const primerDia = new Date(mes + '-01T00:00:00');
  const ultimoDia = new Date(primerDia);
  ultimoDia.setMonth(ultimoDia.getMonth() + 1);
  ultimoDia.setDate(ultimoDia.getDate() - 1);
  ultimoDia.setHours(23, 59, 59);
  return contratos.find(c => {
    const inicio   = c.fecha_inicio || c.fecha_ingreso;
    const fin      = c.fecha_termino;
    const inicioOk = !inicio || new Date(inicio + 'T12:00:00') <= ultimoDia;
    const finOk    = !fin    || new Date(fin    + 'T12:00:00') >= primerDia;
    return inicioOk && finOk;
  }) || null;
}

// Mes anterior en formato YYYY-MM (para calcular imposiciones 13→13)
const mesAnteriorStr = computed(() => {
  const [y, m] = filtroMes.value.split('-').map(Number);
  const d = new Date(y, m - 2, 1); // m-2: mes anterior, 0-indexed
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
});

// Trabajadores con contrato en el mes anterior (base de imposiciones)
const trabajadoresMesAnterior = computed(() =>
  (rrhhStore.trabajadores || []).filter(t =>
    tieniaContratoEnMes(t._id || t.id, mesAnteriorStr.value)
  )
);

// KPI 1: Líquido a pagar a fin del mes seleccionado
// - honorarios / proyecto / tipo_sueldo='liquido': sueldo_base ES el neto acordado
// - indefinido / plazo_fijo / part_time (bruto): descontar AFP (11.44%) + salud (7%)
const kpiLiquido = computed(() => {
  let total = 0;
  trabajadoresFiltrados.value.forEach(t => {
    const c = contratoEnMes(t._id || t.id, filtroMes.value);
    if (!c) return;
    const tipo       = (c.tipo_contrato || '').toLowerCase();
    const tipoSueldo = c.tipo_sueldo || 'bruto';
    const sueldo = c.sueldo_base  || 0;
    const mov    = c.movilizacion || 0;
    const col    = c.colacion     || 0;
    if (tipo === 'honorarios' || tipo === 'proyecto' || tipoSueldo === 'liquido') {
      // Monto acordado = neto, se transfiere sin descuentos por parte de la empresa
      total += sueldo + mov + col;
    } else {
      // Contrato permanente bruto: descontar cotizaciones obligatorias del trabajador
      total += Math.round(sueldo * (1 - 0.1844) + mov + col);
    }
  });
  return total;
});

// Tasa total de imposiciones (todos los contratos excepto honorarios)
// AFP trabajador 11.44% + salud 7% + cesantía emp 2.4% + acc. 0.93% + SIS 1.5%
const TASA_IMPOSICIONES = 0.1144 + 0.07 + 0.024 + 0.0093 + 0.015; // = 0.2327

// KPI 2: Costo empresa mes seleccionado
// - honorarios:  monto acordado (sin carga previsional — va por IVA)
// - proyecto / tipo_sueldo='liquido': neto acordado + TODAS las cotizaciones (gross-up)
// - indefinido / plazo_fijo / part_time (bruto): bruto × ~1.2 (cargas + gratificación)
const kpiCostoEmpresa = computed(() => {
  let total = 0;
  trabajadoresFiltrados.value.forEach(t => {
    const c = contratoEnMes(t._id || t.id, filtroMes.value);
    if (!c) return;
    const tipo       = (c.tipo_contrato || '').toLowerCase();
    const tipoSueldo = c.tipo_sueldo || 'bruto';
    const sueldo = c.sueldo_base  || 0;
    const mov    = c.movilizacion || 0;
    const col    = c.colacion     || 0;
    const base   = sueldo + mov + col;
    if (tipo === 'honorarios') {
      total += base; // sin carga empresa
    } else if (tipo === 'proyecto' || tipoSueldo === 'liquido') {
      // Empresa absorbe todas las cotizaciones encima del neto acordado (gross-up)
      total += Math.round(base * (1 + TASA_IMPOSICIONES));
    } else {
      // Indefinido / plazo_fijo / part_time bruto: bruto + cargas patronales + gratificación
      total += Math.round(base * 1.2);
    }
  });
  return total;
});

// KPI 3: Imposiciones período 13 mes actual → 13 mes siguiente
// - honorarios: excluidos (van por IVA, sin previsión)
// - proyecto:   empresa paga AFP + salud + cesantía emp + acc. + SIS sobre el neto
// - resto:      mismo cálculo sobre sueldo bruto
const kpiImposiciones = computed(() => {
  let total = 0;
  trabajadoresFiltrados.value.forEach(t => {
    const c = contratoEnMes(t._id || t.id, filtroMes.value);
    if (!c) return;
    const tipo   = (c.tipo_contrato || '').toLowerCase();
    if (tipo === 'honorarios') return; // sin imposiciones previsionales
    const sueldo = c.sueldo_base || 0;
    total += Math.round(sueldo * TASA_IMPOSICIONES);
  });
  return total;
});

// Label legible del período de imposiciones: "13 abr → 13 may"
// (se pagan del 13 del mes en curso al 13 del mes siguiente)
const labelPeriodoImposiciones = computed(() => {
  const [y, m] = filtroMes.value.split('-').map(Number);
  const desde  = new Date(y, m - 1, 13);  // día 13 del mes seleccionado
  const hasta  = new Date(y, m,     13);  // día 13 del mes siguiente
  const fmt    = (d) => d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
  return `${fmt(desde)} → ${fmt(hasta)}`;
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtCLP = (n) =>
  n ? `$${Math.round(n).toLocaleString("es-CL")}` : "$0";

const calcVacaciones = (t) => {
  if (!t.fecha_ingreso) return 0;
  const meses =
    (new Date() - new Date(t.fecha_ingreso)) / (1000 * 60 * 60 * 24 * 30.44);
  return Math.floor((meses / 12) * 15);
};

// ── Menú contextual de fila ───────────────────────────────────────────────────
const menuOpenId = ref(null); // _id del trabajador con menú abierto

function toggleMenu(t, e) {
  e.stopPropagation();
  menuOpenId.value = menuOpenId.value === (t._id || t.id) ? null : (t._id || t.id);
}
function closeMenu() { menuOpenId.value = null; }

// ¿Tiene el trabajador historia? (contratos o liquidaciones registradas)
function tieneHistoria(t) {
  const tid = t._id || t.id;
  const contratos = contratosPortrabajador.value[tid]?.length > 0;
  const liqs = (rrhhStore.liquidaciones || []).some(l => l.trabajador_id === tid);
  return contratos || liqs;
}

// ── Confirmar eliminación ─────────────────────────────────────────────────────
const confirmEliminar = ref({ show: false, trabajador: null });
const eliminandoTrabajador = ref(false);

function pedirEliminar(t) {
  closeMenu();
  confirmEliminar.value = { show: true, trabajador: t };
}

async function confirmarEliminar() {
  const t = confirmEliminar.value.trabajador;
  if (!t) return;
  eliminandoTrabajador.value = true;
  try {
    rrhhStore.deleteTrabajador(t._id || t.id);
  } finally {
    eliminandoTrabajador.value = false;
    confirmEliminar.value = { show: false, trabajador: null };
  }
}

// ── Desactivar trabajador ─────────────────────────────────────────────────────
async function desactivarTrabajador(t) {
  closeMenu();
  await rrhhStore.updateTrabajador(t._id || t.id, { estado: 'inactivo' });
}

// ── Modal Nuevo Trabajador ────────────────────────────────────────────────────
const showModalNuevo     = ref(false);
const guardandoTrabajador = ref(false);
const fotoPreview        = ref(null);  // base64 preview
const fotoFileRef        = ref(null);  // <input type="file"> ref

const nuevoFormDefaults = () => ({
  nombre: '', apellido: '', email: '', telefono: '', rut: '',
  sexo: '',
  cargo: '', departamento: '', profesion: '',
  fecha_nacimiento: '', nacionalidad: 'Chilena',
  direccion: '',
  afp: 'AFP Capital', sistema_salud: 'FONASA',
  isapre_nombre: '', isapre_monto_uf: '',
  estado: 'activo',
  foto: null,
});

const nuevoForm = ref(nuevoFormDefaults());

const abrirNuevoTrabajador = () => {
  nuevoForm.value = nuevoFormDefaults();
  fotoPreview.value = null;
  showModalNuevo.value = true;
};

function onFotoChange(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    fotoPreview.value = ev.target.result;
    nuevoForm.value.foto = ev.target.result;
  };
  reader.readAsDataURL(file);
}

const guardarTrabajador = async () => {
  if (!nuevoForm.value.nombre) return;
  guardandoTrabajador.value = true;
  try {
    await rrhhStore.createTrabajador({ ...nuevoForm.value });
    showModalNuevo.value = false;
  } catch (e) {
    console.error('Error creando trabajador', e);
  } finally {
    guardandoTrabajador.value = false;
  }
};

// ── Vista por Proyectos ───────────────────────────────────────────────────────
const fotoProyecto         = ref({});
const fotoFileRefProyecto  = ref(null);
const proyectoFotoTarget   = ref(null);

function onFotoProyectoChange(e) {
  const file = e.target.files?.[0];
  if (!file || !proyectoFotoTarget.value) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    fotoProyecto.value = { ...fotoProyecto.value, [proyectoFotoTarget.value]: ev.target.result };
    try { localStorage.setItem('rrhh_fotos_proyectos', JSON.stringify(fotoProyecto.value)); } catch {}
  };
  reader.readAsDataURL(file);
}

function subirFotoProyecto(key) {
  proyectoFotoTarget.value = key;
  fotoFileRefProyecto.value?.click();
}

const trabajadoresPorProyecto = computed(() => {
  const contratos    = rrhhStore.contratos   || [];
  const trabajadores = rrhhStore.trabajadores || [];

  // Contrato vigente por trabajador
  const vigenteMap = {};
  contratos.forEach(c => {
    if (!c.trabajador_id) return;
    const est = (c.estado_contrato || c.estado || '').toLowerCase();
    if (est === 'activo' || est === 'vigente') {
      if (!vigenteMap[c.trabajador_id]) vigenteMap[c.trabajador_id] = c;
    }
  });

  const grupos = {};
  trabajadores.forEach(t => {
    const tid = t._id || t.id;
    const c   = vigenteMap[tid];
    const key = c?.negocio_nombre || c?.nombre_proyecto || '__sin_proyecto__';

    if (!grupos[key]) {
      grupos[key] = {
        nombre: key === '__sin_proyecto__' ? 'Sin proyecto asignado' : key,
        key,
        trabajadores: [],
        contratos: [],
        fecha_inicio: null,
        fecha_termino: null,
        total_liquido:      0,
        total_costo:        0,
        total_imposiciones: 0,
      };
    }
    grupos[key].trabajadores.push(t);
    if (c) {
      grupos[key].contratos.push(c);
      const fi   = c.fecha_inicio || c.fecha_ingreso;
      const ft   = c.fecha_termino;
      if (fi && (!grupos[key].fecha_inicio  || fi < grupos[key].fecha_inicio))  grupos[key].fecha_inicio  = fi;
      if (ft && (!grupos[key].fecha_termino || ft > grupos[key].fecha_termino)) grupos[key].fecha_termino = ft;

      const tipo       = (c.tipo_contrato || '').toLowerCase();
      const tipoSueldo = c.tipo_sueldo || 'bruto';
      const sueldo = c.sueldo_base   || 0;
      const mov    = c.movilizacion  || 0;
      const col    = c.colacion      || 0;
      const base   = sueldo + mov + col;
      const esLiq  = tipo === 'proyecto' || tipoSueldo === 'liquido';

      // Líquido al trabajador
      if (tipo === 'honorarios' || esLiq) {
        grupos[key].total_liquido += base;                              // neto acordado
      } else {
        grupos[key].total_liquido += Math.round(sueldo * (1 - 0.1844) + mov + col);
      }

      // Costo empresa
      if (tipo === 'honorarios') {
        grupos[key].total_costo += base;
      } else if (esLiq) {
        grupos[key].total_costo += Math.round(base * (1 + TASA_IMPOSICIONES));
      } else {
        grupos[key].total_costo += Math.round(base * 1.2);
      }

      // Imposiciones a Previred
      if (tipo !== 'honorarios') {
        grupos[key].total_imposiciones += Math.round(sueldo * TASA_IMPOSICIONES);
      }
    }
  });

  return Object.values(grupos)
    .filter(g => g.key !== '__sin_proyecto__')
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
});

// ── Sprint 2: contrato vigente, estado doble, labels contextuales ─────────────

// Map: trabajador_id → contrato vigente
const contratoVigenteMap = computed(() => {
  const map = {}
  ;(rrhhStore.contratos || []).forEach(c => {
    if (!c.trabajador_id) return
    const est = (c.estado_contrato || c.estado || '').toLowerCase()
    if (['vigente', 'activo', 'borrador'].includes(est)) {
      if (!map[c.trabajador_id]) map[c.trabajador_id] = c
    }
  })
  return map
})
function contratoVigente(tid) { return contratoVigenteMap.value[tid] || null }

// Semáforo de vigencia del contrato
function estadoContratoInfo(c) {
  if (!c) return { label: 'Sin contrato', cls: 'sin-contrato' }
  const est = (c.estado_contrato || c.estado || '').toLowerCase()
  if (est === 'vencido') return { label: 'Vencido', cls: 'vencido-c' }
  if (!c.fecha_termino)  return { label: 'Indefinido', cls: 'indefinido-c' }
  const fin = new Date(c.fecha_termino + 'T12:00:00')
  const hoy = new Date()
  const lim = new Date(); lim.setDate(lim.getDate() + 30)
  if (fin < hoy)  return { label: 'Vencido', cls: 'vencido-c' }
  if (fin <= lim) {
    const dias = Math.ceil((fin - hoy) / (1000 * 60 * 60 * 24))
    return { label: `Vence en ${dias}d`, cls: 'por-vencer-c' }
  }
  return { label: 'Vigente', cls: 'vigente-c' }
}

// Mostrar sueldo sin $0 — etiqueta contextual según tipo
function sueldoDisplay(t) {
  const c    = contratoVigente(t._id || t.id)
  const tipo = (c?.tipo_contrato || t.tipo_contrato || '').toLowerCase()
  const val  = c?.sueldo_base ?? t.sueldo_base ?? 0
  if (tipo === 'honorarios') return { label: 'Variable',    cls: 'lbl-var' }
  if (tipo === 'proyecto')   return { label: 'Por contrato', cls: 'lbl-var' }
  if (!val)                  return { label: 'No definido',  cls: 'lbl-nd' }
  return { label: fmtCLP(val), cls: '' }
}

// Labels de tipo contrato
const TIPO_LABELS = {
  indefinido: 'Indefinido', plazo_fijo: 'Plazo fijo',
  proyecto: 'Proyecto', honorarios: 'Honorarios', part_time: 'Part-time',
}
function tipoLabel(t) {
  const c    = contratoVigente(t._id || t.id)
  const tipo = c?.tipo_contrato || t.tipo_contrato || ''
  return TIPO_LABELS[tipo] || tipo || '—'
}

// Vista "Fijos": solo indefinido / plazo_fijo / part_time
const trabajadoresFiltradosFijos = computed(() =>
  trabajadoresFiltrados.value.filter(t => {
    const c    = contratoVigente(t._id || t.id)
    const tipo = (c?.tipo_contrato || t.tipo_contrato || '').toLowerCase()
    return ['indefinido', 'plazo_fijo', 'part_time'].includes(tipo)
  })
)

// Vista "Por proyecto": solo proyecto / honorarios
const trabajadoresFiltradosProyecto = computed(() =>
  trabajadoresFiltrados.value.filter(t => {
    const c    = contratoVigente(t._id || t.id)
    const tipo = (c?.tipo_contrato || t.tipo_contrato || '').toLowerCase()
    return ['proyecto', 'honorarios'].includes(tipo)
  })
)

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(async () => {
  try {
    const saved = localStorage.getItem('rrhh_fotos_proyectos');
    if (saved) fotoProyecto.value = JSON.parse(saved);
  } catch {}
  try {
    await Promise.all([rrhhStore.getTrabajadores(), rrhhStore.getContratos()]);
  } finally {
  }
});

</script>

<template>
  <div class="rrhhPage">

    <!-- Header -->
    <div class="rrhhPage__header">
      <div class="rrhhPage__header-left">
        <h2 class="rrhhPage__title">Personas</h2>
        <span class="rrhhPage__subtitle">
          {{ trabajadoresFiltrados.length }} personas · {{ filtroMes }}
        </span>
      </div>
      <div class="rrhhPage__header-right">
        <button class="btn btn-secondary" disabled>Importar Contacto</button>
        <button class="btn btn-primary" @click="abrirNuevoTrabajador">
          <span class="u u-plus"></span> Nueva Persona
        </button>
      </div>
    </div>

    <!-- Banner: trabajadores huérfanos sin org -->
    <div v-if="orphanCount > 0 && rrhhStore.currentOrgId" class="orphan-banner">
      <div class="orphan-banner__icon">
        <i class="u u-warning"></i>
      </div>
      <div class="orphan-banner__text">
        <strong>{{ orphanCount }} persona{{ orphanCount > 1 ? 's' : '' }} sin organización asignada.</strong>
        ¿Reasignarlas a la organización activa?
      </div>
      <button class="orphan-banner__btn" :disabled="migrating" @click="migrateOrphans">
        <span v-if="migrating" class="spin-sm"></span>
        <span v-else>Reasignar ahora</span>
      </button>
      <button class="orphan-banner__dismiss" @click="orphanDismissed = true">
        <i class="u u-close"></i>
      </button>
    </div>

    <!-- Filtros + Toggle Vista -->
    <div class="rrhhPage__filters">
      <div class="filterInput">
        <span class="u u-search"></span>
        <input v-model="busqueda" placeholder="Buscar trabajador..." />
      </div>

      <!-- Filtro mes -->
      <div class="filterInput filterInput--mes">
        <input type="month" v-model="filtroMes" title="Filtrar por mes" />
      </div>

      <!-- Toggle de vista -->
      <div class="view-toggle">
        <button :class="['view-btn', vistaActual === 'lista' && 'active']" @click="vistaActual = 'lista'" title="Lista completa">
          <span class="u u-list"></span>
          <span>Lista</span>
          <span v-if="trabajadoresFiltrados.length" class="view-count">{{ trabajadoresFiltrados.length }}</span>
        </button>
        <button :class="['view-btn', vistaActual === 'fijos' && 'active']" @click="vistaActual = 'fijos'" title="Solo fijos">
          <span class="u u-usuarios"></span>
          <span>Fijos</span>
          <span v-if="trabajadoresFiltradosFijos.length" class="view-count">{{ trabajadoresFiltradosFijos.length }}</span>
        </button>
        <button :class="['view-btn', vistaActual === 'proyectos' && 'active']" @click="vistaActual = 'proyectos'" title="Vista por proyectos">
          <span class="u u-grid"></span>
          <span>Proyectos</span>
          <span v-if="trabajadoresPorProyecto.length" class="view-count">
            {{ trabajadoresPorProyecto.reduce((acc, g) => acc + g.trabajadores.length, 0) }}
          </span>
        </button>
      </div>

      <!-- Separador (solo desktop) -->
      <div class="filter-sep desktop-only"></div>

      <!-- Chips de filtro — desktop -->
      <button :class="['chip desktop-only', filtroEstado === 'todos' && 'active']"    @click="filtroEstado = 'todos'">Todos</button>
      <button :class="['chip desktop-only', filtroEstado === 'activo' && 'active']"   @click="filtroEstado = 'activo'">Activos</button>
      <button :class="['chip desktop-only', filtroEstado === 'inactivo' && 'active']" @click="filtroEstado = 'inactivo'">Inactivos</button>
      <button :class="['chip desktop-only', filtroContrato === 'indefinido' && 'active']" @click="filtroContrato = filtroContrato === 'indefinido' ? 'todos' : 'indefinido'">Indefinido</button>
      <button :class="['chip desktop-only', filtroContrato === 'proyecto' && 'active']"   @click="filtroContrato = filtroContrato === 'proyecto' ? 'todos' : 'proyecto'">Por Proyecto</button>

      <!-- Selects de filtro — mobile -->
      <div class="mobile-filters">
        <select v-model="filtroEstado" class="mobile-select">
          <option value="todos">Todos</option>
          <option value="activo">Activos</option>
          <option value="inactivo">Inactivos</option>
        </select>
        <select v-model="filtroContrato" class="mobile-select">
          <option value="todos">Todos los tipos</option>
          <option value="indefinido">Indefinido</option>
          <option value="proyecto">Por Proyecto</option>
        </select>
      </div>
    </div>

    <!-- ── Vista por Proyectos ──────────────────────────────────────────── -->
    <div v-if="vistaActual === 'proyectos'" class="proyectos-grid">
      <input ref="fotoFileRefProyecto" type="file" accept="image/*" style="display:none" @change="onFotoProyectoChange" />

      <div
        v-for="grupo in trabajadoresPorProyecto"
        :key="grupo.key"
        class="proyecto-card"
      >
        <!-- Cabecera con foto -->
        <div class="proyecto-card__cover" :style="fotoProyecto[grupo.key] ? `background-image:url(${fotoProyecto[grupo.key]})` : ''">
          <div class="proyecto-card__cover-overlay">
            <div class="proyecto-card__cover-actions">
              <button class="btn-foto-up" @click.stop="subirFotoProyecto(grupo.key)" :title="fotoProyecto[grupo.key] ? 'Cambiar foto' : 'Subir foto'">
                <span class="u u-edit" style="font-size:12px"></span>
                {{ fotoProyecto[grupo.key] ? 'Cambiar' : 'Foto' }}
              </button>
            </div>
          </div>
          <div class="proyecto-card__name-wrap">
            <h3 class="proyecto-card__name">{{ grupo.nombre }}</h3>
            <div class="proyecto-card__dates" v-if="grupo.fecha_inicio">
              {{ new Date(grupo.fecha_inicio + 'T12:00').toLocaleDateString('es-CL', { day:'numeric', month:'short', year:'numeric' }) }}
              <template v-if="grupo.fecha_termino">
                → {{ new Date(grupo.fecha_termino + 'T12:00').toLocaleDateString('es-CL', { day:'numeric', month:'short', year:'numeric' }) }}
              </template>
              <template v-else>→ Indefinido</template>
            </div>
          </div>
        </div>

        <!-- KPIs del proyecto -->
        <div class="proyecto-card__stats">
          <div class="proyecto-stat">
            <span class="proyecto-stat__lbl">Líquido</span>
            <span class="proyecto-stat__val teal">{{ fmtCLP(grupo.total_liquido) }}</span>
          </div>
          <div class="proyecto-stat__sep"></div>
          <div class="proyecto-stat">
            <span class="proyecto-stat__lbl">Costo empresa</span>
            <span class="proyecto-stat__val orange">{{ fmtCLP(grupo.total_costo) }}</span>
          </div>
          <div class="proyecto-stat__sep"></div>
          <div class="proyecto-stat">
            <span class="proyecto-stat__lbl">Imposiciones</span>
            <span class="proyecto-stat__val rose">{{ fmtCLP(grupo.total_imposiciones) }}</span>
          </div>
        </div>

        <!-- Barra visual + contador de trabajadores -->
        <div class="proyecto-card__bar-wrap">
          <div class="proyecto-card__bar" v-if="grupo.contratos.length">
            <div
              v-for="(c, i) in grupo.contratos"
              :key="i"
              :class="['bar-seg', c.tipo_contrato]"
              :style="`width:${100/grupo.contratos.length}%`"
              :title="c.tipo_contrato"
            ></div>
          </div>
          <div class="proyecto-card__count">
            <span class="u u-usuarios" style="font-size:12px"></span>
            {{ grupo.trabajadores.length }} {{ grupo.trabajadores.length === 1 ? 'trabajador' : 'trabajadores' }}
          </div>
        </div>

        <!-- Lista de trabajadores -->
        <div class="proyecto-card__workers">
          <div
            v-for="t in grupo.trabajadores"
            :key="t._id"
            class="proyecto-worker"
            @click="$router.push(`/rrhh/trabajadores/${t._id}`)"
          >
            <div class="proyecto-worker__avatar">
              <img v-if="t.foto" :src="t.foto" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />
              <template v-else>{{ t.nombre?.charAt(0) }}{{ (t.apellido || t.nombre?.split(' ')[1] || '')?.charAt(0) }}</template>
            </div>
            <div class="proyecto-worker__info">
              <span class="proyecto-worker__name">{{ t.nombre }} {{ t.apellido || '' }}</span>
              <span class="proyecto-worker__cargo">{{ t.cargo || '—' }}</span>
            </div>
            <div class="proyecto-worker__pills">
              <span :class="['tagEstado', t.estado]">{{ t.estado === 'activo' ? '● Activo' : 'Inactivo' }}</span>
              <span :class="['tagContrato-v', estadoContratoInfo(contratoVigente(t._id || t.id)).cls]" style="font-size:10px">
                {{ estadoContratoInfo(contratoVigente(t._id || t.id)).label }}
              </span>
            </div>
          </div>
          <div v-if="!grupo.trabajadores.length" class="proyecto-empty">Sin personas asignadas</div>
        </div>

      </div>
    </div>

    <!-- ── Vista Lista completa ──────────────────────────────────────────── -->
    <div v-else-if="vistaActual === 'lista'">
      <!-- Mobile: tarjetas -->
      <div class="mobile-cards">
        <div
          v-for="t in trabajadoresFiltrados" :key="t._id + '-m'"
          class="mobile-card"
          @click="$router.push(`/rrhh/trabajadores/${t._id}`)"
        >
          <div class="mobile-card__avatar" :style="t.foto ? '' : 'background:#2a9d8f'">
            <img v-if="t.foto" :src="t.foto" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />
            <template v-else>{{ t.nombre?.charAt(0) }}{{ (t.apellido || '')?.charAt(0) }}</template>
          </div>
          <div class="mobile-card__info">
            <div class="mobile-card__name">{{ t.nombre }} {{ t.apellido || '' }}</div>
            <div class="mobile-card__cargo">{{ t.cargo || '—' }}</div>
            <div class="mobile-card__pills">
              <span :class="['tagEstado', t.estado]">{{ t.estado === 'activo' ? '● Activo' : 'Inactivo' }}</span>
              <span :class="['tagContrato', contratoVigente(t._id || t.id)?.tipo_contrato || t.tipo_contrato]">{{ tipoLabel(t) }}</span>
              <span :class="['tagContrato-v', estadoContratoInfo(contratoVigente(t._id || t.id)).cls]">
                {{ estadoContratoInfo(contratoVigente(t._id || t.id)).label }}
              </span>
            </div>
          </div>
          <div class="mobile-card__sueldo">{{ sueldoDisplay(t).label }}</div>
        </div>
        <div v-if="!trabajadoresFiltrados.length" class="mobile-empty">
          No hay personas que coincidan
        </div>
      </div>

      <!-- Desktop: tabla -->
      <div class="rrhhPage__table-wrap desktop-table">
      <table class="rrhhTable">
        <thead>
          <tr>
            <th></th>
            <th>Nombre</th>
            <th>Cargo</th>
            <th>Modalidad</th>
            <th>Sueldo base</th>
            <th>Ingreso</th>
            <th>Persona</th>
            <th>Contrato</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in trabajadoresFiltrados" :key="t._id" class="rrhhTable__row" @click="$router.push(`/rrhh/trabajadores/${t._id}`)">
            <td><div class="avatar" :style="t.foto ? '' : 'background:#2a9d8f'">
              <img v-if="t.foto" :src="t.foto" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />
              <template v-else>{{ t.nombre?.charAt(0) }}{{ (t.apellido || t.nombre?.split(' ')[1] || '')?.charAt(0) }}</template>
            </div></td>
            <td><div class="cellName">
              <span class="name">{{ t.nombre }} {{ t.apellido || '' }}</span>
              <span class="email">{{ t.email }}</span>
            </div></td>
            <td class="muted">{{ t.cargo || '—' }}</td>
            <td><span :class="['tagContrato', contratoVigente(t._id || t.id)?.tipo_contrato || t.tipo_contrato]">
              {{ tipoLabel(t) }}
            </span></td>
            <td>
              <span :class="['sueldo-lbl', sueldoDisplay(t).cls]">{{ sueldoDisplay(t).label }}</span>
            </td>
            <td class="muted">{{ t.fecha_ingreso ? new Date(t.fecha_ingreso + 'T12:00').toLocaleDateString('es-CL', { year:'numeric', month:'short' }) : '—' }}</td>
            <td><span :class="['tagEstado', t.estado]">{{ t.estado === 'activo' ? '● Activo' : 'Inactivo' }}</span></td>
            <td>
              <span :class="['tagContrato-v', estadoContratoInfo(contratoVigente(t._id || t.id)).cls]">
                {{ estadoContratoInfo(contratoVigente(t._id || t.id)).label }}
              </span>
            </td>
            <td @click.stop class="td-menu">
              <button class="btnDots" @click="toggleMenu(t, $event)">···</button>
              <div v-if="menuOpenId === (t._id || t.id)" class="row-menu">
                <button class="row-menu__item" @click.stop="$router.push(`/rrhh/trabajadores/${t._id}`)">Ver detalle</button>
                <div class="row-menu__sep"></div>
                <template v-if="!tieneHistoria(t)">
                  <button class="row-menu__item row-menu__item--danger" @click.stop="pedirEliminar(t)">Eliminar persona</button>
                </template>
                <template v-else>
                  <button class="row-menu__item row-menu__item--warn" @click.stop="desactivarTrabajador(t)" :disabled="t.estado === 'inactivo'">
                    {{ t.estado === 'inactivo' ? 'Ya inactivo' : 'Desactivar persona' }}
                  </button>
                  <span class="row-menu__hint">Tiene historia — no se puede eliminar</span>
                </template>
              </div>
            </td>
          </tr>
          <tr v-if="!trabajadoresFiltrados.length">
            <td colspan="9" class="emptyRow">No hay personas que coincidan con el filtro</td>
          </tr>
        </tbody>
      </table>
      </div><!-- /desktop-table -->
    </div><!-- /lista -->

    <!-- ── Vista Fijos ────────────────────────────────────────────────────── -->
    <div v-else-if="vistaActual === 'fijos'" class="rrhhPage__table-wrap">
      <table class="rrhhTable">
        <thead>
          <tr>
            <th></th>
            <th>Nombre</th>
            <th>Cargo</th>
            <th>Tipo vínculo</th>
            <th>Sueldo base</th>
            <th>Ingreso</th>
            <th>Vacaciones</th>
            <th>Contrato</th>
            <th>Persona</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in trabajadoresFiltradosFijos" :key="t._id" class="rrhhTable__row" @click="$router.push(`/rrhh/trabajadores/${t._id}`)">
            <td><div class="avatar" :style="t.foto ? '' : 'background:#2a9d8f'">
              <img v-if="t.foto" :src="t.foto" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />
              <template v-else>{{ t.nombre?.charAt(0) }}{{ (t.apellido || t.nombre?.split(' ')[1] || '')?.charAt(0) }}</template>
            </div></td>
            <td><div class="cellName">
              <span class="name">{{ t.nombre }} {{ t.apellido || '' }}</span>
              <span class="email">{{ t.email }}</span>
            </div></td>
            <td class="muted">{{ t.cargo || '—' }}</td>
            <td><span :class="['tagContrato', contratoVigente(t._id || t.id)?.tipo_contrato || t.tipo_contrato]">{{ tipoLabel(t) }}</span></td>
            <td><span :class="['sueldo-lbl', sueldoDisplay(t).cls]">{{ sueldoDisplay(t).label }}</span></td>
            <td class="muted">{{ t.fecha_ingreso ? new Date(t.fecha_ingreso + 'T12:00').toLocaleDateString('es-CL', { year:'numeric', month:'short' }) : '—' }}</td>
            <td :class="['vacaciones', calcVacaciones(t) >= 15 && 'warn']">{{ calcVacaciones(t) }} días</td>
            <td>
              <span :class="['tagContrato-v', estadoContratoInfo(contratoVigente(t._id || t.id)).cls]">
                {{ estadoContratoInfo(contratoVigente(t._id || t.id)).label }}
              </span>
            </td>
            <td><span :class="['tagEstado', t.estado]">{{ t.estado === 'activo' ? '● Activo' : 'Inactivo' }}</span></td>
            <td @click.stop class="td-menu">
              <button class="btnDots" @click="toggleMenu(t, $event)">···</button>
              <div v-if="menuOpenId === (t._id || t.id)" class="row-menu">
                <button class="row-menu__item" @click.stop="$router.push(`/rrhh/trabajadores/${t._id}`)">Ver detalle</button>
                <div class="row-menu__sep"></div>
                <template v-if="!tieneHistoria(t)">
                  <button class="row-menu__item row-menu__item--danger" @click.stop="pedirEliminar(t)">Eliminar persona</button>
                </template>
                <template v-else>
                  <button class="row-menu__item row-menu__item--warn" @click.stop="desactivarTrabajador(t)" :disabled="t.estado === 'inactivo'">
                    {{ t.estado === 'inactivo' ? 'Ya inactivo' : 'Desactivar persona' }}
                  </button>
                  <span class="row-menu__hint">Tiene historia — no se puede eliminar</span>
                </template>
              </div>
            </td>
          </tr>
          <tr v-if="!trabajadoresFiltradosFijos.length">
            <td colspan="10" class="emptyRow">No hay personas con contrato fijo activo</td>
          </tr>
        </tbody>
      </table>
    </div><!-- end vista fijos -->

    <!-- ── KPIs pie de página ──────────────────────────────────────────────── -->
    <div class="footer-kpis">
      <div class="footer-kpi">
        <div class="footer-kpi__label">Líquido a pagar</div>
        <div class="footer-kpi__val">{{ fmtCLP(kpiLiquido) }}</div>
        <div class="footer-kpi__sub">fin de {{ filtroMes }}</div>
      </div>
      <div class="footer-kpi__sep"></div>
      <div class="footer-kpi">
        <div class="footer-kpi__label">Costo empresa</div>
        <div class="footer-kpi__val footer-kpi__val--orange">{{ fmtCLP(kpiCostoEmpresa) }}</div>
        <div class="footer-kpi__sub">mes {{ filtroMes }}</div>
      </div>
      <div class="footer-kpi__sep"></div>
      <div class="footer-kpi">
        <div class="footer-kpi__label">Imposiciones Previred</div>
        <div class="footer-kpi__val footer-kpi__val--rose">{{ fmtCLP(kpiImposiciones) }}</div>
        <div class="footer-kpi__sub">{{ labelPeriodoImposiciones }}</div>
      </div>
      <div class="footer-kpi__badge">estimado</div>
    </div>

  </div>

  <!-- ── Modal Nuevo Trabajador ───────────────────────────────────────────── -->
  <Teleport to="body">
    <div v-if="showModalNuevo" class="modalOverlay" @click.self="showModalNuevo = false">
      <div class="modalBox">
        <div class="modalBox__header">
          <h3>Nuevo Trabajador</h3>
          <button class="btnClose" @click="showModalNuevo = false">✕</button>
        </div>
        <div class="modalBox__body">

          <!-- Foto de perfil -->
          <div class="foto-upload-row">
            <div class="foto-preview-circle" @click="fotoFileRef?.click()">
              <img v-if="fotoPreview" :src="fotoPreview" class="foto-img" />
              <span v-else class="foto-placeholder">
                {{ nuevoForm.nombre ? nuevoForm.nombre.charAt(0).toUpperCase() : '👤' }}
              </span>
              <div class="foto-overlay">📷</div>
            </div>
            <div class="foto-upload-hint">
              <p>Foto de perfil</p>
              <small>Haz clic para subir una imagen</small>
            </div>
            <input ref="fotoFileRef" type="file" accept="image/*" style="display:none" @change="onFotoChange" />
          </div>

          <!-- Nombre -->
          <div class="formGrid2">
            <div class="formRow">
              <label>Nombre <span class="lbl-req">*</span></label>
              <input v-model="nuevoForm.nombre" placeholder="Ej: María" />
            </div>
            <div class="formRow">
              <label>Apellido <span class="lbl-req">*</span></label>
              <input v-model="nuevoForm.apellido" placeholder="Ej: González" />
            </div>
          </div>

          <!-- RUT / Teléfono -->
          <div class="formGrid2">
            <div class="formRow">
              <label>RUT / ID <span class="lbl-req">*</span></label>
              <input v-model="nuevoForm.rut" placeholder="12.345.678-9" />
            </div>
            <div class="formRow">
              <label>Teléfono</label>
              <input v-model="nuevoForm.telefono" placeholder="+56 9 1234 5678" />
            </div>
          </div>

          <!-- Email -->
          <div class="formRow">
            <label>Email <span class="lbl-req">*</span></label>
            <input v-model="nuevoForm.email" type="email" placeholder="correo@ejemplo.cl" />
          </div>

          <!-- Fecha nacimiento / Nacionalidad -->
          <div class="formGrid2">
            <div class="formRow">
              <label>Fecha de Nacimiento</label>
              <input v-model="nuevoForm.fecha_nacimiento" type="date" />
            </div>
            <div class="formRow">
              <label>Nacionalidad</label>
              <input v-model="nuevoForm.nacionalidad" placeholder="Chilena" />
            </div>
          </div>

          <!-- Dirección -->
          <div class="formRow">
            <label>Dirección</label>
            <input v-model="nuevoForm.direccion" placeholder="Ej: Av. Providencia 1234, Santiago" />
          </div>

          <!-- Cargo / Profesión -->
          <div class="formGrid2">
            <div class="formRow">
              <label>Cargo <span class="lbl-req">*</span></label>
              <input v-model="nuevoForm.cargo" placeholder="Ej: Director de Arte" />
            </div>
            <div class="formRow">
              <label>Profesión / Título</label>
              <input v-model="nuevoForm.profesion" placeholder="Ej: Ingeniero Civil" />
            </div>
          </div>

          <!-- Departamento -->
          <div class="formRow">
            <label>Departamento</label>
            <input v-model="nuevoForm.departamento" placeholder="Ej: Producción" />
          </div>

          <!-- Sexo -->
          <div class="formRow">
            <label>Sexo</label>
            <select v-model="nuevoForm.sexo">
              <option value="">Seleccionar...</option>
              <option value="masculino">Masculino</option>
              <option value="femenino">Femenino</option>
              <option value="otro">Otro</option>
            </select>
          </div>

          <!-- AFP / Salud -->
          <div class="formGrid2">
            <div class="formRow">
              <label>AFP</label>
              <select v-model="nuevoForm.afp">
                <option>AFP Capital</option>
                <option>AFP Cuprum</option>
                <option>AFP Habitat</option>
                <option>AFP Modelo</option>
                <option>AFP PlanVital</option>
                <option>AFP ProVida</option>
                <option>AFP Uno</option>
              </select>
            </div>
            <div class="formRow">
              <label>Sistema de Salud</label>
              <select v-model="nuevoForm.sistema_salud">
                <option>FONASA</option>
                <option>Isapre</option>
              </select>
            </div>
          </div>

          <!-- Isapre: campos adicionales cuando se selecciona Isapre -->
          <div v-if="nuevoForm.sistema_salud === 'Isapre'" class="formGrid2">
            <div class="formRow">
              <label>Isapre <span class="lbl-opcional">(opcional)</span></label>
              <select v-model="nuevoForm.isapre_nombre">
                <option value="">Seleccionar Isapre...</option>
                <option>Banmédica</option>
                <option>Colmena</option>
                <option>Cruz Blanca</option>
                <option>Consalud</option>
                <option>MásVida</option>
                <option>Esencial</option>
                <option>Vida Tres</option>
              </select>
            </div>
            <div class="formRow">
              <label>Monto pactado (UF) <span class="lbl-opcional">(opcional)</span></label>
              <input v-model="nuevoForm.isapre_monto_uf" type="number" step="0.01" min="0" placeholder="Ej: 3.50" />
            </div>
          </div>

          <!-- Estado -->
          <div class="formRow">
            <label>Estado</label>
            <select v-model="nuevoForm.estado">
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </div>

        </div>
        <div class="modalBox__footer">
          <button class="btn btn-secondary" @click="showModalNuevo = false">Cancelar</button>
          <button class="btn btn-primary" :disabled="guardandoTrabajador || !nuevoForm.nombre || !nuevoForm.apellido || !nuevoForm.rut || !nuevoForm.email || !nuevoForm.cargo" @click="guardarTrabajador">
            {{ guardandoTrabajador ? 'Guardando...' : 'Crear Trabajador' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- ── Overlay para cerrar menús al click fuera ──────────────────────────── -->
  <div v-if="menuOpenId" class="menu-backdrop" @click="closeMenu"></div>

  <!-- ── Modal Confirmar Eliminación ──────────────────────────────────────── -->
  <Teleport to="body">
    <div v-if="confirmEliminar.show" class="modalOverlay" @click.self="confirmEliminar.show = false">
      <div class="modalBox modalBox--sm">
        <div class="modalBox__header">
          <h3>Eliminar persona</h3>
          <button class="btnClose" @click="confirmEliminar.show = false">✕</button>
        </div>
        <div class="modalBox__body" style="text-align:center; padding: 24px 32px;">
          <div style="font-size:40px; margin-bottom:12px;">🗑️</div>
          <p style="font-weight:600; margin-bottom:6px;">
            ¿Eliminar a <strong>{{ confirmEliminar.trabajador?.nombre }} {{ confirmEliminar.trabajador?.apellido }}</strong>?
          </p>
          <p style="color:var(--text-muted, #888); font-size:13px; margin-bottom:0;">
            Esta persona no tiene historia registrada.<br>
            La eliminación es <strong>definitiva</strong> y no se puede deshacer.
          </p>
        </div>
        <div class="modalBox__footer">
          <button class="btn btn-secondary" @click="confirmEliminar.show = false">Cancelar</button>
          <button class="btn btn-danger" :disabled="eliminandoTrabajador" @click="confirmarEliminar">
            {{ eliminandoTrabajador ? 'Eliminando...' : 'Eliminar definitivamente' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>

</template>

<style scoped>
/* ── Contenedor principal ────────────────────────────────────────────────── */
.rrhhPage {
  height: 100%;
  min-height: 0;
  width: 100%;
  padding: 24px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;
  background: var(--neutral-background-darker, #f8fafc);
}

/* ── Header interno ──────────────────────────────────────────────────────── */
.rrhhPage__header { display: flex; align-items: center; justify-content: space-between; }
.rrhhPage__header-right { display: flex; gap: 10px; }
.rrhhPage__title {
  font-size: 20px; font-weight: 800;
  color: var(--neutral-text-title, #111827);
  margin: 0;
}
.rrhhPage__subtitle {
  font-size: 12px; color: var(--neutral-text-caption, #6b7280); margin-left: 10px;
}

/* ── Filtros ─────────────────────────────────────────────────────────────── */
.rrhhPage__filters { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }

.filterInput {
  display: flex; align-items: center; gap: 6px;
  background: var(--neutral-background-default, #ffffff);
  border: 1.5px solid rgba(255,255,255,0.1);
  border-radius: 8px; padding: 0 12px; height: 34px;
  transition: border-color .15s;
}
.filterInput:focus-within { border-color: #3ac7a5; }
.filterInput input {
  background: transparent; border: none; outline: none;
  font-family: Nunito; font-size: 13px; color: var(--neutral-text-title, #111827); width: 180px;
}
.filterInput span { color: var(--neutral-text-caption, #6b7280); font-size: 14px; }

/* Filtro mes */
.filterInput--mes { min-width: 130px; }
.filterInput--mes input[type="month"] {
  background: transparent; border: none; outline: none;
  font-family: Nunito; font-size: 13px; color: var(--neutral-text-title, #111827);
  width: 120px; cursor: pointer;
  color-scheme: dark;
}

.chip {
  height: 32px; padding: 0 14px; border-radius: 20px;
  font-family: Nunito; font-size: 12px; font-weight: 600;
  color: var(--neutral-text-caption, #6b7280);
  background: transparent;
  border: 1.5px solid rgba(255,255,255,0.1);
  cursor: pointer; transition: all .15s;
}
.chip.active { background: rgba(58,199,165,0.15); color: #3ac7a5; border-color: rgba(58,199,165,0.5); }
.chip:not(.active):hover { background: rgba(255,255,255,0.05); color: var(--neutral-text-title, #111827); border-color: rgba(255,255,255,0.18); }

/* ── Tabla container ─────────────────────────────────────────────────────── */
.rrhhPage__table-wrap {
  flex: 1; min-height: 0;
  overflow-y: auto;
  border-radius: 14px;
  border: 1.5px solid rgba(255,255,255,0.09);
  background: var(--neutral-background-default, #ffffff);
  box-shadow: 0 2px 16px rgba(0,0,0,0.25);
}

/* Scrollbar del wrap */
.rrhhPage__table-wrap::-webkit-scrollbar { width: 6px; }
.rrhhPage__table-wrap::-webkit-scrollbar-track { background: transparent; }
.rrhhPage__table-wrap::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }

/* ── Tabla ───────────────────────────────────────────────────────────────── */
.rrhhTable { width: 100%; border-collapse: collapse; }

.rrhhTable th {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .07em; color: var(--neutral-text-caption, #6b7280);
  padding: 12px 16px;
  border-bottom: 1.5px solid rgba(255,255,255,0.09);
  text-align: left; white-space: nowrap;
  background: rgba(10,18,26,0.4);
  position: sticky; top: 0; z-index: 1;
}

.rrhhTable td {
  font-size: 13px; color: var(--neutral-text-title, #1f2937);
  padding: 13px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  vertical-align: middle;
}

.rrhhTable tbody tr:last-child td { border-bottom: none; }

.rrhhTable__row { cursor: pointer; transition: background .12s; }
.rrhhTable__row:hover td {
  background: rgba(58,199,165,0.06);
}

/* ── Celda Avatar ────────────────────────────────────────────────────────── */
.avatar {
  width: 34px; height: 34px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 800; color: #fff;
  background: #2a9d8f;        /* color explícito, no variable */
  flex-shrink: 0;
}

/* ── Celda Nombre ────────────────────────────────────────────────────────── */
.cellName { display: flex; flex-direction: column; gap: 2px; }
.cellName .name  { font-weight: 700; font-size: 13px; color: var(--neutral-text-title, #111827); }
.cellName .email { font-size: 11px; color: var(--neutral-text-caption, #6b7280); }

/* ── Badges Contrato ─────────────────────────────────────────────────────── */
.tagContrato {
  display: inline-flex; align-items: center;
  padding: 3px 10px; border-radius: 20px;
  font-size: 11px; font-weight: 700;
}
/* colores explícitos — no depender de variables transparentes */
.tagContrato.indefinido  { background: rgba(58,199,165,0.15);  color: #3ac7a5; }
.tagContrato.proyecto    { background: rgba(133,140,240,0.18); color: #a78bfa; }
.tagContrato.plazo_fijo  { background: rgba(251,191,36,0.15);  color: #fbbf24; }
.tagContrato.honorarios  { background: rgba(249,115,22,0.15);  color: #fb923c; }
.tagContrato.part_time   { background: rgba(96,165,250,0.15);  color: #60a5fa; }

/* ── Badge Estado persona ────────────────────────────────────────────────── */
.tagEstado {
  display: inline-flex; align-items: center;
  padding: 3px 10px; border-radius: 20px;
  font-size: 11px; font-weight: 700;
}
.tagEstado.activo    { background: rgba(74,222,128,0.14);  color: #4ade80; }
.tagEstado.inactivo  { background: rgba(156,163,175,0.14); color: var(--neutral-text-caption, #6b7280); }
.tagEstado.pendiente { background: rgba(251,191,36,0.14);  color: #fbbf24; }

/* ── Badge estado de contrato (semáforo) ─────────────────────────────────── */
.tagContrato-v {
  display: inline-flex; align-items: center;
  padding: 3px 9px; border-radius: 20px;
  font-size: 11px; font-weight: 700;
  border: 1px solid transparent;
}
.tagContrato-v.vigente-c     { background: rgba(58,199,165,0.1);   color: #3ac7a5; border-color: rgba(58,199,165,0.25); }
.tagContrato-v.indefinido-c  { background: rgba(58,199,165,0.1);   color: #3ac7a5; border-color: rgba(58,199,165,0.25); }
.tagContrato-v.por-vencer-c  { background: rgba(244,162,97,0.12);  color: #f4a261; border-color: rgba(244,162,97,0.3); }
.tagContrato-v.vencido-c     { background: rgba(239,68,68,0.1);    color: #f87171; border-color: rgba(239,68,68,0.25); }
.tagContrato-v.sin-contrato  { background: rgba(107,114,128,0.1);  color: var(--neutral-text-subtitle, #6b7280); border-color: rgba(107,114,128,0.2); }

/* ── Label sueldo contextual ─────────────────────────────────────────────── */
.sueldo-lbl { font-size: 13px; font-weight: 700; color: var(--neutral-text-title, #111827); }
.sueldo-lbl.lbl-var { color: var(--neutral-text-caption, #6b7280); font-style: italic; font-weight: 500; font-size: 12px; }
.sueldo-lbl.lbl-nd  { color: var(--neutral-text-subtitle, #6b7280); font-style: italic; font-weight: 500; font-size: 12px; }

/* ── Celdas especiales ───────────────────────────────────────────────────── */
.muted   { color: var(--neutral-text-caption, #6b7280) !important; }
.bold    { font-weight: 700; }
.vacaciones { font-weight: 600; color: var(--neutral-text-caption, #6b7280); }
.vacaciones.warn { color: #f59e0b; }
.emptyRow { text-align: center; color: var(--neutral-text-caption, #6b7280); padding: 48px; font-size: 14px; }

/* ── Botón tres puntos ───────────────────────────────────────────────────── */
.btnDots {
  background: transparent;
  border: 1.5px solid rgba(255,255,255,0.1);
  border-radius: 6px; padding: 3px 10px;
  cursor: pointer; color: var(--neutral-text-caption, #6b7280);
  font-size: 15px; letter-spacing: 1px;
  transition: all .12s;
}
.btnDots:hover { background: rgba(255,255,255,0.06); color: var(--neutral-text-title, #111827); border-color: rgba(255,255,255,0.2); }

/* ── Menú contextual de fila ─────────────────────────────────────────────── */
.td-menu { position: relative; width: 48px; text-align: center; }
.row-menu {
  position: absolute; right: 0; top: calc(100% + 4px); z-index: 200;
  background: #1e2229; border: 1px solid rgba(255,255,255,0.12);
  border-radius: 10px; padding: 4px; min-width: 190px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
}
.row-menu__item {
  display: block; width: 100%; text-align: left;
  background: transparent; border: none; border-radius: 7px;
  padding: 8px 12px; font-size: 13px; font-family: Nunito;
  color: #e2e8f0; cursor: pointer; transition: background .1s;
}
.row-menu__item:hover { background: rgba(255,255,255,0.08); }
.row-menu__item:disabled { opacity: 0.45; cursor: default; }
.row-menu__item--danger { color: #f87171; }
.row-menu__item--danger:hover { background: rgba(248,113,113,0.12); }
.row-menu__item--warn { color: #fb923c; }
.row-menu__item--warn:hover { background: rgba(251,146,60,0.12); }
.row-menu__sep { height: 1px; background: rgba(255,255,255,0.08); margin: 4px 0; }
.row-menu__hint {
  display: block; padding: 4px 12px 6px; font-size: 11px;
  color: var(--neutral-text-subtitle, #6b7280); font-style: italic;
}
.menu-backdrop {
  position: fixed; inset: 0; z-index: 199;
}

/* ── Buttons ─────────────────────────────────────────────────────────────── */
.btn {
  display: inline-flex; align-items: center; gap: 6px;
  height: 36px; padding: 0 16px; border-radius: 8px;
  font-family: Nunito; font-size: 13px; font-weight: 700;
  cursor: pointer; border: none; transition: all .15s;
  white-space: nowrap;
}
.btn-primary   { background: #2a9d8f; color: #fff; }
.btn-primary:hover { background: #238a7d; }
.btn-secondary {
  background: rgba(255,255,255,0.06);
  color: var(--neutral-text-title, #1f2937);
  border: 1.5px solid rgba(255,255,255,0.1);
}
.btn-secondary:hover { background: rgba(255,255,255,0.1); }
.btn-danger { background: #dc2626; color: #fff; }
.btn-danger:hover { background: #b91c1c; }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* ── Modal ───────────────────────────────────────────────────────────────── */
.modalOverlay {
  position: fixed; inset: 0; z-index: 9000;
  background: rgba(0,0,0,0.65);
  display: flex; align-items: center; justify-content: center;
  backdrop-filter: blur(3px);
}
.modalBox {
  background: var(--neutral-background-default, #ffffff);
  border: 1.5px solid rgba(255,255,255,0.1);
  border-radius: 16px;
  width: 560px; max-width: 95vw;
  max-height: 90vh; overflow-y: auto;
  display: flex; flex-direction: column;
  box-shadow: 0 24px 64px rgba(0,0,0,0.6);
}
.modalBox--sm { width: 420px; }
.modalBox__header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1.5px solid rgba(255,255,255,0.07);
}
.modalBox__header h3 {
  margin: 0; font-size: 17px; font-weight: 800; color: var(--neutral-text-title, #111827);
}
.btnClose {
  background: transparent; border: none; color: var(--neutral-text-caption, #6b7280);
  font-size: 16px; cursor: pointer; padding: 4px 8px; border-radius: 6px;
  transition: all .15s;
}
.btnClose:hover { background: rgba(255,255,255,0.08); color: var(--neutral-text-title, #111827); }
.modalBox__body {
  padding: 20px 24px;
  display: flex; flex-direction: column; gap: 14px;
}
.modalBox__footer {
  padding: 16px 24px;
  border-top: 1.5px solid rgba(255,255,255,0.07);
  display: flex; gap: 10px; justify-content: flex-end;
}
.formRow {
  display: flex; flex-direction: column; gap: 6px;
}
.formRow label {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .05em; color: var(--neutral-text-caption, #6b7280);
  display: flex; align-items: center; gap: 4px;
}
.lbl-req { color: #f87171; font-size: 12px; text-transform: none; }
.lbl-opcional { color: var(--neutral-text-subtitle, #6b7280); font-size: 10px; font-weight: 500; text-transform: none; letter-spacing: 0; font-style: italic; }
.formRow input,
.formRow select {
  background: var(--neutral-background-darker, #f8fafc);
  border: 1.5px solid rgba(255,255,255,0.1);
  border-radius: 8px; padding: 9px 12px;
  font-family: Nunito; font-size: 13px; color: var(--neutral-text-title, #111827);
  outline: none; transition: border-color .15s;
}
.formRow input:focus,
.formRow select:focus { border-color: #3ac7a5; }
.formRow select option { background: var(--neutral-background-default, #ffffff); }
.formGrid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

/* ── Foto de perfil en modal ─────────────────────────────────────────────── */
.foto-upload-row {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 4px;
}
.foto-preview-circle {
  width: 72px; height: 72px;
  border-radius: 50%;
  background: var(--neutral-background-default, #ffffff);
  border: 2px dashed rgba(58,199,165,0.4);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
  transition: border-color .15s;
}
.foto-preview-circle:hover { border-color: #3ac7a5; }
.foto-img { width: 100%; height: 100%; object-fit: cover; }
.foto-placeholder {
  font-size: 26px;
  color: var(--neutral-text-caption, #6b7280);
  font-weight: 700;
}
.foto-overlay {
  position: absolute; inset: 0;
  background: rgba(0,0,0,0.55);
  display: flex; align-items: center; justify-content: center;
  font-size: 20px;
  opacity: 0;
  transition: opacity .15s;
}
.foto-preview-circle:hover .foto-overlay { opacity: 1; }
.foto-upload-hint p {
  font-size: 13px; font-weight: 700; color: var(--neutral-text-title, #111827); margin: 0 0 2px;
}
.foto-upload-hint small {
  font-size: 11px; color: var(--neutral-text-subtitle, #6b7280);
}

/* ── Toggle de vista ──────────────────────────────────────────────────────── */
.filter-sep {
  width: 1px; height: 24px;
  background: rgba(255,255,255,0.12);
  margin: 0 4px;
  align-self: center;
}

.view-toggle {
  display: flex;
  background: rgba(255,255,255,0.05);
  border: 1.5px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  overflow: hidden;
  gap: 0;
}
.view-btn {
  display: flex; align-items: center; gap: 5px;
  padding: 0 12px; height: 32px;
  font-family: Nunito; font-size: 12px; font-weight: 600;
  color: var(--neutral-text-subtitle, #6b7280);
  background: transparent;
  border: none; cursor: pointer;
  transition: all .15s;
}
.view-btn + .view-btn { border-left: 1px solid rgba(255,255,255,0.08); }
.view-btn:hover { color: var(--neutral-text-title, #111827); background: rgba(255,255,255,0.05); }
.view-btn.active { color: #3ac7a5; background: rgba(58,199,165,0.1); }
.view-btn .u { font-size: 13px; }
.view-count {
  background: rgba(58,199,165,0.15); color: #3ac7a5;
  font-size: 9.5px; font-weight: 800; padding: 1px 6px;
  border-radius: 20px; margin-left: 2px;
}

/* ── Grid de proyectos ────────────────────────────────────────────────────── */
.proyectos-grid {
  flex: 1; min-height: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 20px;
  overflow-y: auto;
  padding-bottom: 16px;
}
.proyectos-grid::-webkit-scrollbar { width: 6px; }
.proyectos-grid::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }

/* ── Tarjeta de proyecto ─────────────────────────────────────────────────── */
.proyecto-card {
  background: var(--neutral-background-default, #ffffff);
  border: 1.5px solid rgba(255,255,255,0.08);
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: border-color .15s, box-shadow .15s;
}
.proyecto-card:hover {
  border-color: rgba(58,199,165,0.3);
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
}

/* Cover */
.proyecto-card__cover {
  height: 140px;
  background: linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%);
  background-size: cover;
  background-position: center;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}
.proyecto-card__cover-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.55) 100%);
  display: flex; align-items: flex-start; justify-content: flex-end;
  padding: 10px;
  opacity: 0; transition: opacity .18s;
}
.proyecto-card:hover .proyecto-card__cover-overlay { opacity: 1; }

.btn-foto-up {
  display: flex; align-items: center; gap: 4px;
  background: rgba(0,0,0,0.55);
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 8px; color: var(--neutral-text-title, #1f2937);
  font-family: Nunito; font-size: 11px; font-weight: 600;
  padding: 4px 10px; cursor: pointer;
  transition: background .15s;
}
.btn-foto-up:hover { background: rgba(58,199,165,0.3); color: #fff; border-color: rgba(58,199,165,0.5); }

.proyecto-card__name-wrap {
  padding: 14px 16px 12px;
  position: relative;
}
.proyecto-card__name {
  margin: 0; font-size: 16px; font-weight: 800; color: var(--neutral-text-title, #111827);
  text-shadow: 0 1px 4px rgba(0,0,0,0.7);
}
.proyecto-card__dates {
  font-size: 11px; color: rgba(229,231,235,0.75); margin-top: 4px;
  text-shadow: 0 1px 3px rgba(0,0,0,0.6);
}

/* Stats / KPIs por proyecto */
.proyecto-card__stats {
  display: flex; align-items: center; gap: 0;
  padding: 12px 16px;
  border-top: 1px solid rgba(255,255,255,0.07);
}
.proyecto-stat {
  flex: 1;
  display: flex; flex-direction: column; gap: 3px;
}
.proyecto-stat__lbl {
  font-size: 10px; color: var(--neutral-text-subtitle, #6b7280);
  text-transform: uppercase; letter-spacing: 0.05em;
}
.proyecto-stat__val {
  font-size: 16px; font-weight: 800; color: var(--neutral-text-title, #111827);
}
.proyecto-stat__val.teal   { color: #3ac7a5; }
.proyecto-stat__val.orange { color: #fb923c; }
.proyecto-stat__val.rose   { color: #f472b6; }
.proyecto-stat__sep {
  width: 1px; height: 36px; background: rgba(255,255,255,0.08); margin: 0 14px;
}

/* Barra de tipos + contador */
.proyecto-card__bar-wrap {
  border-top: 1px solid rgba(255,255,255,0.07);
}
.proyecto-card__bar {
  display: flex; height: 4px; overflow: hidden;
}
.proyecto-card__count {
  display: flex; align-items: center; gap: 5px;
  padding: 7px 16px 6px;
  font-size: 11px; font-weight: 700; color: var(--neutral-text-subtitle, #6b7280);
  letter-spacing: 0.02em;
}
.bar-seg { height: 100%; transition: opacity .15s; }
.bar-seg.indefinido  { background: #3ac7a5; }
.bar-seg.proyecto    { background: #a78bfa; }
.bar-seg.plazo_fijo  { background: #fbbf24; }
.bar-seg.honorarios  { background: #fb923c; }
.bar-seg.part_time   { background: #60a5fa; }

/* Lista de trabajadores en tarjeta */
.proyecto-card__workers {
  flex: 1;
  display: flex; flex-direction: column;
  overflow: hidden;
}
.proyecto-worker {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  cursor: pointer;
  transition: background .12s;
}
.proyecto-worker:last-child { border-bottom: none; }
.proyecto-worker:hover { background: rgba(58,199,165,0.05); }
.proyecto-worker__avatar {
  width: 32px; height: 32px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 800; color: #fff;
  background: #2a9d8f; flex-shrink: 0;
  overflow: hidden;
}
.proyecto-worker__info {
  display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0;
}
.proyecto-worker__name {
  font-size: 13px; font-weight: 700; color: var(--neutral-text-title, #111827);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.proyecto-worker__cargo {
  font-size: 11px; color: var(--neutral-text-subtitle, #6b7280);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.proyecto-worker__pills {
  display: flex; flex-direction: column; align-items: flex-end; gap: 3px; flex-shrink: 0;
}
.proyecto-empty { padding: 20px; text-align: center; color: #4b5563; font-size: 13px; }

/* ── KPIs pie de página ──────────────────────────────────────────────────── */
.footer-kpis {
  display: flex;
  align-items: center;
  gap: 0;
  background: var(--neutral-background-default, #ffffff);
  border: 1.5px solid var(--neutral-border-light, #e2e8f0);
  border-radius: 14px;
  padding: 0 24px;
  height: 68px;
  flex-shrink: 0;
}
.footer-kpi {
  display: flex; flex-direction: column; gap: 3px;
  flex: 1;
  padding: 0 20px;
}
.footer-kpi:first-child { padding-left: 0; }
.footer-kpi__label {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .06em; color: var(--neutral-text-subtitle, #6b7280);
}
.footer-kpi__val {
  font-size: 20px; font-weight: 900; color: #3ac7a5;
  white-space: nowrap; line-height: 1.1;
}
.footer-kpi__val--orange { color: #f4a261; }
.footer-kpi__val--rose   { color: #f472b6; }
.footer-kpi__sub {
  font-size: 10px; color: #4b5563;
}
.footer-kpi__sep {
  width: 1px; height: 36px;
  background: var(--neutral-border-light, #e2e8f0);
  flex-shrink: 0;
}
.footer-kpi__badge {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .05em;
  color: #4b5563;
  border: 1px solid var(--neutral-border-light, #e2e8f0);
  border-radius: 6px; padding: 3px 8px;
  flex-shrink: 0; margin-left: 8px;
}
.orphan-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(240, 180, 0, 0.08);
  border: 1px solid rgba(240, 180, 0, 0.25);
  border-radius: 10px;
  padding: 12px 16px;
  margin-bottom: 16px;
  font-size: 13px;
  color: #d1d5db;
  flex-wrap: wrap;
}
.orphan-banner__icon { color: #f59e0b; font-size: 16px; flex-shrink: 0; }
.orphan-banner__text { flex: 1; min-width: 200px; }
.orphan-banner__text strong { color: #fbbf24; }
.orphan-banner__btn {
  padding: 7px 14px;
  background: rgba(240, 180, 0, 0.15);
  border: 1px solid rgba(240, 180, 0, 0.3);
  border-radius: 7px;
  color: #fbbf24;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
.orphan-banner__btn:hover:not(:disabled) { background: rgba(240, 180, 0, 0.25); }
.orphan-banner__btn:disabled { opacity: 0.6; cursor: not-allowed; }
.orphan-banner__dismiss {
  background: none;
  border: none;
  color: #6b7280;
  cursor: pointer;
  font-size: 14px;
  padding: 4px;
  flex-shrink: 0;
}
.spin-sm {
  width: 12px; height: 12px;
  border: 2px solid rgba(251,191,36,0.3);
  border-top-color: #fbbf24;
  border-radius: 50%;
  animation: spinSm 0.7s linear infinite;
  display: inline-block;
}
@keyframes spinSm { to { transform: rotate(360deg); } }

/* ── Mobile filters & cards ───────────────────────────────────────────────── */
.mobile-filters { display: none; gap: 8px; }
.mobile-cards   { display: none; flex-direction: column; gap: 8px; padding: 0 0 16px; }
.mobile-empty   { padding: 32px; text-align: center; color: #6b7280; font-size: 13px; }

.mobile-select {
  height: 34px; padding: 0 10px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px;
  color: var(--neutral-text-title, #e5e7eb);
  font-size: 12px; font-family: inherit; font-weight: 600;
  cursor: pointer; outline: none;
  flex: 1;
}
.mobile-select option { background: #1a2332; color: #e5e7eb; }

.mobile-card {
  display: flex; align-items: center; gap: 12px;
  background: var(--neutral-background-default, #0f1923);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 12px;
  padding: 12px 14px;
  cursor: pointer;
  transition: border-color .15s, background .15s;
  -webkit-tap-highlight-color: transparent;
}
.mobile-card:active { background: rgba(58,199,165,0.06); border-color: rgba(58,199,165,0.3); }

.mobile-card__avatar {
  width: 40px; height: 40px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 800; color: #fff;
  flex-shrink: 0; overflow: hidden;
  background: #2a9d8f;
}
.mobile-card__info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.mobile-card__name { font-size: 14px; font-weight: 700; color: var(--neutral-text-title, #e5e7eb); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mobile-card__cargo { font-size: 11px; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mobile-card__pills { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px; }
.mobile-card__sueldo { font-size: 12px; font-weight: 700; color: #3ac7a5; flex-shrink: 0; text-align: right; }

@media (max-width: 767px) {
  /* Filters */
  .desktop-only { display: none !important; }
  .mobile-filters { display: flex; width: 100%; }

  /* Cards vs tabla */
  .mobile-cards  { display: flex; }
  .desktop-table { display: none; }

  /* Header compacto */
  .rrhhPage__header { flex-direction: column; align-items: flex-start; gap: 10px; }
  .rrhhPage__header-right { width: 100%; display: flex; gap: 8px; }
  .rrhhPage__header-right .btn { flex: 1; justify-content: center; font-size: 12px; padding: 8px 10px; }

  /* Filtros en columna en 2 filas */
  .rrhhPage__filters {
    flex-wrap: wrap;
    gap: 8px;
  }
  .filterInput { flex: 1; min-width: 0; }
  .filterInput--mes { flex: 0 0 auto; }
  .view-toggle { width: 100%; }
  .view-btn { flex: 1; justify-content: center; }

  /* KPIs pie: scroll horizontal */
  .footer-kpis {
    overflow-x: auto;
    padding: 0 16px;
    gap: 0;
    height: auto;
    padding-top: 10px;
    padding-bottom: 10px;
  }
  .footer-kpi { padding: 0 14px; min-width: 100px; }
  .footer-kpi__val { font-size: 16px; }
}
</style>
