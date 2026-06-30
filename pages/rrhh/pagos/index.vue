<template>
  <div class="pagos-page">
    <!-- ── Header ──────────────────────────────────────────────────────── -->
    <div class="pagos-header">
      <div>
        <h1 class="pagos-title">Pagos del mes</h1>
        <p class="pagos-sub">Gestiona liquidaciones, anticipos y cierre de mes en un solo lugar.</p>
      </div>

      <!-- Selector de mes/año -->
      <div class="month-picker">
        <button class="month-nav" @click="cambiarMes(-1)" title="Mes anterior">‹</button>
        <select v-model.number="mes" class="month-select">
          <option v-for="m in meses" :key="m.v" :value="m.v">{{ m.l }}</option>
        </select>
        <select v-model.number="anio" class="year-select">
          <option v-for="y in anios" :key="y" :value="y">{{ y }}</option>
        </select>
        <button class="month-nav" @click="cambiarMes(1)" title="Mes siguiente">›</button>
        <span v-if="mesCerrado" class="month-status month-status--closed">🔒 Cerrado</span>
        <span v-else class="month-status month-status--open">● Abierto</span>
      </div>
    </div>

    <!-- ── 3 botones de acción ─────────────────────────────────────────── -->
    <div class="pagos-actions">
      <button class="pagos-btn pagos-btn--primary" :disabled="mesCerrado" @click="showMasivasModal = true">
        <i class="u u-cobros-y-pagos"></i>
        <span>
          <strong>Liquidaciones masivas</strong>
          <small>Genera liquidaciones para todo tu equipo</small>
        </span>
      </button>
      <button class="pagos-btn" :disabled="mesCerrado" @click="abrirAnticipo">
        <i class="u u-agregar"></i>
        <span>
          <strong>Crear anticipo</strong>
          <small>Adelanto único a un trabajador</small>
        </span>
      </button>
      <button class="pagos-btn pagos-btn--ghost" @click="toggleCierre">
        <i :class="mesCerrado ? 'u u-show' : 'u u-locked'"></i>
        <span>
          <strong>{{ mesCerrado ? 'Abrir mes' : 'Cerrar mes' }}</strong>
          <small>{{ mesCerrado ? 'Permite editar de nuevo' : 'Bloquea modificaciones' }}</small>
        </span>
      </button>
    </div>

    <!-- ── KPIs del mes ──────────────────────────────────────────────────── -->
    <div class="pagos-kpis">
      <div class="kpi">
        <span class="kpi__label">Liquidaciones</span>
        <span class="kpi__value">{{ liquidacionesMes.length }}</span>
        <span class="kpi__sub">{{ trabajadoresActivos.length }} trabajadores activos</span>
      </div>
      <div class="kpi">
        <span class="kpi__label">Total a pagar</span>
        <span class="kpi__value">{{ formatCLP(totalLiquido) }}</span>
        <span class="kpi__sub">líquido neto</span>
      </div>
      <div class="kpi">
        <span class="kpi__label">Costo empresa</span>
        <span class="kpi__value">{{ formatCLP(totalCostoEmpresa) }}</span>
        <span class="kpi__sub">incluye cargos patronales</span>
      </div>
      <div class="kpi">
        <span class="kpi__label">Anticipos</span>
        <span class="kpi__value">{{ anticiposMes.length }}</span>
        <span class="kpi__sub">{{ formatCLP(totalAnticipos) }}</span>
      </div>
    </div>

    <!-- ── Lista de liquidaciones ─────────────────────────────────────────── -->
    <section class="pagos-section">
      <div class="pagos-section__head">
        <h2>Liquidaciones generadas — {{ nombreMesAnio }}</h2>
        <div v-if="seleccionadas.length" class="selection-actions">
          <span>{{ seleccionadas.length }} seleccionada(s)</span>
          <button class="btn-link" @click="eliminarSeleccionadas">Eliminar</button>
          <button class="btn-link" @click="seleccionadas = []">Cancelar</button>
        </div>
      </div>

      <div v-if="cargando" class="pagos-empty">Cargando…</div>
      <div v-else-if="!liquidacionesMes.length" class="pagos-empty">
        <p>Aún no hay liquidaciones generadas para este mes.</p>
        <button v-if="!mesCerrado" class="pagos-btn pagos-btn--primary pagos-btn--sm" @click="showMasivasModal = true">
          Generar liquidaciones masivas →
        </button>
      </div>
      <div v-else class="liq-grid">
        <div
          v-for="liq in liquidacionesMes"
          :key="liq._id"
          class="liq-card"
          :class="{ 'liq-card--selected': seleccionadas.includes(liq._id) }"
        >
          <label class="liq-card__check">
            <input type="checkbox" :value="liq._id" v-model="seleccionadas" />
          </label>
          <div class="liq-card__head">
            <span class="liq-card__avatar">{{ initials(liq.trabajador_nombre) }}</span>
            <div class="liq-card__info">
              <span class="liq-card__nombre">{{ liq.trabajador_nombre }}</span>
              <span class="liq-card__estado" :class="`liq-card__estado--${liq.estado || 'pendiente'}`">
                {{ liq.estado || 'pendiente' }}
              </span>
            </div>
          </div>
          <div class="liq-card__body">
            <div class="liq-row">
              <span>Total haberes</span>
              <strong>{{ formatCLP(liq.total_haberes) }}</strong>
            </div>
            <div class="liq-row liq-row--neg">
              <span>Descuentos</span>
              <strong>−{{ formatCLP(liq.total_descuentos) }}</strong>
            </div>
            <div class="liq-row liq-row--total">
              <span>Líquido</span>
              <strong>{{ formatCLP(liq.liquido_a_pagar) }}</strong>
            </div>
          </div>
          <div class="liq-card__foot">
            <button class="liq-card-btn" @click="descargarPdf(liq)" title="Descargar PDF">
              <i class="u u-folder-open"></i> PDF
            </button>
            <button class="liq-card-btn" @click="enviarEmail(liq)" title="Enviar por email">
              <i class="u u-link"></i> Email
            </button>
            <button class="liq-card-btn" @click="verDetalle(liq)" title="Ver detalle">
              <i class="u u-edit"></i>
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Lista de anticipos ─────────────────────────────────────────── -->
    <section v-if="anticiposMes.length" class="pagos-section">
      <div class="pagos-section__head">
        <h2>Anticipos — {{ nombreMesAnio }}</h2>
      </div>
      <div class="anticipos-list">
        <div v-for="a in anticiposMes" :key="a._id" class="anticipo-row">
          <span class="anticipo-avatar">{{ initials(a.trabajador_nombre) }}</span>
          <span class="anticipo-nombre">{{ a.trabajador_nombre }}</span>
          <span class="anticipo-fecha">{{ a.fecha }}</span>
          <span class="anticipo-monto">{{ formatCLP(a.monto) }}</span>
          <span class="anticipo-motivo">{{ a.motivo || '—' }}</span>
        </div>
      </div>
    </section>

    <!-- ── Modal: Liquidaciones masivas ─────────────────────────────────── -->
    <LiquidacionesMasivas
      v-if="showMasivasModal"
      :mes="mes"
      :anio="anio"
      :trabajadores="trabajadoresParaLiquidar"
      @close="showMasivasModal = false"
      @generadas="onLiquidacionesGeneradas"
    />

    <!-- ── Modal: Crear anticipo ─────────────────────────────────────────── -->
    <CrearAnticipo
      v-if="showAnticipoModal"
      :mes="mes"
      :anio="anio"
      :trabajadores="trabajadoresActivos"
      @close="showAnticipoModal = false"
      @creado="onAnticipoCreado"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import useRrhhStore from '@/stores/rrhh'
import { useAuthStore } from '@/stores/auth'
import LiquidacionesMasivas from '@/components/pagos/LiquidacionesMasivas.vue'
import CrearAnticipo        from '@/components/pagos/CrearAnticipo.vue'

definePageMeta({ middleware: 'auth', layout: 'rrhh' })

const rrhhStore = useRrhhStore()
const authStore = useAuthStore()

const meses = [
  { v: 1, l: 'Enero' }, { v: 2, l: 'Febrero' }, { v: 3, l: 'Marzo' },
  { v: 4, l: 'Abril' }, { v: 5, l: 'Mayo' }, { v: 6, l: 'Junio' },
  { v: 7, l: 'Julio' }, { v: 8, l: 'Agosto' }, { v: 9, l: 'Septiembre' },
  { v: 10, l: 'Octubre' }, { v: 11, l: 'Noviembre' }, { v: 12, l: 'Diciembre' },
]

const hoy = new Date()
const mes  = ref(hoy.getMonth() + 1)
const anio = ref(hoy.getFullYear())

const anios = computed(() => {
  const a = anio.value
  return [a - 2, a - 1, a, a + 1]
})

const nombreMesAnio = computed(() =>
  `${meses.find(m => m.v === mes.value)?.l || ''} ${anio.value}`
)

const cargando        = ref(false)
const liquidacionesMes = ref([])
const anticiposMes     = ref([])
const cierres          = ref([])
const seleccionadas    = ref([])
const showMasivasModal = ref(false)
const showAnticipoModal = ref(false)

function authHeaders() {
  if (typeof localStorage === 'undefined') return {}
  try {
    const s = JSON.parse(localStorage.getItem('rrhh_session') || '{}')
    return s?.token ? { Authorization: `Bearer ${s.token}` } : {}
  } catch { return {} }
}

async function cargar() {
  cargando.value = true
  try {
    const orgId = authStore?.currentOrgId
    const params = new URLSearchParams({ mes: String(mes.value), anio: String(anio.value) })
    if (orgId) params.set('orgId', orgId)

    const [liqs, antis] = await Promise.all([
      $fetch(`/api/rrhh/liquidaciones?${params}`, { headers: authHeaders() }).catch(() => []),
      $fetch(`/api/rrhh/anticipos?${params}`, { headers: authHeaders() }).catch(() => []),
    ])
    liquidacionesMes.value = (Array.isArray(liqs) ? liqs : []).filter(l =>
      Number(l.mes) === mes.value && Number(l.anio) === anio.value &&
      (!orgId || l.orgId === orgId)
    )
    anticiposMes.value = (Array.isArray(antis) ? antis : []).filter(a =>
      (!orgId || a.orgId === orgId)
    )

    // Cargar trabajadores y contratos si no están en el store
    if (!rrhhStore.trabajadores?.length) await rrhhStore.getTrabajadores?.()
    if (!rrhhStore.contratos?.length)    await rrhhStore.getContratos?.()
  } finally {
    cargando.value = false
  }
}

watch([mes, anio], cargar)
onMounted(cargar)

// ── Trabajadores con contratos vigentes ese mes ──────────────────────────
const trabajadoresActivos = computed(() => {
  const oid = authStore?.currentOrgId
  return (rrhhStore.trabajadores || []).filter(t =>
    (t.estado === 'activo' || t.estado === 'Activo') &&
    (!oid || t.orgId === oid)
  )
})

const trabajadoresParaLiquidar = computed(() => {
  // Trabajadores con contrato vigente en el mes seleccionado, sin liquidación ya generada
  const yaLiquidados = new Set(liquidacionesMes.value.map(l => l.trabajador_id))
  const oid = authStore?.currentOrgId
  const contratos = (rrhhStore.contratos || []).filter(c =>
    (c.estado === 'vigente' || !c.estado) &&
    (!oid || c.orgId === oid)
  )
  return trabajadoresActivos.value
    .filter(t => !yaLiquidados.has(t._id))
    .map(t => {
      const c = contratos.find(c => c.trabajador_id === t._id)
      return { ...t, contrato: c }
    })
    .filter(t => t.contrato)
})

const mesCerrado = computed(() => false)  // TODO: implementar Cierre model
const totalLiquido = computed(() => liquidacionesMes.value.reduce((s, l) => s + (l.liquido_a_pagar || 0), 0))
const totalCostoEmpresa = computed(() => liquidacionesMes.value.reduce((s, l) => s + (l.costo_empresa || 0), 0))
const totalAnticipos = computed(() => anticiposMes.value.reduce((s, a) => s + (a.monto || 0), 0))

function cambiarMes(delta) {
  let m = mes.value + delta
  let a = anio.value
  if (m < 1)  { m = 12; a-- }
  if (m > 12) { m = 1;  a++ }
  mes.value  = m
  anio.value = a
}

function abrirAnticipo() {
  showAnticipoModal.value = true
}

function toggleCierre() {
  alert('Cierre de mes — funcionalidad próximamente')
}

function initials(nombre) {
  return String(nombre || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('')
}

function formatCLP(n) {
  const v = Math.round(Number(n) || 0)
  return '$' + v.toLocaleString('es-CL')
}

function descargarPdf(liq) {
  // La página de Liquidaciones ya tiene wired el PDF (con el body completo).
  // Por ahora redirigimos ahí con el id en query — atajo simple sin
  // duplicar la lógica del PDF.
  if (typeof window !== 'undefined') {
    window.open(`/rrhh/liquidaciones?pdf=${liq._id}`, '_blank')
  }
}

function enviarEmail(liq) {
  alert('Envío por email — próximamente. Por ahora descargá el PDF y mandalo manualmente.')
}

function verDetalle(liq) {
  if (typeof window !== 'undefined') {
    window.open(`/rrhh/liquidaciones?id=${liq._id}`, '_blank')
  }
}

async function eliminarSeleccionadas() {
  if (!confirm(`¿Eliminar ${seleccionadas.value.length} liquidaciones?`)) return
  for (const id of seleccionadas.value) {
    await $fetch(`/api/rrhh/liquidaciones/${id}`, { method: 'DELETE', headers: authHeaders() }).catch(() => {})
  }
  seleccionadas.value = []
  await cargar()
}

function onLiquidacionesGeneradas() {
  showMasivasModal.value = false
  cargar()
}

function onAnticipoCreado() {
  showAnticipoModal.value = false
  cargar()
}
</script>

<style scoped>
.pagos-page {
  padding: 24px 32px 60px;
  max-width: 1400px;
  margin: 0 auto;
}

.pagos-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  gap: 24px; flex-wrap: wrap;
  margin-bottom: 24px;
}
.pagos-title {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 28px; font-weight: 700;
  color: var(--neutral-text-title, #f3f4f6);
  margin: 0 0 4px;
}
.pagos-sub { color: var(--neutral-text-muted, #9ca3af); font-size: 14px; margin: 0; }

.month-picker {
  display: flex; align-items: center; gap: 8px;
  background: var(--neutral-background-subtle, #0f1a26);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  padding: 6px 10px;
}
.month-nav {
  background: none; border: none;
  color: var(--neutral-text-body, #d1d5db);
  font-size: 18px; cursor: pointer;
  width: 24px; height: 24px;
  border-radius: 4px;
}
.month-nav:hover { background: rgba(255,255,255,0.06); }
.month-select, .year-select {
  background: none; border: none;
  color: var(--neutral-text-title, #f3f4f6);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 14px; font-weight: 600;
  cursor: pointer;
  padding: 4px 6px;
}
.month-status {
  margin-left: 6px;
  padding: 3px 8px;
  border-radius: 99px;
  font-size: 10px; font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.month-status--open   { background: rgba(13,207,168,0.12); color: #0DCFA8; }
.month-status--closed { background: rgba(245,200,66,0.12); color: #F5C842; }

/* ── Botones de acción ──────────────────────────────────────────────── */
.pagos-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-bottom: 28px;
}
.pagos-btn {
  display: flex; align-items: center; gap: 14px;
  background: var(--neutral-background-subtle, #0f1a26);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  padding: 18px 22px;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s;
  color: var(--neutral-text-body, #d1d5db);
}
.pagos-btn:hover:not(:disabled) {
  border-color: rgba(13,207,168,0.4);
  transform: translateY(-1px);
}
.pagos-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.pagos-btn i {
  font-size: 22px;
  color: var(--neutral-text-muted, #9ca3af);
}
.pagos-btn--primary {
  background: rgba(13,207,168,0.08);
  border-color: rgba(13,207,168,0.3);
}
.pagos-btn--primary i { color: #0DCFA8; }
.pagos-btn--ghost { background: rgba(255,255,255,0.02); }
.pagos-btn span {
  display: flex; flex-direction: column; gap: 2px;
}
.pagos-btn strong {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 14px; font-weight: 600;
  color: var(--neutral-text-title, #f3f4f6);
}
.pagos-btn small {
  font-size: 11px;
  color: var(--neutral-text-muted, #9ca3af);
}
.pagos-btn--sm { padding: 10px 18px; font-size: 13px; }

/* ── KPIs ──────────────────────────────────────────────────────────── */
.pagos-kpis {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 28px;
}
.kpi {
  background: var(--neutral-background-subtle, #0f1a26);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px;
  padding: 14px 16px;
  display: flex; flex-direction: column; gap: 2px;
}
.kpi__label {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 10px; font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--neutral-text-muted, #9ca3af);
  text-transform: uppercase;
}
.kpi__value {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 22px; font-weight: 700;
  color: var(--neutral-text-title, #f3f4f6);
}
.kpi__sub { font-size: 11px; color: var(--neutral-text-muted, #9ca3af); }

/* ── Sección ──────────────────────────────────────────────────────── */
.pagos-section { margin-bottom: 32px; }
.pagos-section__head {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 12px;
}
.pagos-section__head h2 {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 16px; font-weight: 600;
  color: var(--neutral-text-title, #f3f4f6);
  margin: 0;
}
.selection-actions {
  display: flex; gap: 10px; align-items: center;
  font-size: 12px; color: var(--neutral-text-muted, #9ca3af);
}
.btn-link {
  background: none; border: none; cursor: pointer;
  color: #0DCFA8;
  font-size: 12px; font-weight: 600;
}
.btn-link:hover { text-decoration: underline; }

.pagos-empty {
  background: var(--neutral-background-subtle, #0f1a26);
  border: 1px dashed rgba(255,255,255,0.08);
  border-radius: 12px;
  padding: 40px;
  text-align: center;
  color: var(--neutral-text-muted, #9ca3af);
}
.pagos-empty p { margin: 0 0 14px; }

/* ── Cards de liquidación ────────────────────────────────────────── */
.liq-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}
.liq-card {
  background: var(--neutral-background-subtle, #0f1a26);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
  padding: 14px;
  position: relative;
  transition: all 0.15s;
}
.liq-card:hover { border-color: rgba(255,255,255,0.15); }
.liq-card--selected {
  border-color: #0DCFA8;
  background: rgba(13,207,168,0.04);
}
.liq-card__check {
  position: absolute; top: 12px; right: 12px;
}
.liq-card__head {
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 12px;
}
.liq-card__avatar {
  width: 36px; height: 36px;
  background: linear-gradient(135deg, #0DCFA8, #4AA3FF);
  color: #fff;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  font-size: 13px;
}
.liq-card__info { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.liq-card__nombre {
  font-size: 13px; font-weight: 600;
  color: var(--neutral-text-title, #f3f4f6);
}
.liq-card__estado {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 99px;
  width: fit-content;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.liq-card__estado--pagada    { background: rgba(13,207,168,0.12);  color: #0DCFA8; }
.liq-card__estado--pendiente { background: rgba(245,200,66,0.12);  color: #F5C842; }
.liq-card__estado--anulada   { background: rgba(239,68,68,0.12);   color: #f87171; }

.liq-card__body {
  display: flex; flex-direction: column; gap: 4px;
  padding: 10px 0;
  border-top: 1px solid rgba(255,255,255,0.05);
  margin-bottom: 10px;
}
.liq-row {
  display: flex; justify-content: space-between;
  font-size: 12px;
}
.liq-row span { color: var(--neutral-text-muted, #9ca3af); }
.liq-row strong { color: var(--neutral-text-body, #d1d5db); font-weight: 600; }
.liq-row--neg strong { color: #f87171; }
.liq-row--total {
  padding-top: 6px;
  border-top: 1px solid rgba(255,255,255,0.05);
  font-size: 13px;
}
.liq-row--total strong { color: #0DCFA8; font-size: 14px; }

.liq-card__foot {
  display: flex; gap: 6px;
  padding-top: 10px;
  border-top: 1px solid rgba(255,255,255,0.05);
}
.liq-card-btn {
  flex: 1;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 6px;
  padding: 6px;
  color: var(--neutral-text-muted, #9ca3af);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.1s;
}
.liq-card-btn:hover { background: rgba(13,207,168,0.08); color: #0DCFA8; border-color: rgba(13,207,168,0.25); }

/* ── Anticipos ──────────────────────────────────────────────────── */
.anticipos-list {
  background: var(--neutral-background-subtle, #0f1a26);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px;
  overflow: hidden;
}
.anticipo-row {
  display: grid;
  grid-template-columns: 32px 1fr 90px 110px 1fr;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  font-size: 13px;
}
.anticipo-row:last-child { border-bottom: none; }
.anticipo-avatar {
  width: 28px; height: 28px;
  background: rgba(255,255,255,0.08);
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700;
}
.anticipo-nombre { color: var(--neutral-text-title, #f3f4f6); font-weight: 500; }
.anticipo-fecha  { font-size: 11px; color: var(--neutral-text-muted, #9ca3af); }
.anticipo-monto  { color: #F5C842; font-weight: 700; font-family: 'Space Grotesk', sans-serif; }
.anticipo-motivo { color: var(--neutral-text-muted, #9ca3af); font-size: 12px; }

/* ── Light theme ────────────────────────────────────────────────── */
:root.light-theme .month-picker,
:root.light-theme .pagos-btn,
:root.light-theme .kpi,
:root.light-theme .liq-card,
:root.light-theme .anticipos-list,
:root.light-theme .pagos-empty {
  background: #ffffff;
  border-color: #e5e7eb;
}
:root.light-theme .pagos-title,
:root.light-theme .pagos-section__head h2,
:root.light-theme .kpi__value,
:root.light-theme .liq-card__nombre,
:root.light-theme .pagos-btn strong,
:root.light-theme .anticipo-nombre { color: #0f172a; }

@media (max-width: 900px) {
  .pagos-actions, .pagos-kpis { grid-template-columns: 1fr; }
}
</style>
