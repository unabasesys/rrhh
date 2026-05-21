<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
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
const proyectoIdTarget     = ref(null);

function onFotoProyectoChange(e) {
  const file = e.target.files?.[0];
  if (!file || !proyectoFotoTarget.value) return;
  const reader = new FileReader();
  reader.onload = async (ev) => {
    const base64 = ev.target.result;
    const key    = proyectoFotoTarget.value;
    fotoProyecto.value = { ...fotoProyecto.value, [key]: base64 };
    // Respaldo local
    try { localStorage.setItem('rrhh_fotos_proyectos', JSON.stringify(fotoProyecto.value)); } catch {}
    // Guardar en MongoDB para que todos los dispositivos vean la foto
    if (proyectoIdTarget.value) {
      try {
        await $fetch(`/api/rrhh/proyectos/${proyectoIdTarget.value}`, {
          method: 'PUT',
          body: { foto: base64 },
        });
        // Actualizar proyectosDB en memoria para que recarga no pierda la foto
        const idx = proyectosDB.value.findIndex(p => p._id === proyectoIdTarget.value);
        if (idx !== -1) proyectosDB.value[idx] = { ...proyectosDB.value[idx], foto: base64 };
      } catch (err) {
        console.warn('[foto] Error guardando foto en MongoDB:', err);
      }
    }
  };
  reader.readAsDataURL(file);
}

function subirFotoProyecto(key, negocioId = null) {
  proyectoFotoTarget.value = key;
  proyectoIdTarget.value   = negocioId;
  fotoFileRefProyecto.value?.click();
}

async function quitarFotoProyecto(key, negocioId = null) {
  // Eliminar del ref local
  const fotos = { ...fotoProyecto.value };
  delete fotos[key];
  fotoProyecto.value = fotos;
  try { localStorage.setItem('rrhh_fotos_proyectos', JSON.stringify(fotos)); } catch {}
  // Borrar de MongoDB
  if (negocioId) {
    try {
      await $fetch(`/api/rrhh/proyectos/${negocioId}`, {
        method: 'PUT',
        body: { foto: null },
      });
      const idx = proyectosDB.value.findIndex(p => p._id === negocioId);
      if (idx !== -1) proyectosDB.value[idx] = { ...proyectosDB.value[idx], foto: null };
    } catch (err) { console.warn('[foto] Error borrando foto en MongoDB:', err); }
  }
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
        nombre:      key === '__sin_proyecto__' ? 'Sin proyecto asignado' : key,
        key,
        negocio_id:  c?.negocio_id || null,
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

// ── Treemap "Centro de costo" ─────────────────────────────────────────────────
const proyectosDB      = ref([])
const treemapContainer = ref(null)
const treemapSize      = ref({ w: 900, h: 480 })
let   _tmRO            = null

// Map proyectoId → tipo (venta / gasto)
const proyectoTipoMap = computed(() => {
  const m = {}
  proyectosDB.value.forEach(p => { m[p._id] = p.tipo || 'venta' })
  return m
})

// Palette by tipo
const TM_PALETTES = {
  venta:   { bg: 'linear-gradient(140deg,#0b2921 0%,#143d31 100%)', accent: '#3ac7a5', label: 'Ingreso' },
  gasto:   { bg: 'linear-gradient(140deg,#2d150a 0%,#3f200c 100%)', accent: '#f4a261', label: 'Gasto' },
  default: { bg: 'linear-gradient(140deg,#111827 0%,#1e2d3d 100%)', accent: '#818cf8', label: 'Centro' },
}
const TM_CYCLE = [
  { bg:'linear-gradient(140deg,#0b2921 0%,#143d31 100%)', accent:'#3ac7a5' },
  { bg:'linear-gradient(140deg,#2d150a 0%,#3f200c 100%)', accent:'#f4a261' },
  { bg:'linear-gradient(140deg,#1a1035 0%,#2a1a50 100%)', accent:'#a78bfa' },
  { bg:'linear-gradient(140deg,#0f1f2e 0%,#172d44 100%)', accent:'#60a5fa' },
  { bg:'linear-gradient(140deg,#251c00 0%,#3a2b00 100%)', accent:'#fbbf24' },
]
// Iconos decorativos por tipo / ciclo
const TM_ICONS_BY_TIPO = { venta: 'u-ventas', gasto: 'u-dashboard', default: 'u-grid' }
const TM_ICON_CYCLE    = ['u-ventas', 'u-dashboard', 'u-grid', 'u-usuarios', 'u-config']

function _tmWorst(values, rowSum, shorter) {
  if (!rowSum || !shorter) return Infinity
  let max = 0, min = Infinity
  for (const v of values) { if (v > max) max = v; if (v < min) min = v }
  return Math.max((shorter * shorter * max) / (rowSum * rowSum),
                  (rowSum * rowSum) / (shorter * shorter * min))
}

function squarify(items, x, y, w, h) {
  if (!items.length || !w || !h) return []
  const total  = items.reduce((s, i) => s + i.value, 0)
  const factor = (w * h) / total
  const pool   = [...items]
    .sort((a, b) => b.value - a.value)
    .map(i => ({ ...i, value: i.value * factor }))
  const rects  = []
  let cx = x, cy = y, cw = w, ch = h, idx = 0
  while (idx < pool.length) {
    const shorter = Math.min(cw, ch)
    const row = [], rowVals = []
    let rowSum = 0, prevWorst = Infinity
    while (idx < pool.length) {
      const item = pool[idx]
      const newSum    = rowSum + item.value
      const newWorst  = _tmWorst([...rowVals, item.value], newSum, shorter)
      if (row.length > 0 && newWorst > prevWorst) break
      row.push(item); rowVals.push(item.value)
      rowSum = newSum; prevWorst = newWorst; idx++
    }
    if (!row.length) { idx++; continue }
    if (cw >= ch) {
      const sw = rowSum / ch; let ry = cy
      for (const it of row) {
        const rh = ch * (it.value / rowSum)
        rects.push({ ...it, x: cx, y: ry, w: sw, h: rh }); ry += rh
      }
      cx += sw; cw -= sw
    } else {
      const sh = rowSum / cw; let rx = cx
      for (const it of row) {
        const rw = cw * (it.value / rowSum)
        rects.push({ ...it, x: rx, y: cy, w: rw, h: sh }); rx += rw
      }
      cy += sh; ch -= sh
    }
  }
  return rects
}

const treemapRects = computed(() => {
  const grupos = trabajadoresPorProyecto.value
  const { w, h } = treemapSize.value
  if (!grupos.length || !w || !h) return []
  const tipoMap = proyectoTipoMap.value
  const items = grupos
    .map((g, i) => ({
      ...g,
      value: g.total_costo || 1,
      tipo: tipoMap[g.negocio_id] || null,
      _idx: i,
    }))
    .filter(g => g.value > 0)
  if (!items.length) return []
  const rects = squarify(items, 0, 0, w, h)
  return rects.map((r, i) => {
    const tipo    = r.tipo || 'default'
    const palette = TM_PALETTES[tipo] || TM_CYCLE[r._idx % TM_CYCLE.length]
    const icon    = TM_ICONS_BY_TIPO[tipo] || TM_ICON_CYCLE[r._idx % TM_ICON_CYCLE.length]
    return { ...r, palette, area: r.w * r.h, icon }
  })
})

function fmtM(v) {
  if (!v) return '—'
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `$${Math.round(v / 1_000)}k`
  return `$${v}`
}

function tmTipoLabel(tipo) {
  return TM_PALETTES[tipo]?.label || 'Centro'
}

// ── Mobile "Mapa de costos" (spec 402×874) ────────────────────────────────────
const isMobile  = ref(false)
const mmDayMode = ref(false)
let   _mmResizeObs = null

function _checkMobile() { isMobile.value = window.innerWidth < 768 }

// Cover gradients cycling (spec palette)
const MM_COVERS = [
  { from: '#2E4F3E', to: '#0B3744' },  // teal-green
  { from: '#3A5A3A', to: '#1A3A1A' },  // dark green
  { from: '#7B4A2B', to: '#3B2415' },  // warm brown
  { from: '#2E2E5A', to: '#1A1A3A' },  // purple
  { from: '#0B3744', to: '#062D3A' },  // deep navy
  { from: '#5A3E2E', to: '#3A2415' },  // rust
]

// Type → chip display (extensible, con fallback dinámico)
const MM_TIPO_CONF = {
  venta:      { label: 'INGRESO',    color: '#0DCFA8', icon: 'u-ventas'    },
  gasto:      { label: 'GASTO',      color: '#F4D26B', icon: 'u-config'    },
  pelicula:   { label: 'PELÍCULA',   color: '#C4B6E0', icon: 'u-grid'      },
  película:   { label: 'PELÍCULA',   color: '#C4B6E0', icon: 'u-grid'      },
  evento:     { label: 'EVENTO',     color: '#B5D4B0', icon: 'u-usuarios'  },
  documental: { label: 'DOCUMENTAL', color: '#E07856', icon: 'u-dashboard' },
  publicidad: { label: 'PUBLICIDAD', color: '#F4D26B', icon: 'u-ventas'    },
  servicio:   { label: 'SERVICIO',   color: '#0DCFA8', icon: 'u-config'    },
}
const _MM_COLOR_CYCLE = ['#0DCFA8','#F4D26B','#C4B6E0','#B5D4B0','#E07856']
function mmTipoConf(tipo) {
  const key = (tipo || '').toLowerCase()
  if (MM_TIPO_CONF[key]) return MM_TIPO_CONF[key]
  // Fallback: tipo desconocido → color cíclico basado en hash
  const hash = key.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return { label: key.toUpperCase(), color: _MM_COLOR_CYCLE[hash % _MM_COLOR_CYCLE.length], icon: 'u-grid' }
}

// Color semántico del margen
function mmMargenColor(pct) {
  if (pct === null || pct === undefined) return null
  if (pct >= 20)  return '#0DCFA8'   // verde
  if (pct >= 0)   return '#F4D26B'   // ámbar
  return '#E07856'                    // coral (negativo)
}

const mmMesLabel = computed(() =>
  new Date(filtroMes.value + '-01').toLocaleDateString('es-CL', { month: 'long' })
)

const mobileMapProyectos = computed(() => {
  const tipoMap  = proyectoTipoMap.value
  const dbMap    = {}
  proyectosDB.value.forEach(p => { dbMap[p._id] = p })
  return trabajadoresPorProyecto.value
    .slice()
    .sort((a, b) => b.total_costo - a.total_costo)
    .slice(0, 6)
    .map((g, i) => {
      const proyecto     = dbMap[g.negocio_id] || {}
      const tipo         = proyecto.tipo || tipoMap[g.negocio_id] || 'venta'
      const conf         = mmTipoConf(tipo)
      const cover        = MM_COVERS[i % MM_COVERS.length]
      const presupuesto  = proyecto.presupuesto || 0
      const margen       = presupuesto > 0
        ? Math.round((presupuesto - g.total_costo) / presupuesto * 100)
        : null
      return { ...g, _mmIdx: i, tipo, conf, cover, presupuesto, margen }
    })
})

const mmRows = computed(() => {
  const p = mobileMapProyectos.value
  return [
    { key: 'r0', flex: 50, items: p.slice(0, 2), size: 'lg' },
    { key: 'r1', flex: 30, items: p.slice(2, 4), size: 'md' },
    { key: 'r2', flex: 20, items: p.slice(4, 6), size: 'sm' },
  ].filter(r => r.items.length > 0)
})

const mmTotalPersonas = computed(() =>
  mobileMapProyectos.value.reduce((s, g) => s + g.trabajadores.length, 0)
)
const mmTotalCosto = computed(() =>
  trabajadoresPorProyecto.value.reduce((s, g) => s + (g.total_costo || 0), 0)
)
const mmKpiLiquido   = computed(() => trabajadoresPorProyecto.value.reduce((s, g) => s + (g.total_liquido || 0), 0))
const mmKpiEmpresa   = computed(() => trabajadoresPorProyecto.value.reduce((s, g) => s + (g.total_costo || 0), 0))
const mmKpiImpuestos = computed(() => trabajadoresPorProyecto.value.reduce((s, g) => s + (g.total_imposiciones || 0), 0))

function fmtShort(n) {
  if (!n) return '$ 0'
  const abs = Math.abs(n)
  if (abs >= 10_000_000) return `$ ${Math.round(n / 1_000_000)}M`
  if (abs >= 1_000_000)  return `$ ${(n / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)      return `$ ${Math.round(n / 1_000)}k`
  return `$ ${n}`
}

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
  _checkMobile()
  window.addEventListener('resize', _checkMobile)
  try {
    const saved = localStorage.getItem('rrhh_fotos_proyectos');
    if (saved) fotoProyecto.value = JSON.parse(saved);
  } catch {}
  try {
    await Promise.all([rrhhStore.getTrabajadores(), rrhhStore.getContratos()]);
  } finally {
  }
  // Cargar proyectos para tipos de treemap y fotos
  try {
    const authStore = (await import('@/stores/auth')).useAuthStore()
    const orgId = authStore?.currentOrgId || null
    proyectosDB.value = await $fetch(orgId ? `/api/rrhh/proyectos?orgId=${orgId}` : '/api/rrhh/proyectos')
    // Cargar fotos desde MongoDB (sobreescribe localStorage si hay foto en DB)
    const fotosDB = {}
    proyectosDB.value.forEach(p => { if (p.foto) fotosDB[p.nombre] = p.foto })
    if (Object.keys(fotosDB).length) {
      fotoProyecto.value = { ...fotoProyecto.value, ...fotosDB }
    }
  } catch { proyectosDB.value = [] }
  // ResizeObserver para dimensiones del treemap
  if (treemapContainer.value) {
    _tmRO = new ResizeObserver(entries => {
      for (const e of entries) {
        const cr = e.contentRect
        treemapSize.value = { w: cr.width, h: cr.height }
      }
    })
    _tmRO.observe(treemapContainer.value)
    const cr = treemapContainer.value.getBoundingClientRect()
    treemapSize.value = { w: cr.width || 900, h: cr.height || 480 }
  }
});
onUnmounted(() => {
  _tmRO?.disconnect()
  window.removeEventListener('resize', _checkMobile)
});

// Cuando el usuario cambia a vista treemap, conectar ResizeObserver
watch(vistaActual, async (val) => {
  if (val !== 'proyectos') return
  await nextTick()
  if (!treemapContainer.value) return
  if (_tmRO) { _tmRO.disconnect(); _tmRO = null }
  _tmRO = new ResizeObserver(entries => {
    for (const e of entries) {
      const cr = e.contentRect
      treemapSize.value = { w: Math.max(cr.width, 100), h: Math.max(cr.height, 100) }
    }
  })
  _tmRO.observe(treemapContainer.value)
  const cr = treemapContainer.value.getBoundingClientRect()
  treemapSize.value = { w: cr.width || 900, h: cr.height || 480 }
})

</script>

<template>
  <div class="rrhhPage" :class="{ 'mm-mode': vistaActual === 'proyectos' && isMobile, 'mm-day-mode': mmDayMode && vistaActual === 'proyectos' && isMobile }">

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

    <!-- ── Vista Proyectos ────────────────────────────────────────────────── -->
    <!-- Mobile: Mapa de costos hi-fi -->
    <div v-if="vistaActual === 'proyectos' && isMobile" :class="['mapa-movil', mmDayMode && 'mm-day']">

      <!-- Title block -->
      <div class="mm-title">
        <!-- Day/Night toggle -->
        <button class="mm-daynight-toggle" @click.stop="mmDayMode = !mmDayMode" :title="mmDayMode ? 'Modo oscuro' : 'Modo día'">
          <svg v-if="!mmDayMode" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        </button>
        <div class="mm-crumb">
          <span class="mm-crumb-base">CENTRO DE COSTO</span>
          <span class="mm-crumb-sep">/</span>
          <span class="mm-crumb-active">MAPA</span>
        </div>
        <h1 class="mm-h1">Mapa de {{ mmMesLabel }}</h1>
        <div class="mm-subrow">
          <span class="mm-total-val">{{ fmtShort(mmTotalCosto) }}</span>
          <span class="mm-meta-txt">
            · {{ mobileMapProyectos.length }} proyecto{{ mobileMapProyectos.length !== 1 ? 's' : '' }}
            · {{ mmTotalPersonas }} persona{{ mmTotalPersonas !== 1 ? 's' : '' }}
          </span>
        </div>
      </div>

      <!-- View switcher -->
      <div class="mm-switcher">
        <button class="mm-pill mm-pill--active">Mapa</button>
        <button class="mm-pill" disabled>Flujo</button>
        <button class="mm-pill" disabled>Salud</button>
        <button class="mm-pill" disabled>Calendario</button>
      </div>

      <!-- Estado vacío -->
      <div v-if="!mobileMapProyectos.length" class="mm-empty">
        <span class="u u-grid" style="font-size:28px;opacity:.18"></span>
        <p>Sin proyectos con costo en {{ filtroMes }}</p>
      </div>

      <!-- Grid 3 filas: 50 / 30 / 20 -->
      <div v-else class="mm-grid">
        <div
          v-for="row in mmRows"
          :key="row.key"
          class="mm-row"
          :style="`flex: ${row.flex}`"
        >
          <div
            v-for="p in row.items"
            :key="p.key"
            class="mm-cell"
            :style="{
              flex: p.total_costo,
              background: fotoProyecto[p.key]
                ? `linear-gradient(to bottom,rgba(3,26,34,.2) 0%,rgba(3,26,34,.72) 100%),url(${fotoProyecto[p.key]}) center/cover no-repeat`
                : `linear-gradient(135deg, ${p.cover.from} 0%, ${p.cover.to} 100%)`,
            }"
            @click="$router.push(`/rrhh/trabajadores/${p.trabajadores[0]?._id || ''}`)"
          >
            <!-- Type chip -->
            <div class="mm-chip">
              <span class="mm-chip-dot" :style="{ background: p.conf.color }"></span>
              <span v-if="row.size !== 'sm'" class="mm-chip-lbl" :style="{ color: p.conf.color }">{{ p.conf.label }}</span>
            </div>

            <!-- Name + cost -->
            <div class="mm-cell-inner">
              <div :class="['mm-cell-name', `mm-cell-name--${row.size}`]">{{ p.nombre }}</div>
              <div class="mm-cell-bottom">
                <div :class="['mm-cell-cost', `mm-cell-cost--${row.size}`]">
                  {{ fmtShort(p.total_costo) }}
                </div>
                <div v-if="row.size !== 'sm'" class="mm-cell-sub">
                  {{ p.trabajadores.length }}p<template v-if="p.margen !== null"> · <span :style="{ color: mmMargenColor(p.margen) }">{{ p.margen }}% margen</span></template>
                </div>
              </div>
            </div>

            <!-- Watermark icon -->
            <span :class="['u', p.conf.icon, 'mm-watermark', `mm-watermark--${row.size}`]"></span>
          </div>
        </div>
      </div>

      <!-- KPI strip -->
      <div class="mm-kpi-strip">
        <div class="mm-kpi-item">
          <div class="mm-kpi-swatch" style="background:#0DCFA8"></div>
          <div class="mm-kpi-col">
            <div class="mm-kpi-label">LÍQUIDO</div>
            <div class="mm-kpi-val">{{ fmtShort(mmKpiLiquido) }}</div>
          </div>
        </div>
        <div class="mm-kpi-item">
          <div class="mm-kpi-swatch" style="background:#F4D26B"></div>
          <div class="mm-kpi-col">
            <div class="mm-kpi-label">EMPRESA</div>
            <div class="mm-kpi-val">{{ fmtShort(mmKpiEmpresa) }}</div>
          </div>
        </div>
        <div class="mm-kpi-item">
          <div class="mm-kpi-swatch" style="background:#E07856"></div>
          <div class="mm-kpi-col">
            <div class="mm-kpi-label">IMPUESTOS</div>
            <div class="mm-kpi-val">{{ fmtShort(mmKpiImpuestos) }}</div>
          </div>
        </div>
      </div>
    </div><!-- /mapa-movil -->

    <!-- Desktop: Treemap "Centro de costo" ───────────────────────────────── -->
    <div v-else-if="vistaActual === 'proyectos'" class="treemap-wrap">

      <!-- Título del mapa -->
      <div class="treemap-header">
        <div class="treemap-header__left">
          <span class="treemap-header__title">Centro de costo</span>
          <span class="treemap-header__dot">·</span>
          <span class="treemap-header__sub">
            Mapa de {{ new Date(filtroMes + '-01').toLocaleDateString('es-CL', { month:'long' }) }}
          </span>
        </div>
        <div class="treemap-header__right">
          <span class="treemap-legend-dot" style="background:#3ac7a5"></span><span class="treemap-legend-lbl">Ingreso</span>
          <span class="treemap-legend-dot" style="background:#f4a261;margin-left:12px"></span><span class="treemap-legend-lbl">Gasto</span>
        </div>
      </div>

      <!-- Canvas del treemap -->
      <div ref="treemapContainer" class="treemap-canvas">

        <!-- Input oculto para subir foto -->
        <input
          ref="fotoFileRefProyecto"
          type="file"
          accept="image/*"
          style="display:none"
          @change="onFotoProyectoChange"
        />

        <!-- Estado vacío -->
        <div v-if="!treemapRects.length" class="treemap-empty">
          <span class="u u-grid" style="font-size:32px;opacity:.2"></span>
          <p>Sin proyectos con costo asignado en {{ filtroMes }}</p>
        </div>

        <!-- Tiles del mapa -->
        <div
          v-for="(r, i) in treemapRects"
          :key="r.key"
          class="tm-tile"
          :style="{
            left:   r.x + 'px',
            top:    r.y + 'px',
            width:  r.w + 'px',
            height: r.h + 'px',
            '--accent': r.palette.accent,
            background: fotoProyecto[r.key]
              ? `linear-gradient(to bottom,rgba(0,0,0,.25) 0%,rgba(0,0,0,.68) 100%),url(${fotoProyecto[r.key]}) center/cover no-repeat`
              : r.palette.bg,
          }"
          @click="$router.push(`/rrhh/trabajadores/${r.trabajadores[0]?._id || ''}`)"
        >
          <!-- Icono decorativo de fondo (sólo si no hay foto) -->
          <span
            v-if="!fotoProyecto[r.key] && r.area >= 10000"
            :class="['u', r.icon, 'tm-tile__deco']"
          ></span>

          <!-- Botones foto — aparecen en hover -->
          <template v-if="r.area >= 14000">
            <button
              class="tm-tile__foto-btn"
              @click.stop="subirFotoProyecto(r.key, r.negocio_id)"
              :title="fotoProyecto[r.key] ? 'Cambiar foto' : 'Adjuntar foto'"
            >
              <span class="u u-edit" style="font-size:10px"></span>
              {{ fotoProyecto[r.key] ? 'Cambiar foto' : 'Adjuntar foto' }}
            </button>
            <button
              v-if="fotoProyecto[r.key]"
              class="tm-tile__foto-btn tm-tile__foto-btn--remove"
              @click.stop="quitarFotoProyecto(r.key, r.negocio_id)"
              title="Quitar foto"
            >
              <span class="u u-close" style="font-size:10px"></span>
              Quitar foto
            </button>
          </template>

          <!-- Contenido adaptable por tamaño -->
          <template v-if="r.area >= 18000">
            <div class="tm-tile__badge" :style="{ background: r.palette.accent + '28', color: r.palette.accent }">
              {{ tmTipoLabel(r.tipo) }}
            </div>
            <div class="tm-tile__body">
              <div class="tm-tile__name">{{ r.nombre }}</div>
              <div class="tm-tile__cost" :style="{ color: r.palette.accent }">{{ fmtM(r.total_costo) }}</div>
              <div class="tm-tile__meta">costo del mes · {{ r.trabajadores.length }} {{ r.trabajadores.length === 1 ? 'persona' : 'personas' }}</div>
            </div>
            <div class="tm-tile__workers" v-if="r.area >= 40000 && r.trabajadores.length">
              <div
                v-for="t in r.trabajadores.slice(0, r.area >= 80000 ? 5 : 3)"
                :key="t._id"
                class="tm-worker-chip"
                @click.stop="$router.push(`/rrhh/trabajadores/${t._id}`)"
              >
                <div class="tm-worker-chip__av" :style="{ background: r.palette.accent }">
                  {{ t.nombre?.charAt(0) }}{{ (t.apellido || '')?.charAt(0) }}
                </div>
                <span class="tm-worker-chip__name">{{ t.nombre }} {{ t.apellido || '' }}</span>
              </div>
            </div>
          </template>
          <template v-else-if="r.area >= 6000">
            <div class="tm-tile__body tm-tile__body--sm">
              <div class="tm-tile__name tm-tile__name--sm">{{ r.nombre }}</div>
              <div class="tm-tile__cost tm-tile__cost--sm" :style="{ color: r.palette.accent }">{{ fmtM(r.total_costo) }}</div>
            </div>
          </template>
          <!-- Tile muy pequeño: solo dot de color -->
          <template v-else>
            <div class="tm-tile__dot" :style="{ background: r.palette.accent }"></div>
          </template>
        </div>

      </div><!-- /treemap-canvas -->
    </div><!-- /treemap-wrap -->

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

/* ── Treemap "Centro de costo" ───────────────────────────────────────────── */
.treemap-wrap {
  flex: 1; min-height: 0;
  display: flex; flex-direction: column; gap: 10px;
  overflow: hidden;
}

/* Header del mapa */
.treemap-header {
  display: flex; align-items: center; justify-content: space-between;
  flex-shrink: 0; padding: 0 2px;
}
.treemap-header__left { display: flex; align-items: center; gap: 7px; }
.treemap-header__title {
  font-size: 14px; font-weight: 800;
  color: var(--neutral-text-title, #f1f5f9);
  letter-spacing: -.01em;
}
.treemap-header__dot  { color: rgba(255,255,255,0.25); font-size: 14px; }
.treemap-header__sub  { font-size: 13px; font-weight: 500; color: var(--neutral-text-caption, #94a3b8); }
.treemap-header__right { display: flex; align-items: center; gap: 5px; }
.treemap-legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.treemap-legend-lbl { font-size: 11px; color: var(--neutral-text-caption, #94a3b8); font-weight: 600; }

/* Canvas del treemap */
.treemap-canvas {
  flex: 1; min-height: 0;
  position: relative;
  border-radius: 14px;
  overflow: hidden;
  background: #08121a;
  box-shadow: 0 4px 32px rgba(0,0,0,0.45);
}

/* Estado vacío */
.treemap-empty {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; color: rgba(255,255,255,0.2);
  font-size: 14px;
}
.treemap-empty p { margin: 0; }

/* Tile del treemap */
.tm-tile {
  position: absolute;
  box-sizing: border-box;
  border: 2px solid #08121a;
  border-radius: 10px;
  padding: 14px;
  display: flex; flex-direction: column; gap: 6px;
  overflow: hidden;
  cursor: pointer;
  transition: filter .15s, border-color .15s;
}
.tm-tile:hover {
  filter: brightness(1.12);
  border-color: var(--accent, rgba(255,255,255,0.18));
  z-index: 10;
}
/* Patrón de puntos sobre el tile */
.tm-tile::before {
  content: '';
  position: absolute; inset: 0; pointer-events: none; z-index: 0;
  background-image: radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px);
  background-size: 22px 22px;
}
/* Todos los hijos directos encima del patrón */
.tm-tile > * { position: relative; z-index: 1; }

/* Icono decorativo de fondo */
.tm-tile__deco {
  position: absolute !important;
  right: -10px; bottom: -10px; z-index: 0 !important;
  font-size: 120px;
  color: var(--accent, rgba(255,255,255,0.06));
  opacity: .12;
  pointer-events: none;
  line-height: 1;
  user-select: none;
  transition: opacity .18s;
}
.tm-tile:hover .tm-tile__deco { opacity: .2; }

/* Botones foto */
.tm-tile__foto-btn {
  position: absolute !important;
  top: 10px; right: 10px; z-index: 20 !important;
  display: flex; align-items: center; gap: 4px;
  background: rgba(0,0,0,0.55);
  border: 1px solid rgba(255,255,255,0.18);
  border-radius: 7px; padding: 4px 9px;
  font-family: Nunito; font-size: 10.5px; font-weight: 700;
  color: rgba(255,255,255,0.75); cursor: pointer;
  opacity: 0; transition: opacity .18s, background .15s;
}
.tm-tile__foto-btn--remove {
  top: auto !important;
  bottom: auto !important;
  right: 10px !important;
  top: 36px !important;
}
.tm-tile:hover .tm-tile__foto-btn { opacity: 1; }
.tm-tile__foto-btn:hover {
  background: rgba(255,255,255,0.15);
  color: #fff;
  border-color: var(--accent, rgba(255,255,255,0.35));
}
.tm-tile__foto-btn--remove:hover {
  background: rgba(224,120,86,0.55);
  border-color: rgba(224,120,86,0.6);
  color: #fff;
}

/* Badge tipo */
.tm-tile__badge {
  display: inline-flex; align-items: center;
  padding: 2px 8px; border-radius: 20px;
  font-size: 9.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase;
  width: fit-content;
  flex-shrink: 0;
}

/* Body */
.tm-tile__body {
  flex: 1; display: flex; flex-direction: column; justify-content: flex-end; gap: 3px;
}
.tm-tile__body--sm {
  justify-content: center; gap: 2px;
}
.tm-tile__name {
  font-size: 15px; font-weight: 800; color: #fff;
  line-height: 1.2; overflow: hidden;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}
.tm-tile__name--sm {
  font-size: 12px; -webkit-line-clamp: 1;
}
.tm-tile__cost {
  font-size: 22px; font-weight: 900; line-height: 1.1;
  letter-spacing: -.02em;
}
.tm-tile__cost--sm {
  font-size: 15px;
}
.tm-tile__meta {
  font-size: 11px; color: rgba(255,255,255,0.45); font-weight: 500;
}

/* Workers chips */
.tm-tile__workers {
  display: flex; flex-direction: column; gap: 5px;
  margin-top: 4px;
}
.tm-worker-chip {
  display: flex; align-items: center; gap: 7px;
  background: rgba(0,0,0,0.25);
  border-radius: 20px; padding: 4px 10px 4px 4px;
  cursor: pointer; transition: background .12s;
  width: fit-content; max-width: 100%;
}
.tm-worker-chip:hover { background: rgba(255,255,255,0.1); }
.tm-worker-chip__av {
  width: 22px; height: 22px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 9px; font-weight: 800; color: #fff; flex-shrink: 0;
  opacity: .85;
}
.tm-worker-chip__name {
  font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.8);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px;
}

/* Dot para tiles muy pequeños */
.tm-tile__dot {
  width: 8px; height: 8px; border-radius: 50%;
  position: absolute; top: 8px; left: 8px; opacity: .7;
}

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

/* ── Mobile: hasta 1023px para cubrir phablets y tablets portrait ── */
@media (max-width: 1023px) {
  /* Cards vs tabla — ocultar tabla, mostrar tarjetas */
  .mobile-cards  { display: flex; }
  .desktop-table { display: none; }
}

@media (max-width: 767px) {
  /* Filters */
  .desktop-only { display: none !important; }
  .mobile-filters { display: flex; width: 100%; }

  /* Header compacto */
  .rrhhPage__header { flex-direction: column; align-items: flex-start; gap: 10px; }
  .rrhhPage__header-right { width: 100%; display: flex; gap: 8px; }
  .rrhhPage__header-right .btn { flex: 1; justify-content: center; font-size: 12px; padding: 8px 10px; }

  /* Filtros en columna en 2 filas */
  .rrhhPage__filters { flex-wrap: wrap; gap: 8px; }
  .filterInput { flex: 1; min-width: 0; }
  .filterInput--mes { flex: 0 0 auto; }
  .view-toggle { width: 100%; }
  .view-btn { flex: 1; justify-content: center; }

  /* ── Treemap en móvil: canvas ocupa ~70% del viewport ── */
  .treemap-wrap {
    flex: 1;
    min-height: 0;
    gap: 8px;
  }
  .treemap-header {
    flex-shrink: 0;
  }
  .treemap-header__title { font-size: 12px; }
  .treemap-header__sub   { font-size: 11px; }
  .treemap-canvas {
    /* Altura explícita para que el ResizeObserver tenga dimensiones reales */
    min-height: max(260px, 58vh);
    height: max(260px, 58vh);
    flex: none;
  }

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

/* ══════════════════════════════════════════════════════════════════════════
   MOBILE MAP "Centro de costo · Mapa de mayo"
   Spec: 402×874, dark #031A22, Space Grotesk + Inter Tight
   ══════════════════════════════════════════════════════════════════════════ */
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter+Tight:wght@400;500;600&display=swap');

/* mm-mode: ocultar chrome estándar cuando el mapa está activo en móvil */
@media (max-width: 767px) {
  .rrhhPage.mm-mode {
    padding: 0 !important;
    gap: 0 !important;
    background: #031A22 !important;
    overflow: hidden;
  }
  .rrhhPage.mm-mode > .rrhhPage__header,
  .rrhhPage.mm-mode > .orphan-banner,
  .rrhhPage.mm-mode > .rrhhPage__filters,
  .rrhhPage.mm-mode > .footer-kpis {
    display: none !important;
  }
}

/* ── Contenedor principal del mapa móvil ── */
.mapa-movil {
  display: none;           /* hidden on desktop — JS sets isMobile */
  flex-direction: column;
  background: #031A22;
  color: #F5F0E6;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  font-family: 'Inter Tight', 'Nunito', sans-serif;
}
@media (max-width: 767px) {
  .mapa-movil { display: flex; }
}

/* ── Title block ── */
.mm-title {
  padding: 6px 20px 10px;
  flex-shrink: 0;
}
.mm-crumb {
  display: flex;
  align-items: center;
  gap: 5px;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  margin-bottom: 4px;
}
.mm-crumb-base { color: rgba(245,240,230,0.45); }
.mm-crumb-sep  { color: rgba(245,240,230,0.25); }
.mm-crumb-active { color: #0DCFA8; }

.mm-h1 {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 26px;
  font-weight: 600;
  letter-spacing: -0.025em;
  color: #F5F0E6;
  margin: 0 0 4px;
  line-height: 1.15;
}

.mm-subrow {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.mm-total-val {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 18px;
  font-weight: 700;
  color: #0DCFA8;
  font-variant-numeric: tabular-nums;
}
.mm-meta-txt {
  font-size: 11.5px;
  color: rgba(245,240,230,0.55);
  font-family: 'Inter Tight', sans-serif;
}

/* ── View switcher ── */
.mm-switcher {
  display: flex;
  gap: 2px;
  padding: 3px;
  margin: 0 16px 10px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(245,240,230,0.06);
  border-radius: 9px;
  flex-shrink: 0;
}
.mm-pill {
  flex: 1;
  height: 30px;
  border-radius: 6px;
  border: none;
  background: transparent;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 11.5px;
  font-weight: 500;
  color: rgba(245,240,230,0.6);
  cursor: pointer;
  transition: background .15s, color .15s;
}
.mm-pill--active {
  background: rgba(13,207,168,0.15);
  color: #0DCFA8;
  font-weight: 600;
}
.mm-pill:disabled { cursor: default; opacity: .7; }

/* ── Grid: 3 rows flex ── */
.mm-grid {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: 6px;
  margin: 0 16px;
  overflow: hidden;
}
.mm-row {
  display: flex;
  gap: 6px;
  min-height: 0;
  /* flex value set inline (50 / 30 / 20) */
}

/* ── Cell ── */
.mm-cell {
  position: relative;
  border-radius: 10px;
  border: 1px solid rgba(245,240,230,0.06);
  padding: 10px 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  /* flex value set inline (proportional to cost) */
  min-width: 0;
  transition: filter .15s;
}
.mm-cell:hover { filter: brightness(1.1); }

/* Type chip */
.mm-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(6,45,58,0.6);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border-radius: 100px;
  padding: 2px 7px 2px 5px;
  width: fit-content;
  position: relative; z-index: 1;
  flex-shrink: 0;
}
.mm-chip-dot {
  width: 4px; height: 4px;
  border-radius: 50%;
  flex-shrink: 0;
}
.mm-chip-lbl {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  line-height: 1;
}

/* Inner body: pushes cost to bottom */
.mm-cell-inner {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 3px;
  position: relative; z-index: 1;
}

.mm-cell-name {
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 600;
  color: #F5F0E6;
  letter-spacing: -0.015em;
  line-height: 1.2;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
}
.mm-cell-name--lg { font-size: 17px; -webkit-line-clamp: 2; }
.mm-cell-name--md { font-size: 13px; -webkit-line-clamp: 2; }
.mm-cell-name--sm { font-size: 11px; -webkit-line-clamp: 1; }

.mm-cell-bottom {
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex-wrap: wrap;
}

.mm-cell-cost {
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  color: #F5F0E6;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
  white-space: nowrap;
}
.mm-cell-cost--lg { font-size: 22px; }
.mm-cell-cost--md { font-size: 15px; }
.mm-cell-cost--sm { font-size: 12px; }

.mm-cell-sub {
  font-family: 'Inter Tight', sans-serif;
  font-size: 10.5px;
  color: rgba(245,240,230,0.5);
  white-space: nowrap;
}

/* Watermark icon */
.mm-watermark {
  position: absolute !important;
  z-index: 0 !important;
  right: -8px; bottom: -8px;
  opacity: 0.18;
  pointer-events: none;
  color: rgba(245,240,230,0.9);
  line-height: 1;
}
.mm-watermark--lg { font-size: 90px; }
.mm-watermark--md { font-size: 56px; }
.mm-watermark--sm { font-size: 40px; }

/* ── Empty state ── */
.mm-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: rgba(245,240,230,0.2);
  font-size: 14px;
  font-family: 'Inter Tight', sans-serif;
}
.mm-empty p { margin: 0; }

/* ── KPI strip ── */
.mm-kpi-strip {
  display: flex;
  gap: 6px;
  padding: 10px 16px 56px; /* 56px = home indicator space */
  border-top: 1px solid rgba(245,240,230,0.06);
  margin-top: 10px;
  flex-shrink: 0;
}
.mm-kpi-item {
  flex: 1;
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 10px 8px;
  background: rgba(255,255,255,0.025);
  border: 1px solid rgba(245,240,230,0.06);
  border-radius: 9px;
}
.mm-kpi-swatch {
  width: 6px; height: 6px;
  border-radius: 1px;
  flex-shrink: 0;
  margin-top: 3px;
}
.mm-kpi-col { display: flex; flex-direction: column; gap: 2px; }
.mm-kpi-label {
  font-family: 'Inter Tight', sans-serif;
  font-size: 9.5px;
  font-weight: 500;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  color: rgba(245,240,230,0.55);
  white-space: nowrap;
}
.mm-kpi-val {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 12.5px;
  font-weight: 700;
  color: #F5F0E6;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* ── Day/Night toggle button ── */
.mm-title { position: relative; }
.mm-daynight-toggle {
  position: absolute;
  top: 6px; right: 0;
  width: 32px; height: 32px;
  border-radius: 9px;
  border: 1px solid rgba(245,240,230,0.1);
  background: rgba(255,255,255,0.06);
  color: rgba(245,240,230,0.65);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: background .15s, color .15s;
  -webkit-tap-highlight-color: transparent;
  flex-shrink: 0;
}
.mm-daynight-toggle:active { background: rgba(255,255,255,0.12); }

/* ══════════════════════════════════════════════════════════════════════════
   MODO DÍA — light chrome, dark cells preserved
   Activado via .mapa-movil.mm-day
   ══════════════════════════════════════════════════════════════════════════ */

/* Page background in day mode */
@media (max-width: 767px) {
  .rrhhPage.mm-mode.mm-day-mode { background: #F5F0E6 !important; }
}

/* ── Container ── */
.mapa-movil.mm-day {
  background: #F5F0E6;
  color: #062D3A;
}

/* ── Toggle button in day mode ── */
.mm-day .mm-daynight-toggle {
  border-color: rgba(6,45,58,0.12);
  background: #FFFFFF;
  color: rgba(6,45,58,0.7);
  box-shadow: 0 1px 2px rgba(6,45,58,0.04);
}

/* ── Title block ── */
.mm-day .mm-crumb-base  { color: rgba(6,45,58,0.5); }
.mm-day .mm-crumb-sep   { color: rgba(6,45,58,0.25); }
.mm-day .mm-crumb-active { color: #0AA888; }
.mm-day .mm-h1          { color: #062D3A; }
.mm-day .mm-total-val   { color: #0AA888; }
.mm-day .mm-meta-txt    { color: rgba(6,45,58,0.6); }

/* ── View switcher ── */
.mm-day .mm-switcher {
  background: #FFFFFF;
  border-color: rgba(6,45,58,0.08);
  box-shadow: 0 1px 2px rgba(6,45,58,0.04);
}
.mm-day .mm-pill {
  color: rgba(6,45,58,0.55);
  font-weight: 500;
}
.mm-day .mm-pill--active {
  background: rgba(13,207,168,0.18);
  color: #0AA888;
  font-weight: 600;
}
.mm-day .mm-pill:disabled { opacity: .6; }

/* ── Cells — keep dark gradients, add subtle border + shadow ── */
.mm-day .mm-cell {
  border: 1px solid rgba(6,45,58,0.08);
  box-shadow: 0 2px 6px rgba(6,45,58,0.06);
}

/* Type chip — cream pill with backdrop blur, color from tipo */
.mm-day .mm-chip {
  background: rgba(245,240,230,0.92);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

/* Cell text stays white (dark cell bg provides contrast) */
.mm-day .mm-cell-name {
  color: #FFFFFF;
  text-shadow: 0 1px 2px rgba(6,45,58,0.25);
}
.mm-day .mm-cell-cost {
  color: #FFFFFF;
  text-shadow: 0 1px 2px rgba(6,45,58,0.25);
}
.mm-day .mm-cell-sub {
  color: rgba(255,255,255,0.85);
  text-shadow: 0 1px 2px rgba(6,45,58,0.25);
}

/* Watermark slightly more visible over cream surroundings */
.mm-day .mm-watermark { opacity: 0.22; }

/* ── Empty state ── */
.mm-day .mm-empty { color: rgba(6,45,58,0.3); }

/* ── KPI strip ── */
.mm-day .mm-kpi-strip {
  background: #F5F0E6;
  border-top-color: rgba(6,45,58,0.08);
}
.mm-day .mm-kpi-item {
  background: #FFFFFF;
  border-color: rgba(6,45,58,0.08);
  box-shadow: 0 1px 2px rgba(6,45,58,0.04);
}
.mm-day .mm-kpi-label {
  font-family: 'Space Grotesk', sans-serif;
  color: rgba(6,45,58,0.55);
  font-weight: 600;
}
.mm-day .mm-kpi-val { color: #062D3A; }
</style>
