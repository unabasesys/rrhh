<script setup>
/**
 * pages/rrhh/asistencia/informes.vue
 * Informes de asistencia: por trabajador, por proyecto, atrasos.
 */
import { ref, computed, onMounted } from 'vue'
import { useAsistenciaStore } from '@/stores/asistencia'
import useRrhhStore from '@/stores/rrhh'
import useGlobalStore from '@/stores/global'
import RrhhSectionTabs from '@/components/rrhh/SectionTabs.vue'

definePageMeta({ layout: 'rrhh' })

const asistencia = useAsistenciaStore()
const rrhhStore  = useRrhhStore()
const global     = useGlobalStore()

// ── Herramientas section tabs ─────────────────────────────────────────────
const herramientasTabs = [
  { key: 'reportes', label: 'Reportes y Nómina', path: '/rrhh/reportes' },
  { key: 'informes', label: 'Informes Asistencia', path: '/rrhh/asistencia/informes' },
]

onMounted(async () => {
  asistencia.init()
  global.title     = 'Herramientas'
  global.namePage  = 'RRHH'
  global.breadcrumb = [
    { name: 'RRHH', path: '/rrhh/trabajadores' },
    { name: 'Herramientas' },
  ]
  if (!rrhhStore.trabajadores?.length) {
    await rrhhStore.getTrabajadores()
  }
})

// ─── Filtros ──────────────────────────────────────────────────────────────
const vistaActiva = ref('trabajadores') // 'trabajadores' | 'proyectos' | 'atrasos'

const hoy = asistencia.fechaHoy()
const primerMes = (() => {
  const d = new Date(hoy)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
})()
const filtroDesde = ref(primerMes)
const filtroHasta = ref(hoy)

const trabajadores  = computed(() => rrhhStore.trabajadores || [])
const proyectos     = computed(() => asistencia.proyectos)

function initiales(n) { return n?.split(' ').slice(0,2).map(p=>p[0]).join('').toUpperCase() || '?' }
const COLORS = ['#2a9d8f','#e76f51','#f4a261','#858cf0','#e9c46a','#264653']
function avatarColor(id) { return COLORS[(id?.charCodeAt?.(id.length-1)||0)%COLORS.length] }

// ─── Vista: Por trabajador ────────────────────────────────────────────────
const resumenTrabajadores = computed(() => {
  return trabajadores.value.map(w => {
    const id = w._id || w.id
    const r = asistencia.getResumenTrabajador(id, filtroDesde.value, filtroHasta.value)
    const promedioHoras = r.diasTrabajados > 0
      ? (r.totalHoras / r.diasTrabajados).toFixed(1)
      : '0.0'
    const promedioAtraso = r.diasAtraso > 0
      ? Math.round(r.totalAtrasoMin / r.diasAtraso)
      : 0
    return { ...w, ...r, promedioHoras, promedioAtraso }
  })
})

// ─── Vista: Por proyecto ──────────────────────────────────────────────────
const resumenProyectos = computed(() => {
  return proyectos.value.map(p => {
    const r = asistencia.getResumenProyecto(p.id, filtroDesde.value, filtroHasta.value)

    // Enriquecer líneas con nombre
    const lineasRicas = r.lineas.map(l => {
      const linea = asistencia.getLinea(p.id, l.linea_id)
      return {
        ...l,
        nombre: linea?.nombre || 'Sin línea',
        codigo: linea?.codigo || '—',
        cuenta: linea?.cuenta || '—',
        ntrabajadores: l.trabajadores.length,
      }
    })

    return {
      ...p,
      total_horas: r.total_horas,
      lineas_data: lineasRicas,
    }
  }).filter(p => p.total_horas > 0)
})

// ─── Vista: Atrasos ───────────────────────────────────────────────────────
const atrasosMarcaciones = computed(() => {
  const recs = asistencia.getMarcacionesPorRango(filtroDesde.value, filtroHasta.value)
  return recs
    .filter(m => m.atraso_minutos > 0)
    .sort((a, b) => b.atraso_minutos - a.atraso_minutos)
    .map(m => ({
      ...m,
      worker: trabajadores.value.find(w => (w._id || w.id) === m.trabajador_id),
      turno:  asistencia.getTurno(m.turno_id),
      proyecto: asistencia.getProyecto(m.proyecto_id),
    }))
})

function fmtFecha(f) {
  if (!f) return '—'
  const d = new Date(f + 'T12:00:00')
  return d.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })
}

// ─── Export CSV simple ────────────────────────────────────────────────────
function exportarCSV() {
  let csv = ''
  if (vistaActiva.value === 'trabajadores') {
    csv = 'Nombre,Cargo,Días Trabajados,Días Ausente,Días Atraso,Total Horas,Horas Extra,Promedio Horas/Día,Promedio Atraso Min\n'
    csv += resumenTrabajadores.value.map(r =>
      `"${r.nombre}","${r.cargo}",${r.diasTrabajados},${r.diasAusente},${r.diasAtraso},${r.totalHoras},${r.totalHorasExtra},${r.promedioHoras},${r.promedioAtraso}`
    ).join('\n')
  } else if (vistaActiva.value === 'atrasos') {
    csv = 'Trabajador,Fecha,Hora Entrada,Atraso (min),Turno,Proyecto\n'
    csv += atrasosMarcaciones.value.map(m =>
      `"${m.worker?.nombre || ''}","${m.fecha}","${m.entrada}",${m.atraso_minutos},"${m.turno?.nombre || ''}","${m.proyecto?.nombre || ''}"`
    ).join('\n')
  }

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `informe-asistencia-${filtroDesde.value}-${filtroHasta.value}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="informes-page">

    <!-- ── Section Tabs: Herramientas ────────────────────────────────── -->
    <RrhhSectionTabs :tabs="herramientasTabs" current="informes" />

    <!-- ── Header + controles ─────────────────────────────────────────── -->
    <div class="page-header">
      <div class="vista-tabs">
        <button
          v-for="v in [
            { key: 'trabajadores', label: 'Por Trabajador', icon: 'u u-usuarios' },
            { key: 'proyectos',    label: 'Por Proyecto',   icon: 'u u-ventas' },
            { key: 'atrasos',      label: 'Atrasos',        icon: 'u u-reloj' },
          ]"
          :key="v.key"
          class="tab-btn"
          :class="{ active: vistaActiva === v.key }"
          @click="vistaActiva = v.key"
        >
          <i :class="v.icon"></i> {{ v.label }}
        </button>
      </div>
      <div class="header-right">
        <div class="date-range">
          <input type="date" v-model="filtroDesde" />
          <span>—</span>
          <input type="date" v-model="filtroHasta" />
        </div>
        <button class="btn-export" @click="exportarCSV">
          <i class="u u-reportes"></i> Exportar CSV
        </button>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════ -->
    <!-- Vista: Por trabajador -->
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <div v-if="vistaActiva === 'trabajadores'" class="table-card">
      <table class="inf-table">
        <thead>
          <tr>
            <th>Trabajador</th>
            <th>Cargo</th>
            <th class="num-col">Días trabajados</th>
            <th class="num-col">Ausentes</th>
            <th class="num-col">Atrasos</th>
            <th class="num-col">Total horas</th>
            <th class="num-col">Horas extra</th>
            <th class="num-col">Prom h/día</th>
            <th class="num-col">Prom atraso</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in resumenTrabajadores" :key="r.id">
            <td>
              <div class="worker-cell">
                <div class="avatar-sm" :style="{ background: avatarColor(r.id) }">{{ initiales(r.nombre) }}</div>
                <span class="worker-name">{{ r.nombre }}</span>
              </div>
            </td>
            <td class="text-muted">{{ r.cargo }}</td>
            <td class="num-col">{{ r.diasTrabajados }}</td>
            <td class="num-col">
              <span :class="r.diasAusente > 0 ? 'text-red' : 'text-muted'">{{ r.diasAusente }}</span>
            </td>
            <td class="num-col">
              <span :class="r.diasAtraso > 0 ? 'text-orange' : 'text-muted'">{{ r.diasAtraso }}</span>
            </td>
            <td class="num-col font-bold text-teal">{{ r.totalHoras }}h</td>
            <td class="num-col">
              <span :class="r.totalHorasExtra > 0 ? 'text-purple' : 'text-muted'">
                {{ r.totalHorasExtra > 0 ? `+${r.totalHorasExtra}h` : '—' }}
              </span>
            </td>
            <td class="num-col">{{ r.promedioHoras }}h</td>
            <td class="num-col">
              <span :class="r.promedioAtraso > 0 ? 'text-orange' : 'text-muted'">
                {{ r.promedioAtraso > 0 ? `${r.promedioAtraso}'` : '—' }}
              </span>
            </td>
          </tr>
          <tr v-if="!resumenTrabajadores.length">
            <td colspan="9" class="empty-row">Sin datos para el período seleccionado</td>
          </tr>
        </tbody>
        <!-- Totales -->
        <tfoot v-if="resumenTrabajadores.length">
          <tr>
            <td colspan="2" class="total-label">Totales del período</td>
            <td class="num-col total-val">{{ resumenTrabajadores.reduce((s,r)=>s+r.diasTrabajados,0) }}</td>
            <td class="num-col total-val text-red">{{ resumenTrabajadores.reduce((s,r)=>s+r.diasAusente,0) }}</td>
            <td class="num-col total-val text-orange">{{ resumenTrabajadores.reduce((s,r)=>s+r.diasAtraso,0) }}</td>
            <td class="num-col total-val text-teal">{{ resumenTrabajadores.reduce((s,r)=>s+r.totalHoras,0).toFixed(1) }}h</td>
            <td class="num-col total-val text-purple">{{ resumenTrabajadores.reduce((s,r)=>s+r.totalHorasExtra,0).toFixed(1) }}h</td>
            <td colspan="2"></td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════ -->
    <!-- Vista: Por proyecto -->
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <div v-if="vistaActiva === 'proyectos'" class="proyectos-list">
      <div
        v-for="p in resumenProyectos"
        :key="p.id"
        class="proyecto-card"
      >
        <div class="proyecto-header">
          <div class="proyecto-dot" :style="{ background: p.color }"></div>
          <div>
            <div class="proyecto-nombre">{{ p.nombre }}</div>
            <div class="proyecto-codigo">{{ p.codigo }}</div>
          </div>
          <div class="proyecto-total">
            <span class="total-horas-big">{{ p.total_horas.toFixed(1) }}h</span>
            <span class="total-horas-label">Total imputadas</span>
          </div>
        </div>

        <table class="lineas-table">
          <thead>
            <tr>
              <th>Línea presupuestal</th>
              <th>Código</th>
              <th>Cta. contable</th>
              <th class="num-col">Trabajadores</th>
              <th class="num-col">Horas</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="l in p.lineas_data" :key="l.linea_id">
              <td>{{ l.nombre }}</td>
              <td><span class="code-pill">{{ l.codigo }}</span></td>
              <td><span class="code-pill code-pill--gray">{{ l.cuenta }}</span></td>
              <td class="num-col">{{ l.ntrabajadores }}</td>
              <td class="num-col font-bold text-teal">{{ l.horas }}h</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="!resumenProyectos.length" class="empty-state">
        <i class="u u-ventas"></i>
        <p>Sin imputaciones en el período</p>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════ -->
    <!-- Vista: Atrasos -->
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <div v-if="vistaActiva === 'atrasos'" class="table-card">
      <div class="atrasos-summary">
        <div class="a-stat">
          <span class="a-stat-val text-orange">{{ atrasosMarcaciones.length }}</span>
          <span class="a-stat-label">Total atrasos</span>
        </div>
        <div class="a-stat">
          <span class="a-stat-val">{{ atrasosMarcaciones.reduce((s,m)=>s+m.atraso_minutos,0) }}'</span>
          <span class="a-stat-label">Minutos totales</span>
        </div>
        <div class="a-stat">
          <span class="a-stat-val">
            {{ atrasosMarcaciones.length ? Math.round(atrasosMarcaciones.reduce((s,m)=>s+m.atraso_minutos,0)/atrasosMarcaciones.length) : 0 }}'
          </span>
          <span class="a-stat-label">Promedio por atraso</span>
        </div>
        <div class="a-stat">
          <span class="a-stat-val text-red">
            {{ atrasosMarcaciones.length ? Math.max(...atrasosMarcaciones.map(m=>m.atraso_minutos)) : 0 }}'
          </span>
          <span class="a-stat-label">Mayor atraso</span>
        </div>
      </div>
      <table class="inf-table">
        <thead>
          <tr>
            <th>Trabajador</th>
            <th>Fecha</th>
            <th>Turno</th>
            <th>Hora esperada</th>
            <th>Hora real</th>
            <th class="num-col">Atraso</th>
            <th>Proyecto</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in atrasosMarcaciones" :key="m.id">
            <td>
              <div class="worker-cell">
                <div class="avatar-xs" :style="{ background: avatarColor(m.trabajador_id) }">
                  {{ initiales(m.worker?.nombre) }}
                </div>
                <span class="worker-name">{{ m.worker?.nombre || m.trabajador_id }}</span>
              </div>
            </td>
            <td class="text-muted fecha-col">{{ fmtFecha(m.fecha) }}</td>
            <td class="text-muted">{{ m.turno?.nombre || '—' }}</td>
            <td class="mono">{{ m.turno?.hora_entrada || '—' }}</td>
            <td class="mono text-orange">{{ m.entrada }}</td>
            <td class="num-col">
              <span class="atraso-badge">+{{ m.atraso_minutos }}'</span>
            </td>
            <td class="text-muted">{{ m.proyecto?.nombre || '—' }}</td>
          </tr>
          <tr v-if="!atrasosMarcaciones.length">
            <td colspan="7" class="empty-row">Sin atrasos en el período 🎉</td>
          </tr>
        </tbody>
      </table>
    </div>

  </div>
</template>

<style scoped>
.informes-page { padding: 24px 28px; display: flex; flex-direction: column; gap: 16px; }

/* Header */
.page-header {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 12px;
}
.vista-tabs { display: flex; gap: 6px; }
.tab-btn {
  background: rgba(255,255,255,0.05);
  border: 1.5px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  padding: 8px 16px;
  font-size: 13px; font-weight: 600; color: #9ca3af;
  cursor: pointer; font-family: inherit;
  display: flex; align-items: center; gap: 7px;
  transition: all 0.15s;
}
.tab-btn:hover  { background: rgba(255,255,255,0.08); color: #f3f4f6; }
.tab-btn.active {
  background: rgba(58,199,165,0.12);
  border-color: rgba(58,199,165,0.35);
  color: #3ac7a5;
}

.header-right { display: flex; align-items: center; gap: 10px; }
.date-range {
  display: flex; align-items: center; gap: 8px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px; padding: 6px 12px;
}
.date-range span { color: #6b7280; font-size: 12px; }
.date-range input {
  background: none; border: none;
  color: #f3f4f6; font-size: 13px; font-family: inherit; outline: none;
}

.btn-export {
  background: rgba(133,140,240,0.12);
  border: 1px solid rgba(133,140,240,0.3);
  color: #a78bfa; border-radius: 10px;
  padding: 8px 16px; font-size: 13px; font-weight: 600;
  cursor: pointer; display: flex; align-items: center; gap: 7px;
  font-family: inherit; transition: all 0.15s;
}
.btn-export:hover { background: rgba(133,140,240,0.2); }

/* Table card */
.table-card {
  background: #1e2d3a;
  border: 1.5px solid rgba(255,255,255,0.07);
  border-radius: 14px; overflow: auto;
}
.inf-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.inf-table th {
  padding: 10px 14px; text-align: left;
  font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;
  color: #6b7280; border-bottom: 1px solid rgba(255,255,255,0.06);
}
.inf-table td {
  padding: 11px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  color: #d1d5db; vertical-align: middle;
}
.inf-table tfoot td {
  padding: 12px 14px;
  border-top: 1px solid rgba(255,255,255,0.08);
  background: rgba(58,199,165,0.04);
}
.inf-table tbody tr:hover td { background: rgba(58,199,165,0.03); }

.num-col { text-align: right; }
.text-muted { color: #6b7280; font-size: 12px; }
.text-teal   { color: #3ac7a5; }
.text-red    { color: #f87171; }
.text-orange { color: #f4a261; }
.text-purple { color: #a78bfa; }
.font-bold   { font-weight: 700; }
.mono { font-family: 'Roboto Mono', monospace; font-size: 12px; }
.fecha-col { text-transform: capitalize; }

.worker-cell { display: flex; align-items: center; gap: 8px; }
.avatar-sm {
  width: 30px; height: 30px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; color: #fff; flex-shrink: 0;
}
.avatar-xs {
  width: 24px; height: 24px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 9px; font-weight: 700; color: #fff; flex-shrink: 0;
}
.worker-name { font-size: 13px; font-weight: 600; color: #f3f4f6; }

.total-label { font-weight: 700; color: #f3f4f6; }
.total-val   { font-weight: 700; }
.empty-row   { text-align: center; color: #6b7280; padding: 40px !important; }

/* Proyectos */
.proyectos-list { display: flex; flex-direction: column; gap: 14px; }
.proyecto-card {
  background: #1e2d3a;
  border: 1.5px solid rgba(255,255,255,0.07);
  border-radius: 14px; overflow: hidden;
}
.proyecto-header {
  display: flex; align-items: center; gap: 14px;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.proyecto-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
.proyecto-nombre { font-size: 15px; font-weight: 700; color: #f3f4f6; }
.proyecto-codigo { font-size: 11px; color: #6b7280; margin-top: 2px; }
.proyecto-total { margin-left: auto; text-align: right; }
.total-horas-big   { display: block; font-size: 22px; font-weight: 800; color: #3ac7a5; }
.total-horas-label { font-size: 11px; color: #6b7280; }

.lineas-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.lineas-table th {
  padding: 8px 16px; text-align: left;
  font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;
  color: #6b7280; background: rgba(255,255,255,0.02);
}
.lineas-table td {
  padding: 10px 16px;
  border-top: 1px solid rgba(255,255,255,0.04);
  color: #d1d5db;
}

.code-pill {
  background: rgba(133,140,240,0.15); color: #a78bfa;
  padding: 2px 7px; border-radius: 6px; font-size: 11px; font-weight: 700;
}
.code-pill--gray {
  background: rgba(107,114,128,0.15); color: #9ca3af;
}

.empty-state {
  padding: 60px; display: flex; flex-direction: column; align-items: center; gap: 10px;
  color: #6b7280;
}
.empty-state i { font-size: 36px; color: #374151; }
.empty-state p { font-size: 14px; margin: 0; }

/* Atrasos */
.atrasos-summary {
  display: flex; gap: 0;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.a-stat {
  flex: 1; padding: 16px 20px;
  border-right: 1px solid rgba(255,255,255,0.06);
  display: flex; flex-direction: column; gap: 4px;
}
.a-stat:last-child { border-right: none; }
.a-stat-val   { font-size: 24px; font-weight: 800; color: #f3f4f6; }
.a-stat-label { font-size: 11px; color: #6b7280; }

.atraso-badge {
  background: rgba(244,162,97,0.15); color: #f4a261;
  padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 700;
}
</style>
