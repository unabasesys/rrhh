<script setup>
/**
 * pages/rrhh/asistencia/marcaciones.vue
 * Registro completo de marcaciones con corrección del supervisor y asignación
 * de proyecto / línea presupuestal.
 */
import { ref, computed, onMounted, watch, nextTick } from "vue"
import { useAsistenciaStore } from '@/stores/asistencia'
import useRrhhStore from '@/stores/rrhh'
import { useRoute } from 'vue-router'

definePageMeta({ layout: 'rrhh' })

const asistencia = useAsistenciaStore()
const rrhhStore  = useRrhhStore()
const global     = {}
const route      = useRoute()

// ─── Proyectos reales (desde backend, scopados a la org activa) ─────────────
const proyectos = ref([])
async function cargarProyectos() {
  try {
    const oid = rrhhStore.currentOrgId
    const ses = JSON.parse(localStorage.getItem('rrhh_session') || '{}')
    const url = oid ? `/api/rrhh/proyectos?orgId=${oid}` : '/api/rrhh/proyectos'
    proyectos.value = await $fetch(url, {
      headers: ses.token ? { Authorization: `Bearer ${ses.token}` } : {},
    })
  } catch (e) {
    proyectos.value = []
  }
}
function getProyecto(id) {
  if (!id) return null
  return proyectos.value.find(p => (p._id || p.id) === id) || null
}

onMounted(async () => {
  asistencia.init()
  global.title     = 'Marcaciones'
  global.namePage  = 'RRHH'
  global.breadcrumb = [
    { name: 'RRHH',         path: '/rrhh/trabajadores' },
    { name: 'Marcaciones' },
  ]
  if (!rrhhStore.trabajadores?.length) {
    await rrhhStore.getTrabajadores()
  }
  await cargarProyectos()
})

// ── Tabs de sección: Asistencia unificada ────────────────────────────────────
const asistenciaTabs = [
  { key: 'marcaciones', label: 'Marcaciones',  path: '/rrhh/asistencia/marcaciones', icon: 'u u-check' },
  { key: 'turnos',      label: 'Turnos',        path: '/rrhh/asistencia/turnos',      icon: 'u u-reloj' },
  { key: 'historial',   label: 'Historial',     path: '/rrhh/asistencia/marcaciones?tab=historial', icon: 'u u-calendar' },
  { key: 'incidencias', label: 'Incidencias',   path: '/rrhh/asistencia/marcaciones?tab=incidencias', icon: 'u u-alerta' },
]

// ── Sub-tab activa (soporta ?tab=incidencias / ?tab=historial) ───────────────
const subtabActual = computed(() => route.query.tab || 'marcaciones')

// ─── Incidencias ──────────────────────────────────────────────────────────────
// Período: últimos 30 días por defecto
const incidPeriodoDays = ref(30)
const incidPeriodoDesde = computed(() => {
  const d = new Date(hoy)
  d.setDate(d.getDate() - incidPeriodoDays.value)
  return d.toISOString().split('T')[0]
})

const incidencias = computed(() => {
  const desde = incidPeriodoDesde.value
  const marcaciones = asistencia.marcaciones.filter(m => m.fecha >= desde && m.fecha <= hoy)
  const trabajadoresActivos = trabajadores.value.filter(w => w.estado !== 'inactivo')

  const result = []

  // 1. Atrasos
  marcaciones
    .filter(m => m.atraso_minutos > 0)
    .forEach(m => {
      const w = getWorker(m.trabajador_id)
      result.push({
        tipo: 'atraso',
        fecha: m.fecha,
        trabajador_id: m.trabajador_id,
        trabajador: w?.nombre || m.trabajador_id,
        cargo: w?.cargo || '',
        detalle: `${m.atraso_minutos} min de atraso`,
        valor: m.atraso_minutos,
        marcacion_id: m.id,
      })
    })

  // 2. Ausencias (sin marcación en días laborales pasados)
  const diasDesde = Math.abs(Math.ceil((new Date(desde) - new Date(hoy)) / 86400000))
  for (let i = 1; i <= diasDesde; i++) {
    const d = new Date(hoy)
    d.setDate(d.getDate() - i)
    const dow = d.getDay()
    if (dow === 0 || dow === 6) continue // skip weekends
    const fechaStr = d.toISOString().split('T')[0]

    trabajadoresActivos.forEach(w => {
      const wid = w._id || w.id
      const tiene = marcaciones.some(m => m.trabajador_id === wid && m.fecha === fechaStr)
      if (!tiene) {
        result.push({
          tipo: 'ausencia',
          fecha: fechaStr,
          trabajador_id: wid,
          trabajador: w.nombre,
          cargo: w.cargo || '',
          detalle: 'Sin marcación',
          valor: null,
          marcacion_id: null,
        })
      }
    })
  }

  // 3. Horas extra (>= 1 hora extra)
  marcaciones
    .filter(m => (m.horas_extra || 0) >= 1)
    .forEach(m => {
      const w = getWorker(m.trabajador_id)
      result.push({
        tipo: 'hora_extra',
        fecha: m.fecha,
        trabajador_id: m.trabajador_id,
        trabajador: w?.nombre || m.trabajador_id,
        cargo: w?.cargo || '',
        detalle: `${m.horas_extra}h extra`,
        valor: m.horas_extra,
        marcacion_id: m.id,
      })
    })

  // Ordenar: más reciente primero
  return result.sort((a, b) => b.fecha.localeCompare(a.fecha))
})

const incidFiltroTipo = ref('') // '' | 'atraso' | 'ausencia' | 'hora_extra'

const incidenciasFiltradas = computed(() => {
  if (!incidFiltroTipo.value) return incidencias.value
  return incidencias.value.filter(i => i.tipo === incidFiltroTipo.value)
})

const incidKpis = computed(() => ({
  total: incidencias.value.length,
  atrasos: incidencias.value.filter(i => i.tipo === 'atraso').length,
  ausencias: incidencias.value.filter(i => i.tipo === 'ausencia').length,
  horasExtra: incidencias.value.filter(i => i.tipo === 'hora_extra').length,
}))

// ─── Filtros ──────────────────────────────────────────────────────────────
const filtroFechaDesde = ref('')
const filtroFechaHasta = ref('')
const filtroTrabajador = ref('')
const filtroEstado     = ref('')
const filtroProyecto   = ref('')

const hoy = asistencia.fechaHoy()

// Defaults: semana actual
const lunes = (() => {
  const d = new Date(hoy)
  const dow = d.getDay() === 0 ? 7 : d.getDay()
  d.setDate(d.getDate() - dow + 1)
  return d.toISOString().split('T')[0]
})()
filtroFechaDesde.value = lunes
filtroFechaHasta.value = hoy

// ─── Datos ────────────────────────────────────────────────────────────────
const trabajadores = computed(() => rrhhStore.trabajadores || [])

function getWorker(id) { return trabajadores.value.find(w => (w._id || w.id) === id) }
function initiales(n) { return n?.split(' ').slice(0,2).map(p=>p[0]).join('').toUpperCase() || '?' }
const COLORS = ['#2a9d8f','#e76f51','#f4a261','#858cf0','#e9c46a','#264653']
function avatarColor(id) { return COLORS[(id?.charCodeAt?.(id.length-1)||0)%COLORS.length] }

// ─── Marcaciones filtradas ────────────────────────────────────────────────
const marcacionesFiltradas = computed(() => {
  let list = [...asistencia.marcaciones]

  if (filtroFechaDesde.value) list = list.filter(m => m.fecha >= filtroFechaDesde.value)
  if (filtroFechaHasta.value) list = list.filter(m => m.fecha <= filtroFechaHasta.value)
  if (filtroTrabajador.value) list = list.filter(m => m.trabajador_id === filtroTrabajador.value)
  if (filtroEstado.value)     list = list.filter(m => m.estado === filtroEstado.value)
  if (filtroProyecto.value)   list = list.filter(m => m.proyecto_id === filtroProyecto.value)

  // Ordenar fecha desc
  list.sort((a, b) => (b.fecha + b.entrada).localeCompare(a.fecha + a.entrada))
  return list
})

// ─── KPIs del rango ───────────────────────────────────────────────────────
const kpisRango = computed(() => {
  const list = marcacionesFiltradas.value
  return {
    total: list.length,
    pendientes: list.filter(m => m.estado === 'pendiente').length,
    atrasos: list.filter(m => m.atraso_minutos > 0).length,
    horasExtra: list.reduce((s, m) => s + (m.horas_extra || 0), 0).toFixed(1),
    horas: list.reduce((s, m) => s + (m.horas_trabajadas || 0), 0).toFixed(1),
  }
})

// ─── Edición supervisor ───────────────────────────────────────────────────
const editando   = ref(null)
const editForm   = ref({})
const guardando  = ref(false)

function abrirEdicion(marc) {
  editando.value = marc.id
  editForm.value = {
    ...marc,
    // Asegura que proyecto_id y linea_id son strings válidos
    proyecto_id: marc.proyecto_id || '',
    linea_id:    marc.linea_id || '',
  }
}

function cancelarEdicion() {
  editando.value = null
  editForm.value = {}
}

function guardarEdicion() {
  guardando.value = true
  asistencia.corregirMarcacion(editando.value, editForm.value)
  setTimeout(() => {
    guardando.value = false
    editando.value = null
    editForm.value = {}
  }, 300)
}

// Líneas del proyecto seleccionado en el form de edición
const lineasEditForm = computed(() => {
  const p = getProyecto(editForm.value?.proyecto_id)
  return p?.lineas || []
})

function aprobar(id) { asistencia.aprobarMarcacion(id) }
function rechazar(id) { asistencia.rechazarMarcacion(id, 'Rechazado por supervisor') }
function eliminar(id) { asistencia.deleteMarcacion(id) }

// ─── Vista por proyectos ──────────────────────────────────────────────────
const vistaMarcaciones = ref('normal') // 'normal' | 'proyectos'

// Agrupar las marcaciones filtradas por proyecto
const marcacionesPorProyecto = computed(() => {
  const list = marcacionesFiltradas.value
  const grupos = {}

  list.forEach(m => {
    const p = getProyecto(m.proyecto_id)
    const key   = m.proyecto_id || '__sin_proyecto__'
    const label = p?.nombre || (m.proyecto_id ? m.proyecto_id : 'Sin proyecto asignado')

    if (!grupos[key]) {
      grupos[key] = {
        key,
        nombre: label,
        proyecto: p,
        marcaciones: [],
        trabajadoresIds: new Set(),
        totalHoras: 0,
        totalExtra: 0,
        pendientes: 0,
        atrasos: 0,
      }
    }
    grupos[key].marcaciones.push(m)
    if (m.trabajador_id) grupos[key].trabajadoresIds.add(m.trabajador_id)
    grupos[key].totalHoras  += m.horas_trabajadas || 0
    grupos[key].totalExtra  += m.horas_extra || 0
    if (m.estado === 'pendiente') grupos[key].pendientes++
    if (m.atraso_minutos > 0)     grupos[key].atrasos++
  })

  return Object.values(grupos).sort((a, b) => {
    if (a.key === '__sin_proyecto__') return 1
    if (b.key === '__sin_proyecto__') return -1
    return a.nombre.localeCompare(b.nombre)
  })
})

// ─── Panel detalle de proyecto ────────────────────────────────────────────
const proyectoPanel    = ref(null)   // grupo seleccionado
const showProyPanel    = ref(false)

function abrirProyecto(grupo) {
  proyectoPanel.value = grupo
  showProyPanel.value = true
}
function cerrarProyPanel() {
  showProyPanel.value = false
  setTimeout(() => { proyectoPanel.value = null }, 300)
}

// ─── Estado de marcación hoy para un trabajador ───────────────────────────
function marcacionHoy(wid) {
  return asistencia.marcaciones.find(m => m.trabajador_id === wid && m.fecha === hoy) || null
}

function estadoHoy(wid) {
  const m = marcacionHoy(wid)
  if (!m)          return 'sin_marcar'
  if (!m.salida)   return 'entrada'
  return 'completo'
}

// ─── Modal marcar trabajador ──────────────────────────────────────────────
const marcarWorker  = ref(null)
const marcarGrupo   = ref(null)
const showMarcar    = ref(false)
const marcarHora    = ref('')
const marcarGuardando = ref(false)
const marcarError   = ref('')

function horaAhora() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

function abrirMarcar(wid, grupo) {
  marcarWorker.value  = wid
  marcarGrupo.value   = grupo
  marcarHora.value    = horaAhora()
  marcarError.value   = ''
  marcarGuardando.value = false
  showMarcar.value    = true
}

function cerrarMarcar() {
  showMarcar.value = false
}

const marcarTipo = computed(() => estadoHoy(marcarWorker.value))

function ejecutarMarcacion() {
  if (!marcarWorker.value) return
  marcarGuardando.value = true
  marcarError.value = ''

  try {
    let result
    const proyId = marcarGrupo.value?.proyecto?.id || ''
    if (marcarTipo.value === 'sin_marcar') {
      result = asistencia.marcarEntrada({
        trabajador_id: marcarWorker.value,
        proyecto_id: proyId,
        turno_id: null,
        linea_id: null,
      })
    } else if (marcarTipo.value === 'entrada') {
      result = asistencia.marcarSalida({ trabajador_id: marcarWorker.value })
    }

    if (result?.ok === false) {
      marcarError.value = result.error || 'Error al registrar'
    } else {
      showMarcar.value = false
    }
  } catch (e) {
    marcarError.value = 'Error inesperado al marcar'
  } finally {
    marcarGuardando.value = false
  }
}

// ─── Formato de fecha ─────────────────────────────────────────────────────
function fmtFecha(f) {
  if (!f) return '—'
  const d = new Date(f + 'T12:00:00')
  return d.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })
}

// ─── Badges ───────────────────────────────────────────────────────────────
function estadoBadge(m) {
  if (m.estado === 'aprobado') return { label: 'Aprobado', cls: 'badge-ok' }
  if (m.estado === 'rechazado') return { label: 'Rechazado', cls: 'badge-red' }
  return { label: 'Pendiente', cls: 'badge-pend' }
}

function tipoBadge(m) {
  if (m.tipo === 'extra')    return { label: 'Horas extra',  cls: 'badge-extra' }
  if (m.tipo === 'tardanza') return { label: 'Tardanza',     cls: 'badge-late' }
  if (m.tipo === 'ausencia') return { label: 'Ausente',      cls: 'badge-aus' }
  return { label: 'Normal', cls: 'badge-norm' }
}
</script>

<template>
  <div class="marc-page">

    <!-- ── Tabs de sección: Asistencia unificada ─────────────────────── -->
    <RrhhSectionTabs :tabs="asistenciaTabs" :current="subtabActual === 'incidencias' ? 'incidencias' : subtabActual === 'historial' ? 'historial' : 'marcaciones'" />

    <!-- ── Contenido principal (se oculta en sub-tab incidencias) ──────── -->
    <template v-if="subtabActual !== 'incidencias'">

    <!-- ── Filtros ─────────────────────────────────────────────────────── -->
    <div class="filter-bar">
      <div class="filter-group">
        <label>Desde</label>
        <input type="date" v-model="filtroFechaDesde" />
      </div>
      <div class="filter-group">
        <label>Hasta</label>
        <input type="date" v-model="filtroFechaHasta" />
      </div>
      <div class="filter-group">
        <label>Trabajador</label>
        <select v-model="filtroTrabajador">
          <option value="">Todos</option>
          <option v-for="w in trabajadores" :key="w.id" :value="w.id">{{ w.nombre }}</option>
        </select>
      </div>
      <div class="filter-group">
        <label>Proyecto</label>
        <select v-model="filtroProyecto">
          <option value="">Todos</option>
          <option v-for="p in proyectos" :key="p._id || p.id" :value="p._id || p.id">{{ p.nombre }}</option>
        </select>
      </div>
      <div class="filter-group">
        <label>Estado</label>
        <select v-model="filtroEstado">
          <option value="">Todos</option>
          <option value="pendiente">Pendiente</option>
          <option value="aprobado">Aprobado</option>
          <option value="rechazado">Rechazado</option>
        </select>
      </div>
    </div>

    <!-- ── Toggle de vista ───────────────────────────────────────────── -->
    <div class="marc-vista-toggle">
      <button :class="['marc-vbtn', vistaMarcaciones === 'normal' && 'active']" @click="vistaMarcaciones = 'normal'">
        <span class="u u-list" style="font-size:13px"></span> Lista
      </button>
      <button :class="['marc-vbtn', vistaMarcaciones === 'proyectos' && 'active']" @click="vistaMarcaciones = 'proyectos'">
        <span class="u u-grid" style="font-size:13px"></span> Por Proyectos
      </button>
    </div>

    <!-- ── KPIs compactos ─────────────────────────────────────────────── -->
    <div class="kpi-mini-row">
      <div class="kpi-mini">
        <span class="kpi-mini-val">{{ kpisRango.total }}</span>
        <span class="kpi-mini-label">Registros</span>
      </div>
      <div class="kpi-mini kpi-mini--orange">
        <span class="kpi-mini-val">{{ kpisRango.pendientes }}</span>
        <span class="kpi-mini-label">Pendientes</span>
      </div>
      <div class="kpi-mini kpi-mini--red">
        <span class="kpi-mini-val">{{ kpisRango.atrasos }}</span>
        <span class="kpi-mini-label">Atrasos</span>
      </div>
      <div class="kpi-mini kpi-mini--purple">
        <span class="kpi-mini-val">{{ kpisRango.horasExtra }}h</span>
        <span class="kpi-mini-label">Horas extra</span>
      </div>
      <div class="kpi-mini kpi-mini--teal">
        <span class="kpi-mini-val">{{ kpisRango.horas }}h</span>
        <span class="kpi-mini-label">Total horas</span>
      </div>
    </div>

    <!-- ── Vista por Proyectos ───────────────────────────────────────── -->
    <div v-if="vistaMarcaciones === 'proyectos'" class="marc-proy-grid">
      <div v-for="grupo in marcacionesPorProyecto" :key="grupo.key" class="marc-proy-card" @click="abrirProyecto(grupo)" style="cursor:pointer">

        <!-- Header del proyecto -->
        <div class="marc-proy-card__header">
          <div class="marc-proy-card__icon">
            <span class="u u-grid" style="font-size:18px;color:#3ac7a5"></span>
          </div>
          <div class="marc-proy-card__title-col">
            <h3 class="marc-proy-card__title">{{ grupo.nombre }}</h3>
            <span class="marc-proy-card__sub">{{ grupo.marcaciones.length }} marcaciones · {{ grupo.trabajadoresIds.size }} trabajadores</span>
          </div>
          <div class="marc-proy-card__badges">
            <span v-if="grupo.pendientes > 0" class="mproy-badge orange">{{ grupo.pendientes }} pend.</span>
            <span v-if="grupo.atrasos > 0" class="mproy-badge red">{{ grupo.atrasos }} atrasos</span>
          </div>
        </div>

        <!-- Stats del proyecto -->
        <div class="marc-proy-card__stats">
          <div class="marc-proy-stat">
            <span class="marc-proy-stat__val">{{ grupo.totalHoras.toFixed(1) }}h</span>
            <span class="marc-proy-stat__label">Total horas</span>
          </div>
          <div class="marc-proy-stat">
            <span class="marc-proy-stat__val purple">{{ grupo.totalExtra.toFixed(1) }}h</span>
            <span class="marc-proy-stat__label">Horas extra</span>
          </div>
          <div class="marc-proy-stat">
            <span class="marc-proy-stat__val">{{ grupo.trabajadoresIds.size }}</span>
            <span class="marc-proy-stat__label">Trabajadores</span>
          </div>
          <div class="marc-proy-stat">
            <span class="marc-proy-stat__val teal">{{ grupo.marcaciones.filter(m=>m.estado==='aprobado').length }}</span>
            <span class="marc-proy-stat__label">Aprobadas</span>
          </div>
        </div>

        <!-- Lista de trabajadores con resumen -->
        <div class="marc-proy-workers">
          <div
            v-for="wid in [...grupo.trabajadoresIds]"
            :key="wid"
            class="marc-proy-worker"
          >
            <div class="avatar-xs" :style="{ background: avatarColor(wid) }">
              {{ initiales(getWorker(wid)?.nombre) }}
            </div>
            <div class="marc-proy-worker__info">
              <span class="marc-proy-worker__name">{{ getWorker(wid)?.nombre || wid }}</span>
              <div class="marc-proy-worker__chips">
                <span class="wchip">
                  {{ grupo.marcaciones.filter(m=>m.trabajador_id===wid).length }} reg.
                </span>
                <span class="wchip teal">
                  {{ grupo.marcaciones.filter(m=>m.trabajador_id===wid).reduce((s,m)=>s+(m.horas_trabajadas||0),0).toFixed(1) }}h
                </span>
                <span v-if="grupo.marcaciones.filter(m=>m.trabajador_id===wid && m.horas_extra>0).length" class="wchip purple">
                  +{{ grupo.marcaciones.filter(m=>m.trabajador_id===wid).reduce((s,m)=>s+(m.horas_extra||0),0).toFixed(1) }}h extra
                </span>
              </div>
            </div>
            <!-- mini marcaciones timeline -->
            <div class="marc-mini-row">
              <div
                v-for="m in grupo.marcaciones.filter(ma=>ma.trabajador_id===wid).slice(0,7)"
                :key="m.id"
                :class="['marc-mini-dot', m.estado]"
                :title="`${fmtFecha(m.fecha)} ${m.entrada||''}–${m.salida||''}`"
              ></div>
              <span v-if="grupo.marcaciones.filter(ma=>ma.trabajador_id===wid).length > 7" class="marc-mini-more">
                +{{ grupo.marcaciones.filter(ma=>ma.trabajador_id===wid).length - 7 }}
              </span>
            </div>
          </div>
        </div>

      </div>

      <div v-if="!marcacionesPorProyecto.length" class="marc-proy-empty">
        No hay marcaciones para los filtros seleccionados
      </div>
    </div>

    <!-- ── Tabla (vista normal) ───────────────────────────────────────── -->
    <div v-else class="table-card">
      <table class="marc-table">
        <thead>
          <tr>
            <th>Trabajador</th>
            <th>Fecha</th>
            <th>Turno</th>
            <th>Entrada</th>
            <th>Salida</th>
            <th>Horas</th>
            <th>Extra</th>
            <th>Atraso</th>
            <th>Proyecto / Línea</th>
            <th>Tipo</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <!-- Fila normal -->
          <template v-for="marc in marcacionesFiltradas" :key="marc.id">
            <tr v-if="editando !== marc.id" :class="{ 'row-modified': marc.modificado_por_supervisor }">
              <td>
                <div class="worker-cell">
                  <div class="avatar-xs" :style="{ background: avatarColor(marc.trabajador_id) }">
                    {{ initiales(getWorker(marc.trabajador_id)?.nombre) }}
                  </div>
                  <span class="worker-name-sm">{{ getWorker(marc.trabajador_id)?.nombre || marc.trabajador_id }}</span>
                </div>
              </td>
              <td class="fecha-col">{{ fmtFecha(marc.fecha) }}</td>
              <td class="text-muted-sm">{{ asistencia.getTurno(marc.turno_id)?.nombre || '—' }}</td>
              <td>
                <span class="mono" :class="{ 'text-orange': marc.atraso_minutos > 0 }">
                  {{ marc.entrada || '—' }}
                </span>
              </td>
              <td><span class="mono">{{ marc.salida || '—' }}</span></td>
              <td class="text-num">{{ marc.horas_trabajadas > 0 ? `${marc.horas_trabajadas}h` : '—' }}</td>
              <td class="text-num">
                <span v-if="marc.horas_extra > 0" class="badge-extra-sm">+{{ marc.horas_extra }}h</span>
                <span v-else class="text-muted-sm">—</span>
              </td>
              <td>
                <span v-if="marc.atraso_minutos > 0" class="badge-late-sm">+{{ marc.atraso_minutos }}'</span>
                <span v-else class="text-muted-sm">—</span>
              </td>
              <td>
                <div class="proyecto-cell">
                  <span class="proj-name">{{ getProyecto(marc.proyecto_id)?.nombre || '—' }}</span>
                  <span v-if="marc.linea_id" class="linea-code">
                    {{ asistencia.getLinea(marc.proyecto_id, marc.linea_id)?.nombre || '' }}
                    <span class="code-badge">{{ asistencia.getLinea(marc.proyecto_id, marc.linea_id)?.codigo || '' }}</span>
                  </span>
                </div>
              </td>
              <td><span class="badge sm" :class="tipoBadge(marc).cls">{{ tipoBadge(marc).label }}</span></td>
              <td><span class="badge sm" :class="estadoBadge(marc).cls">{{ estadoBadge(marc).label }}</span></td>
              <td>
                <div class="actions-cell">
                  <button class="btn-act" title="Editar" @click="abrirEdicion(marc)">
                    <i class="u u-editar"></i>
                  </button>
                  <button v-if="marc.estado === 'pendiente'" class="btn-act btn-act--green" title="Aprobar" @click="aprobar(marc.id)">
                    <i class="u u-check"></i>
                  </button>
                  <button v-if="marc.estado === 'pendiente'" class="btn-act btn-act--red" title="Rechazar" @click="rechazar(marc.id)">
                    <i class="u u-cerrar"></i>
                  </button>
                </div>
              </td>
            </tr>

            <!-- Fila en modo edición ───────────────────────────────────── -->
            <tr v-else class="row-edit">
              <td colspan="12">
                <div class="edit-form">
                  <div class="edit-grid">
                    <div class="ef">
                      <label>Entrada</label>
                      <input type="time" v-model="editForm.entrada" />
                    </div>
                    <div class="ef">
                      <label>Salida</label>
                      <input type="time" v-model="editForm.salida" />
                    </div>
                    <div class="ef">
                      <label>Proyecto</label>
                      <select v-model="editForm.proyecto_id" @change="editForm.linea_id = ''">
                        <option value="">Sin proyecto</option>
                        <option v-for="p in proyectos" :key="p._id || p.id" :value="p._id || p.id">{{ p.nombre }}</option>
                      </select>
                    </div>
                    <div class="ef">
                      <label>Línea presupuestal</label>
                      <select v-model="editForm.linea_id">
                        <option value="">Sin línea</option>
                        <option v-for="l in lineasEditForm" :key="l.id" :value="l.id">
                          [{{ l.codigo }}] {{ l.nombre }}
                        </option>
                      </select>
                    </div>
                    <div class="ef">
                      <label>Estado</label>
                      <select v-model="editForm.estado">
                        <option value="pendiente">Pendiente</option>
                        <option value="aprobado">Aprobado</option>
                        <option value="rechazado">Rechazado</option>
                      </select>
                    </div>
                    <div class="ef ef--wide">
                      <label>Observaciones</label>
                      <input v-model="editForm.observaciones" placeholder="Nota del supervisor" />
                    </div>
                  </div>
                  <div class="edit-actions">
                    <button class="btn-ghost-sm" @click="cancelarEdicion">Cancelar</button>
                    <button class="btn-primary-sm" @click="guardarEdicion" :disabled="guardando">
                      <i class="u u-check"></i> {{ guardando ? 'Guardando…' : 'Guardar' }}
                    </button>
                  </div>
                </div>
              </td>
            </tr>
          </template>

          <tr v-if="!marcacionesFiltradas.length">
            <td colspan="12" style="text-align:center;padding:40px;color:#6b7280">
              No hay marcaciones para los filtros seleccionados
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    </template>
    <!-- ── /Contenido principal ─────────────────────────────────────────── -->

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- ── Tab: Incidencias ─────────────────────────────────────────────── -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <div v-if="subtabActual === 'incidencias'" class="incid-section">

      <!-- Header + controles -->
      <div class="incid-header">
        <div class="incid-periodo">
          <span class="incid-header__label">Período:</span>
          <button :class="['incid-periodo-btn', incidPeriodoDays === 7 && 'active']" @click="incidPeriodoDays = 7">7 días</button>
          <button :class="['incid-periodo-btn', incidPeriodoDays === 30 && 'active']" @click="incidPeriodoDays = 30">30 días</button>
          <button :class="['incid-periodo-btn', incidPeriodoDays === 90 && 'active']" @click="incidPeriodoDays = 90">90 días</button>
        </div>
        <div class="incid-tipo-filter">
          <button :class="['incid-tipo-btn', !incidFiltroTipo && 'active']" @click="incidFiltroTipo = ''">
            Todas <span class="incid-count">{{ incidKpis.total }}</span>
          </button>
          <button :class="['incid-tipo-btn incid-tipo-btn--atraso', incidFiltroTipo === 'atraso' && 'active']" @click="incidFiltroTipo = 'atraso'">
            <i class="u u-reloj"></i> Atrasos <span class="incid-count">{{ incidKpis.atrasos }}</span>
          </button>
          <button :class="['incid-tipo-btn incid-tipo-btn--ausencia', incidFiltroTipo === 'ausencia' && 'active']" @click="incidFiltroTipo = 'ausencia'">
            <i class="u u-cerrar"></i> Ausencias <span class="incid-count">{{ incidKpis.ausencias }}</span>
          </button>
          <button :class="['incid-tipo-btn incid-tipo-btn--extra', incidFiltroTipo === 'hora_extra' && 'active']" @click="incidFiltroTipo = 'hora_extra'">
            <i class="u u-cobros-y-pagos"></i> Horas extra <span class="incid-count">{{ incidKpis.horasExtra }}</span>
          </button>
        </div>
      </div>

      <!-- KPI row -->
      <div class="incid-kpis">
        <div class="incid-kpi incid-kpi--orange">
          <div class="incid-kpi__val">{{ incidKpis.atrasos }}</div>
          <div class="incid-kpi__label">Atrasos</div>
        </div>
        <div class="incid-kpi incid-kpi--red">
          <div class="incid-kpi__val">{{ incidKpis.ausencias }}</div>
          <div class="incid-kpi__label">Ausencias</div>
        </div>
        <div class="incid-kpi incid-kpi--purple">
          <div class="incid-kpi__val">{{ incidKpis.horasExtra }}</div>
          <div class="incid-kpi__label">Con horas extra</div>
        </div>
        <div class="incid-kpi incid-kpi--neutral">
          <div class="incid-kpi__val">{{ incidKpis.total }}</div>
          <div class="incid-kpi__label">Total incidencias</div>
        </div>
      </div>

      <!-- Tabla de incidencias -->
      <div class="incid-table-wrap">
        <table class="incid-table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Fecha</th>
              <th>Trabajador</th>
              <th>Cargo</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="inc in incidenciasFiltradas" :key="`${inc.tipo}-${inc.fecha}-${inc.trabajador_id}`">
              <td>
                <span class="incid-badge" :class="`incid-badge--${inc.tipo}`">
                  <i :class="inc.tipo === 'atraso' ? 'u u-reloj' : inc.tipo === 'ausencia' ? 'u u-cerrar' : 'u u-cobros-y-pagos'"></i>
                  {{ inc.tipo === 'atraso' ? 'Atraso' : inc.tipo === 'ausencia' ? 'Ausencia' : 'Hora extra' }}
                </span>
              </td>
              <td class="incid-fecha">{{ new Date(inc.fecha + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' }) }}</td>
              <td>
                <div class="worker-cell-sm">
                  <div class="avatar-xs" :style="{ background: avatarColor(inc.trabajador_id) }">
                    {{ initiales(inc.trabajador) }}
                  </div>
                  <span class="incid-nombre">{{ inc.trabajador }}</span>
                </div>
              </td>
              <td class="incid-cargo">{{ inc.cargo || '—' }}</td>
              <td class="incid-detalle">{{ inc.detalle }}</td>
            </tr>
            <tr v-if="!incidenciasFiltradas.length">
              <td colspan="5" class="incid-empty">
                <i class="u u-check" style="color:#3ac7a5;font-size:20px"></i>
                <span>Sin incidencias para el período seleccionado</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>
    <!-- ── /Incidencias ───────────────────────────────────────────────────── -->

  </div>

  <!-- ── Panel detalle de proyecto ──────────────────────────────────────── -->
  <Teleport to="body">
    <!-- Overlay -->
    <Transition name="fade">
      <div v-if="showProyPanel" class="proy-overlay" @click="cerrarProyPanel"></div>
    </Transition>

    <!-- Drawer panel -->
    <Transition name="slide-right">
      <div v-if="showProyPanel && proyectoPanel" class="proy-panel">

        <!-- Header -->
        <div class="proy-panel__header">
          <div class="proy-panel__icon">
            <span class="u u-grid" style="font-size:20px;color:#3ac7a5"></span>
          </div>
          <div class="proy-panel__title-col">
            <h2 class="proy-panel__title">{{ proyectoPanel.nombre }}</h2>
            <span class="proy-panel__sub">{{ proyectoPanel.marcaciones.length }} marcaciones · {{ proyectoPanel.trabajadoresIds.size }} trabajadores</span>
          </div>
          <button class="proy-panel__close" @click="cerrarProyPanel">
            <span class="u u-cerrar" style="font-size:14px"></span>
          </button>
        </div>

        <!-- Stats compactos -->
        <div class="proy-panel__stats">
          <div class="proy-pstat">
            <span class="proy-pstat__val">{{ proyectoPanel.totalHoras.toFixed(1) }}h</span>
            <span class="proy-pstat__label">Horas</span>
          </div>
          <div class="proy-pstat">
            <span class="proy-pstat__val purple">{{ proyectoPanel.totalExtra.toFixed(1) }}h</span>
            <span class="proy-pstat__label">Extra</span>
          </div>
          <div class="proy-pstat">
            <span class="proy-pstat__val orange" v-if="proyectoPanel.pendientes > 0">{{ proyectoPanel.pendientes }}</span>
            <span class="proy-pstat__val teal" v-else>✓</span>
            <span class="proy-pstat__label">Pendientes</span>
          </div>
          <div class="proy-pstat">
            <span class="proy-pstat__val teal">{{ proyectoPanel.marcaciones.filter(m=>m.estado==='aprobado').length }}</span>
            <span class="proy-pstat__label">Aprobadas</span>
          </div>
        </div>

        <!-- Fecha de hoy -->
        <div class="proy-panel__date-label">
          <span class="u u-fecha" style="font-size:13px;color:#6b7280"></span>
          Hoy: {{ new Date().toLocaleDateString('es-CL', { weekday:'long', day:'numeric', month:'long' }) }}
        </div>

        <!-- Lista de trabajadores -->
        <div class="proy-panel__workers">
          <div
            v-for="wid in [...proyectoPanel.trabajadoresIds]"
            :key="wid"
            class="proy-pw"
            @click.stop="abrirMarcar(wid, proyectoPanel)"
          >
            <!-- Avatar -->
            <div class="proy-pw__avatar" :style="{ background: avatarColor(wid) }">
              <img v-if="getWorker(wid)?.foto" :src="getWorker(wid).foto" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />
              <template v-else>{{ initiales(getWorker(wid)?.nombre) }}</template>
            </div>

            <!-- Info -->
            <div class="proy-pw__info">
              <span class="proy-pw__name">{{ getWorker(wid)?.nombre || wid }}</span>
              <div class="proy-pw__chips">
                <span class="wchip">{{ proyectoPanel.marcaciones.filter(m=>m.trabajador_id===wid).length }} reg.</span>
                <span class="wchip teal">{{ proyectoPanel.marcaciones.filter(m=>m.trabajador_id===wid).reduce((s,m)=>s+(m.horas_trabajadas||0),0).toFixed(1) }}h</span>
              </div>
            </div>

            <!-- Estado hoy -->
            <div class="proy-pw__estado">
              <template v-if="estadoHoy(wid) === 'completo'">
                <span class="estado-pill completo">
                  <span class="u u-check" style="font-size:11px"></span>
                  Completo
                </span>
              </template>
              <template v-else-if="estadoHoy(wid) === 'entrada'">
                <div class="estado-pill entrada">
                  <span>↪ {{ marcacionHoy(wid)?.entrada }}</span>
                </div>
                <span class="marcar-hint">Tap para salida</span>
              </template>
              <template v-else>
                <span class="estado-pill sin-marcar">Sin marcar</span>
                <span class="marcar-hint">Tap para marcar</span>
              </template>
            </div>
          </div>
        </div>

      </div>
    </Transition>
  </Teleport>

  <!-- ── Modal rápido de marcación ──────────────────────────────────────── -->
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="showMarcar" class="marcar-overlay" @click.self="cerrarMarcar">
        <Transition name="slide-up">
          <div v-if="showMarcar" class="marcar-modal">

            <!-- Handle bar (mobile) -->
            <div class="marcar-handle"></div>

            <!-- Worker header -->
            <div class="marcar-worker-header">
              <div class="marcar-avatar" :style="{ background: avatarColor(marcarWorker) }">
                <img v-if="getWorker(marcarWorker)?.foto" :src="getWorker(marcarWorker).foto" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />
                <template v-else>{{ initiales(getWorker(marcarWorker)?.nombre) }}</template>
              </div>
              <div>
                <div class="marcar-worker-name">{{ getWorker(marcarWorker)?.nombre || marcarWorker }}</div>
                <div class="marcar-worker-sub">{{ marcarGrupo?.nombre }}</div>
              </div>
            </div>

            <!-- Estado actual -->
            <div v-if="estadoHoy(marcarWorker) === 'entrada'" class="marcar-status-row">
              <span class="marcar-status-badge entrada">Entrada registrada: {{ marcacionHoy(marcarWorker)?.entrada }}</span>
            </div>
            <div v-else-if="estadoHoy(marcarWorker) === 'completo'" class="marcar-status-row">
              <span class="marcar-status-badge completo">
                {{ marcacionHoy(marcarWorker)?.entrada }} → {{ marcacionHoy(marcarWorker)?.salida }}
                · {{ marcacionHoy(marcarWorker)?.horas_trabajadas }}h
              </span>
            </div>

            <!-- Hora -->
            <div class="marcar-hora-row" v-if="marcarTipo !== 'completo'">
              <label class="marcar-hora-label">
                {{ marcarTipo === 'sin_marcar' ? 'Hora de Entrada' : 'Hora de Salida' }}
              </label>
              <div class="marcar-hora-inputs">
                <input type="time" v-model="marcarHora" class="marcar-time-input" />
                <button class="btn-ahora" @click="marcarHora = horaAhora()">Ahora</button>
              </div>
            </div>

            <!-- Error -->
            <div v-if="marcarError" class="marcar-error">⚠ {{ marcarError }}</div>

            <!-- Botones de acción -->
            <div class="marcar-actions">
              <button class="marcar-btn-cancel" @click="cerrarMarcar">Cancelar</button>
              <button
                v-if="marcarTipo === 'sin_marcar'"
                class="marcar-btn-entrada"
                :disabled="marcarGuardando"
                @click="ejecutarMarcacion"
              >
                <span class="u u-plus" style="font-size:14px"></span>
                {{ marcarGuardando ? 'Registrando...' : 'Registrar Entrada' }}
              </button>
              <button
                v-else-if="marcarTipo === 'entrada'"
                class="marcar-btn-salida"
                :disabled="marcarGuardando"
                @click="ejecutarMarcacion"
              >
                <span class="u u-check" style="font-size:14px"></span>
                {{ marcarGuardando ? 'Registrando...' : 'Registrar Salida' }}
              </button>
              <div v-else class="marcar-btn-done">✓ Jornada completa</div>
            </div>

          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>

</template>

<style scoped>
.marc-page { padding: 24px 28px; display: flex; flex-direction: column; gap: 16px; }

/* Filtros */
.filter-bar {
  display: flex; flex-wrap: wrap; gap: 12px;
  background: var(--neutral-background-default, #ffffff);
  border: 1.5px solid rgba(255,255,255,0.07);
  border-radius: 12px;
  padding: 14px 18px;
}
.filter-group {
  display: flex; flex-direction: column; gap: 4px;
}
.filter-group label {
  font-size: 11px; font-weight: 600; color: var(--neutral-text-subtitle, #6b7280); text-transform: uppercase; letter-spacing: 0.07em;
}
.filter-group input, .filter-group select {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  padding: 6px 10px;
  color: var(--neutral-text-title, #111827);
  font-size: 13px; font-family: inherit;
  outline: none;
}
.filter-group input:focus, .filter-group select:focus { border-color: rgba(58,199,165,0.5); }
.filter-group select option { background: var(--neutral-background-default, #ffffff); }

/* KPIs mini */
.kpi-mini-row { display: flex; gap: 12px; flex-wrap: wrap; }
.kpi-mini {
  background: var(--neutral-background-default, #ffffff);
  border: 1.5px solid rgba(255,255,255,0.07);
  border-radius: 10px;
  padding: 10px 16px;
  display: flex; flex-direction: column; gap: 2px;
  flex: 1; min-width: 90px;
}
.kpi-mini-val   { font-size: 22px; font-weight: 800; color: var(--neutral-text-title, #111827); }
.kpi-mini-label { font-size: 11px; color: var(--neutral-text-subtitle, #6b7280); }
.kpi-mini--orange .kpi-mini-val { color: #f4a261; }
.kpi-mini--red    .kpi-mini-val { color: #f87171; }
.kpi-mini--purple .kpi-mini-val { color: #a78bfa; }
.kpi-mini--teal   .kpi-mini-val { color: #3ac7a5; }

/* Table */
.table-card {
  background: var(--neutral-background-default, #ffffff);
  border: 1.5px solid rgba(255,255,255,0.07);
  border-radius: 14px;
  overflow: auto;
}
.marc-table { width: 100%; border-collapse: collapse; font-size: 12.5px; white-space: nowrap; }
.marc-table th {
  padding: 10px 12px;
  text-align: left;
  font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--neutral-text-subtitle, #6b7280);
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.marc-table td {
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  color: var(--neutral-text-body, #374151); vertical-align: middle;
}
.marc-table tbody tr:hover td { background: rgba(58,199,165,0.03); }
.row-modified td { background: rgba(133,140,240,0.05); }
.row-edit td { background: rgba(58,199,165,0.05); padding: 0; }

/* Cells */
.worker-cell { display: flex; align-items: center; gap: 7px; }
.avatar-xs {
  width: 26px; height: 26px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700; color: #fff; flex-shrink: 0;
}
.worker-name-sm { font-size: 12.5px; font-weight: 600; color: var(--neutral-text-title, #111827); }
.fecha-col { font-size: 12px; color: var(--neutral-text-caption, #6b7280); text-transform: capitalize; }
.text-muted-sm { font-size: 12px; color: var(--neutral-text-subtitle, #6b7280); }
.text-num { font-variant-numeric: tabular-nums; }
.mono { font-family: 'Roboto Mono', monospace; font-size: 12px; }
.text-orange { color: #f4a261; }

/* Project cell */
.proyecto-cell { display: flex; flex-direction: column; gap: 2px; max-width: 180px; }
.proj-name { font-size: 12px; font-weight: 600; color: var(--neutral-text-body, #374151); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.linea-code { font-size: 11px; color: var(--neutral-text-subtitle, #6b7280); display: flex; align-items: center; gap: 4px; }
.code-badge {
  background: rgba(133,140,240,0.15); color: #a78bfa;
  padding: 1px 5px; border-radius: 4px; font-size: 10px; font-weight: 700;
}

/* Badges */
.badge { padding: 2px 8px; border-radius: 20px; font-weight: 600; }
.badge.sm { font-size: 10.5px; }
.badge-ok    { background: rgba(58,199,165,0.12); color: #3ac7a5; }
.badge-pend  { background: rgba(244,162,97,0.12); color: #f4a261; }
.badge-red   { background: rgba(239,68,68,0.12);  color: #f87171; }
.badge-norm  { background: rgba(107,114,128,0.12);color: var(--neutral-text-caption, #6b7280); }
.badge-extra { background: rgba(133,140,240,0.15);color: #a78bfa; }
.badge-late  { background: rgba(244,162,97,0.15); color: #f4a261; }
.badge-aus   { background: rgba(239,68,68,0.12);  color: #f87171; }

.badge-extra-sm { color: #a78bfa; font-size: 11px; font-weight: 700; }
.badge-late-sm  { color: #f4a261; font-size: 11px; font-weight: 700; }

/* Actions */
.actions-cell { display: flex; gap: 4px; }
.btn-act {
  background: none; border: 1px solid rgba(255,255,255,0.1);
  color: var(--neutral-text-subtitle, #6b7280); border-radius: 7px;
  width: 26px; height: 26px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; font-size: 12px; transition: all 0.15s;
}
.btn-act:hover { background: rgba(255,255,255,0.07); color: var(--neutral-text-title, #111827); }
.btn-act--green:hover { background: rgba(74,222,128,0.1); color: #4ade80; border-color: rgba(74,222,128,0.3); }
.btn-act--red:hover   { background: rgba(239,68,68,0.1);  color: #f87171; border-color: rgba(239,68,68,0.3); }

/* Edit form */
.edit-form { padding: 14px 16px; }
.edit-grid { display: flex; flex-wrap: wrap; gap: 12px; }
.ef { display: flex; flex-direction: column; gap: 4px; min-width: 140px; }
.ef--wide { flex: 2; min-width: 220px; }
.ef label { font-size: 11px; font-weight: 600; color: var(--neutral-text-subtitle, #6b7280); }
.ef input, .ef select {
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 7px; padding: 6px 10px;
  color: var(--neutral-text-title, #111827); font-size: 12.5px; font-family: inherit; outline: none;
}
.ef input:focus, .ef select:focus { border-color: rgba(58,199,165,0.5); }
.ef select option { background: var(--neutral-background-default, #ffffff); }

.edit-actions { display: flex; gap: 8px; margin-top: 12px; justify-content: flex-end; }

.btn-primary-sm {
  background: #2a9d8f; border: none; color: #fff; border-radius: 8px;
  padding: 7px 14px; font-size: 12px; font-weight: 700; cursor: pointer;
  display: flex; align-items: center; gap: 5px; font-family: inherit;
}
.btn-primary-sm:disabled { opacity: 0.5; }
.btn-ghost-sm {
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12);
  color: var(--neutral-text-caption, #6b7280); border-radius: 8px;
  padding: 7px 14px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit;
}

/* ── Toggle de vista ──────────────────────────────────────────────── */
.marc-vista-toggle {
  display: flex;
  background: rgba(255,255,255,0.05);
  border: 1.5px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  width: fit-content;
  overflow: hidden;
}
.marc-vbtn {
  display: flex; align-items: center; gap: 5px;
  padding: 0 14px; height: 32px;
  font-family: Nunito; font-size: 12px; font-weight: 600;
  color: var(--neutral-text-subtitle, #6b7280); background: transparent; border: none; cursor: pointer;
  transition: all .15s;
}
.marc-vbtn + .marc-vbtn { border-left: 1px solid rgba(255,255,255,0.08); }
.marc-vbtn:hover { color: var(--neutral-text-title, #111827); background: rgba(255,255,255,0.05); }
.marc-vbtn.active { color: #3ac7a5; background: rgba(58,199,165,0.1); }

/* ── Grid de proyectos (marcaciones) ─────────────────────────────── */
.marc-proy-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 18px;
}
.marc-proy-empty {
  grid-column: 1 / -1;
  text-align: center; padding: 48px; color: var(--neutral-text-subtitle, #6b7280); font-size: 14px;
}

/* Tarjeta */
.marc-proy-card {
  background: var(--neutral-background-default, #ffffff);
  border: 1.5px solid rgba(255,255,255,0.07);
  border-radius: 14px;
  overflow: hidden;
  transition: border-color .15s, box-shadow .15s;
}
.marc-proy-card:hover {
  border-color: rgba(58,199,165,0.25);
  box-shadow: 0 6px 24px rgba(0,0,0,0.25);
}

/* Header */
.marc-proy-card__header {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
}
.marc-proy-card__icon {
  width: 38px; height: 38px; border-radius: 10px;
  background: rgba(58,199,165,0.1); border: 1px solid rgba(58,199,165,0.2);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.marc-proy-card__title-col { flex: 1; min-width: 0; }
.marc-proy-card__title {
  margin: 0; font-size: 14px; font-weight: 800; color: var(--neutral-text-title, #111827);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.marc-proy-card__sub { font-size: 11px; color: var(--neutral-text-subtitle, #6b7280); }
.marc-proy-card__badges { display: flex; gap: 5px; align-items: flex-start; flex-shrink: 0; }
.mproy-badge {
  padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 700;
}
.mproy-badge.orange { background: rgba(244,162,97,0.15); color: #f4a261; }
.mproy-badge.red    { background: rgba(239,68,68,0.12);  color: #f87171; }

/* Stats */
.marc-proy-card__stats {
  display: flex; border-bottom: 1px solid rgba(255,255,255,0.06);
}
.marc-proy-stat {
  flex: 1;
  display: flex; flex-direction: column; gap: 2px;
  padding: 10px 14px;
  border-right: 1px solid rgba(255,255,255,0.06);
}
.marc-proy-stat:last-child { border-right: none; }
.marc-proy-stat__val {
  font-size: 16px; font-weight: 800; color: var(--neutral-text-title, #111827);
}
.marc-proy-stat__val.teal   { color: #3ac7a5; }
.marc-proy-stat__val.purple { color: #a78bfa; }
.marc-proy-stat__label { font-size: 10px; color: var(--neutral-text-subtitle, #6b7280); text-transform: uppercase; letter-spacing: 0.05em; }

/* Workers list */
.marc-proy-workers { display: flex; flex-direction: column; }
.marc-proy-worker {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.marc-proy-worker:last-child { border-bottom: none; }
.marc-proy-worker__info {
  display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 0;
}
.marc-proy-worker__name {
  font-size: 12.5px; font-weight: 700; color: var(--neutral-text-title, #111827);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.marc-proy-worker__chips {
  display: flex; gap: 5px; flex-wrap: wrap;
}
.wchip {
  font-size: 10px; font-weight: 600; color: var(--neutral-text-subtitle, #6b7280);
  background: rgba(255,255,255,0.06);
  padding: 1px 6px; border-radius: 4px;
}
.wchip.teal   { background: rgba(58,199,165,0.1);   color: #3ac7a5; }
.wchip.purple { background: rgba(133,140,240,0.12); color: #a78bfa; }

/* Mini dots timeline */
.marc-mini-row {
  display: flex; align-items: center; gap: 3px; flex-shrink: 0;
}
.marc-mini-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #374151;
  transition: transform .1s;
}
.marc-mini-dot.aprobado  { background: #3ac7a5; }
.marc-mini-dot.pendiente { background: #f4a261; }
.marc-mini-dot.rechazado { background: #f87171; }
.marc-mini-dot:hover { transform: scale(1.4); }
.marc-mini-more { font-size: 10px; color: var(--neutral-text-subtitle, #6b7280); margin-left: 2px; }

/* ── Panel de proyecto (slide-in desde la derecha) ───────────────── */
.proy-overlay {
  position: fixed; inset: 0; z-index: 400;
  background: rgba(0,0,0,0.55);
  backdrop-filter: blur(3px);
}
.proy-panel {
  position: fixed; top: 0; right: 0; bottom: 0; z-index: 401;
  width: min(480px, 100vw);
  background: #131f2b;
  border-left: 1.5px solid rgba(255,255,255,0.08);
  display: flex; flex-direction: column;
  overflow: hidden;
  box-shadow: -8px 0 40px rgba(0,0,0,0.45);
}

.proy-panel__header {
  display: flex; align-items: center; gap: 12px;
  padding: 16px 18px;
  background: #1a2a38;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  flex-shrink: 0;
}
.proy-panel__icon {
  width: 40px; height: 40px; border-radius: 11px;
  background: rgba(58,199,165,0.12);
  border: 1px solid rgba(58,199,165,0.25);
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; flex-shrink: 0;
}
.proy-panel__title-col { flex: 1; min-width: 0; }
.proy-panel__title {
  margin: 0; font-size: 15px; font-weight: 800; color: var(--neutral-text-title, #111827);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.proy-panel__sub { display: block; margin: 2px 0 0; font-size: 11px; color: var(--neutral-text-subtitle, #6b7280); }

.proy-panel__close {
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.1);
  color: var(--neutral-text-caption, #6b7280); border-radius: 8px;
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; font-size: 16px; flex-shrink: 0;
  transition: all .15s;
}
.proy-panel__close:hover { background: rgba(239,68,68,0.15); color: #f87171; border-color: rgba(239,68,68,0.3); }

.proy-panel__stats {
  display: flex;
  padding: 12px 18px; gap: 10px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}
.proy-pstat {
  flex: 1;
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--neutral-border-light, #e2e8f0);
  border-radius: 10px;
  padding: 10px 12px;
  display: flex; flex-direction: column; gap: 2px;
}
.proy-pstat__val { font-size: 18px; font-weight: 800; color: var(--neutral-text-title, #111827); }
.proy-pstat__val.teal   { color: #3ac7a5; }
.proy-pstat__val.orange { color: #f4a261; }
.proy-pstat__val.red    { color: #f87171; }
.proy-pstat__val.purple { color: #a78bfa; }
.proy-pstat__label { font-size: 10px; font-weight: 600; color: var(--neutral-text-subtitle, #6b7280); text-transform: uppercase; letter-spacing: 0.05em; }

.proy-panel__date-label {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 18px;
  font-size: 12px; color: var(--neutral-text-subtitle, #6b7280);
  border-bottom: 1px solid rgba(255,255,255,0.05);
  flex-shrink: 0; text-transform: capitalize;
}

.proy-panel__workers {
  flex: 1; overflow-y: auto;
  padding: 12px;
  display: flex; flex-direction: column; gap: 6px;
}
.proy-panel__workers::-webkit-scrollbar { width: 4px; }
.proy-panel__workers::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

/* Fila de trabajador en el panel */
.proy-pw {
  display: flex; align-items: center; gap: 12px;
  min-height: 56px; padding: 10px 14px;
  background: rgba(255,255,255,0.04);
  border: 1.5px solid rgba(255,255,255,0.06);
  border-radius: 11px;
  cursor: pointer;
  transition: background .15s, border-color .15s;
  -webkit-tap-highlight-color: transparent;
}
.proy-pw:hover { background: rgba(255,255,255,0.08); border-color: rgba(58,199,165,0.2); }
.proy-pw:active { background: rgba(58,199,165,0.08); }

.proy-pw__avatar {
  width: 36px; height: 36px; border-radius: 50%;
  background: rgba(58,199,165,0.12);
  border: 1.5px solid rgba(58,199,165,0.2);
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 700; color: #3ac7a5;
  flex-shrink: 0;
}
.proy-pw__info { flex: 1; min-width: 0; }
.proy-pw__name {
  font-size: 13px; font-weight: 700; color: var(--neutral-text-title, #111827);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.proy-pw__sub { font-size: 11px; color: var(--neutral-text-subtitle, #6b7280); margin-top: 1px; }

/* Estado dentro del panel / worker row */
.proy-pw__estado {
  display: flex; flex-direction: column; align-items: flex-end; gap: 3px; flex-shrink: 0;
}
.marcar-hint {
  font-size: 10px; color: #4b5563; margin-top: 2px;
}

/* Estado pill */
.estado-pill {
  display: flex; align-items: center; gap: 5px;
  padding: 3px 9px; border-radius: 20px;
  font-size: 11px; font-weight: 700; flex-shrink: 0;
  white-space: nowrap;
}
.estado-pill.sin-marcar {
  background: rgba(107,114,128,0.12);
  border: 1px solid rgba(107,114,128,0.2);
  color: var(--neutral-text-caption, #6b7280);
}
.estado-pill.entrada {
  background: rgba(244,162,97,0.12);
  border: 1px solid rgba(244,162,97,0.25);
  color: #f4a261;
}
.estado-pill.completo {
  background: rgba(58,199,165,0.12);
  border: 1px solid rgba(58,199,165,0.25);
  color: #3ac7a5;
}

/* ── Modal de marcación (slide-up bottom sheet) ───────────────────── */
.marcar-overlay {
  position: fixed; inset: 0; z-index: 500;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px);
}
.marcar-modal {
  position: fixed; left: 50%; bottom: 0; z-index: 501;
  transform: translateX(-50%);
  width: min(480px, 100vw);
  background: #131f2b;
  border-radius: 20px 20px 0 0;
  border-top: 1.5px solid rgba(255,255,255,0.1);
  overflow: hidden;
  box-shadow: 0 -12px 48px rgba(0,0,0,0.5);
}
.marcar-handle {
  width: 40px; height: 4px; border-radius: 4px;
  background: rgba(255,255,255,0.15);
  margin: 12px auto 0;
}
.marcar-worker-header {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 20px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
}
.marcar-avatar {
  width: 40px; height: 40px; border-radius: 50%;
  background: rgba(58,199,165,0.12);
  border: 1.5px solid rgba(58,199,165,0.25);
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; font-weight: 700; color: #3ac7a5;
  flex-shrink: 0; overflow: hidden;
}
.marcar-worker-name { font-size: 15px; font-weight: 800; color: var(--neutral-text-title, #111827); }
.marcar-worker-sub  { font-size: 12px; color: var(--neutral-text-subtitle, #6b7280); margin-top: 2px; }

.marcar-status-row {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.marcar-status-badge {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 12px; border-radius: 20px;
  font-size: 12px; font-weight: 700;
}
.marcar-status-badge.entrada  { background: rgba(244,162,97,0.12); border: 1px solid rgba(244,162,97,0.25); color: #f4a261; }
.marcar-status-badge.completo { background: rgba(58,199,165,0.12); border: 1px solid rgba(58,199,165,0.25); color: #3ac7a5; }

.marcar-hora-row {
  display: flex; flex-direction: column; gap: 8px;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.marcar-hora-label { font-size: 11px; font-weight: 700; color: var(--neutral-text-subtitle, #6b7280); text-transform: uppercase; letter-spacing: 0.05em; }
.marcar-hora-inputs {
  display: flex; align-items: center; gap: 10px;
}
.marcar-time-input {
  flex: 1;
  background: rgba(255,255,255,0.07);
  border: 1.5px solid rgba(255,255,255,0.12);
  border-radius: 10px;
  padding: 10px 14px;
  color: var(--neutral-text-title, #111827); font-size: 16px; font-weight: 700;
  font-family: 'SF Mono', 'Fira Code', monospace;
  outline: none; text-align: center;
}
.marcar-time-input:focus { border-color: rgba(58,199,165,0.5); }
.btn-ahora {
  background: rgba(58,199,165,0.1);
  border: 1px solid rgba(58,199,165,0.25);
  color: #3ac7a5; border-radius: 9px;
  padding: 9px 14px; font-size: 12px; font-weight: 700;
  cursor: pointer; font-family: inherit; transition: all .15s; white-space: nowrap;
}
.btn-ahora:hover { background: rgba(58,199,165,0.2); }

.marcar-actions {
  display: flex; gap: 10px;
  padding: 14px 20px 28px;
}
.marcar-btn-cancel {
  height: 52px; padding: 0 18px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  color: var(--neutral-text-caption, #6b7280); border-radius: 13px;
  font-size: 14px; font-weight: 700;
  cursor: pointer; font-family: inherit;
  transition: all .15s;
  -webkit-tap-highlight-color: transparent;
}
.marcar-btn-cancel:hover { background: rgba(255,255,255,0.1); color: var(--neutral-text-title, #111827); }

.marcar-btn-done {
  flex: 1; height: 52px; border-radius: 13px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(58,199,165,0.08);
  border: 1.5px solid rgba(58,199,165,0.2);
  color: #3ac7a5; font-size: 14px; font-weight: 800;
}

.marcar-btn-entrada {
  flex: 1; height: 52px; border: none; border-radius: 13px;
  background: linear-gradient(135deg, #2a9d8f, #3ac7a5);
  color: #fff; font-size: 15px; font-weight: 800;
  cursor: pointer; font-family: inherit;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  transition: opacity .15s, transform .1s;
  -webkit-tap-highlight-color: transparent;
}
.marcar-btn-entrada:hover { opacity: 0.9; }
.marcar-btn-entrada:active { transform: scale(0.97); }
.marcar-btn-entrada:disabled { opacity: 0.45; cursor: default; }

.marcar-btn-salida {
  flex: 1; height: 52px; border: none; border-radius: 13px;
  background: linear-gradient(135deg, #b45309, #f4a261);
  color: #fff; font-size: 15px; font-weight: 800;
  cursor: pointer; font-family: inherit;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  transition: opacity .15s, transform .1s;
  -webkit-tap-highlight-color: transparent;
}
.marcar-btn-salida:hover { opacity: 0.9; }
.marcar-btn-salida:active { transform: scale(0.97); }
.marcar-btn-salida:disabled { opacity: 0.45; cursor: default; }

.marcar-error {
  margin: 0 20px 12px;
  padding: 10px 14px;
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.25);
  border-radius: 9px;
  color: #f87171; font-size: 12px;
}

/* ── Transiciones Vue ────────────────────────────────────────────── */
/* Overlay fade */
.fade-enter-active, .fade-leave-active { transition: opacity .25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* Panel slide-in desde la derecha */
.slide-right-enter-active { transition: transform .28s cubic-bezier(0.22,1,0.36,1); }
.slide-right-leave-active { transition: transform .22s cubic-bezier(0.55,0,1,0.45); }
.slide-right-enter-from  { transform: translateX(100%); }
.slide-right-leave-to    { transform: translateX(100%); }

/* Modal slide-up desde abajo */
.slide-up-enter-active { transition: transform .3s cubic-bezier(0.22,1,0.36,1); }
.slide-up-leave-active { transition: transform .22s cubic-bezier(0.55,0,1,0.45); }
.slide-up-enter-from  { transform: translateX(-50%) translateY(100%); }
.slide-up-leave-to    { transform: translateX(-50%) translateY(100%); }

/* ── Responsive (iPad y móvil) ───────────────────────────────────── */
@media (max-width: 768px) {
  .marc-proy-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .proy-panel {
    width: 100vw;
    border-left: none;
    border-top: 1.5px solid rgba(255,255,255,0.08);
  }
  .marcar-modal {
    border-radius: 20px 20px 0 0;
  }
}
@media (min-width: 769px) and (max-width: 1024px) {
  /* iPad landscape: panel toma 55% del ancho */
  .proy-panel { width: min(520px, 55vw); }
  .marc-proy-grid { grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* ── Incidencias ────────────────────────────────────────────────────────── */
/* ═══════════════════════════════════════════════════════════════════════════ */

.incid-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Header */
.incid-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.incid-periodo {
  display: flex;
  align-items: center;
  gap: 8px;
}

.incid-header__label {
  font-size: 12px;
  color: var(--neutral-text-subtitle, #6b7280);
  margin-right: 4px;
}

.incid-periodo-btn {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: var(--neutral-text-caption, #6b7280);
  border-radius: 6px;
  padding: 5px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.incid-periodo-btn.active,
.incid-periodo-btn:hover {
  background: rgba(58,199,165,0.12);
  border-color: rgba(58,199,165,0.3);
  color: #3ac7a5;
}

.incid-tipo-filter {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.incid-tipo-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: var(--neutral-text-caption, #6b7280);
  border-radius: 20px;
  padding: 5px 14px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.incid-tipo-btn.active,
.incid-tipo-btn:hover { background: rgba(255,255,255,0.1); color: var(--neutral-text-title, #111827); }

.incid-tipo-btn--atraso.active   { background: rgba(244,162,97,0.15); border-color: rgba(244,162,97,0.3); color: #f4a261; }
.incid-tipo-btn--ausencia.active { background: rgba(239,68,68,0.12);  border-color: rgba(239,68,68,0.25); color: #f87171; }
.incid-tipo-btn--extra.active    { background: rgba(133,140,240,0.15);border-color: rgba(133,140,240,0.3);color: #858cf0; }

.incid-count {
  background: rgba(255,255,255,0.1);
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 700;
}

/* KPI mini */
.incid-kpis {
  display: flex;
  gap: 12px;
}

.incid-kpi {
  flex: 1;
  background: var(--neutral-background-default, #ffffff);
  border: 1.5px solid rgba(255,255,255,0.07);
  border-radius: 12px;
  padding: 14px 16px;
  text-align: center;
}

.incid-kpi__val {
  font-size: 28px;
  font-weight: 800;
  line-height: 1;
  margin-bottom: 4px;
}

.incid-kpi__label {
  font-size: 11px;
  color: var(--neutral-text-subtitle, #6b7280);
}

.incid-kpi--orange  { border-color: rgba(244,162,97,0.2); }
.incid-kpi--orange  .incid-kpi__val { color: #f4a261; }
.incid-kpi--red     { border-color: rgba(239,68,68,0.2); }
.incid-kpi--red     .incid-kpi__val { color: #f87171; }
.incid-kpi--purple  { border-color: rgba(133,140,240,0.2); }
.incid-kpi--purple  .incid-kpi__val { color: #858cf0; }
.incid-kpi--neutral .incid-kpi__val { color: var(--neutral-text-title, #111827); }

/* Table */
.incid-table-wrap {
  background: var(--neutral-background-default, #ffffff);
  border: 1.5px solid rgba(255,255,255,0.07);
  border-radius: 14px;
  overflow: hidden;
}

.incid-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.incid-table th {
  padding: 11px 16px;
  text-align: left;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--neutral-text-caption, #6b7280);
  background: rgba(255,255,255,0.025);
  border-bottom: 1px solid rgba(255,255,255,0.08);
}

.incid-table td {
  padding: 13px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  color: var(--neutral-text-title, #1f2937);
  vertical-align: middle;
}

.incid-table tbody tr:hover td { background: rgba(58,199,165,0.03); }

/* Badges */
.incid-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
}
.incid-badge--atraso    { background: rgba(244,162,97,0.15); color: #f4a261; }
.incid-badge--ausencia  { background: rgba(239,68,68,0.12);  color: #f87171; }
.incid-badge--hora_extra{ background: rgba(133,140,240,0.15);color: #858cf0; }

.incid-fecha {
  font-size: 12px;
  color: var(--neutral-text-caption, #6b7280);
  text-transform: capitalize;
  white-space: nowrap;
}

.incid-nombre { font-weight: 600; color: var(--neutral-text-title, #111827); }
.incid-cargo  { font-size: 12px; color: var(--neutral-text-subtitle, #6b7280); }

.incid-detalle {
  font-size: 13px;
  color: var(--neutral-text-body, #374151);
}

.incid-empty {
  text-align: center;
  padding: 40px;
  color: var(--neutral-text-subtitle, #6b7280);
  font-size: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

/* Worker cell small */
.worker-cell-sm {
  display: flex;
  align-items: center;
  gap: 8px;
}

.avatar-xs {
  width: 28px; height: 28px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700; color: #fff;
  flex-shrink: 0;
}
</style>
