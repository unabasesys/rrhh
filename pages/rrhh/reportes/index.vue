<template>
  <div class="reportes-page">
    <!-- ── Section Tabs: Herramientas ─────────────────────────────────── -->
    <RrhhSectionTabs :tabs="herramientasTabs" current="reportes" />

    <!-- Toolbar -->
    <div class="page-toolbar">
      <div class="toolbar-left">
        <select v-model="filtroAnio" class="form-input form-input-sm">
          <option v-for="y in anios" :key="y" :value="y">{{ y }}</option>
        </select>
        <select v-model="filtroMes" class="form-input form-input-sm">
          <option value="">Año completo</option>
          <option v-for="m in meses" :key="m.v" :value="m.v">{{ m.l }}</option>
        </select>
      </div>
      <div class="toolbar-right">
        <button class="btn btn-outline" @click="exportarLibroDT">
          <i class="u u-descargar"></i> Libro DT
        </button>
        <button class="btn btn-outline" @click="exportarCentralizacion">
          <i class="u u-descargar"></i> Centralización
        </button>
        <button class="btn btn-primary" @click="exportarTodos">
          <i class="u u-descargar"></i> Exportar Todo
        </button>
      </div>
    </div>

    <!-- KPI Dashboard -->
    <div class="kpi-grid">
      <div class="kpi-card kpi-main">
        <div class="kpi-icon"><i class="u u-usuarios"></i></div>
        <div class="kpi-data">
          <span class="kpi-label">Trabajadores Activos</span>
          <span class="kpi-value">{{ rrhhStore.trabajadoresActivos.length }}</span>
          <span class="kpi-sub">de {{ rrhhStore.trabajadores.length }} totales</span>
        </div>
      </div>
      <div class="kpi-card kpi-main">
        <div class="kpi-icon teal"><i class="u u-cobros-y-pagos"></i></div>
        <div class="kpi-data">
          <span class="kpi-label">Costo Mensual Total</span>
          <span class="kpi-value teal">{{ formatCLP(rrhhStore.costoMensualTotal) }}</span>
          <span class="kpi-sub">incluyendo cargas patronales</span>
        </div>
      </div>
      <div class="kpi-card kpi-main">
        <div class="kpi-icon yellow"><i class="u u-folder-open"></i></div>
        <div class="kpi-data">
          <span class="kpi-label">Contratos por Vencer</span>
          <span class="kpi-value yellow">{{ rrhhStore.trabajadoresPorVencer.length }}</span>
          <span class="kpi-sub">próximos 30 días</span>
        </div>
      </div>
      <div class="kpi-card kpi-main">
        <div class="kpi-icon purple"><i class="u u-ventas"></i></div>
        <div class="kpi-data">
          <span class="kpi-label">Vacaciones Acumuladas</span>
          <span class="kpi-value purple">{{ rrhhStore.vacacionesTotales }} días</span>
          <span class="kpi-sub">total equipo</span>
        </div>
      </div>
    </div>

    <!-- Reporte Tabs -->
    <div class="report-tabs">
      <button
        v-for="tab in reporteTabs"
        :key="tab.id"
        class="tab-btn"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        <i :class="tab.icon"></i> {{ tab.label }}
      </button>
    </div>

    <!-- Tab: Centralización de Remuneraciones -->
    <div v-if="activeTab === 'centralizacion'" class="tab-content">
      <div class="section-header">
        <div>
          <h3>Centralización de Remuneraciones</h3>
          <p class="section-desc">Resumen contable de haberes, descuentos y aportes patronales del período seleccionado.</p>
        </div>
        <button class="btn btn-outline btn-sm" @click="exportarCentralizacion">
          <i class="u u-descargar"></i> Exportar Excel
        </button>
      </div>

      <div class="centralizacion-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Cuenta Contable</th>
              <th>Descripción</th>
              <th>Debe</th>
              <th>Haber</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in cuentasCentralizacion" :key="row.cuenta">
              <td class="cuenta-code">{{ row.cuenta }}</td>
              <td>{{ row.desc }}</td>
              <td class="number">{{ row.debe > 0 ? formatCLP(row.debe) : '—' }}</td>
              <td class="number">{{ row.haber > 0 ? formatCLP(row.haber) : '—' }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td colspan="2"><strong>TOTALES</strong></td>
              <td class="number teal"><strong>{{ formatCLP(totalDebe) }}</strong></td>
              <td class="number teal"><strong>{{ formatCLP(totalHaber) }}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div class="contabilidad-nota">
        <i class="u u-alerta"></i>
        <span>Los asientos contables están basados en las liquidaciones del período. Revise con su contador antes de contabilizar.</span>
      </div>
    </div>

    <!-- Tab: Libro de Remuneraciones DT -->
    <div v-if="activeTab === 'libro_dt'" class="tab-content">
      <div class="section-header">
        <div>
          <h3>Libro de Remuneraciones — Dirección del Trabajo</h3>
          <p class="section-desc">Formato exigido por el Art. 62 del Código del Trabajo para empresas con 5 o más trabajadores.</p>
        </div>
        <button class="btn btn-outline btn-sm" @click="exportarLibroDT">
          <i class="u u-descargar"></i> Exportar
        </button>
      </div>

      <div class="table-wrap">
        <table class="data-table libro-table">
          <thead>
            <tr>
              <th>RUT</th>
              <th>Nombre</th>
              <th>Cargo</th>
              <th>Días</th>
              <th>S. Base</th>
              <th>Gratif.</th>
              <th>T. Haberes</th>
              <th>AFP</th>
              <th>Salud</th>
              <th>Cesantía</th>
              <th>Imp. 2ª Cat</th>
              <th>T. Desc.</th>
              <th>Líquido</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in libroRows" :key="row.rut">
              <td>{{ row.rut }}</td>
              <td>{{ row.nombre }}</td>
              <td>{{ row.cargo }}</td>
              <td class="center">{{ row.dias }}</td>
              <td class="number">{{ formatCLP(row.sueldo_base) }}</td>
              <td class="number">{{ formatCLP(row.gratificacion) }}</td>
              <td class="number">{{ formatCLP(row.total_haberes) }}</td>
              <td class="number red">{{ formatCLP(row.afp) }}</td>
              <td class="number red">{{ formatCLP(row.salud) }}</td>
              <td class="number red">{{ formatCLP(row.cesantia) }}</td>
              <td class="number red">{{ formatCLP(row.impuesto) }}</td>
              <td class="number red">{{ formatCLP(row.total_descuentos) }}</td>
              <td class="number teal"><strong>{{ formatCLP(row.liquido) }}</strong></td>
            </tr>
            <tr v-if="!libroRows.length" class="empty-row">
              <td colspan="13" class="empty-cell">
                No hay liquidaciones para el período seleccionado
              </td>
            </tr>
          </tbody>
          <tfoot v-if="libroRows.length">
            <tr class="total-row">
              <td colspan="4"><strong>TOTALES</strong></td>
              <td class="number"><strong>{{ formatCLP(libroTotals.sueldo_base) }}</strong></td>
              <td class="number"><strong>{{ formatCLP(libroTotals.gratificacion) }}</strong></td>
              <td class="number"><strong>{{ formatCLP(libroTotals.total_haberes) }}</strong></td>
              <td class="number red"><strong>{{ formatCLP(libroTotals.afp) }}</strong></td>
              <td class="number red"><strong>{{ formatCLP(libroTotals.salud) }}</strong></td>
              <td class="number red"><strong>{{ formatCLP(libroTotals.cesantia) }}</strong></td>
              <td class="number red"><strong>{{ formatCLP(libroTotals.impuesto) }}</strong></td>
              <td class="number red"><strong>{{ formatCLP(libroTotals.total_descuentos) }}</strong></td>
              <td class="number teal"><strong>{{ formatCLP(libroTotals.liquido) }}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <!-- Tab: Costos por Proyecto (Ley 19.981) -->
    <div v-if="activeTab === 'costos_proyecto'" class="tab-content">
      <div class="section-header">
        <div>
          <h3>Costos por Proyecto Audiovisual</h3>
          <p class="section-desc">Distribución de costos laborales por proyecto — especialmente útil para obras bajo Ley N° 19.981.</p>
        </div>
        <button class="btn btn-outline btn-sm">
          <i class="u u-descargar"></i> Exportar
        </button>
      </div>

      <div class="proyectos-grid" v-if="proyectos.length">
        <div class="proyecto-card" v-for="proy in proyectos" :key="proy.nombre">
          <div class="proyecto-header">
            <div class="proyecto-icon"><i class="u u-ventas"></i></div>
            <div class="proyecto-info">
              <h4>{{ proy.nombre }}</h4>
              <span class="proyecto-badge">Ley 19.981</span>
            </div>
          </div>
          <div class="proyecto-trabajadores">
            <div class="pt-row" v-for="t in proy.trabajadores" :key="t.id">
              <div class="pt-name">{{ t.nombre }}</div>
              <div class="pt-cargo">{{ t.cargo }}</div>
              <div class="pt-costo teal">{{ formatCLP(t.costo_empresa) }}</div>
            </div>
          </div>
          <div class="proyecto-total">
            <span>Costo Total Proyecto</span>
            <span class="teal">{{ formatCLP(proy.costo_total) }}</span>
          </div>
        </div>
      </div>

      <div class="empty-state" v-else>
        <i class="u u-ventas empty-icon"></i>
        <p>No hay proyectos audiovisuales registrados</p>
        <p class="empty-sub">Crea contratos "Por Proyecto" para ver el costo por obra</p>
      </div>
    </div>

    <!-- Tab: Resumen AFP/Salud -->
    <div v-if="activeTab === 'prevision'" class="tab-content">
      <div class="section-header">
        <div>
          <h3>Resumen Previsional</h3>
          <p class="section-desc">Totales de cotizaciones a AFP y sistemas de salud del período.</p>
        </div>
        <button class="btn btn-outline btn-sm">
          <i class="u u-descargar"></i> Exportar
        </button>
      </div>

      <div class="prevision-grid">
        <!-- AFP -->
        <div class="prevision-card">
          <h4 class="prevision-title">AFP</h4>
          <div class="prevision-rows">
            <div class="prevision-row" v-for="afp in resumenAFP" :key="afp.nombre">
              <div class="afp-info">
                <span class="afp-nombre">{{ afp.nombre }}</span>
                <span class="afp-count">{{ afp.count }} trabajador{{ afp.count !== 1 ? 'es' : '' }}</span>
              </div>
              <div class="afp-montos">
                <div class="monto-item">
                  <span class="monto-label">Trabajador</span>
                  <span class="monto-value red">{{ formatCLP(afp.aporte_trabajador) }}</span>
                </div>
                <div class="monto-item">
                  <span class="monto-label">Empleador (SIS)</span>
                  <span class="monto-value">{{ formatCLP(afp.aporte_empleador) }}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="prevision-total">
            <span>Total AFP</span>
            <span class="teal">{{ formatCLP(totalAFP) }}</span>
          </div>
        </div>

        <!-- Salud -->
        <div class="prevision-card">
          <h4 class="prevision-title">Sistema de Salud</h4>
          <div class="prevision-rows">
            <div class="prevision-row" v-for="s in resumenSalud" :key="s.nombre">
              <div class="afp-info">
                <span class="afp-nombre">{{ s.nombre }}</span>
                <span class="afp-count">{{ s.count }} trabajador{{ s.count !== 1 ? 'es' : '' }}</span>
              </div>
              <div class="afp-montos">
                <div class="monto-item">
                  <span class="monto-label">Cotización 7%</span>
                  <span class="monto-value red">{{ formatCLP(s.total) }}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="prevision-total">
            <span>Total Salud</span>
            <span class="teal">{{ formatCLP(totalSalud) }}</span>
          </div>
        </div>

        <!-- Cesantía -->
        <div class="prevision-card">
          <h4 class="prevision-title">Seguro de Cesantía (AFC)</h4>
          <div class="cesantia-info">
            <div class="cesantia-row">
              <span>Aporte Trabajadores (0.6%)</span>
              <span class="red">{{ formatCLP(totalCesantiaTrabajador) }}</span>
            </div>
            <div class="cesantia-row">
              <span>Aporte Empleador (2.4% / 3.0%)</span>
              <span>{{ formatCLP(totalCesantiaEmpleador) }}</span>
            </div>
          </div>
          <div class="prevision-total">
            <span>Total AFC</span>
            <span class="teal">{{ formatCLP(totalCesantiaTrabajador + totalCesantiaEmpleador) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab: Vacaciones -->
    <div v-if="activeTab === 'vacaciones'" class="tab-content">
      <div class="section-header">
        <div>
          <h3>Control de Vacaciones</h3>
          <p class="section-desc">Días acumulados y pendientes por trabajador. Base: 15 días hábiles anuales (Art. 67 CT).</p>
        </div>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Trabajador</th>
              <th>Cargo</th>
              <th>Fecha Ingreso</th>
              <th>Antigüedad</th>
              <th>Días Ganados</th>
              <th>Días Tomados</th>
              <th>Saldo</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in vacacionesRows" :key="t._id">
              <td>
                <div class="worker-cell">
                  <div class="mini-avatar">{{ `${t.nombre?.[0]}${t.apellido?.[0]}`.toUpperCase() }}</div>
                  <span>{{ t.nombre }} {{ t.apellido }}</span>
                </div>
              </td>
              <td>{{ t.cargo }}</td>
              <td>{{ formatDate(t.fecha_ingreso) }}</td>
              <td>{{ getAntiguedad(t.fecha_ingreso) }}</td>
              <td class="center">{{ t.vacaciones_ganados || 0 }}</td>
              <td class="center">{{ t.vacaciones_tomados || 0 }}</td>
              <td class="center">
                <span :class="getSaldoClass(t)">{{ (t.vacaciones_ganados || 0) - (t.vacaciones_tomados || 0) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue"
import useRrhhStore from '@/stores/rrhh'
import RrhhSectionTabs from '@/components/rrhh/SectionTabs.vue'

definePageMeta({ name: 'rrhh-reportes', layout: 'rrhh', middleware: ['auth'] })

const t = (key) => key
const rrhhStore = useRrhhStore()

const now = new Date()
const filtroAnio = ref(now.getFullYear())
const filtroMes = ref(now.getMonth() + 1)
const activeTab = ref('centralizacion')

const meses = [
  { v: 1, l: 'Enero' }, { v: 2, l: 'Febrero' }, { v: 3, l: 'Marzo' },
  { v: 4, l: 'Abril' }, { v: 5, l: 'Mayo' }, { v: 6, l: 'Junio' },
  { v: 7, l: 'Julio' }, { v: 8, l: 'Agosto' }, { v: 9, l: 'Septiembre' },
  { v: 10, l: 'Octubre' }, { v: 11, l: 'Noviembre' }, { v: 12, l: 'Diciembre' },
]

const anios = computed(() => {
  const yr = now.getFullYear()
  return [yr, yr - 1, yr - 2, yr - 3]
})

const reporteTabs = [
  { id: 'centralizacion', label: 'Centralización', icon: 'u u-cobros-y-pagos' },
  { id: 'libro_dt', label: 'Libro DT', icon: 'u u-folder-open' },
  { id: 'costos_proyecto', label: 'Costos Proyecto', icon: 'u u-ventas' },
  { id: 'prevision', label: 'AFP / Salud', icon: 'u u-usuarios' },
  { id: 'vacaciones', label: 'Vacaciones', icon: 'u u-calendario' },
]

// ── Herramientas section tabs (unifica Reportes + Informes Asistencia) ──
const herramientasTabs = [
  { key: 'reportes', label: 'Reportes y Nómina', path: '/rrhh/reportes' },
  { key: 'informes', label: 'Informes Asistencia', path: '/rrhh/asistencia/informes' },
]

const liquidacionesPeriodo = computed(() => {
  return rrhhStore.liquidaciones.filter(l => {
    if (filtroMes.value) return l.anio === filtroAnio.value && l.mes === filtroMes.value
    return l.anio === filtroAnio.value
  })
})

// Centralización
const cuentasCentralizacion = computed(() => {
  const liq = liquidacionesPeriodo.value
  const sumHaberes = liq.reduce((s, l) => s + (l.total_haberes || 0), 0)
  const sumAfp = liq.reduce((s, l) => s + (l.afp_descuento || 0), 0)
  const sumSalud = liq.reduce((s, l) => s + (l.salud_descuento || 0), 0)
  const sumCesantiaT = liq.reduce((s, l) => s + (l.cesantia_trabajador || 0), 0)
  const sumCesantiaE = liq.reduce((s, l) => s + (l.cesantia_empleador || 0), 0)
  const sumImpuesto = liq.reduce((s, l) => s + (l.impuesto || 0), 0)
  const sumLiquido = liq.reduce((s, l) => s + (l.liquido_a_pagar || 0), 0)
  return [
    { cuenta: '4-1-01-01', desc: 'Sueldos y Salarios', debe: sumHaberes, haber: 0 },
    { cuenta: '2-1-05-01', desc: 'Cotizaciones AFP por pagar', debe: 0, haber: sumAfp },
    { cuenta: '2-1-05-02', desc: 'Cotizaciones Salud por pagar', debe: 0, haber: sumSalud },
    { cuenta: '2-1-05-03', desc: 'Seguro Cesantía trabajador', debe: 0, haber: sumCesantiaT },
    { cuenta: '4-1-01-05', desc: 'Aporte Empleador Cesantía', debe: sumCesantiaE, haber: 0 },
    { cuenta: '2-1-05-04', desc: 'Cesantía empleador por pagar', debe: 0, haber: sumCesantiaE },
    { cuenta: '2-1-05-05', desc: 'Impuesto Único 2ª Categoría', debe: 0, haber: sumImpuesto },
    { cuenta: '2-1-01-01', desc: 'Remuneraciones por pagar', debe: 0, haber: sumLiquido },
  ]
})

const totalDebe = computed(() => cuentasCentralizacion.value.reduce((s, r) => s + r.debe, 0))
const totalHaber = computed(() => cuentasCentralizacion.value.reduce((s, r) => s + r.haber, 0))

// Libro DT
const libroRows = computed(() => {
  return liquidacionesPeriodo.value.map(liq => {
    const trab = rrhhStore.trabajadores.find(t => t._id === liq.trabajador_id)
    return {
      rut: trab?.rut || '—',
      nombre: trab ? `${trab.nombre} ${trab.apellido}` : '—',
      cargo: trab?.cargo || '—',
      dias: liq.dias_trabajados || 30,
      sueldo_base: liq.sueldo_base || 0,
      gratificacion: liq.gratificacion || 0,
      total_haberes: liq.total_haberes || 0,
      afp: liq.afp_descuento || 0,
      salud: liq.salud_descuento || 0,
      cesantia: liq.cesantia_trabajador || 0,
      impuesto: liq.impuesto || 0,
      total_descuentos: liq.total_descuentos || 0,
      liquido: liq.liquido_a_pagar || 0,
    }
  })
})

const libroTotals = computed(() => {
  const keys = ['sueldo_base', 'gratificacion', 'total_haberes', 'afp', 'salud', 'cesantia', 'impuesto', 'total_descuentos', 'liquido']
  const totals = {}
  keys.forEach(k => { totals[k] = libroRows.value.reduce((s, r) => s + (r[k] || 0), 0) })
  return totals
})

// Proyectos
const proyectos = computed(() => {
  const contratosProyecto = rrhhStore.contratos.filter(c => c.tipo_contrato === 'proyecto' && c.nombre_proyecto)
  const proyMap = {}
  contratosProyecto.forEach(c => {
    const proy = c.nombre_proyecto
    if (!proyMap[proy]) proyMap[proy] = { nombre: proy, trabajadores: [], costo_total: 0 }
    const trab = rrhhStore.trabajadores.find(t => t._id === c.trabajador_id)
    if (trab) {
      const base = trab.sueldo_base || 0
      const costo = Math.round(base * 1.264)
      proyMap[proy].trabajadores.push({ id: trab._id, nombre: `${trab.nombre} ${trab.apellido}`, cargo: trab.cargo, costo_empresa: costo })
      proyMap[proy].costo_total += costo
    }
  })
  return Object.values(proyMap)
})

// AFP / Salud
const resumenAFP = computed(() => {
  const map = {}
  rrhhStore.trabajadoresActivos.forEach(t => {
    const afp = t.afp || 'Desconocida'
    if (!map[afp]) map[afp] = { nombre: afp, count: 0, aporte_trabajador: 0, aporte_empleador: 0 }
    map[afp].count++
    const base = t.sueldo_base || 0
    map[afp].aporte_trabajador += Math.round(base * 0.1)
    map[afp].aporte_empleador += Math.round(base * 0.0153) // SIS aprox
  })
  return Object.values(map)
})

const resumenSalud = computed(() => {
  const map = {}
  rrhhStore.trabajadoresActivos.forEach(t => {
    const salud = t.sistema_salud || 'FONASA'
    if (!map[salud]) map[salud] = { nombre: salud, count: 0, total: 0 }
    map[salud].count++
    map[salud].total += Math.round((t.sueldo_base || 0) * 0.07)
  })
  return Object.values(map)
})

const totalAFP = computed(() => resumenAFP.value.reduce((s, a) => s + a.aporte_trabajador + a.aporte_empleador, 0))
const totalSalud = computed(() => resumenSalud.value.reduce((s, s2) => s + s2.total, 0))
const totalCesantiaTrabajador = computed(() => rrhhStore.trabajadoresActivos.reduce((s, t) => s + Math.round((t.sueldo_base || 0) * 0.006), 0))
const totalCesantiaEmpleador = computed(() => rrhhStore.trabajadoresActivos.reduce((s, t) => s + Math.round((t.sueldo_base || 0) * (t.tipo_contrato === 'plazo_fijo' ? 0.03 : 0.024)), 0))

// Vacaciones
const vacacionesRows = computed(() => rrhhStore.trabajadoresActivos)

function getAntiguedad(fecha) {
  if (!fecha) return '—'
  const diff = now - new Date(fecha)
  const years = Math.floor(diff / (1000 * 60 * 60 * 24 * 365))
  const months = Math.floor((diff % (1000 * 60 * 60 * 24 * 365)) / (1000 * 60 * 60 * 24 * 30))
  if (years === 0) return `${months}m`
  return `${years}a ${months}m`
}

function getSaldoClass(t) {
  const saldo = (t.vacaciones_ganados || 0) - (t.vacaciones_tomados || 0)
  if (saldo < 0) return 'red'
  if (saldo > 20) return 'yellow'
  return 'teal'
}

function formatCLP(v) {
  if (!v && v !== 0) return '—'
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v)
}

function formatDate(d) {
  if (!d) return '—'
  const dateStr = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d + 'T12:00' : d
  return new Date(dateStr).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function exportarCentralizacion() { console.log('Exportar centralización') }
function exportarLibroDT() { console.log('Exportar Libro DT') }
function exportarTodos() { console.log('Exportar todos los reportes') }

onMounted(async () => {
  await Promise.all([
    rrhhStore.getTrabajadores(),
    rrhhStore.getLiquidaciones(),
    rrhhStore.getContratos(),
  ])
})

onUnmounted(() => {
})
</script>

<style scoped>
.reportes-page { padding: 24px; }

/* Toolbar */
.page-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
.toolbar-left { display: flex; gap: 10px; }
.toolbar-right { display: flex; gap: 10px; }
.form-input { background: var(--neutral-background-strong, #2a3a4a); border: 1.5px solid var(--neutral-border-light, rgba(255,255,255,0.1)); border-radius: 8px; padding: 8px 12px; color: var(--neutral-text-title, #f3f4f6); font-size: 13px; font-family: inherit; }
.form-input:focus { outline: none; border-color: var(--primary-text-default, #3ac7a5); }
.form-input-sm { padding: 7px 10px; font-size: 12px; }

/* KPI Grid */
.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 28px; }
.kpi-card { background: var(--neutral-background-strong, #2a3a4a); border: 1px solid var(--neutral-border-light, rgba(255,255,255,0.07)); border-radius: 12px; padding: 18px 20px; display: flex; align-items: center; gap: 16px; }
.kpi-main {}
.kpi-icon { font-size: 28px; color: var(--neutral-text-body, #9ca3af); }
.kpi-icon.teal { color: #3ac7a5; }
.kpi-icon.yellow { color: #fbbf24; }
.kpi-icon.purple { color: #a78bfa; }
.kpi-data { display: flex; flex-direction: column; gap: 3px; }
.kpi-label { font-size: 11px; color: var(--neutral-text-body, #9ca3af); font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
.kpi-value { font-size: 22px; font-weight: 700; color: var(--neutral-text-title, #f3f4f6); }
.kpi-sub { font-size: 11px; color: var(--neutral-text-body, #9ca3af); }

/* Report tabs */
.report-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--neutral-border-light, rgba(255,255,255,0.07)); margin-bottom: 24px; }
.tab-btn { padding: 10px 16px; background: none; border: none; color: var(--neutral-text-body, #9ca3af); font-size: 13px; font-weight: 500; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: all 0.2s; display: flex; align-items: center; gap: 7px; font-family: inherit; }
.tab-btn:hover { color: var(--neutral-text-title, #f3f4f6); }
.tab-btn.active { color: var(--primary-text-default, #3ac7a5); border-bottom-color: var(--primary-text-default, #3ac7a5); }
.tab-content { animation: fadeIn 0.2s ease; }

/* Section header */
.section-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
.section-header h3 { font-size: 16px; font-weight: 600; color: var(--neutral-text-title, #f3f4f6); margin: 0 0 4px; }
.section-desc { font-size: 13px; color: var(--neutral-text-body, #9ca3af); margin: 0; }

/* Tables */
.table-wrap, .centralizacion-table-wrap { background: var(--neutral-background-strong, #2a3a4a); border: 1px solid var(--neutral-border-light, rgba(255,255,255,0.07)); border-radius: 12px; overflow: auto; }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table th { padding: 11px 14px; text-align: left; font-size: 11px; font-weight: 600; color: var(--neutral-text-body, #9ca3af); text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid var(--neutral-border-light, rgba(255,255,255,0.08)); background: rgba(0,0,0,0.1); white-space: nowrap; }
.data-table td { padding: 11px 14px; border-bottom: 1px solid var(--neutral-border-light, rgba(255,255,255,0.04)); color: var(--neutral-text-title, #f3f4f6); white-space: nowrap; }
.data-table tfoot td { border-top: 2px solid var(--neutral-border-light, rgba(255,255,255,0.12)); border-bottom: none; padding: 12px 14px; background: rgba(0,0,0,0.1); }
.total-row td { font-weight: 600; }
.cuenta-code { font-family: monospace; color: var(--neutral-text-body, #9ca3af); font-size: 12px; }
.number { text-align: right; }
.center { text-align: center; }
.empty-row td { text-align: center; padding: 40px; color: var(--neutral-text-body, #9ca3af); }

.contabilidad-nota { display: flex; align-items: center; gap: 10px; margin-top: 12px; padding: 10px 14px; background: rgba(251,191,36,0.07); border: 1px solid rgba(251,191,36,0.2); border-radius: 8px; font-size: 12px; color: #fbbf24; }

/* Proyectos */
.proyectos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
.proyecto-card { background: var(--neutral-background-strong, #2a3a4a); border: 1px solid var(--neutral-border-light, rgba(255,255,255,0.07)); border-radius: 12px; padding: 20px; }
.proyecto-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.proyecto-icon { font-size: 28px; color: #a78bfa; }
.proyecto-info h4 { font-size: 14px; font-weight: 600; color: var(--neutral-text-title, #f3f4f6); margin: 0 0 4px; }
.proyecto-badge { display: inline-flex; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; background: rgba(139,92,246,0.15); color: #a78bfa; }
.proyecto-trabajadores { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
.pt-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--neutral-border-light, rgba(255,255,255,0.05)); }
.pt-name { flex: 1; font-size: 13px; font-weight: 500; color: var(--neutral-text-title, #f3f4f6); }
.pt-cargo { font-size: 11px; color: var(--neutral-text-body, #9ca3af); width: 100px; }
.pt-costo { font-size: 13px; font-weight: 600; }
.proyecto-total { display: flex; justify-content: space-between; padding-top: 12px; border-top: 2px solid var(--neutral-border-light, rgba(255,255,255,0.1)); font-size: 14px; font-weight: 700; color: var(--neutral-text-title, #f3f4f6); }

/* Previsión */
.prevision-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.prevision-card { background: var(--neutral-background-strong, #2a3a4a); border: 1px solid var(--neutral-border-light, rgba(255,255,255,0.07)); border-radius: 12px; padding: 20px; }
.prevision-title { font-size: 13px; font-weight: 700; color: var(--primary-text-default, #3ac7a5); text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 16px; }
.prevision-rows { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
.prevision-row { display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; border-bottom: 1px solid var(--neutral-border-light, rgba(255,255,255,0.05)); }
.afp-info { display: flex; flex-direction: column; gap: 2px; }
.afp-nombre { font-size: 13px; font-weight: 500; color: var(--neutral-text-title, #f3f4f6); }
.afp-count { font-size: 11px; color: var(--neutral-text-body, #9ca3af); }
.afp-montos { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.monto-item { display: flex; flex-direction: column; align-items: flex-end; }
.monto-label { font-size: 10px; color: var(--neutral-text-body, #9ca3af); }
.monto-value { font-size: 13px; font-weight: 500; color: var(--neutral-text-title, #f3f4f6); }
.prevision-total { display: flex; justify-content: space-between; padding-top: 12px; border-top: 2px solid var(--neutral-border-light, rgba(255,255,255,0.1)); font-size: 14px; font-weight: 700; color: var(--neutral-text-title, #f3f4f6); }
.cesantia-info { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
.cesantia-row { display: flex; justify-content: space-between; font-size: 13px; padding: 6px 0; border-bottom: 1px solid var(--neutral-border-light, rgba(255,255,255,0.05)); color: var(--neutral-text-body, #9ca3af); }
.cesantia-row span:last-child { font-weight: 500; color: var(--neutral-text-title, #f3f4f6); }

/* Vacaciones */
.worker-cell { display: flex; align-items: center; gap: 10px; }
.mini-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--primary-surface-default, #2a9d8f); color: #fff; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

/* Buttons */
.btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; font-family: inherit; transition: all 0.2s; white-space: nowrap; }
.btn-sm { padding: 6px 12px; font-size: 12px; }
.btn-primary { background: var(--primary-surface-default, #2a9d8f); color: #fff; }
.btn-primary:hover { opacity: 0.85; }
.btn-outline { background: transparent; border: 1.5px solid var(--primary-text-default, #3ac7a5); color: var(--primary-text-default, #3ac7a5); }
.btn-outline:hover { background: var(--primary-surface-shadow-8a, rgba(58,199,165,0.08)); }

/* Colors */
.teal { color: #3ac7a5 !important; }
.red { color: #f87171 !important; }
.yellow { color: #fbbf24 !important; }
.purple { color: #a78bfa !important; }

/* Empty */
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 24px; gap: 12px; color: var(--neutral-text-body, #9ca3af); }
.empty-icon { font-size: 52px; opacity: 0.25; }
.empty-sub { font-size: 12px; margin: 0; }

@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

@media (max-width: 1024px) {
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
  .prevision-grid { grid-template-columns: 1fr; }
}
@media (max-width: 768px) {
  .kpi-grid { grid-template-columns: 1fr; }
}
</style>
