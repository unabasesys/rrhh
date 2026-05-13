<template>
  <div class="indicadores-page">

    <!-- ── Header ──────────────────────────────────────────────────────────── -->
    <div class="ind-header">
      <div class="ind-header-left">
        <h2 class="ind-title">Indicadores Previsionales</h2>
        <div class="ind-periodo-badge">
          <i class="u u-calendario" style="font-size:12px"></i>
          Remuneraciones {{ periodoLabel }} — pago {{ pagoLabel }}
        </div>
      </div>
      <div class="ind-header-right">
        <div class="ind-fuente">
          <span class="ind-fuente-label">Fuente</span>
          <a href="https://www.previred.com/indicadores-previsionales/" target="_blank" rel="noopener" class="ind-fuente-link">
            PREVIRED.COM <i class="u u-external-link" style="font-size:10px"></i>
          </a>
          <span class="ind-fuente-fecha">Actualizado {{ fechaActualizacion }}</span>
        </div>
        <div v-if="alertaSIS" class="ind-alerta-sis">
          <i class="u u-info-circle"></i>
          {{ alertaSIS }}
        </div>
      </div>
    </div>

    <!-- ── Fila 1: UF + UTM/UTA + Rentas tope ──────────────────────────────── -->
    <div class="ind-row">

      <!-- UF -->
      <div class="ind-card ind-card-highlight">
        <div class="ind-card-header">
          <span class="ind-card-icon">📊</span>
          <span class="ind-card-title">Valor UF</span>
        </div>
        <div class="ind-uf-main">
          <span class="ind-uf-label">Al {{ uf.fechaActual }}</span>
          <span class="ind-uf-valor">{{ formatCLP(uf.valorActual) }}</span>
        </div>
        <div class="ind-uf-prev">
          <span>Al {{ uf.fechaAnterior }}</span>
          <span>{{ formatCLP(uf.valorAnterior) }}</span>
        </div>
      </div>

      <!-- UTM / UTA -->
      <div class="ind-card">
        <div class="ind-card-header">
          <span class="ind-card-icon">📐</span>
          <span class="ind-card-title">UTM / UTA</span>
          <span class="ind-card-period">{{ periodoLabel }}</span>
        </div>
        <div class="ind-kv-list">
          <div class="ind-kv">
            <span class="ind-kv-label">UTM</span>
            <span class="ind-kv-value teal">{{ formatCLP(utm.valor) }}</span>
          </div>
          <div class="ind-kv">
            <span class="ind-kv-label">UTA (anual)</span>
            <span class="ind-kv-value">{{ formatCLP(uta.valor) }}</span>
          </div>
        </div>
      </div>

      <!-- Rentas topes -->
      <div class="ind-card">
        <div class="ind-card-header">
          <span class="ind-card-icon">🏛️</span>
          <span class="ind-card-title">Rentas Topes Imponibles</span>
        </div>
        <div class="ind-kv-list">
          <div class="ind-kv" v-for="tope in rentasTopes" :key="tope.label">
            <span class="ind-kv-label">{{ tope.label }}</span>
            <span class="ind-kv-value">{{ formatCLP(tope.valor) }}</span>
          </div>
        </div>
      </div>

      <!-- Rentas mínimas -->
      <div class="ind-card">
        <div class="ind-card-header">
          <span class="ind-card-icon">📋</span>
          <span class="ind-card-title">Rentas Mínimas Imponibles</span>
        </div>
        <div class="ind-kv-list">
          <div class="ind-kv" v-for="r in rentasMinimas" :key="r.label">
            <span class="ind-kv-label">{{ r.label }}</span>
            <span class="ind-kv-value">{{ formatCLP(r.valor) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Fila 2: AFP + Cesantía ─────────────────────────────────────────── -->
    <div class="ind-row">

      <!-- Tabla AFP dependientes -->
      <div class="ind-card ind-card-wide">
        <div class="ind-card-header">
          <span class="ind-card-icon">🏦</span>
          <span class="ind-card-title">Tasas AFP — Dependientes</span>
        </div>
        <table class="ind-table">
          <thead>
            <tr>
              <th>AFP</th>
              <th class="text-right">Trabajador</th>
              <th class="text-right">Empleador (SIS)</th>
              <th class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="afp in tasasAFP" :key="afp.nombre" :class="{ 'row-highlight': afp.nombre === 'Capital' }">
              <td class="afp-nombre">{{ afp.nombre }}</td>
              <td class="text-right teal-text">{{ afp.trabajador }}</td>
              <td class="text-right muted-text">{{ afp.empleador }}</td>
              <td class="text-right bold-text">{{ afp.total }}</td>
            </tr>
          </tbody>
        </table>
        <div class="ind-table-note">(*) SIS 2026: <strong>{{ sisRate }}</strong> — Oficio N° 7429, 14/04/2026</div>
      </div>

      <!-- Seguro de Cesantía + SIS + APV -->
      <div class="ind-col">

        <!-- Cesantía AFC -->
        <div class="ind-card">
          <div class="ind-card-header">
            <span class="ind-card-icon">🔒</span>
            <span class="ind-card-title">Seguro de Cesantía (AFC)</span>
          </div>
          <table class="ind-table">
            <thead>
              <tr>
                <th>Contrato</th>
                <th class="text-right">Empleador</th>
                <th class="text-right">Trabajador</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in cesantia" :key="c.tipo">
                <td>{{ c.tipo }}</td>
                <td class="text-right teal-text">{{ c.empleador }}</td>
                <td class="text-right">{{ c.trabajador }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- SIS + APV -->
        <div class="ind-row ind-row-sm">
          <div class="ind-card ind-card-mini">
            <div class="ind-card-header">
              <span class="ind-card-icon">🛡️</span>
              <span class="ind-card-title">SIS</span>
            </div>
            <div class="ind-big-number teal">{{ sisRate }}</div>
            <div class="ind-big-label">Cargo empleador</div>
          </div>
          <div class="ind-card ind-card-mini">
            <div class="ind-card-header">
              <span class="ind-card-icon">💰</span>
              <span class="ind-card-title">APV</span>
            </div>
            <div class="ind-kv-list">
              <div class="ind-kv">
                <span class="ind-kv-label">Tope mes (50 UF)</span>
                <span class="ind-kv-value teal">{{ formatCLP(apv.topesMensual) }}</span>
              </div>
              <div class="ind-kv">
                <span class="ind-kv-label">Tope anual (600 UF)</span>
                <span class="ind-kv-value">{{ formatCLP(apv.topesAnual) }}</span>
              </div>
              <div class="ind-kv">
                <span class="ind-kv-label">Depósito convenido (900 UF)</span>
                <span class="ind-kv-value">{{ formatCLP(apv.depositoConvenido) }}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- ── Fila 3: Asignación familiar + Trabajos pesados + Salud ─────────── -->
    <div class="ind-row">

      <!-- Asignación familiar -->
      <div class="ind-card">
        <div class="ind-card-header">
          <span class="ind-card-icon">👨‍👩‍👧</span>
          <span class="ind-card-title">Asignación Familiar</span>
        </div>
        <table class="ind-table">
          <thead>
            <tr>
              <th>Tramo</th>
              <th class="text-right">Monto</th>
              <th>Renta máxima</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in asignacionFamiliar" :key="t.tramo">
              <td><span class="tramo-badge" :class="`tramo-${t.letra}`">{{ t.tramo }}</span></td>
              <td class="text-right teal-text">{{ t.monto ? formatCLP(t.monto) : '—' }}</td>
              <td class="muted-text text-sm">{{ t.requisito }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Trabajos pesados -->
      <div class="ind-card">
        <div class="ind-card-header">
          <span class="ind-card-icon">⚒️</span>
          <span class="ind-card-title">Cotización Trabajos Pesados</span>
        </div>
        <table class="ind-table">
          <thead>
            <tr>
              <th>Calificación</th>
              <th class="text-right">Total</th>
              <th class="text-right">Empleador</th>
              <th class="text-right">Trabajador</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="tp in trabajosPesados" :key="tp.tipo">
              <td>{{ tp.tipo }}</td>
              <td class="text-right bold-text">{{ tp.total }}</td>
              <td class="text-right teal-text">{{ tp.empleador }}</td>
              <td class="text-right">{{ tp.trabajador }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Distribución salud 7% CCAF -->
      <div class="ind-card">
        <div class="ind-card-header">
          <span class="ind-card-icon">🏥</span>
          <span class="ind-card-title">Distribución Salud 7% — CCAF</span>
        </div>
        <div class="ind-kv-list" style="margin-bottom:12px">
          <div class="ind-kv" v-for="s in saludCCAF" :key="s.label">
            <span class="ind-kv-label">{{ s.label }}</span>
            <span class="ind-kv-value teal">{{ s.valor }}</span>
          </div>
        </div>
        <p class="ind-note">Solo aplica a empleadores afiliados a una Caja de Compensación. De lo contrario, se cotiza el 7% íntegro a FONASA.</p>
      </div>

    </div>

  </div>
</template>

<script setup>
import { computed, onMounted } from "vue"
import { useIndicadoresStore } from '@/stores/indicadores'

definePageMeta({ name: 'rrhh-indicadores', layout: 'rrhh', middleware: ['auth'] })

const ind = useIndicadoresStore()
onMounted(() => ind.initIfEmpty())

// ── Período ────────────────────────────────────────────────────────────────
const periodoLabel       = computed(() => ind.periodo)
const pagoLabel          = computed(() => ind.pago)
const fechaActualizacion = computed(() => {
  if (!ind.actualizado) return '—'
  const d = new Date(ind.actualizado + 'T12:00')
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
})
const alertaSIS = computed(() =>
  ind.sis_tasa
    ? `Nueva tasa SIS ${(ind.sis_tasa * 100).toFixed(2).replace('.', ',')}% — Oficio N° 7429 del 14/04/2026`
    : null
)

// ── Datos desde el store ───────────────────────────────────────────────────
const uf = computed(() => ({
  fechaActual:   ind.uf_fecha,
  valorActual:   ind.uf_actual,
  fechaAnterior: ind.uf_fecha_ant,
  valorAnterior: ind.uf_anterior,
}))

const utm = computed(() => ({ valor: ind.utm }))
const uta = computed(() => ({ valor: ind.uta }))

const rentasTopes = computed(() => [
  { label: 'AFP (90 UF)',                valor: ind.tope_afp      },
  { label: 'IPS / ex-INP (60 UF)',       valor: ind.tope_ips      },
  { label: 'Seguro Cesantía (135,2 UF)', valor: ind.tope_cesantia },
])

const rentasMinimas = computed(() => [
  { label: 'Dependientes e Independientes', valor: ind.renta_min_dependiente },
  { label: 'Menores 18 / Mayores 65',       valor: ind.renta_min_menor_65   },
  { label: 'Casa Particular',               valor: ind.renta_min_casa_part  },
  { label: 'Fines no remuneracionales',     valor: ind.renta_min_no_remun   },
])

const sisRate = computed(() =>
  ind.sis_tasa ? (ind.sis_tasa * 100).toFixed(2).replace('.', ',') + '%' : '1,62%'
)

const tasasAFP = computed(() =>
  (ind.afp || []).map(a => ({
    nombre:     a.nombre.replace('AFP ', ''),
    trabajador: pct(a.trabajador_total || (0.10 + a.comision)),
    empleador:  pct(a.empleador_sis   || 0.001),
    total:      pct((a.trabajador_total || (0.10 + a.comision)) + (a.empleador_sis || 0.001)),
  }))
)

const cesantia = computed(() => {
  const c = ind.cesantia || {}
  return [
    { tipo: 'Plazo Indefinido',    empleador: pctRI(c.indefinido_empleador),    trabajador: pctRI(c.indefinido_trabajador) },
    { tipo: 'Plazo Fijo',          empleador: pctRI(c.plazo_fijo_empleador),    trabajador: '—' },
    { tipo: 'Proyecto',            empleador: pctRI(c.proyecto_empleador),      trabajador: '—' },
    { tipo: 'Indefinido ≥11 años', empleador: pctRI(c.indefinido_11_empleador), trabajador: '—' },
    { tipo: 'Casa Particular',     empleador: pctRI(c.casa_part_empleador),     trabajador: '—' },
  ]
})

const apv = computed(() => ({
  topesMensual:      ind.apv_tope_mensual,
  topesAnual:        ind.apv_tope_anual,
  depositoConvenido: ind.deposito_convenido,
}))

const asignacionFamiliar = computed(() =>
  (ind.asignacion_familiar || []).map((t, i) => ({
    tramo:    `Tramo ${t.tramo}`,
    letra:    t.tramo.toLowerCase(),
    monto:    t.monto,
    requisito: i === 0 ? `Renta ≤ ${formatCLP(t.renta_max)}`
             : t.renta_max
             ? `${formatCLP((ind.asignacion_familiar[i-1]?.renta_max || 0) + 1)} < Renta ≤ ${formatCLP(t.renta_max)}`
             : `Renta > ${formatCLP(ind.asignacion_familiar[i-1]?.renta_max || 0)}`,
  }))
)

const trabajosPesados = computed(() => {
  const tp = ind.trabajos_pesados || {}
  return [
    { tipo: 'Pesado',       total: '4%', empleador: pctRI(tp.pesado_empleador),        trabajador: pctRI(tp.pesado_trabajador) },
    { tipo: 'Menos pesado', total: '2%', empleador: pctRI(tp.menos_pesado_empleador),  trabajador: pctRI(tp.menos_pesado_trabajador) },
  ]
})

const saludCCAF = computed(() => [
  { label: 'CCAF',   valor: pctRI(ind.ccaf_ccaf)   },
  { label: 'FONASA', valor: pctRI(ind.ccaf_fonasa)  },
])

// ── Helpers ────────────────────────────────────────────────────────────────
function formatCLP(n) {
  if (!n && n !== 0) return '—'
  return '$\u00a0' + Math.round(n).toLocaleString('es-CL')
}
function pct(v)   { return v != null ? (v * 100).toFixed(2).replace('.', ',') + '%' : '—' }
function pctRI(v) { return v != null ? (v * 100).toFixed(1).replace('.', ',') + '% R.I.' : '—' }
</script>

<style scoped>
.indicadores-page {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 1400px;
}

/* ── Header ── */
.ind-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.ind-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--neutral-text-title, #f3f4f6);
  margin: 0 0 6px;
}
.ind-periodo-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #0ea5e9;
  background: rgba(14,165,233,0.1);
  border: 1px solid rgba(14,165,233,0.2);
  border-radius: 20px;
  padding: 4px 12px;
}
.ind-header-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}
.ind-fuente {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--neutral-text-subtitle, #6b7280);
}
.ind-fuente-label { font-weight: 600; }
.ind-fuente-link  { color: #0ea5e9; text-decoration: none; font-weight: 600; }
.ind-fuente-link:hover { text-decoration: underline; }
.ind-fuente-fecha { color: #4b5563; }
.ind-alerta-sis {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #f59e0b;
  background: rgba(245,158,11,0.08);
  border: 1px solid rgba(245,158,11,0.2);
  border-radius: 8px;
  padding: 6px 12px;
}

/* ── Layout rows ── */
.ind-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
  align-items: start;
}
.ind-row-sm {
  display: grid;
  grid-template-columns: 1fr 1.6fr;
  gap: 12px;
}
.ind-col {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ── Cards ── */
.ind-card {
  background: var(--neutral-bg-card, rgba(255,255,255,0.04));
  border: 1px solid var(--neutral-border-light, rgba(255,255,255,0.08));
  border-radius: 12px;
  padding: 16px;
}
.ind-card-highlight {
  border-color: rgba(14,165,233,0.25);
  background: rgba(14,165,233,0.05);
}
.ind-card-wide {
  grid-column: span 2;
}
@media (max-width: 900px) {
  .ind-card-wide { grid-column: span 1; }
}
.ind-card-mini {
  padding: 14px;
}

.ind-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}
.ind-card-icon   { font-size: 16px; }
.ind-card-title  { font-size: 13px; font-weight: 600; color: var(--neutral-text-title, #f3f4f6); flex: 1; }
.ind-card-period { font-size: 11px; color: var(--neutral-text-subtitle, #6b7280); }

/* ── UF block ── */
.ind-uf-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
}
.ind-uf-label {
  font-size: 11px;
  color: var(--neutral-text-caption, #6b7280);
}
.ind-uf-valor {
  font-size: 28px;
  font-weight: 700;
  color: #0ea5e9;
  letter-spacing: -0.5px;
}
.ind-uf-prev {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--neutral-text-subtitle, #6b7280);
  border-top: 1px solid rgba(255,255,255,0.06);
  padding-top: 8px;
}

/* ── Key-value list ── */
.ind-kv-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ind-kv {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  gap: 12px;
}
.ind-kv-label {
  color: var(--neutral-text-caption, #6b7280);
  flex: 1;
}
.ind-kv-value {
  color: var(--neutral-text-title, #f3f4f6);
  font-weight: 600;
  white-space: nowrap;
}
.ind-kv-value.teal { color: #0ea5e9; }

/* ── Big number ── */
.ind-big-number {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 4px;
}
.ind-big-number.teal { color: #0ea5e9; }
.ind-big-label { font-size: 11px; color: var(--neutral-text-subtitle, #6b7280); }

/* ── Tables ── */
.ind-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.ind-table th {
  color: var(--neutral-text-subtitle, #6b7280);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 6px 8px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  text-align: left;
}
.ind-table td {
  padding: 7px 8px;
  color: var(--neutral-text-body, #d1d5db);
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.ind-table tr:last-child td { border-bottom: none; }
.ind-table tr.row-highlight td { background: rgba(14,165,233,0.06); }
.ind-table tr.row-highlight .afp-nombre { color: #0ea5e9; font-weight: 600; }
.ind-table .text-right { text-align: right; }
.ind-table .teal-text   { color: #0ea5e9; font-weight: 600; }
.ind-table .muted-text  { color: var(--neutral-text-subtitle, #6b7280); }
.ind-table .bold-text   { font-weight: 700; color: var(--neutral-text-title, #111827); }
.ind-table .text-sm     { font-size: 11px; }
.ind-table-note {
  margin-top: 10px;
  font-size: 11px;
  color: var(--neutral-text-subtitle, #6b7280);
  border-top: 1px solid rgba(255,255,255,0.06);
  padding-top: 8px;
}
.ind-table-note strong { color: #f59e0b; }

/* ── Tramos ── */
.tramo-badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
}
.tramo-a { background: rgba(16,185,129,0.15); color: #10b981; }
.tramo-b { background: rgba(14,165,233,0.15); color: #0ea5e9; }
.tramo-c { background: rgba(245,158,11,0.15); color: #f59e0b; }
.tramo-d { background: rgba(107,114,128,0.15); color: var(--neutral-text-subtitle, #6b7280); }

/* ── Note ── */
.ind-note {
  font-size: 11px;
  color: var(--neutral-text-subtitle, #6b7280);
  line-height: 1.5;
  margin: 0;
  border-top: 1px solid rgba(255,255,255,0.06);
  padding-top: 10px;
}
</style>
