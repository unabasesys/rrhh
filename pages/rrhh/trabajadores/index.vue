<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import useGlobalStore from "@/stores/global";
import useRrhhStore from "@/stores/rrhh";

const globalStore = useGlobalStore();
const rrhhStore   = useRrhhStore();

definePageMeta({
  name: "rrhh-trabajadores",
  layout: 'rrhh',
  middleware: ["auth"],
});

useHead({ title: "Personas – RRHH" });

// ── Estado local ──────────────────────────────────────────────────────────────
const busqueda       = ref("");
const filtroEstado   = ref("activo");
const filtroContrato = ref("todos");
const filtroMes      = ref(new Date().toISOString().slice(0, 7)); // YYYY-MM

// Vista por defecto persistida en localStorage (feature 8)
const _vistaGuardada = (() => { try { return localStorage.getItem('rrhh_vista_defecto') || 'lista' } catch { return 'lista' } })()
const vistaActual    = ref(_vistaGuardada); // "lista" | "fijos" | "proyectos"
watch(vistaActual, (v) => { try { localStorage.setItem('rrhh_vista_defecto', v) } catch {} })

// Filtro de estado en vista proyectos (feature 7)
const filtroEstadoProyecto = ref('todos'); // 'todos' | 'activo' | 'por_vencer' | 'vencido' | 'cerrado'

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

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtCLP = (n) =>
  n ? `$${Math.round(n).toLocaleString("es-CL")}` : "$0";

const calcVacaciones = (t) => {
  if (!t.fecha_ingreso) return 0;
  const meses =
    (new Date() - new Date(t.fecha_ingreso)) / (1000 * 60 * 60 * 24 * 30.44);
  return Math.floor((meses / 12) * 15);
};

// ── Modal Nuevo Trabajador ────────────────────────────────────────────────────
const showModalNuevo     = ref(false);
const guardandoTrabajador = ref(false);
const fotoPreview        = ref(null);  // base64 preview
const fotoFileRef        = ref(null);  // <input type="file"> ref

const nuevoFormDefaults = () => ({
  nombre: '', apellido: '', email: '', telefono: '', rut: '',
  cargo: '', departamento: '', profesion: '',
  fecha_nacimiento: '', nacionalidad: 'Chilena',
  direccion: '',
  afp: 'AFP Capital', sistema_salud: 'FONASA',
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
  const contratos   = rrhhStore.contratos   || [];
  const trabajadores = rrhhStore.trabajadores || [];

  // Contrato vigente por trabajador
  const vigenteMap = {};
  contratos.forEach(c => {
    if (!c.trabajador_id) return;
    const est = c.estado_contrato || c.estado;
    if (est === 'activo' || est === 'vigente') {
      if (!vigenteMap[c.trabajador_id]) vigenteMap[c.trabajador_id] = c;
    }
  });

  const hoy = new Date();
  const lim30 = new Date(); lim30.setDate(lim30.getDate() + 30);

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
        total_costo: 0,
        total_liquido: 0,
        total_imposiciones: 0,
        // conteo de estados para feature 6 / 7
        count_activo: 0,
        count_por_vencer: 0,
        count_vencido: 0,
        count_cerrado: 0,
      };
    }
    grupos[key].trabajadores.push(t);

    // Estado del trabajador en este grupo
    if (t.estado === 'inactivo') {
      grupos[key].count_cerrado++;
    } else if (c && c.fecha_termino) {
      const fin = new Date(c.fecha_termino + 'T12:00:00');
      if (fin < hoy)      { grupos[key].count_vencido++; }
      else if (fin <= lim30) { grupos[key].count_por_vencer++; }
      else                { grupos[key].count_activo++; }
    } else {
      grupos[key].count_activo++;
    }

    if (c) {
      grupos[key].contratos.push(c);
      const fi = c.fecha_inicio || c.fecha_ingreso;
      const ft = c.fecha_termino;
      if (fi && (!grupos[key].fecha_inicio || fi < grupos[key].fecha_inicio))  grupos[key].fecha_inicio = fi;
      if (ft && (!grupos[key].fecha_termino || ft > grupos[key].fecha_termino)) grupos[key].fecha_termino = ft;
      const sueldo = c.sueldo_base || 0;
      const mov    = c.movilizacion || 0;
      const col    = c.colacion || 0;
      const base   = sueldo + mov + col;
      const tipo   = c.tipo_contrato || '';
      const factor = (tipo === 'indefinido' || tipo === 'plazo_fijo') ? 1.2 : 1;
      grupos[key].total_costo += Math.round(base * factor);
      // Líquido estimado: sueldo_base neto (~18.44% desc trabajador) + asignaciones
      if (tipo !== 'honorarios') {
        grupos[key].total_liquido       += Math.round(sueldo * 0.8156 + mov + col);
        // Imposiciones: AFP empleado 11.44% + salud 7% + cesantía empleador 2.4% + seg. laboral 0.93%
        grupos[key].total_imposiciones  += Math.round(sueldo * 0.2077);
      } else {
        // Honorarios reciben bruto (pagan sus propias imposiciones)
        grupos[key].total_liquido       += Math.round(sueldo);
      }
    }
  });

  return Object.values(grupos).sort((a, b) => {
    if (a.key === '__sin_proyecto__') return 1;
    if (b.key === '__sin_proyecto__') return -1;
    return a.nombre.localeCompare(b.nombre);
  });
});

// ── Vista proyectos filtrada por estado (feature 7) ───────────────────────────
const trabajadoresPorProyectoFiltrado = computed(() => {
  const grupos = trabajadoresPorProyecto.value;
  if (filtroEstadoProyecto.value === 'todos') return grupos;
  return grupos.filter(g => {
    if (filtroEstadoProyecto.value === 'activo')     return g.count_activo > 0;
    if (filtroEstadoProyecto.value === 'por_vencer') return g.count_por_vencer > 0;
    if (filtroEstadoProyecto.value === 'vencido')    return g.count_vencido > 0;
    if (filtroEstadoProyecto.value === 'cerrado')    return g.count_cerrado > 0;
    return true;
  });
});

// ── Resumen global proyectos para fila rosa (feature 6) ───────────────────────
const resumenProyectos = computed(() => {
  let activos = 0, por_vencer = 0, vencidos = 0, cerrados = 0;
  trabajadoresPorProyecto.value.forEach(g => {
    activos    += g.count_activo;
    por_vencer += g.count_por_vencer;
    vencidos   += g.count_vencido;
    cerrados   += g.count_cerrado;
  });
  const total = activos + por_vencer + vencidos + cerrados;
  return { total, activos, por_vencer, vencidos, cerrados };
});

// ── KPIs de nómina (features 2 y 3) ──────────────────────────────────────────
const kpiTotalPagar = computed(() => {
  const liqs = rrhhStore.liquidaciones || [];
  const mes  = filtroMes.value;
  const liqs_mes = liqs.filter(l => {
    const p = l.periodo || l.mes || l.fecha_periodo || '';
    return p.startsWith(mes);
  });
  if (liqs_mes.length) {
    return { valor: liqs_mes.reduce((s, l) => s + (l.liquido_a_pagar || l.liquido || 0), 0), estimado: false };
  }
  // Fallback: suma estimada desde contratos activos
  const activos = (rrhhStore.trabajadores || []).filter(t => t.estado === 'activo' || t.estado === 'Activo');
  const val = activos.reduce((s, t) => {
    const c = contratoVigenteMap.value[t._id || t.id];
    const tipo = (c?.tipo_contrato || '').toLowerCase();
    if (tipo === 'honorarios') return s + (c?.sueldo_base || 0);
    const sueldo = c?.sueldo_base || 0;
    const mov    = c?.movilizacion || 0;
    const col    = c?.colacion || 0;
    return s + Math.round(sueldo * 0.8156 + mov + col);
  }, 0);
  return { valor: val, estimado: true };
});

const kpiImposiciones = computed(() => {
  const liqs = rrhhStore.liquidaciones || [];
  const mes  = filtroMes.value;
  const liqs_mes = liqs.filter(l => {
    const p = l.periodo || l.mes || l.fecha_periodo || '';
    return p.startsWith(mes);
  });
  if (liqs_mes.length) {
    const val = liqs_mes.reduce((s, l) => {
      const afp   = l.afp_empleado   || l.cotizacion_afp   || l.afp    || 0;
      const salud = l.cotizacion_salud || l.salud            || 0;
      const ces   = l.cesantia_empleador || l.cesantia       || 0;
      return s + afp + salud + ces;
    }, 0);
    return { valor: val, estimado: false };
  }
  // Fallback: ~20.77% of sueldo_base activos
  const activos = (rrhhStore.trabajadores || []).filter(t => t.estado === 'activo' || t.estado === 'Activo');
  const val = activos.reduce((s, t) => {
    const c    = contratoVigenteMap.value[t._id || t.id];
    const tipo = (c?.tipo_contrato || '').toLowerCase();
    if (tipo === 'honorarios') return s; // no imposiciones empleador para honorarios
    return s + Math.round((c?.sueldo_base || 0) * 0.2077);
  }, 0);
  return { valor: val, estimado: true };
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
  globalStore.loading = true;
  globalStore.updatedTitle("Personas");
  globalStore.namePage = "RRHH";
  globalStore.updatedBreadcrumb([{ name: "RRHH", path: "/rrhh/trabajadores" }, { name: "Personas", path: "/rrhh/trabajadores" }]);
  try {
    const saved = localStorage.getItem('rrhh_fotos_proyectos');
    if (saved) fotoProyecto.value = JSON.parse(saved);
  } catch {}
  try {
    await Promise.all([
      rrhhStore.getTrabajadores(),
      rrhhStore.getContratos(),
      rrhhStore.getLiquidaciones?.(),
    ]);
  } finally {
    globalStore.loading = false;
  }
});

onUnmounted(() => globalStore.cleanHeader());
</script>

<template>
  <div class="rrhhPage">

    <!-- Header -->
    <div class="rrhhPage__header">
      <div class="rrhhPage__header-left">
        <h2 class="rrhhPage__title">Personas</h2>
        <span class="rrhhPage__subtitle">
          {{ rrhhStore.trabajadoresActivos.length }} activos · {{ rrhhStore.trabajadores.length }} total
        </span>
      </div>
      <div class="rrhhPage__header-right">
        <button class="btn btn-secondary" disabled>Importar Contacto</button>
        <button class="btn btn-primary" @click="abrirNuevoTrabajador">
          <span class="u u-plus"></span> Nueva Persona
        </button>
      </div>
    </div>

    <!-- Filtros + Toggle Vista -->
    <div class="rrhhPage__filters">
      <div class="filterInput">
        <span class="u u-search"></span>
        <input v-model="busqueda" placeholder="Buscar trabajador..." />
      </div>
      <!-- Filtro mes -->
      <div class="filterInput filterInput--mes">
        <span class="u u-calendar" style="font-size:13px"></span>
        <input type="month" v-model="filtroMes" />
      </div>

      <button :class="['chip', filtroEstado === 'todos' && 'active']"    @click="filtroEstado = 'todos'">Todos</button>
      <button :class="['chip', filtroEstado === 'activo' && 'active']"   @click="filtroEstado = 'activo'">Activos</button>
      <button :class="['chip', filtroEstado === 'inactivo' && 'active']" @click="filtroEstado = 'inactivo'">Inactivos</button>
      <button :class="['chip', filtroContrato === 'indefinido' && 'active']" @click="filtroContrato = filtroContrato === 'indefinido' ? 'todos' : 'indefinido'">Indefinido</button>
      <button :class="['chip', filtroContrato === 'proyecto' && 'active']"   @click="filtroContrato = filtroContrato === 'proyecto' ? 'todos' : 'proyecto'">Por Proyecto</button>

      <!-- Separador -->
      <div class="filter-sep"></div>

      <!-- Toggle de vista — 3 opciones (view-btn activo = guardado como defecto) -->
      <div class="view-toggle">
        <button :class="['view-btn', vistaActual === 'lista' && 'active']" @click="vistaActual = 'lista'" title="Lista completa · Clic para guardar como vista por defecto">
          <span class="u u-list"></span>
          <span>Lista</span>
        </button>
        <button :class="['view-btn', vistaActual === 'fijos' && 'active']" @click="vistaActual = 'fijos'" title="Solo fijos · Clic para guardar como vista por defecto">
          <span class="u u-usuarios"></span>
          <span>Fijos</span>
          <span v-if="trabajadoresFiltradosFijos.length" class="view-count">{{ trabajadoresFiltradosFijos.length }}</span>
        </button>
        <button :class="['view-btn', vistaActual === 'proyectos' && 'active']" @click="vistaActual = 'proyectos'" title="Vista por proyectos · Clic para guardar como vista por defecto">
          <span class="u u-grid"></span>
          <span>Proyectos</span>
        </button>
      </div>
    </div>

    <!-- KPIs de nómina (features 2 y 3) -->
    <div class="kpi-row">
      <div class="kpi-card">
        <div class="kpi-card__icon">💰</div>
        <div class="kpi-card__body">
          <div class="kpi-card__val">{{ fmtCLP(kpiTotalPagar.valor) }}</div>
          <div class="kpi-card__label">
            Total a pagar
            <span v-if="kpiTotalPagar.estimado" class="kpi-est">(estimado)</span>
          </div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card__icon">🏦</div>
        <div class="kpi-card__body">
          <div class="kpi-card__val kpi-card__val--orange">{{ fmtCLP(kpiImposiciones.valor) }}</div>
          <div class="kpi-card__label">
            Imposiciones Previred
            <span v-if="kpiImposiciones.estimado" class="kpi-est">(estimado)</span>
          </div>
        </div>
      </div>
      <div class="kpi-card kpi-card--action">
        <div class="kpi-card__icon">📋</div>
        <div class="kpi-card__body">
          <div class="kpi-card__val kpi-card__val--sm">{{ filtroMes }}</div>
          <div class="kpi-card__label">Período seleccionado</div>
        </div>
        <button class="btn btn-rose" @click.stop title="Cerrar Nómina – próximamente">
          Cerrar Nómina
        </button>
      </div>
    </div>

    <!-- ── Vista por Proyectos ──────────────────────────────────────────── -->
    <div v-if="vistaActual === 'proyectos'" class="proyectos-section">
      <input ref="fotoFileRefProyecto" type="file" accept="image/*" style="display:none" @change="onFotoProyectoChange" />

      <!-- Fila resumen rosa (feature 6) -->
      <div class="resumen-rosa">
        <div class="resumen-rosa__stat">
          <span class="resumen-rosa__val">{{ resumenProyectos.total }}</span>
          <span class="resumen-rosa__label">Total</span>
        </div>
        <div class="resumen-rosa__sep"></div>
        <div class="resumen-rosa__stat">
          <span class="resumen-rosa__val resumen-rosa__val--green">{{ resumenProyectos.activos }}</span>
          <span class="resumen-rosa__label">Activos</span>
        </div>
        <div class="resumen-rosa__stat">
          <span class="resumen-rosa__val resumen-rosa__val--orange">{{ resumenProyectos.por_vencer }}</span>
          <span class="resumen-rosa__label">Por vencer</span>
        </div>
        <div class="resumen-rosa__stat">
          <span class="resumen-rosa__val resumen-rosa__val--red">{{ resumenProyectos.vencidos }}</span>
          <span class="resumen-rosa__label">Vencidos</span>
        </div>
        <div class="resumen-rosa__stat">
          <span class="resumen-rosa__val resumen-rosa__val--gray">{{ resumenProyectos.cerrados }}</span>
          <span class="resumen-rosa__label">Cerrados</span>
        </div>
        <div class="resumen-rosa__spacer"></div>
        <!-- Filtros de estado en proyectos (feature 7) -->
        <div class="view-toggle view-toggle--sm">
          <button :class="['view-btn', filtroEstadoProyecto === 'todos' && 'active']" @click="filtroEstadoProyecto = 'todos'">Todos</button>
          <button :class="['view-btn', filtroEstadoProyecto === 'activo' && 'active']" @click="filtroEstadoProyecto = 'activo'">Activos</button>
          <button :class="['view-btn', filtroEstadoProyecto === 'por_vencer' && 'active']" @click="filtroEstadoProyecto = 'por_vencer'">Por vencer</button>
          <button :class="['view-btn', filtroEstadoProyecto === 'vencido' && 'active']" @click="filtroEstadoProyecto = 'vencido'">Vencidos</button>
          <button :class="['view-btn', filtroEstadoProyecto === 'cerrado' && 'active']" @click="filtroEstadoProyecto = 'cerrado'">Cerrados</button>
        </div>
      </div>

      <!-- Grid de tarjetas -->
      <div class="proyectos-grid">
      <div
        v-for="grupo in trabajadoresPorProyectoFiltrado"
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

        <!-- Stats (feature 5) -->
        <div class="proyecto-card__stats">
          <div class="proyecto-stat">
            <span class="proyecto-stat__val">{{ grupo.trabajadores.length }}</span>
            <div class="proyecto-stat__states">
              <span v-if="grupo.count_activo" class="ps-dot ps-dot--green">{{ grupo.count_activo }} activos</span>
              <span v-if="grupo.count_por_vencer" class="ps-dot ps-dot--orange">{{ grupo.count_por_vencer }} x vencer</span>
              <span v-if="grupo.count_vencido" class="ps-dot ps-dot--red">{{ grupo.count_vencido }} venc.</span>
            </div>
            <span class="proyecto-stat__label">Personas</span>
          </div>
          <div class="proyecto-stat">
            <span class="proyecto-stat__val teal">{{ fmtCLP(grupo.total_liquido) }}</span>
            <span class="proyecto-stat__label">Líquido / mes</span>
          </div>
          <div class="proyecto-stat">
            <span class="proyecto-stat__val proyecto-stat__val--orange">{{ fmtCLP(grupo.total_costo) }}</span>
            <span class="proyecto-stat__label">Costo empresa</span>
          </div>
          <div class="proyecto-stat" v-if="grupo.total_imposiciones">
            <span class="proyecto-stat__val proyecto-stat__val--rose">{{ fmtCLP(grupo.total_imposiciones) }}</span>
            <span class="proyecto-stat__label">Imposiciones</span>
          </div>
        </div>

        <!-- Barra visual de tipos de contrato -->
        <div class="proyecto-card__bar" v-if="grupo.contratos.length">
          <div
            v-for="(c, i) in grupo.contratos"
            :key="i"
            :class="['bar-seg', c.tipo_contrato]"
            :style="`width:${100/grupo.contratos.length}%`"
            :title="c.tipo_contrato"
          ></div>
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
      </div><!-- /proyectos-grid -->
    </div><!-- /proyectos-section -->

    <!-- ── Vista Lista completa ──────────────────────────────────────────── -->
    <div v-else-if="vistaActual === 'lista'" class="rrhhPage__table-wrap">
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
            <td class="muted">{{ t.fecha_ingreso ? new Date(t.fecha_ingreso).toLocaleDateString('es-CL', { year:'numeric', month:'short' }) : '—' }}</td>
            <td><span :class="['tagEstado', t.estado]">{{ t.estado === 'activo' ? '● Activo' : 'Inactivo' }}</span></td>
            <td>
              <span :class="['tagContrato-v', estadoContratoInfo(contratoVigente(t._id || t.id)).cls]">
                {{ estadoContratoInfo(contratoVigente(t._id || t.id)).label }}
              </span>
            </td>
            <td @click.stop><button class="btnDots" @click="$router.push(`/rrhh/trabajadores/${t._id}`)">···</button></td>
          </tr>
          <tr v-if="!trabajadoresFiltrados.length">
            <td colspan="9" class="emptyRow">No hay personas que coincidan con el filtro</td>
          </tr>
        </tbody>
      </table>
    </div>

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
            <td class="muted">{{ t.fecha_ingreso ? new Date(t.fecha_ingreso).toLocaleDateString('es-CL', { year:'numeric', month:'short' }) : '—' }}</td>
            <td :class="['vacaciones', calcVacaciones(t) >= 15 && 'warn']">{{ calcVacaciones(t) }} días</td>
            <td>
              <span :class="['tagContrato-v', estadoContratoInfo(contratoVigente(t._id || t.id)).cls]">
                {{ estadoContratoInfo(contratoVigente(t._id || t.id)).label }}
              </span>
            </td>
            <td><span :class="['tagEstado', t.estado]">{{ t.estado === 'activo' ? '● Activo' : 'Inactivo' }}</span></td>
            <td @click.stop><button class="btnDots" @click="$router.push(`/rrhh/trabajadores/${t._id}`)">···</button></td>
          </tr>
          <tr v-if="!trabajadoresFiltradosFijos.length">
            <td colspan="10" class="emptyRow">No hay personas con contrato fijo activo</td>
          </tr>
        </tbody>
      </table>
    </div><!-- end vista fijos -->


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
              <label>Nombre *</label>
              <input v-model="nuevoForm.nombre" placeholder="Ej: María" />
            </div>
            <div class="formRow">
              <label>Apellido</label>
              <input v-model="nuevoForm.apellido" placeholder="Ej: González" />
            </div>
          </div>

          <!-- RUT / Teléfono -->
          <div class="formGrid2">
            <div class="formRow">
              <label>RUT / ID</label>
              <input v-model="nuevoForm.rut" placeholder="12.345.678-9" />
            </div>
            <div class="formRow">
              <label>Teléfono</label>
              <input v-model="nuevoForm.telefono" placeholder="+56 9 1234 5678" />
            </div>
          </div>

          <!-- Email -->
          <div class="formRow">
            <label>Email</label>
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
              <label>Cargo</label>
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
          <button class="btn btn-primary" :disabled="guardandoTrabajador || !nuevoForm.nombre" @click="guardarTrabajador">
            {{ guardandoTrabajador ? 'Guardando...' : 'Crear Trabajador' }}
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
  background: #161f27;
}

/* ── Header interno ──────────────────────────────────────────────────────── */
.rrhhPage__header { display: flex; align-items: center; justify-content: space-between; }
.rrhhPage__header-right { display: flex; gap: 10px; }
.rrhhPage__title {
  font-size: 20px; font-weight: 800;
  color: #f3f4f6;
  margin: 0;
}
.rrhhPage__subtitle {
  font-size: 12px; color: #9ca3af; margin-left: 10px;
}

/* ── Filtros ─────────────────────────────────────────────────────────────── */
.rrhhPage__filters { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }

.filterInput {
  display: flex; align-items: center; gap: 6px;
  background: #1e2d3a;
  border: 1.5px solid rgba(255,255,255,0.1);
  border-radius: 8px; padding: 0 12px; height: 34px;
  transition: border-color .15s;
}
.filterInput:focus-within { border-color: #3ac7a5; }
.filterInput input {
  background: transparent; border: none; outline: none;
  font-family: Nunito; font-size: 13px; color: #f3f4f6; width: 180px;
}
.filterInput span { color: #9ca3af; font-size: 14px; }

.chip {
  height: 32px; padding: 0 14px; border-radius: 20px;
  font-family: Nunito; font-size: 12px; font-weight: 600;
  color: #9ca3af;
  background: transparent;
  border: 1.5px solid rgba(255,255,255,0.1);
  cursor: pointer; transition: all .15s;
}
.chip.active { background: rgba(58,199,165,0.15); color: #3ac7a5; border-color: rgba(58,199,165,0.5); }
.chip:not(.active):hover { background: rgba(255,255,255,0.05); color: #f3f4f6; border-color: rgba(255,255,255,0.18); }

/* ── Tabla container ─────────────────────────────────────────────────────── */
.rrhhPage__table-wrap {
  flex: 1; min-height: 0;
  overflow-y: auto;
  border-radius: 14px;
  border: 1.5px solid rgba(255,255,255,0.09);
  background: #1e2d3a;
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
  letter-spacing: .07em; color: #9ca3af;
  padding: 12px 16px;
  border-bottom: 1.5px solid rgba(255,255,255,0.09);
  text-align: left; white-space: nowrap;
  background: rgba(10,18,26,0.4);
  position: sticky; top: 0; z-index: 1;
}

.rrhhTable td {
  font-size: 13px; color: #e5e7eb;
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
.cellName .name  { font-weight: 700; font-size: 13px; color: #f3f4f6; }
.cellName .email { font-size: 11px; color: #9ca3af; }

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
.tagEstado.inactivo  { background: rgba(156,163,175,0.14); color: #9ca3af; }
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
.tagContrato-v.sin-contrato  { background: rgba(107,114,128,0.1);  color: #6b7280; border-color: rgba(107,114,128,0.2); }

/* ── Label sueldo contextual ─────────────────────────────────────────────── */
.sueldo-lbl { font-size: 13px; font-weight: 700; color: #f3f4f6; }
.sueldo-lbl.lbl-var { color: #9ca3af; font-style: italic; font-weight: 500; font-size: 12px; }
.sueldo-lbl.lbl-nd  { color: #6b7280; font-style: italic; font-weight: 500; font-size: 12px; }

/* ── Celdas especiales ───────────────────────────────────────────────────── */
.muted   { color: #9ca3af !important; }
.bold    { font-weight: 700; }
.vacaciones { font-weight: 600; color: #9ca3af; }
.vacaciones.warn { color: #f59e0b; }
.emptyRow { text-align: center; color: #9ca3af; padding: 48px; font-size: 14px; }

/* ── Botón tres puntos ───────────────────────────────────────────────────── */
.btnDots {
  background: transparent;
  border: 1.5px solid rgba(255,255,255,0.1);
  border-radius: 6px; padding: 3px 10px;
  cursor: pointer; color: #9ca3af;
  font-size: 15px; letter-spacing: 1px;
  transition: all .12s;
}
.btnDots:hover { background: rgba(255,255,255,0.06); color: #f3f4f6; border-color: rgba(255,255,255,0.2); }

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
  color: #e5e7eb;
  border: 1.5px solid rgba(255,255,255,0.1);
}
.btn-secondary:hover { background: rgba(255,255,255,0.1); }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* ── Modal ───────────────────────────────────────────────────────────────── */
.modalOverlay {
  position: fixed; inset: 0; z-index: 9000;
  background: rgba(0,0,0,0.65);
  display: flex; align-items: center; justify-content: center;
  backdrop-filter: blur(3px);
}
.modalBox {
  background: #1a2535;
  border: 1.5px solid rgba(255,255,255,0.1);
  border-radius: 16px;
  width: 560px; max-width: 95vw;
  max-height: 90vh; overflow-y: auto;
  display: flex; flex-direction: column;
  box-shadow: 0 24px 64px rgba(0,0,0,0.6);
}
.modalBox__header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1.5px solid rgba(255,255,255,0.07);
}
.modalBox__header h3 {
  margin: 0; font-size: 17px; font-weight: 800; color: #f3f4f6;
}
.btnClose {
  background: transparent; border: none; color: #9ca3af;
  font-size: 16px; cursor: pointer; padding: 4px 8px; border-radius: 6px;
  transition: all .15s;
}
.btnClose:hover { background: rgba(255,255,255,0.08); color: #f3f4f6; }
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
  letter-spacing: .05em; color: #9ca3af;
}
.formRow input,
.formRow select {
  background: #0f1923;
  border: 1.5px solid rgba(255,255,255,0.1);
  border-radius: 8px; padding: 9px 12px;
  font-family: Nunito; font-size: 13px; color: #f3f4f6;
  outline: none; transition: border-color .15s;
}
.formRow input:focus,
.formRow select:focus { border-color: #3ac7a5; }
.formRow select option { background: #1a2535; }
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
  background: #1a2535;
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
  color: #9ca3af;
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
  font-size: 13px; font-weight: 700; color: #f3f4f6; margin: 0 0 2px;
}
.foto-upload-hint small {
  font-size: 11px; color: #6b7280;
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
  color: #6b7280;
  background: transparent;
  border: none; cursor: pointer;
  transition: all .15s;
}
.view-btn + .view-btn { border-left: 1px solid rgba(255,255,255,0.08); }
.view-btn:hover { color: #f3f4f6; background: rgba(255,255,255,0.05); }
.view-btn.active { color: #3ac7a5; background: rgba(58,199,165,0.1); }
.view-btn .u { font-size: 13px; }
.view-count {
  background: rgba(58,199,165,0.15); color: #3ac7a5;
  font-size: 9.5px; font-weight: 800; padding: 1px 6px;
  border-radius: 20px; margin-left: 2px;
}
.view-toggle--sm .view-btn {
  font-size: 11px; height: 28px; padding: 0 10px;
}

/* ── Filtro mes ────────────────────────────────────────────────────────────── */
.filterInput--mes { min-width: 140px; }
.filterInput--mes input[type="month"] {
  background: transparent; border: none; outline: none;
  font-family: Nunito; font-size: 13px; color: #f3f4f6;
  cursor: pointer;
  color-scheme: dark;
}

/* ── KPI row ──────────────────────────────────────────────────────────────── */
.kpi-row {
  display: flex; gap: 12px; flex-wrap: wrap;
}
.kpi-card {
  display: flex; align-items: center; gap: 14px;
  background: #1e2d3a;
  border: 1.5px solid rgba(255,255,255,0.08);
  border-radius: 14px;
  padding: 14px 20px;
  min-width: 200px; flex: 1;
  transition: border-color .15s;
}
.kpi-card:hover { border-color: rgba(58,199,165,0.2); }
.kpi-card--action { flex: 1.5; justify-content: space-between; }
.kpi-card__icon { font-size: 28px; line-height: 1; flex-shrink: 0; }
.kpi-card__body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.kpi-card__val {
  font-size: 22px; font-weight: 900; color: #3ac7a5;
  white-space: nowrap;
}
.kpi-card__val--orange { color: #f4a261; }
.kpi-card__val--sm { font-size: 16px; color: #9ca3af; font-weight: 700; }
.kpi-card__label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: .05em; }
.kpi-est { font-style: italic; color: #9ca3af; text-transform: none; letter-spacing: 0; }

/* ── Cerrar Nómina / Enviar a Unabase ─────────────────────────────────────── */
.btn-rose {
  display: inline-flex; align-items: center; gap: 6px;
  height: 36px; padding: 0 18px; border-radius: 8px;
  font-family: Nunito; font-size: 13px; font-weight: 700;
  cursor: pointer; border: none; transition: all .15s;
  white-space: nowrap; flex-shrink: 0;
  background: rgba(244,114,182,0.18);
  color: #f472b6;
  border: 1.5px solid rgba(244,114,182,0.3);
}
.btn-rose:hover { background: rgba(244,114,182,0.28); border-color: rgba(244,114,182,0.5); }

/* ── Sección proyectos (wrapper con flex-col) ─────────────────────────────── */
.proyectos-section {
  flex: 1; min-height: 0;
  display: flex; flex-direction: column; gap: 12px;
  overflow: hidden;
}

/* ── Fila resumen rosa ─────────────────────────────────────────────────────── */
.resumen-rosa {
  display: flex; align-items: center; gap: 20px;
  background: rgba(244,114,182,0.08);
  border: 1.5px solid rgba(244,114,182,0.2);
  border-radius: 12px;
  padding: 12px 20px;
  flex-shrink: 0;
  flex-wrap: wrap;
  gap: 16px;
}
.resumen-rosa__stat {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
}
.resumen-rosa__val {
  font-size: 22px; font-weight: 900; color: #f3f4f6;
}
.resumen-rosa__val--green  { color: #4ade80; }
.resumen-rosa__val--orange { color: #f4a261; }
.resumen-rosa__val--red    { color: #f87171; }
.resumen-rosa__val--gray   { color: #9ca3af; }
.resumen-rosa__label {
  font-size: 10px; color: rgba(244,114,182,0.8);
  text-transform: uppercase; letter-spacing: .06em;
}
.resumen-rosa__sep {
  width: 1px; height: 32px; background: rgba(244,114,182,0.2);
}
.resumen-rosa__spacer { flex: 1; }

/* ── Grid de proyectos ────────────────────────────────────────────────────── */
.proyectos-grid {
  flex: 1; min-height: 0;
  display: grid;
  gap: 20px;
  overflow-y: auto;
  padding-bottom: 16px;
  /* Responsive: 3 cols → 2 cols → 1 col */
  grid-template-columns: repeat(3, 1fr);
}
/* Responsive breakpoints */
@media (max-width: 1400px) {
  .proyectos-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 900px) {
  .proyectos-grid { grid-template-columns: 1fr; }
}
@media (min-width: 1800px) {
  .proyectos-grid { grid-template-columns: repeat(4, 1fr); }
}
.proyectos-grid::-webkit-scrollbar { width: 6px; }
.proyectos-grid::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }

/* ── Tarjeta de proyecto ─────────────────────────────────────────────────── */
.proyecto-card {
  background: #1e2d3a;
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
  border-radius: 8px; color: #e5e7eb;
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
  margin: 0; font-size: 16px; font-weight: 800; color: #f3f4f6;
  text-shadow: 0 1px 4px rgba(0,0,0,0.7);
}
.proyecto-card__dates {
  font-size: 11px; color: rgba(229,231,235,0.75); margin-top: 4px;
  text-shadow: 0 1px 3px rgba(0,0,0,0.6);
}

/* Stats */
.proyecto-card__stats {
  display: flex; gap: 0;
  border-top: 1px solid rgba(255,255,255,0.07);
  border-bottom: 1px solid rgba(255,255,255,0.07);
}
.proyecto-stat {
  flex: 1;
  display: flex; flex-direction: column; gap: 2px;
  padding: 12px 14px;
  border-right: 1px solid rgba(255,255,255,0.07);
}
.proyecto-stat:last-child { border-right: none; }
.proyecto-stat__val {
  font-size: 17px; font-weight: 800; color: #f3f4f6;
}
.proyecto-stat__val.teal              { color: #3ac7a5; }
.proyecto-stat__val--orange           { color: #f4a261; }
.proyecto-stat__val--rose             { color: #f472b6; }
.proyecto-stat__label { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }

/* Dots de estado dentro del stat de personas */
.proyecto-stat__states {
  display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px;
}
.ps-dot {
  font-size: 9.5px; font-weight: 700; padding: 1px 6px; border-radius: 20px;
}
.ps-dot--green  { background: rgba(74,222,128,0.12); color: #4ade80; }
.ps-dot--orange { background: rgba(244,162,97,0.12);  color: #f4a261; }
.ps-dot--red    { background: rgba(248,113,113,0.12); color: #f87171; }

/* Barra de tipos de contrato */
.proyecto-card__bar {
  display: flex; height: 4px; overflow: hidden;
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
  font-size: 13px; font-weight: 700; color: #f3f4f6;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.proyecto-worker__cargo {
  font-size: 11px; color: #6b7280;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.proyecto-worker__pills {
  display: flex; flex-direction: column; align-items: flex-end; gap: 3px; flex-shrink: 0;
}
.proyecto-empty { padding: 20px; text-align: center; color: #4b5563; font-size: 13px; }
</style>
