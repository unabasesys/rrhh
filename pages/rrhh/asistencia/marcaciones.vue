<script setup>
/**
 * pages/rrhh/asistencia/marcaciones.vue
 * Registro completo de marcaciones con corrección del supervisor y asignación
 * de proyecto / línea presupuestal.
 */
import { ref, computed, onMounted } from 'vue'
import { useAsistenciaStore } from '@/stores/asistencia'
import useRrhhStore from '@/stores/rrhh'
import useGlobalStore from '@/stores/global'

definePageMeta({ layout: 'rrhh' })

const asistencia = useAsistenciaStore()
const rrhhStore  = useRrhhStore()
const global     = useGlobalStore()

onMounted(async () => {
  asistencia.init()
  global.title     = 'Marcaciones'
  global.namePage  = 'RRHH'
  global.breadcrumb = [
    { name: 'RRHH',       path: '/rrhh/trabajadores' },
    { name: 'Asistencia', path: '/rrhh/asistencia' },
    { name: 'Marcaciones' },
  ]
  if (!rrhhStore.trabajadores?.length) {
    await rrhhStore.getTrabajadores()
  }
})

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
  const p = asistencia.getProyecto(editForm.value?.proyecto_id)
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
    const p = asistencia.getProyecto(m.proyecto_id)
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
          <option v-for="p in asistencia.proyectos" :key="p.id" :value="p.id">{{ p.nombre }}</option>
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
      <div v-for="grupo in marcacionesPorProyecto" :key="grupo.key" class="marc-proy-card">

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
                  <span class="proj-name">{{ asistencia.getProyecto(marc.proyecto_id)?.nombre || '—' }}</span>
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
                        <option v-for="p in asistencia.proyectos" :key="p.id" :value="p.id">{{ p.nombre }}</option>
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

  </div>
</template>

<style scoped>
.marc-page { padding: 24px 28px; display: flex; flex-direction: column; gap: 16px; }

/* Filtros */
.filter-bar {
  display: flex; flex-wrap: wrap; gap: 12px;
  background: #1e2d3a;
  border: 1.5px solid rgba(255,255,255,0.07);
  border-radius: 12px;
  padding: 14px 18px;
}
.filter-group {
  display: flex; flex-direction: column; gap: 4px;
}
.filter-group label {
  font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.07em;
}
.filter-group input, .filter-group select {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  padding: 6px 10px;
  color: #f3f4f6;
  font-size: 13px; font-family: inherit;
  outline: none;
}
.filter-group input:focus, .filter-group select:focus { border-color: rgba(58,199,165,0.5); }
.filter-group select option { background: #1e2d3a; }

/* KPIs mini */
.kpi-mini-row { display: flex; gap: 12px; flex-wrap: wrap; }
.kpi-mini {
  background: #1e2d3a;
  border: 1.5px solid rgba(255,255,255,0.07);
  border-radius: 10px;
  padding: 10px 16px;
  display: flex; flex-direction: column; gap: 2px;
  flex: 1; min-width: 90px;
}
.kpi-mini-val   { font-size: 22px; font-weight: 800; color: #f3f4f6; }
.kpi-mini-label { font-size: 11px; color: #6b7280; }
.kpi-mini--orange .kpi-mini-val { color: #f4a261; }
.kpi-mini--red    .kpi-mini-val { color: #f87171; }
.kpi-mini--purple .kpi-mini-val { color: #a78bfa; }
.kpi-mini--teal   .kpi-mini-val { color: #3ac7a5; }

/* Table */
.table-card {
  background: #1e2d3a;
  border: 1.5px solid rgba(255,255,255,0.07);
  border-radius: 14px;
  overflow: auto;
}
.marc-table { width: 100%; border-collapse: collapse; font-size: 12.5px; white-space: nowrap; }
.marc-table th {
  padding: 10px 12px;
  text-align: left;
  font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;
  color: #6b7280;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.marc-table td {
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  color: #d1d5db; vertical-align: middle;
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
.worker-name-sm { font-size: 12.5px; font-weight: 600; color: #f3f4f6; }
.fecha-col { font-size: 12px; color: #9ca3af; text-transform: capitalize; }
.text-muted-sm { font-size: 12px; color: #6b7280; }
.text-num { font-variant-numeric: tabular-nums; }
.mono { font-family: 'Roboto Mono', monospace; font-size: 12px; }
.text-orange { color: #f4a261; }

/* Project cell */
.proyecto-cell { display: flex; flex-direction: column; gap: 2px; max-width: 180px; }
.proj-name { font-size: 12px; font-weight: 600; color: #d1d5db; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.linea-code { font-size: 11px; color: #6b7280; display: flex; align-items: center; gap: 4px; }
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
.badge-norm  { background: rgba(107,114,128,0.12);color: #9ca3af; }
.badge-extra { background: rgba(133,140,240,0.15);color: #a78bfa; }
.badge-late  { background: rgba(244,162,97,0.15); color: #f4a261; }
.badge-aus   { background: rgba(239,68,68,0.12);  color: #f87171; }

.badge-extra-sm { color: #a78bfa; font-size: 11px; font-weight: 700; }
.badge-late-sm  { color: #f4a261; font-size: 11px; font-weight: 700; }

/* Actions */
.actions-cell { display: flex; gap: 4px; }
.btn-act {
  background: none; border: 1px solid rgba(255,255,255,0.1);
  color: #6b7280; border-radius: 7px;
  width: 26px; height: 26px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; font-size: 12px; transition: all 0.15s;
}
.btn-act:hover { background: rgba(255,255,255,0.07); color: #f3f4f6; }
.btn-act--green:hover { background: rgba(74,222,128,0.1); color: #4ade80; border-color: rgba(74,222,128,0.3); }
.btn-act--red:hover   { background: rgba(239,68,68,0.1);  color: #f87171; border-color: rgba(239,68,68,0.3); }

/* Edit form */
.edit-form { padding: 14px 16px; }
.edit-grid { display: flex; flex-wrap: wrap; gap: 12px; }
.ef { display: flex; flex-direction: column; gap: 4px; min-width: 140px; }
.ef--wide { flex: 2; min-width: 220px; }
.ef label { font-size: 11px; font-weight: 600; color: #6b7280; }
.ef input, .ef select {
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 7px; padding: 6px 10px;
  color: #f3f4f6; font-size: 12.5px; font-family: inherit; outline: none;
}
.ef input:focus, .ef select:focus { border-color: rgba(58,199,165,0.5); }
.ef select option { background: #1e2d3a; }

.edit-actions { display: flex; gap: 8px; margin-top: 12px; justify-content: flex-end; }

.btn-primary-sm {
  background: #2a9d8f; border: none; color: #fff; border-radius: 8px;
  padding: 7px 14px; font-size: 12px; font-weight: 700; cursor: pointer;
  display: flex; align-items: center; gap: 5px; font-family: inherit;
}
.btn-primary-sm:disabled { opacity: 0.5; }
.btn-ghost-sm {
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12);
  color: #9ca3af; border-radius: 8px;
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
  color: #6b7280; background: transparent; border: none; cursor: pointer;
  transition: all .15s;
}
.marc-vbtn + .marc-vbtn { border-left: 1px solid rgba(255,255,255,0.08); }
.marc-vbtn:hover { color: #f3f4f6; background: rgba(255,255,255,0.05); }
.marc-vbtn.active { color: #3ac7a5; background: rgba(58,199,165,0.1); }

/* ── Grid de proyectos (marcaciones) ─────────────────────────────── */
.marc-proy-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 18px;
}
.marc-proy-empty {
  grid-column: 1 / -1;
  text-align: center; padding: 48px; color: #6b7280; font-size: 14px;
}

/* Tarjeta */
.marc-proy-card {
  background: #1e2d3a;
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
  margin: 0; font-size: 14px; font-weight: 800; color: #f3f4f6;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.marc-proy-card__sub { font-size: 11px; color: #6b7280; }
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
  font-size: 16px; font-weight: 800; color: #f3f4f6;
}
.marc-proy-stat__val.teal   { color: #3ac7a5; }
.marc-proy-stat__val.purple { color: #a78bfa; }
.marc-proy-stat__label { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }

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
  font-size: 12.5px; font-weight: 700; color: #f3f4f6;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.marc-proy-worker__chips {
  display: flex; gap: 5px; flex-wrap: wrap;
}
.wchip {
  font-size: 10px; font-weight: 600; color: #6b7280;
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
.marc-mini-more { font-size: 10px; color: #6b7280; margin-left: 2px; }
</style>
