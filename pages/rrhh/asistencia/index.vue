<script setup>
/**
 * pages/rrhh/asistencia/index.vue
 * Dashboard de asistencia: vista de hoy + resumen semanal.
 */
import { ref, computed, onMounted } from "vue"
import { useAsistenciaStore } from '@/stores/asistencia'
import useRrhhStore from '@/stores/rrhh'
import { useRouter } from 'vue-router'
import RrhhSectionTabs from '@/components/rrhh/SectionTabs.vue'

definePageMeta({ layout: 'rrhh' })

const asistencia = useAsistenciaStore()
const rrhhStore  = useRrhhStore()
const global     = {}
const router     = useRouter()

onMounted(async () => {
  asistencia.init()
  global.title    = 'Dashboard RRHH'
  global.namePage = 'RRHH'
  global.breadcrumb = [
    { name: 'RRHH', path: '/rrhh/trabajadores' },
    { name: 'Dashboard' },
  ]
  if (!rrhhStore.trabajadores?.length) {
    await rrhhStore.getTrabajadores()
  }
  if (!rrhhStore.contratos?.length) {
    rrhhStore.getContratos?.()
  }
  if (!rrhhStore.liquidaciones?.length) {
    rrhhStore.getLiquidaciones?.()
  }
})

// ─── Workers ───────────────────────────────────────────────────────────────
const trabajadores = computed(() => rrhhStore.trabajadores || [])

// ─── Marcaciones de hoy ───────────────────────────────────────────────────
const marcacionesHoy = computed(() => asistencia.marcacionesHoy)

// Normaliza ID (workers usan _id, tokens usan id)
function wId(w) { return w._id || w.id }

function getMarcacionHoy(wid) {
  return marcacionesHoy.value.find(m => m.trabajador_id === wid) || null
}

function getEstadoBadge(wid) {
  const m = getMarcacionHoy(wid)
  if (!m || !m.entrada) return { label: 'Sin marcar', cls: 'badge-sin' }
  if (m.tipo === 'ausencia')  return { label: 'Ausente',   cls: 'badge-ausente' }
  if (m.entrada && !m.salida) return { label: 'En trabajo', cls: 'badge-dentro' }
  return { label: 'Completó', cls: 'badge-ok' }
}

// ─── KPIs ─────────────────────────────────────────────────────────────────
const kpis = computed(() => {
  const total   = trabajadores.value.length
  const dentro  = trabajadores.value.filter(w => {
    const m = getMarcacionHoy(wId(w))
    return m && m.entrada && !m.salida
  }).length
  const atrasos = marcacionesHoy.value.filter(m => m.atraso_minutos > 0).length
  const ausentes = trabajadores.value.filter(w => {
    const m = getMarcacionHoy(wId(w))
    return !m || !m.entrada
  }).length
  const horasHoy = marcacionesHoy.value.reduce((s, m) => s + (m.horas_trabajadas || 0), 0)
  return { total, dentro, atrasos, ausentes, horasHoy }
})

// ─── Últimas 2 semanas: mini calendar strip ───────────────────────────────
const hoy = asistencia.fechaHoy()

const diasStrip = computed(() => {
  const dias = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(hoy)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    const dow = d.getDay()
    const esHoy = key === hoy
    const isWeekend = dow === 0 || dow === 6
    const total = asistencia.marcaciones.filter(m => m.fecha === key && !isWeekend).length
    const presentes = asistencia.marcaciones.filter(m => m.fecha === key && m.entrada).length
    dias.push({ fecha: key, label: d.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric' }), esHoy, isWeekend, total, presentes })
  }
  return dias
})

// ─── Portal link ─────────────────────────────────────────────────────────
const showPortalModal = ref(false)
const portalWorker   = ref(null)
const portalLink     = ref('')
const copied         = ref(false)

function abrirPortal(w) {
  portalWorker.value = w
  const id = wId(w)
  // Asegurar que tiene token
  let tok = asistencia.getTokenByTrabajador(id)
  if (!tok) {
    asistencia.generarToken(id)
    tok = asistencia.getTokenByTrabajador(id)
  }
  portalLink.value = asistencia.getPortalUrl(id) || ''
  showPortalModal.value = true
  copied.value = false
}

async function copiarLink() {
  try {
    await navigator.clipboard.writeText(portalLink.value)
    copied.value = true
    setTimeout(() => copied.value = false, 2500)
  } catch {}
}

// ─── RRHH-wide KPIs ──────────────────────────────────────────────────────
const contratos = computed(() => rrhhStore.contratos || [])
const liquidaciones = computed(() => rrhhStore.liquidaciones || [])

const hoyDate = new Date()
const hoyStr  = hoyDate.toISOString().split('T')[0]

function diasHasta(fechaStr) {
  if (!fechaStr) return Infinity
  const d = new Date(fechaStr)
  return Math.ceil((d - hoyDate) / 86400000)
}

const contratosPorVencer30 = computed(() =>
  contratos.value.filter(c => {
    if (!c.fecha_termino) return false
    const d = diasHasta(c.fecha_termino)
    return d >= 0 && d <= 30
  })
)

const contratosPorVencer7 = computed(() =>
  contratos.value.filter(c => {
    if (!c.fecha_termino) return false
    const d = diasHasta(c.fecha_termino)
    return d >= 0 && d <= 7
  })
)

const liquidacionesPendientes = computed(() => {
  const mesActual = new Date().toISOString().slice(0, 7) // YYYY-MM
  return liquidaciones.value.filter(l =>
    l.estado === 'pendiente' ||
    l.estado === 'borrador' ||
    (l.periodo && l.periodo.startsWith(mesActual) && l.estado !== 'pagado')
  )
})

const kpisRrhh = computed(() => ({
  porVencer30:  contratosPorVencer30.value.length,
  porVencer7:   contratosPorVencer7.value.length,
  liqPendientes: liquidacionesPendientes.value.length,
  trabajadoresActivos: trabajadores.value.filter(w => w.estado !== 'inactivo').length,
}))

// ─── Tabs de Asistencia ───────────────────────────────────────────────────
// Solo el Dashboard en la barra — Marcaciones y Turnos van por el menú lateral
const asistenciaTabs = [
  { key: 'dashboard', label: 'Dashboard', path: '/rrhh/asistencia' },
]

// ─── Iniciales ────────────────────────────────────────────────────────────
function initiales(nombre) {
  if (!nombre) return '?'
  return nombre.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
}

const COLORS = ['#2a9d8f','#e76f51','#f4a261','#858cf0','#e9c46a','#264653']
function avatarColor(id) {
  const idx = (id?.charCodeAt?.(id.length - 1) || 0) % COLORS.length
  return COLORS[idx]
}
</script>

<template>
  <div class="asist-page">

    <!-- ── Section tabs ─────────────────────────────────────────────────── -->
    <RrhhSectionTabs :tabs="asistenciaTabs" current="dashboard" />

    <!-- ── KPI cards (Asistencia) ───────────────────────────────────────── -->
    <div class="kpi-row">
      <div class="kpi-card">
        <div class="kpi-icon kpi-teal"><i class="u u-usuarios"></i></div>
        <div>
          <div class="kpi-val">{{ kpis.total }}</div>
          <div class="kpi-label">Total trabajadores</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon kpi-green"><i class="u u-check"></i></div>
        <div>
          <div class="kpi-val">{{ kpis.dentro }}</div>
          <div class="kpi-label">En trabajo ahora</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon kpi-orange"><i class="u u-reloj"></i></div>
        <div>
          <div class="kpi-val">{{ kpis.atrasos }}</div>
          <div class="kpi-label">Atrasos hoy</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon kpi-red"><i class="u u-cerrar"></i></div>
        <div>
          <div class="kpi-val">{{ kpis.ausentes }}</div>
          <div class="kpi-label">Sin marcar</div>
        </div>
      </div>
      <div class="kpi-card kpi-card--wide">
        <div class="kpi-icon kpi-blue"><i class="u u-cobros-y-pagos"></i></div>
        <div>
          <div class="kpi-val">{{ kpis.horasHoy.toFixed(1) }} hrs</div>
          <div class="kpi-label">Horas registradas hoy</div>
        </div>
      </div>
    </div>

    <!-- ── KPI RRHH (segunda fila) ──────────────────────────────────────── -->
    <div class="kpi-row kpi-row--rrhh">
      <div class="kpi-card kpi-card--rrhh" @click="router.push('/rrhh/trabajadores')">
        <div class="kpi-icon kpi-teal"><i class="u u-usuarios"></i></div>
        <div>
          <div class="kpi-val">{{ kpisRrhh.trabajadoresActivos }}</div>
          <div class="kpi-label">Trabajadores activos</div>
        </div>
        <i class="u u-flecha-derecha kpi-arrow"></i>
      </div>
      <div
        class="kpi-card kpi-card--rrhh"
        :class="{ 'kpi-card--warn': kpisRrhh.porVencer30 > 0 }"
        @click="router.push('/rrhh/contratos?tab=vencimientos')"
      >
        <div class="kpi-icon" :class="kpisRrhh.porVencer30 > 0 ? 'kpi-orange' : 'kpi-teal'">
          <i class="u u-folder-open"></i>
        </div>
        <div>
          <div class="kpi-val" :class="{ 'kpi-val--warn': kpisRrhh.porVencer30 > 0 }">
            {{ kpisRrhh.porVencer30 }}
          </div>
          <div class="kpi-label">Contratos por vencer (30d)</div>
        </div>
        <i class="u u-flecha-derecha kpi-arrow"></i>
      </div>
      <div
        class="kpi-card kpi-card--rrhh"
        :class="{ 'kpi-card--warn': kpisRrhh.liqPendientes > 0 }"
        @click="router.push('/rrhh/liquidaciones')"
      >
        <div class="kpi-icon" :class="kpisRrhh.liqPendientes > 0 ? 'kpi-red' : 'kpi-teal'">
          <i class="u u-cobros-y-pagos"></i>
        </div>
        <div>
          <div class="kpi-val" :class="{ 'kpi-val--warn': kpisRrhh.liqPendientes > 0 }">
            {{ kpisRrhh.liqPendientes }}
          </div>
          <div class="kpi-label">Liquidaciones pendientes</div>
        </div>
        <i class="u u-flecha-derecha kpi-arrow"></i>
      </div>
    </div>

    <!-- ── Alert strip: contratos que vencen en ≤7 días ────────────────── -->
    <div v-if="contratosPorVencer7.length" class="alert-strip">
      <div class="alert-strip__icon"><i class="u u-alerta"></i></div>
      <div class="alert-strip__content">
        <span class="alert-strip__title">
          {{ contratosPorVencer7.length === 1 ? '1 contrato vence' : `${contratosPorVencer7.length} contratos vencen` }}
          en los próximos 7 días
        </span>
        <div class="alert-strip__chips">
          <span
            v-for="c in contratosPorVencer7"
            :key="c._id"
            class="alert-chip"
          >
            {{ c.trabajador_nombre || c.nombre || 'Trabajador' }}
            <span class="alert-chip__days">{{ diasHasta(c.fecha_termino) === 0 ? 'hoy' : `${diasHasta(c.fecha_termino)}d` }}</span>
          </span>
        </div>
      </div>
      <button class="alert-strip__cta" @click="router.push('/rrhh/contratos?tab=vencimientos')">
        Ver contratos <i class="u u-flecha-derecha"></i>
      </button>
    </div>

    <!-- ── Strip semanal ─────────────────────────────────────────────────── -->
    <div class="section-card">
      <div class="section-header">
        <span class="section-title">Últimos 7 días</span>
      </div>
      <div class="week-strip">
        <div
          v-for="d in diasStrip"
          :key="d.fecha"
          class="day-col"
          :class="{ 'day-today': d.esHoy, 'day-weekend': d.isWeekend }"
        >
          <div class="day-label">{{ d.label }}</div>
          <div class="day-bar-wrap">
            <div
              class="day-bar"
              :style="{ height: d.total ? `${Math.round((d.presentes/d.total)*100)}%` : '0%' }"
            ></div>
          </div>
          <div class="day-pct">
            {{ d.isWeekend ? '—' : d.total ? `${d.presentes}/${d.total}` : '0' }}
          </div>
        </div>
      </div>
    </div>

    <!-- ── Tabla de hoy ───────────────────────────────────────────────────── -->
    <div class="section-card">
      <div class="section-header">
        <span class="section-title">Estado de hoy</span>
        <span class="section-date">{{ new Date(hoy).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }) }}</span>
      </div>
      <table class="asist-table">
        <thead>
          <tr>
            <th>Trabajador</th>
            <th>Turno</th>
            <th>Proyecto</th>
            <th>Entrada</th>
            <th>Salida</th>
            <th>Horas</th>
            <th>Atraso</th>
            <th>Estado</th>
            <th>Portal</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="w in trabajadores" :key="wId(w)">
            <td>
              <div class="worker-cell">
                <div class="avatar-sm" :style="{ background: avatarColor(wId(w)) }">
                  {{ initiales(w.nombre) }}
                </div>
                <div>
                  <div class="worker-name">{{ w.nombre }}</div>
                  <div class="worker-cargo">{{ w.cargo }}</div>
                </div>
              </div>
            </td>
            <td>
              <span class="text-muted text-sm">
                {{ (() => { const m = getMarcacionHoy(wId(w)); const t = m ? asistencia.getTurno(m.turno_id) : null; return t ? t.nombre : '—' })() }}
              </span>
            </td>
            <td>
              <span class="text-muted text-sm">
                {{ (() => { const m = getMarcacionHoy(wId(w)); const p = m ? asistencia.getProyecto(m.proyecto_id) : null; return p ? p.nombre : '—' })() }}
              </span>
            </td>
            <td>
              <span class="hora-chip" :class="{ 'hora-atraso': getMarcacionHoy(wId(w))?.atraso_minutos > 0 }">
                {{ getMarcacionHoy(wId(w))?.entrada || '—' }}
              </span>
            </td>
            <td>
              <span class="hora-chip">{{ getMarcacionHoy(wId(w))?.salida || '—' }}</span>
            </td>
            <td class="text-num">
              {{ getMarcacionHoy(wId(w))?.horas_trabajadas > 0 ? `${getMarcacionHoy(wId(w)).horas_trabajadas}h` : '—' }}
            </td>
            <td>
              <span v-if="getMarcacionHoy(wId(w))?.atraso_minutos > 0" class="badge-atraso">
                +{{ getMarcacionHoy(wId(w)).atraso_minutos }} min
              </span>
              <span v-else class="text-muted">—</span>
            </td>
            <td>
              <span class="badge" :class="getEstadoBadge(wId(w)).cls">
                {{ getEstadoBadge(wId(w)).label }}
              </span>
            </td>
            <td>
              <button class="btn-icon-sm" @click="abrirPortal(w)" title="Link portal trabajador">
                <i class="u u-link"></i>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

  </div>

  <!-- ── Modal portal link ─────────────────────────────────────────────── -->
  <teleport to="body">
    <div v-if="showPortalModal" class="modal-backdrop" @click.self="showPortalModal = false">
      <div class="modal-box">
        <div class="modal-header">
          <h3>Link Portal — {{ portalWorker?.nombre }}</h3>
          <button @click="showPortalModal = false"><i class="u u-cerrar"></i></button>
        </div>
        <div class="modal-body">
          <p class="modal-desc">
            Comparte este link con el trabajador para que pueda marcar su entrada y salida desde cualquier dispositivo.
            No requiere contraseña.
          </p>
          <div class="link-box">
            <span class="link-text">{{ portalLink }}</span>
            <button class="btn-copy" @click="copiarLink">
              <i :class="copied ? 'u u-check' : 'u u-copiar'"></i>
              {{ copied ? 'Copiado' : 'Copiar' }}
            </button>
          </div>
          <div class="link-qr-hint">
            <i class="u u-info"></i>
            El link es permanente y único para este trabajador. Para revocar acceso, genera un nuevo token desde la ficha del trabajador.
          </div>
        </div>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.asist-page {
  padding: 24px 28px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 0;
}

/* ── KPI ─────────────────────────────────────────────────────────────────── */
.kpi-row {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}

.kpi-card {
  background: var(--neutral-background-default, #ffffff);
  border: 1.5px solid rgba(255,255,255,0.07);
  border-radius: 14px;
  padding: 18px 20px;
  display: flex;
  align-items: center;
  gap: 14px;
  flex: 1;
  min-width: 160px;
}

.kpi-card--wide { flex: 1.5; }

.kpi-icon {
  width: 44px; height: 44px;
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}
.kpi-teal   { background: rgba(42,157,143,0.15); color: #3ac7a5; }
.kpi-green  { background: rgba(74,222,128,0.12); color: #4ade80; }
.kpi-orange { background: rgba(244,162,97,0.15); color: #f4a261; }
.kpi-red    { background: rgba(239,68,68,0.12);  color: #f87171; }
.kpi-blue   { background: rgba(133,140,240,0.15);color: #a78bfa; }

.kpi-val   { font-size: 26px; font-weight: 800; color: var(--neutral-text-title, #111827); line-height: 1.1; }
.kpi-label { font-size: 12px; color: var(--neutral-text-subtitle, #6b7280); margin-top: 2px; }

/* ── KPI RRHH row ───────────────────────────────────────────────────────── */
.kpi-row--rrhh { margin-top: -6px; }

.kpi-card--rrhh {
  cursor: pointer;
  position: relative;
  transition: border-color 0.15s, transform 0.1s;
}
.kpi-card--rrhh:hover {
  border-color: rgba(58,199,165,0.3);
  transform: translateY(-1px);
}
.kpi-card--warn {
  border-color: rgba(244,162,97,0.25) !important;
}
.kpi-val--warn { color: #f4a261; }

.kpi-arrow {
  margin-left: auto;
  font-size: 12px;
  color: #374151;
  transition: color 0.15s;
}
.kpi-card--rrhh:hover .kpi-arrow { color: #3ac7a5; }

/* ── Alert strip ─────────────────────────────────────────────────────────── */
.alert-strip {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: rgba(244,162,97,0.08);
  border: 1.5px solid rgba(244,162,97,0.25);
  border-radius: 12px;
  padding: 14px 18px;
}

.alert-strip__icon {
  width: 36px; height: 36px;
  border-radius: 10px;
  background: rgba(244,162,97,0.15);
  color: #f4a261;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
  margin-top: 1px;
}

.alert-strip__content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.alert-strip__title {
  font-size: 13px;
  font-weight: 600;
  color: #f4a261;
}

.alert-strip__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.alert-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(244,162,97,0.12);
  border: 1px solid rgba(244,162,97,0.2);
  border-radius: 20px;
  padding: 3px 10px;
  font-size: 12px;
  color: var(--neutral-text-body, #374151);
}

.alert-chip__days {
  background: rgba(244,162,97,0.25);
  color: #f4a261;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 11px;
}

.alert-strip__cta {
  background: rgba(244,162,97,0.12);
  border: 1px solid rgba(244,162,97,0.25);
  color: #f4a261;
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: flex; align-items: center; gap: 6px;
  white-space: nowrap;
  align-self: center;
  transition: all 0.15s;
}
.alert-strip__cta:hover {
  background: rgba(244,162,97,0.2);
}

/* ── Cards ───────────────────────────────────────────────────────────────── */
.section-card {
  background: var(--neutral-background-default, #ffffff);
  border: 1.5px solid rgba(255,255,255,0.07);
  border-radius: 14px;
  overflow: hidden;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.section-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--neutral-text-title, #111827);
}

.section-date {
  font-size: 12px;
  color: var(--neutral-text-subtitle, #6b7280);
  text-transform: capitalize;
}

/* ── Week strip ──────────────────────────────────────────────────────────── */
.week-strip {
  display: flex;
  padding: 16px 20px;
  gap: 10px;
}

.day-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  gap: 6px;
}

.day-label {
  font-size: 11px;
  color: var(--neutral-text-subtitle, #6b7280);
  text-transform: capitalize;
  white-space: nowrap;
}

.day-today .day-label {
  color: #3ac7a5;
  font-weight: 700;
}

.day-bar-wrap {
  height: 50px;
  width: 28px;
  background: rgba(255,255,255,0.05);
  border-radius: 6px;
  overflow: hidden;
  display: flex;
  align-items: flex-end;
}

.day-bar {
  width: 100%;
  background: #3ac7a5;
  border-radius: 4px;
  transition: height 0.4s ease;
  min-height: 3px;
}

.day-today .day-bar { background: #2a9d8f; }
.day-weekend .day-bar { background: rgba(255,255,255,0.1); }

.day-pct {
  font-size: 10px;
  color: var(--neutral-text-subtitle, #6b7280);
}

/* ── Table ───────────────────────────────────────────────────────────────── */
.asist-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.asist-table th {
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

.asist-table td {
  padding: 13px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  color: var(--neutral-text-title, #1f2937);
  vertical-align: middle;
}

.asist-table tbody tr:hover td {
  background: rgba(58,199,165,0.04);
}

/* Worker cell */
.worker-cell { display: flex; align-items: center; gap: 10px; }
.avatar-sm {
  width: 34px; height: 34px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; color: #fff;
  flex-shrink: 0;
}
.worker-name { font-size: 13px; font-weight: 600; color: var(--neutral-text-title, #111827); }
.worker-cargo { font-size: 11px; color: var(--neutral-text-subtitle, #6b7280); }

/* Hora chips */
.hora-chip {
  font-size: 13px;
  font-family: 'Roboto Mono', monospace;
  color: var(--neutral-text-body, #374151);
}
.hora-atraso { color: #f4a261; }

.text-num { font-variant-numeric: tabular-nums; color: var(--neutral-text-body, #374151); }
.text-muted { color: var(--neutral-text-subtitle, #6b7280); }
.text-sm { font-size: 12px; }

/* Badges */
.badge { padding: 3px 9px; border-radius: 20px; font-size: 11px; font-weight: 600; }
.badge-sin     { background: rgba(107,114,128,0.15); color: var(--neutral-text-caption, #6b7280); }
.badge-dentro  { background: rgba(74,222,128,0.12); color: #4ade80; }
.badge-ok      { background: rgba(58,199,165,0.15); color: #3ac7a5; }
.badge-ausente { background: rgba(239,68,68,0.12); color: #f87171; }

.badge-atraso {
  background: rgba(244,162,97,0.15);
  color: #f4a261;
  padding: 2px 8px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
}

/* Icon btn */
.btn-icon-sm {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: var(--neutral-text-caption, #6b7280);
  border-radius: 8px;
  width: 30px; height: 30px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.15s;
}
.btn-icon-sm:hover { background: rgba(58,199,165,0.1); color: #3ac7a5; }

/* ── Modal ───────────────────────────────────────────────────────────────── */
.modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(3px);
}
.modal-box {
  background: var(--neutral-background-default, #ffffff);
  border: 1.5px solid rgba(255,255,255,0.1);
  border-radius: 16px;
  width: 500px;
  max-width: 95vw;
  overflow: hidden;
}
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
}
.modal-header h3 { font-size: 16px; font-weight: 700; color: var(--neutral-text-title, #111827); margin: 0; }
.modal-header button { background: none; border: none; color: var(--neutral-text-subtitle, #6b7280); cursor: pointer; font-size: 18px; }
.modal-body { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
.modal-desc { font-size: 13px; color: var(--neutral-text-caption, #6b7280); line-height: 1.6; margin: 0; }

.link-box {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  padding: 10px 14px;
}
.link-text {
  flex: 1;
  font-size: 12px;
  font-family: monospace;
  color: #3ac7a5;
  word-break: break-all;
}
.btn-copy {
  background: rgba(58,199,165,0.15);
  border: 1px solid rgba(58,199,165,0.3);
  color: #3ac7a5;
  border-radius: 8px;
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  display: flex; align-items: center; gap: 6px;
  transition: all 0.15s;
}
.btn-copy:hover { background: rgba(58,199,165,0.25); }

.link-qr-hint {
  font-size: 12px;
  color: var(--neutral-text-subtitle, #6b7280);
  display: flex;
  gap: 8px;
  align-items: flex-start;
  line-height: 1.5;
}
.link-qr-hint i { color: #858cf0; margin-top: 2px; flex-shrink: 0; }
</style>
