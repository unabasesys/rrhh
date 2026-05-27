<template>
  <div class="liquidaciones-page">
    <!-- Tabs de sección unificada -->
    <RrhhSectionTabs :tabs="sectionTabs" current="liquidaciones" />

    <!-- Toolbar -->
    <div class="page-toolbar">
      <div class="toolbar-left">
        <div class="search-wrap">
          <i class="u u-buscar search-icon"></i>
          <input
            v-model="searchQ"
            type="text"
            class="search-input"
            placeholder="Buscar trabajador o período..."
          />
        </div>
        <div class="filters">
          <button
            v-for="f in estadoFiltros"
            :key="f.v"
            class="filter-chip"
            :class="{ active: filtroEstado === f.v }"
            @click="filtroEstado = f.v"
          >
            {{ f.l }}
          </button>
        </div>
        <div class="periodo-filter">
          <select v-model="filtroMes" class="form-input form-input-sm">
            <option value="">Todos los meses</option>
            <option v-for="m in meses" :key="m.v" :value="m.v">{{ m.l }}</option>
          </select>
          <select v-model="filtroAnio" class="form-input form-input-sm">
            <option v-for="y in anios" :key="y" :value="y">{{ y }}</option>
          </select>
        </div>
      </div>
      <div class="toolbar-right">
        <button class="btn btn-outline" @click="exportarExcel">
          <i class="u u-descargar"></i> Exportar
        </button>
        <button class="btn btn-primary" @click="openNewLiq">
          <i class="u u-agregar"></i> Nueva Liquidación
        </button>
      </div>
    </div>

    <!-- KPI Summary -->
    <div class="kpi-row">
      <div class="kpi-card">
        <span class="kpi-label">Total Liquidaciones</span>
        <span class="kpi-value">{{ liquidacionesFiltradas.length }}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Total Haberes</span>
        <span class="kpi-value teal">{{ formatCLP(sumHaberes) }}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Total Descuentos</span>
        <span class="kpi-value red">{{ formatCLP(sumDescuentos) }}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Total Líquido</span>
        <span class="kpi-value teal">{{ formatCLP(sumLiquido) }}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Costo Empresa</span>
        <span class="kpi-value">{{ formatCLP(sumCosto) }}</span>
      </div>
    </div>

    <!-- Table -->
    <div class="table-container" v-if="!loading">
      <table class="data-table" v-if="liquidacionesFiltradas.length">
        <thead>
          <tr>
            <th @click="sortBy('nombre')" class="sortable">
              Trabajador <i class="u u-sort" v-if="sortCol === 'nombre'"></i>
            </th>
            <th @click="sortBy('periodo')" class="sortable">
              Período <i class="u u-sort" v-if="sortCol === 'periodo'"></i>
            </th>
            <th>Sueldo Base</th>
            <th>Total Haberes</th>
            <th class="red-col">Descuentos</th>
            <th>Líquido</th>
            <th>Costo Empresa</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="liq in liquidacionesFiltradas"
            :key="liq._id"
            class="table-row"
            @click="openDetail(liq)"
          >
            <td>
              <div class="worker-cell">
                <div class="mini-avatar">{{ getInitials(liq) }}</div>
                <div>
                  <div class="worker-name">{{ getNombreTrabajador(liq.trabajador_id) }}</div>
                  <div class="worker-cargo">{{ getCargo(liq.trabajador_id) }}</div>
                </div>
              </div>
            </td>
            <td class="periodo-cell">{{ liq.mes }}/{{ liq.anio }}</td>
            <td>{{ formatCLP(liq.sueldo_base) }}</td>
            <td>{{ formatCLP(liq.total_haberes) }}</td>
            <td class="red">{{ formatCLP(liq.total_descuentos) }}</td>
            <td><strong class="teal">{{ formatCLP(liq.liquido_a_pagar) }}</strong></td>
            <td>{{ formatCLP(liq.costo_empresa) }}</td>
            <td>
              <span class="badge" :class="`badge-${liq.estado}`">
                {{ labelEstado(liq.estado) }}
              </span>
            </td>
            <td @click.stop>
              <div class="row-actions">
                <button class="btn-icon" title="Ver detalle" @click="openDetail(liq)">
                  <i class="u u-eye"></i>
                </button>
                <button class="btn-icon" title="Descargar PDF" @click="descargarPDF(liq)">
                  <i class="u u-descargar"></i>
                </button>
                <button
                  v-if="liq.estado === 'borrador'"
                  class="btn-icon teal"
                  title="Marcar pagada"
                  @click="marcarPagada(liq)"
                >
                  <i class="u u-check"></i>
                </button>
                <button class="btn-icon danger" title="Eliminar liquidación" @click="pedirEliminarLiq(liq)">
                  <i class="u u-delete"></i>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="empty-state" v-else>
        <i class="u u-cobros-y-pagos empty-icon"></i>
        <p>No hay liquidaciones para el período seleccionado</p>
        <button class="btn btn-primary" @click="openNewLiq">Crear primera liquidación</button>
      </div>
    </div>

    <!-- Loading -->
    <div class="loading-state" v-if="loading">
      <div class="spinner"></div>
      <p>Cargando liquidaciones...</p>
    </div>

    <!-- Modal Nueva Liquidación -->
    <div v-if="showNewLiqModal" class="modal-overlay" @click.self="showNewLiqModal = false">
      <div class="modal-box modal-lg">
        <div class="modal-header">
          <h2>Nueva Liquidación de Sueldo</h2>
          <button class="modal-close" @click="showNewLiqModal = false">×</button>
        </div>
        <div class="modal-body">
          <!-- Step 1: Seleccionar trabajador -->
          <div class="form-section">
            <h4 class="section-title">1. Trabajador y Período</h4>
            <div class="form-grid-3">
              <div class="form-group col-span-2">
                <label>Trabajador *</label>
                <select v-model="liqForm.trabajador_id" class="form-input" @change="onTrabajadorChange">
                  <option value="">Seleccionar trabajador...</option>
                  <option
                    v-for="t in rrhhStore.trabajadoresActivos"
                    :key="t._id"
                    :value="t._id"
                  >
                    {{ t.nombre }} {{ t.apellido }} — {{ t.cargo }}
                  </option>
                </select>
              </div>
              <div class="form-group">
                <label>Mes *</label>
                <select v-model.number="liqForm.mes" class="form-input">
                  <option v-for="m in meses" :key="m.v" :value="m.v">{{ m.l }}</option>
                </select>
              </div>
              <div class="form-group">
                <label>Año *</label>
                <input v-model.number="liqForm.anio" type="number" class="form-input" min="2020" max="2030" />
              </div>
              <div class="form-group">
                <label>Días Trabajados</label>
                <input v-model.number="liqForm.dias_trabajados" type="number" class="form-input" min="1" max="30" />
              </div>
            </div>
          </div>

          <!-- Info trabajador seleccionado -->
          <div class="trabajador-info-box" v-if="trabajadorSeleccionado">
            <div class="info-chips">
              <span class="chip">AFP: {{ trabajadorSeleccionado.afp }}</span>
              <span class="chip">Salud: {{ trabajadorSeleccionado.sistema_salud || 'FONASA' }}</span>
              <span class="chip">Contrato: {{ labelContrato(trabajadorSeleccionado.tipo_contrato) }}</span>
              <span class="chip teal">Sueldo: {{ formatCLP(trabajadorSeleccionado.sueldo_base) }}</span>
            </div>
          </div>

          <!-- Step 2: Bonos -->
          <div class="form-section">
            <h4 class="section-title">2. Bonos y Asignaciones</h4>
            <div class="item-list">
              <div v-for="(bono, i) in liqForm.bonos" :key="i" class="item-row">
                <div class="item-nombre">
                  <select v-model="bono.tipo" class="form-input form-input-sm" @change="onBonoTipoChange(bono)">
                    <option v-for="t in TIPOS_BONOS" :key="t.tipo" :value="t.tipo">{{ t.nombre }}</option>
                  </select>
                </div>
                <div class="item-badge" :class="bono.imponible ? 'badge-imponible' : 'badge-no-imponible'">
                  {{ bono.imponible ? 'Imponible' : 'No Imponible' }}
                </div>
                <div class="item-monto">
                  <div class="money-input-wrap">
                    <span class="money-prefix">$</span>
                    <input
                      :value="formatCLPInput(bono.monto)"
                      @input="onBonoMontoInput(bono, $event)"
                      class="form-input money-input"
                      inputmode="numeric"
                      placeholder="0"
                    />
                  </div>
                </div>
                <button class="btn-remove" @click="removeBono(i)" title="Eliminar">×</button>
              </div>
              <button class="btn-add-item" @click="addBono">
                <i class="u u-agregar"></i> Agregar bono / asignación
              </button>
            </div>
          </div>

          <!-- Step 3: Descuentos adicionales -->
          <div class="form-section">
            <h4 class="section-title">3. Descuentos Adicionales</h4>
            <div class="item-list">
              <div v-for="(desc, i) in liqForm.descuentos" :key="i" class="item-row">
                <div class="item-nombre">
                  <select v-model="desc.tipo" class="form-input form-input-sm" @change="onDescTipoChange(desc)">
                    <option v-for="t in TIPOS_DESCUENTOS" :key="t.tipo" :value="t.tipo">{{ t.nombre }}</option>
                  </select>
                </div>
                <div class="item-monto">
                  <div class="money-input-wrap">
                    <span class="money-prefix">$</span>
                    <input
                      :value="formatCLPInput(desc.monto)"
                      @input="onDescMontoInput(desc, $event)"
                      class="form-input money-input"
                      inputmode="numeric"
                      placeholder="0"
                    />
                  </div>
                </div>
                <button class="btn-remove" @click="removeDescuento(i)" title="Eliminar">×</button>
              </div>
              <button class="btn-add-item" @click="addDescuento">
                <i class="u u-agregar"></i> Agregar descuento
              </button>
            </div>
            <div class="form-group" style="margin-top:12px">
              <label>Notas</label>
              <input v-model="liqForm.notas" type="text" class="form-input" placeholder="Observaciones..." />
            </div>
          </div>

          <!-- Resultado Cálculo -->
          <div class="liq-resultado" v-if="liqCalc && trabajadorSeleccionado">
            <h4>Resumen Liquidación</h4>
            <div class="liq-cols">
              <!-- Haberes -->
              <div class="liq-col">
                <div class="liq-section-title">Haberes</div>
                <div class="liq-line">
                  <span>Sueldo Proporcional ({{ liqForm.dias_trabajados }}/30)</span>
                  <span>{{ formatCLP(liqCalc.sueldoProporcional) }}</span>
                </div>
                <div class="liq-line" v-if="liqCalc.montoHorasExtra > 0">
                  <span>Horas Extra</span>
                  <span>{{ formatCLP(liqCalc.montoHorasExtra) }}</span>
                </div>
                <div class="liq-line" v-if="liqCalc.gratificacion > 0">
                  <span>Gratificación Legal</span>
                  <span>{{ formatCLP(liqCalc.gratificacion) }}</span>
                </div>
                <!-- Bonos imponibles -->
                <div
                  v-for="bono in liqForm.bonos.filter(b => b.imponible && b.monto > 0)"
                  :key="bono.tipo"
                  class="liq-line"
                >
                  <span>{{ getNombreBono(bono.tipo) }}</span>
                  <span>{{ formatCLP(bono.monto) }}</span>
                </div>
                <!-- Bonos no imponibles -->
                <div
                  v-for="bono in liqForm.bonos.filter(b => !b.imponible && b.monto > 0)"
                  :key="'ni_'+bono.tipo"
                  class="liq-line muted"
                >
                  <span>{{ getNombreBono(bono.tipo) }} <small>(no imp.)</small></span>
                  <span>{{ formatCLP(bono.monto) }}</span>
                </div>
                <div class="liq-line total">
                  <span>Total Haberes</span>
                  <span>{{ formatCLP(liqCalc.totalHaberes) }}</span>
                </div>
                <div class="liq-line muted">
                  <span>Renta Imponible</span>
                  <span>{{ formatCLP(liqCalc.rentaImponible) }}</span>
                </div>
              </div>
              <!-- Descuentos -->
              <div class="liq-col">
                <div class="liq-section-title">Descuentos Legales</div>
                <div class="liq-line">
                  <span>{{ trabajadorSeleccionado.afp }}</span>
                  <span class="red">-{{ formatCLP(liqCalc.afp_descuento) }}</span>
                </div>
                <div class="liq-line">
                  <span>Salud {{ trabajadorSeleccionado.sistema_salud || 'FONASA' }} (7%)</span>
                  <span class="red">-{{ formatCLP(liqCalc.salud_descuento) }}</span>
                </div>
                <div class="liq-line" v-if="liqCalc.cesantia_trabajador > 0">
                  <span>Seguro Cesantía (0.6%)</span>
                  <span class="red">-{{ formatCLP(liqCalc.cesantia_trabajador) }}</span>
                </div>
                <div class="liq-line" v-if="liqCalc.impuesto > 0">
                  <span>Imp. Único 2ª Cat.</span>
                  <span class="red">-{{ formatCLP(liqCalc.impuesto) }}</span>
                </div>
                <template v-if="liqForm.descuentos.length > 0">
                  <div class="liq-section-title" style="margin-top:10px">Otros Descuentos</div>
                  <div
                    v-for="desc in liqForm.descuentos.filter(d => d.monto > 0)"
                    :key="desc.tipo"
                    class="liq-line"
                  >
                    <span>{{ getNombreDescuento(desc.tipo) }}</span>
                    <span class="red">-{{ formatCLP(desc.monto) }}</span>
                  </div>
                </template>
                <div class="liq-line total red">
                  <span>Total Descuentos</span>
                  <span>-{{ formatCLP(liqCalc.totalDescuentos) }}</span>
                </div>
              </div>
            </div>

            <div class="liq-neto">
              <span>Líquido a Pagar</span>
              <span class="teal">{{ formatCLP(liqCalc.liquidoAPagar) }}</span>
            </div>
            <div class="liq-footer-info">
              <div class="liq-costo">
                <span>Costo total empresa</span>
                <span>{{ formatCLP(liqCalc.costoEmpresa) }}</span>
              </div>
              <div class="liq-costo">
                <span>Cesantía empleador ({{ trabajadorSeleccionado.tipo_contrato === 'plazo_fijo' ? '3.0%' : '2.4%' }})</span>
                <span>{{ formatCLP(liqCalc.cesantia_empleador) }}</span>
              </div>
            </div>
          </div>

          <div class="no-worker-notice" v-else>
            <i class="u u-usuarios"></i>
            <span>Selecciona un trabajador para calcular la liquidación automáticamente</span>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="showNewLiqModal = false">Cancelar</button>
          <button class="btn btn-outline" :disabled="!liqCalc" @click="saveLiq('borrador')">
            Guardar Borrador
          </button>
          <button class="btn btn-primary" :disabled="!liqCalc" @click="saveLiq('pagada')">
            <i class="u u-cobros-y-pagos"></i> Registrar como Pagada
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Detalle Liquidación -->
    <div v-if="showDetailModal && selectedLiq" class="modal-overlay" @click.self="showDetailModal = false">
      <div class="modal-box modal-lg">
        <div class="modal-header">
          <div>
            <h2>Liquidación — {{ getNombreTrabajador(selectedLiq.trabajador_id) }}</h2>
            <p class="modal-subtitle">Período {{ selectedLiq.mes }}/{{ selectedLiq.anio }}</p>
          </div>
          <button class="modal-close" @click="showDetailModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="liq-cols">
            <div class="liq-col">
              <div class="liq-section-title">Haberes</div>
              <div class="liq-line">
                <span>Sueldo Base</span><span>{{ formatCLP(selectedLiq.sueldo_base) }}</span>
              </div>
              <div class="liq-line total">
                <span>Total Haberes</span><span>{{ formatCLP(selectedLiq.total_haberes) }}</span>
              </div>
            </div>
            <div class="liq-col">
              <div class="liq-section-title">Descuentos</div>
              <div class="liq-line total red">
                <span>Total Descuentos</span><span>-{{ formatCLP(selectedLiq.total_descuentos) }}</span>
              </div>
            </div>
          </div>
          <div class="liq-neto">
            <span>Líquido a Pagar</span>
            <span class="teal">{{ formatCLP(selectedLiq.liquido_a_pagar) }}</span>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="showDetailModal = false">Cerrar</button>
          <button
            v-if="selectedLiq.estado === 'borrador'"
            class="btn btn-primary"
            @click="marcarPagada(selectedLiq); showDetailModal = false"
          >
            Marcar como Pagada
          </button>
          <button class="btn btn-outline" @click="descargarPDF(selectedLiq)">
            <i class="u u-descargar"></i> PDF
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Confirmar Eliminación de Liquidación -->
    <div v-if="confirmEliminarLiq.show" class="modal-overlay" @click.self="confirmEliminarLiq.show = false">
      <div class="modal-box" style="max-width:420px">
        <div class="modal-header">
          <h2 class="modal-title" style="color:#f87171">Eliminar liquidación</h2>
          <button class="modal-close" @click="confirmEliminarLiq.show = false">×</button>
        </div>
        <div style="padding:24px 24px 8px; text-align:center">
          <div style="font-size:36px; margin-bottom:12px">🗑️</div>
          <p style="font-weight:700; font-size:15px; margin-bottom:6px">
            ¿Eliminar esta liquidación?
          </p>
          <p style="color:#9ca3af; font-size:13px; margin-bottom:0" v-if="confirmEliminarLiq.liq">
            {{ getNombreTrabajador(confirmEliminarLiq.liq.trabajador_id) }} —
            período {{ confirmEliminarLiq.liq.mes }}/{{ confirmEliminarLiq.liq.anio }}
          </p>
          <p style="color:#f87171; font-size:12px; margin-top:10px">
            Esta acción es definitiva y no se puede deshacer.
          </p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="confirmEliminarLiq.show = false">Cancelar</button>
          <button class="btn btn-danger" @click="confirmarEliminarLiq">Eliminar definitivamente</button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue"
import useRrhhStore from '@/stores/rrhh'
import { TIPOS_BONOS, TIPOS_DESCUENTOS, calcularSemanaCorrida } from '@/stores/rrhh'
const loading = ref(false)

definePageMeta({ name: 'rrhh-liquidaciones', layout: 'rrhh', middleware: ['auth'] })

// ── Tabs de sección compartida ───────────────────────────────────────────────
const sectionTabs = computed(() => {
  const porVencer = (rrhhStore.contratos || []).filter(c => {
    if (!['vigente','activo','borrador'].includes(c.estado)) return false
    if (!c.fecha_termino) return false
    const fin = new Date(c.fecha_termino + 'T12:00:00')
    const lim = new Date(); lim.setDate(lim.getDate() + 30)
    return fin >= new Date() && fin <= lim
  }).length
  return [
    { key: 'contratos',    label: 'Contratos',    path: '/rrhh/contratos',    icon: 'u u-ventas' },
    { key: 'liquidaciones',label: 'Liquidaciones', path: '/rrhh/liquidaciones', icon: 'u u-cobros-y-pagos' },
    { key: 'vencimientos', label: 'Vencimientos',  path: '/rrhh/contratos?tab=vencimientos', icon: 'u u-alerta',
      badge: porVencer > 0 ? `${porVencer}` : null, badgeColor: 'orange' },
  ]
})

const t = (key) => key
const rrhhStore = useRrhhStore()

const searchQ = ref('')
const filtroEstado = ref('todos')
const filtroMes = ref('')
const filtroAnio = ref(new Date().getFullYear())
const sortCol = ref('periodo')
const sortDir = ref(-1)
const showNewLiqModal = ref(false)
const showDetailModal = ref(false)
const selectedLiq = ref(null)

// ── Eliminar liquidación ──────────────────────────────────────────────────────
const confirmEliminarLiq = ref({ show: false, liq: null })

function pedirEliminarLiq(liq) {
  confirmEliminarLiq.value = { show: true, liq }
}

function confirmarEliminarLiq() {
  const liq = confirmEliminarLiq.value.liq
  if (!liq) return
  rrhhStore.deleteLiquidacion(liq._id)
  confirmEliminarLiq.value = { show: false, liq: null }
  // Si estaba abierto el detalle de esta liquidación, cerrarlo
  if (selectedLiq.value?._id === liq._id) {
    showDetailModal.value = false
    selectedLiq.value = null
  }
}

const now = new Date()
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

const estadoFiltros = [
  { v: 'todos', l: 'Todas' },
  { v: 'pagada', l: 'Pagadas' },
  { v: 'pendiente', l: 'Pendientes' },
  { v: 'borrador', l: 'Borradores' },
]

const liqForm = ref({
  trabajador_id: '',
  mes: now.getMonth() + 1,
  anio: now.getFullYear(),
  dias_trabajados: 30,
  horas_extra: 0,
  bonos: [],     // [{ tipo, nombre, monto, imponible }]
  descuentos: [], // [{ tipo, nombre, monto }]
  notas: '',
})

const trabajadorSeleccionado = computed(() => {
  if (!liqForm.value.trabajador_id) return null
  return rrhhStore.trabajadores.find(t => t._id === liqForm.value.trabajador_id)
})

const liqCalc = computed(() => {
  if (!trabajadorSeleccionado.value) return null
  return rrhhStore.calcularLiquidacion({
    sueldo_base:    trabajadorSeleccionado.value.sueldo_base,
    afp:            trabajadorSeleccionado.value.afp,
    sistema_salud:  trabajadorSeleccionado.value.sistema_salud,
    tipo_contrato:  trabajadorSeleccionado.value.tipo_contrato,
    gratificacion:  trabajadorSeleccionado.value.gratificacion,
    dias_trabajados: liqForm.value.dias_trabajados,
    horas_extra:    liqForm.value.horas_extra,
    bonos:          liqForm.value.bonos,
    descuentos:     liqForm.value.descuentos,
  })
})

const liquidacionesFiltradas = computed(() => {
  let list = rrhhStore.liquidaciones || []

  if (filtroEstado.value !== 'todos') {
    list = list.filter(l => l.estado === filtroEstado.value)
  }
  if (filtroMes.value) {
    list = list.filter(l => l.mes === filtroMes.value)
  }
  if (filtroAnio.value) {
    list = list.filter(l => l.anio === filtroAnio.value)
  }
  if (searchQ.value) {
    const q = searchQ.value.toLowerCase()
    list = list.filter(l => {
      const nombre = getNombreTrabajador(l.trabajador_id).toLowerCase()
      return nombre.includes(q) || `${l.mes}/${l.anio}`.includes(q)
    })
  }

  return [...list].sort((a, b) => {
    if (sortCol.value === 'periodo') {
      const diff = (a.anio - b.anio) || (a.mes - b.mes)
      return diff * sortDir.value
    }
    return 0
  })
})

const sumHaberes = computed(() => liquidacionesFiltradas.value.reduce((s, l) => s + (l.total_haberes || 0), 0))
const sumDescuentos = computed(() => liquidacionesFiltradas.value.reduce((s, l) => s + (l.total_descuentos || 0), 0))
const sumLiquido = computed(() => liquidacionesFiltradas.value.reduce((s, l) => s + (l.liquido_a_pagar || 0), 0))
const sumCosto = computed(() => liquidacionesFiltradas.value.reduce((s, l) => s + (l.costo_empresa || 0), 0))

function getNombreTrabajador(id) {
  const t = rrhhStore.trabajadores.find(t => t._id === id)
  return t ? `${t.nombre} ${t.apellido}` : id || '—'
}

function getCargo(id) {
  const t = rrhhStore.trabajadores.find(t => t._id === id)
  return t?.cargo || ''
}

function getInitials(liq) {
  const nombre = getNombreTrabajador(liq.trabajador_id)
  const parts = nombre.trim().split(' ')
  return `${parts[0]?.[0] || ''}${parts[1]?.[0] || ''}`.toUpperCase()
}

function labelEstado(e) {
  return { pagada: 'Pagada', pendiente: 'Pendiente', borrador: 'Borrador' }[e] || e
}

function labelContrato(tipo) {
  return { indefinido: 'Indefinido', plazo_fijo: 'Plazo Fijo', proyecto: 'Por Proyecto', honorarios: 'Honorarios', part_time: 'Part Time', sueldo_empresarial: 'Sueldo Empresarial' }[tipo] || tipo
}

function formatCLP(v) {
  if (!v && v !== 0) return '—'
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v)
}

// Separador de miles para inputs
function formatCLPInput(n) {
  if (!n && n !== 0) return ''
  return parseInt(String(n).replace(/\D/g, '')) ? parseInt(String(n).replace(/\D/g, '')).toLocaleString('es-CL') : ''
}

function parseCLPInput(v) {
  return parseInt(String(v).replace(/\./g, '').replace(/,/g, '').replace(/\D/g, '')) || 0
}

function onMoneyInput(field, event) {
  liqForm.value[field] = parseCLPInput(event.target.value)
}

// ── Bonos helpers ────────────────────────────────────────────────────────────
function getNombreBono(tipo) {
  return TIPOS_BONOS.find(t => t.tipo === tipo)?.nombre || tipo
}
function getNombreDescuento(tipo) {
  return TIPOS_DESCUENTOS.find(t => t.tipo === tipo)?.nombre || tipo
}

function addBono() {
  const def = TIPOS_BONOS[0]
  liqForm.value.bonos.push({ tipo: def.tipo, nombre: def.nombre, monto: 0, imponible: def.imponible })
}

function removeBono(i) {
  liqForm.value.bonos.splice(i, 1)
}

function onBonoTipoChange(bono) {
  const def = TIPOS_BONOS.find(t => t.tipo === bono.tipo)
  if (def) {
    bono.nombre = def.nombre
    bono.imponible = def.imponible
  }
}

function onBonoMontoInput(bono, event) {
  bono.monto = parseCLPInput(event.target.value)
}

function addDescuento() {
  const def = TIPOS_DESCUENTOS[0]
  liqForm.value.descuentos.push({ tipo: def.tipo, nombre: def.nombre, monto: 0 })
}

function removeDescuento(i) {
  liqForm.value.descuentos.splice(i, 1)
}

function onDescTipoChange(desc) {
  const def = TIPOS_DESCUENTOS.find(t => t.tipo === desc.tipo)
  if (def) desc.nombre = def.nombre
}

function onDescMontoInput(desc, event) {
  desc.monto = parseCLPInput(event.target.value)
}

// ── Sort / Open ───────────────────────────────────────────────────────────────
function sortBy(col) {
  if (sortCol.value === col) sortDir.value *= -1
  else { sortCol.value = col; sortDir.value = -1 }
}

function openNewLiq() {
  Object.assign(liqForm.value, {
    trabajador_id: '', mes: now.getMonth() + 1, anio: now.getFullYear(),
    dias_trabajados: 30, horas_extra: 0, bonos: [], descuentos: [], notas: '',
  })
  showNewLiqModal.value = true
}

function openDetail(liq) {
  selectedLiq.value = liq
  showDetailModal.value = true
}

function onTrabajadorChange() {
  // Auto-fill days from contract type
}

async function saveLiq(estado) {
  if (!liqCalc.value || !trabajadorSeleccionado.value) return
  await rrhhStore.createLiquidacion({
    trabajador_id:       liqForm.value.trabajador_id,
    mes:                 liqForm.value.mes,
    anio:                liqForm.value.anio,
    dias_trabajados:     liqForm.value.dias_trabajados,
    horas_extra:         liqForm.value.horas_extra,
    bonos:               liqForm.value.bonos,
    descuentos:          liqForm.value.descuentos,
    sueldo_base:         trabajadorSeleccionado.value.sueldo_base,
    total_haberes:       liqCalc.value.totalHaberes,
    total_descuentos:    liqCalc.value.totalDescuentos,
    liquido_a_pagar:     liqCalc.value.liquidoAPagar,
    costo_empresa:       liqCalc.value.costoEmpresa,
    afp_descuento:       liqCalc.value.afp_descuento,
    salud_descuento:     liqCalc.value.salud_descuento,
    cesantia_trabajador: liqCalc.value.cesantia_trabajador,
    cesantia_empleador:  liqCalc.value.cesantia_empleador,
    impuesto:            liqCalc.value.impuesto,
    renta_imponible:     liqCalc.value.rentaImponible,
    renta_tributable:    liqCalc.value.rentaTributable,
    notas:               liqForm.value.notas,
    estado,
  })
  showNewLiqModal.value = false
  await rrhhStore.getLiquidaciones()
}

async function marcarPagada(liq) {
  liq.estado = 'pagada'
  // await rrhhStore.updateLiquidacion(liq._id, { estado: 'pagada' })
}

async function descargarPDF(liq) {
  if (!liq) return
  try {
    loading.value = true

    const trabajador   = rrhhStore.trabajadores.find(t => t._id === liq.trabajador_id) || {}
    const logoBase64   = null
    const nombresMes   = ['enero','febrero','marzo','abril','mayo','junio',
                          'julio','agosto','septiembre','octubre','noviembre','diciembre']
    const mesNombre    = nombresMes[(liq.mes || 1) - 1]
    const anio         = liq.anio || new Date().getFullYear()
    const diasMes      = new Date(anio, liq.mes || 1, 0).getDate()
    const fechaPago    = `${diasMes} de ${mesNombre} de ${anio}`

    // ── Recalcular desde datos guardados ──────────────────────────────────────
    const { calcularLiquidacion, getAfpComision } = await import('@/stores/rrhh')
    const calcData = calcularLiquidacion({
      sueldo_base:    liq.sueldo_base,
      afp:            trabajador.afp,
      sistema_salud:  trabajador.sistema_salud,
      tipo_contrato:  trabajador.tipo_contrato || 'indefinido',
      gratificacion:  trabajador.gratificacion || 'mensual',
      dias_trabajados: liq.dias_trabajados || 30,
      horas_extra:    liq.horas_extra || 0,
      bonos:          liq.bonos || [],
      descuentos:     liq.descuentos || [],
    })

    // ── Construir filas de haberes ────────────────────────────────────────────
    const haberes = [
      { nombre: `Sueldo Base (${liq.dias_trabajados || 30}/30 días)`, monto: calcData.sueldoProporcional },
    ]
    if (calcData.montoHorasExtra > 0)
      haberes.push({ nombre: `Horas Extra (${liq.horas_extra}h × ${liq.sueldo_base.toLocaleString('es-CL')}/30/8×1.5)`, monto: calcData.montoHorasExtra })
    if (calcData.gratificacion > 0)
      haberes.push({ nombre: 'Gratificación Legal (25% sueldo)', monto: calcData.gratificacion })
    ;(liq.bonos || []).forEach(b => {
      if (b.monto > 0) haberes.push({ nombre: b.nombre || getNombreBono(b.tipo), monto: b.monto })
    })

    // ── Construir filas de descuentos legales ─────────────────────────────────
    const afpPct = ((getAfpComision(trabajador.afp) + 0.10) * 100).toFixed(2)
    const rentaImpFmt = (calcData.rentaImponible || 0).toLocaleString('es-CL')
    const rentaTribFmt = (calcData.rentaTributable || 0).toLocaleString('es-CL')

    const descLegales = [
      {
        nombre: `${trabajador.afp || 'AFP'} ${afpPct}% (Renta Imponible: $${rentaImpFmt})`,
        monto: calcData.afp_descuento,
      },
      {
        nombre: `Salud 7% (${trabajador.sistema_salud || 'FONASA'})`,
        monto: calcData.salud_descuento,
      },
    ]
    if (calcData.cesantia_trabajador > 0)
      descLegales.push({ nombre: 'Seguro Cesantía Trabajador (0.6%)', monto: calcData.cesantia_trabajador })
    if (calcData.impuesto > 0)
      descLegales.push({
        nombre: `Imp. Único 2ª Cat. (Renta Tributable: $${rentaTribFmt})`,
        monto: calcData.impuesto,
      })

    // ── Otros descuentos ──────────────────────────────────────────────────────
    const otrosDesc = (liq.descuentos || [])
      .filter(d => d.monto > 0)
      .map(d => ({ nombre: d.nombre || getNombreDescuento(d.tipo), monto: d.monto }))

    const totalHaberes    = haberes.reduce((s, h) => s + h.monto, 0)
    const totalDescuentos = descLegales.reduce((s, d) => s + d.monto, 0) +
                            otrosDesc.reduce((s, d) => s + d.monto, 0)
    const liquidoAPagar   = liq.liquido_a_pagar || calcData.liquidoAPagar

    const payload = {
      logo_base64: logoBase64,
      organizacion: {
        nombre:    localStorage.getItem('rrhh_org_name') || 'Mi Empresa',
        rut:       localStorage.getItem('rrhh_org_rut') || '',
        direccion: localStorage.getItem('rrhh_org_address') || '',
      },
      trabajador: {
        nombre:          `${trabajador.nombre || ''} ${trabajador.apellido || ''}`.trim().toUpperCase(),
        rut:             trabajador.rut || '',
        cargo:           trabajador.cargo || '',
        fecha_ingreso:   trabajador.fecha_ingreso
          ? new Date(trabajador.fecha_ingreso).toLocaleDateString('es-CL', { day:'numeric', month:'long', year:'numeric' })
          : '',
        lugar_trabajo:   localStorage.getItem('rrhh_org_name') || 'Mi Empresa',
        centro_costo:    trabajador.centro_costo || '',
        dias_trabajados: liq.dias_trabajados || 30,
      },
      liquidacion: {
        periodo:          `${mesNombre} de ${anio}`,
        haberes,
        descuentos_legales: descLegales,
        otros_descuentos:   otrosDesc,
        aportes:            [],
        totales: {
          aportes:    0,
          haberes:    totalHaberes,
          descuentos: totalDescuentos,
        },
        liquido_a_pagar: liquidoAPagar,
        pago: {
          fecha_pago:    fechaPago,
          banco:         trabajador.banco         || '',
          tipo_cuenta:   trabajador.tipo_cuenta   || '',
          numero_cuenta: trabajador.numero_cuenta || '',
        },
      },
    }

    const response = await $fetch('/api/rrhh/liquidacion-pdf', {
      method: 'POST',
      body: payload,
      responseType: 'blob',
    })

    const url  = URL.createObjectURL(response)
    const link = document.createElement('a')
    link.href     = url
    link.download = `liquidacion-${trabajador.rut || 'doc'}-${anio}-${String(liq.mes).padStart(2,'0')}.pdf`
    link.click()
    URL.revokeObjectURL(url)

  } catch (err) {
    console.error('Error generando PDF:', err)
  } finally {
    loading.value = false
  }
}

function exportarExcel() {
  // Export - TODO
  console.log('Exportar liquidaciones')
}

onMounted(async () => {
  loading.value = true
  await Promise.all([
    rrhhStore.getLiquidaciones(),
    rrhhStore.getTrabajadores(),
  ])
  loading.value = false
})

onUnmounted(() => {
  loading.value = false
})
</script>

<style scoped>
.liquidaciones-page {
  padding: 24px;
}

/* Toolbar */
.page-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-right {
  display: flex;
  gap: 10px;
}

.search-wrap {
  position: relative;
}

.search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--neutral-text-body, #9ca3af);
  font-size: 14px;
  pointer-events: none;
}

.search-input {
  background: var(--neutral-background-strong, #2a3a4a);
  border: 1.5px solid var(--neutral-border-light, rgba(255,255,255,0.1));
  border-radius: 8px;
  padding: 8px 12px 8px 34px;
  color: var(--neutral-text-title, #f3f4f6);
  font-size: 13px;
  font-family: inherit;
  width: 220px;
  transition: border-color 0.2s;
}
.search-input:focus { outline: none; border-color: var(--primary-text-default, #3ac7a5); }

.filters {
  display: flex;
  gap: 6px;
}

.filter-chip {
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  background: var(--neutral-background-strong, #2a3a4a);
  color: var(--neutral-text-body, #9ca3af);
  border: 1.5px solid var(--neutral-border-light, rgba(255,255,255,0.08));
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
}
.filter-chip.active {
  background: var(--primary-surface-shadow-8a, rgba(58,199,165,0.12));
  color: var(--primary-text-default, #3ac7a5);
  border-color: rgba(58,199,165,0.4);
}
.filter-chip:hover:not(.active) {
  border-color: rgba(255,255,255,0.2);
  color: var(--neutral-text-title, #f3f4f6);
}

.periodo-filter {
  display: flex;
  gap: 6px;
}

/* KPI */
.kpi-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 14px;
  margin-bottom: 24px;
}

.kpi-card {
  background: var(--neutral-background-strong, #2a3a4a);
  border: 1px solid var(--neutral-border-light, rgba(255,255,255,0.07));
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.kpi-label {
  font-size: 11px;
  color: var(--neutral-text-body, #9ca3af);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.kpi-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--neutral-text-title, #f3f4f6);
}

/* Table */
.table-container {
  background: var(--neutral-background-strong, #2a3a4a);
  border: 1px solid var(--neutral-border-light, rgba(255,255,255,0.07));
  border-radius: 12px;
  overflow: hidden;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.data-table th {
  padding: 12px 14px;
  text-align: left;
  font-size: 11px;
  font-weight: 700;
  color: var(--neutral-text-body, #9ca3af);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  border-bottom: 1.5px solid rgba(255,255,255,0.09);
  background: rgba(10,18,26,0.35);
  white-space: nowrap;
}

.data-table th.sortable { cursor: pointer; user-select: none; }
.data-table th.sortable:hover { color: var(--neutral-text-title, #f3f4f6); }

.data-table td {
  padding: 13px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  color: var(--neutral-text-title, #f3f4f6);
  vertical-align: middle;
}

.table-row { cursor: pointer; transition: background 0.15s; }
.table-row:hover td { background: rgba(255,255,255,0.03); }
.table-row:last-child td { border-bottom: none; }

.worker-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mini-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--primary-surface-default, #2a9d8f);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.worker-name { font-size: 13px; font-weight: 500; }
.worker-cargo { font-size: 11px; color: var(--neutral-text-body, #9ca3af); }

.periodo-cell { font-weight: 600; color: var(--neutral-text-body, #9ca3af); }

.row-actions { display: flex; gap: 2px; }

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-box {
  background: var(--neutral-background-strong, #2a3a4a);
  border-radius: 16px;
  border: 1px solid var(--neutral-border-light, rgba(255,255,255,0.1));
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  width: 90%;
  max-width: 640px;
  max-height: 90vh;
  overflow-y: auto;
}
.modal-lg { max-width: 780px; }

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 20px 24px;
  border-bottom: 1px solid var(--neutral-border-light, rgba(255,255,255,0.08));
}

.modal-header h2 {
  font-size: 17px;
  font-weight: 700;
  color: var(--neutral-text-title, #f3f4f6);
  margin: 0 0 2px;
}

.modal-subtitle {
  font-size: 13px;
  color: var(--neutral-text-body, #9ca3af);
  margin: 0;
}

.modal-close {
  background: none; border: none;
  font-size: 22px; color: var(--neutral-text-body, #9ca3af);
  cursor: pointer; padding: 2px 6px; line-height: 1;
}
.modal-close:hover { color: var(--neutral-text-title, #f3f4f6); }

.modal-body { padding: 24px; }

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px;
  border-top: 1px solid var(--neutral-border-light, rgba(255,255,255,0.08));
}

/* Form */
.form-section { margin-bottom: 20px; }

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--primary-text-default, #3ac7a5);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 12px;
}

.form-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

.col-span-2 { grid-column: span 2; }

.form-group { display: flex; flex-direction: column; gap: 5px; }

.form-group label {
  font-size: 11px;
  font-weight: 600;
  color: var(--neutral-text-body, #9ca3af);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.form-input {
  background: var(--neutral-background-default, #1e272e);
  border: 1.5px solid var(--neutral-border-light, rgba(255,255,255,0.1));
  border-radius: 8px;
  padding: 8px 12px;
  color: var(--neutral-text-title, #f3f4f6);
  font-size: 13px;
  font-family: inherit;
  transition: border-color 0.2s;
  width: 100%;
  box-sizing: border-box;
}
.form-input:focus { outline: none; border-color: var(--primary-text-default, #3ac7a5); }
.form-input-sm { padding: 7px 10px; font-size: 12px; }

/* Money input with prefix */
.money-input-wrap {
  display: flex;
  align-items: center;
  background: var(--neutral-background-default, #1e272e);
  border: 1.5px solid var(--neutral-border-light, rgba(255,255,255,0.1));
  border-radius: 8px;
  padding: 0 12px;
  height: 37px;
  transition: border-color 0.2s;
  width: 100%;
  box-sizing: border-box;
}
.money-input-wrap:focus-within {
  border-color: var(--primary-text-default, #3ac7a5);
}
.money-prefix {
  color: var(--neutral-text-body);
  font-size: 13px;
  font-weight: 700;
  margin-right: 4px;
  user-select: none;
}
.money-input {
  flex: 1;
  background: transparent !important;
  border: none !important;
  padding: 0 !important;
  text-align: right;
  font-weight: 700;
  outline: none !important;
}

.trabajador-info-box {
  background: var(--primary-surface-shadow-8a, rgba(58,199,165,0.07));
  border: 1px solid rgba(58,199,165,0.2);
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 16px;
}

.info-chips { display: flex; gap: 8px; flex-wrap: wrap; }

.chip {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 500;
  background: rgba(255,255,255,0.07);
  color: var(--neutral-text-body, #9ca3af);
}

.chip.teal {
  background: rgba(58,199,165,0.15);
  color: #3ac7a5;
}

/* Liquidación resultado */
.liq-resultado {
  background: var(--neutral-background-default, #1e272e);
  border: 1px solid var(--neutral-border-light, rgba(255,255,255,0.07));
  border-radius: 10px;
  padding: 20px;
  margin-top: 16px;
}

.liq-resultado h4 {
  font-size: 14px;
  font-weight: 600;
  color: var(--neutral-text-title, #f3f4f6);
  margin: 0 0 16px;
}

.liq-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-bottom: 16px;
}

.liq-section-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--neutral-text-body, #9ca3af);
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--neutral-border-light, rgba(255,255,255,0.07));
}

.liq-line {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  padding: 4px 0;
  color: var(--neutral-text-body, #9ca3af);
}
.liq-line span:last-child { font-weight: 500; color: var(--neutral-text-title, #f3f4f6); }
.liq-line.muted span { color: var(--neutral-text-body, #9ca3af) !important; font-size: 11px; }
.liq-line.total {
  border-top: 1px solid var(--neutral-border-light, rgba(255,255,255,0.1));
  margin-top: 6px;
  padding-top: 8px;
  font-weight: 600;
  color: var(--neutral-text-title, #f3f4f6);
}
.liq-line.total span:last-child { color: var(--neutral-text-title, #f3f4f6) !important; }
.liq-line.total.red span:last-child { color: #f87171 !important; }

.liq-neto {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  background: var(--primary-surface-shadow-8a, rgba(58,199,165,0.08));
  border-radius: 8px;
  border: 1px solid rgba(58,199,165,0.3);
  font-size: 16px;
  font-weight: 700;
  color: var(--neutral-text-title, #f3f4f6);
  margin-bottom: 10px;
}

.liq-footer-info {
  display: flex;
  gap: 20px;
}

.liq-costo {
  display: flex;
  justify-content: space-between;
  flex: 1;
  font-size: 12px;
  color: var(--neutral-text-body, #9ca3af);
  padding: 4px 0;
}

.no-worker-notice {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px;
  background: var(--neutral-background-default, #1e272e);
  border-radius: 8px;
  border: 1px dashed var(--neutral-border-light, rgba(255,255,255,0.1));
  color: var(--neutral-text-body, #9ca3af);
  font-size: 13px;
  margin-top: 16px;
}

/* Item list (bonos / descuentos) */
.item-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.item-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.item-nombre {
  flex: 2;
}

.item-monto {
  flex: 1;
  min-width: 130px;
}

.item-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 12px;
  white-space: nowrap;
}
.badge-imponible {
  background: rgba(251,191,36,0.15);
  color: #fbbf24;
}
.badge-no-imponible {
  background: rgba(156,163,175,0.12);
  color: var(--neutral-text-caption, #6b7280);
}

.btn-add-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--primary-text-default, #3ac7a5);
  background: var(--primary-surface-shadow-8a, rgba(58,199,165,0.07));
  border: 1.5px dashed rgba(58,199,165,0.3);
  cursor: pointer;
  font-family: inherit;
  width: 100%;
  justify-content: center;
  transition: all 0.15s;
  margin-top: 4px;
}
.btn-add-item:hover {
  background: rgba(58,199,165,0.12);
  border-color: rgba(58,199,165,0.5);
}

.btn-icon.red { color: #f87171; }

.btn-remove {
  flex-shrink: 0;
  width: 28px; height: 28px;
  border-radius: 6px;
  background: rgba(248, 113, 113, 0.1);
  border: 1px solid rgba(248, 113, 113, 0.3);
  color: #f87171;
  font-size: 16px; line-height: 1;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
  font-family: inherit;
}
.btn-remove:hover {
  background: rgba(248, 113, 113, 0.25);
  border-color: rgba(248, 113, 113, 0.6);
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  font-family: inherit;
  transition: all 0.2s;
  white-space: nowrap;
}
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-primary { background: var(--primary-surface-default, #2a9d8f); color: #fff; }
.btn-primary:hover:not(:disabled) { opacity: 0.85; }
.btn-outline { background: transparent; border: 1.5px solid var(--primary-text-default, #3ac7a5); color: var(--primary-text-default, #3ac7a5); }
.btn-outline:hover:not(:disabled) { background: var(--primary-surface-shadow-8a, rgba(58,199,165,0.08)); }
.btn-ghost { background: transparent; color: var(--neutral-text-body, #9ca3af); }
.btn-ghost:hover { color: var(--neutral-text-title, #f3f4f6); }
.btn-icon { background: none; border: none; color: var(--neutral-text-body, #9ca3af); cursor: pointer; padding: 6px; border-radius: 6px; font-size: 14px; transition: all 0.15s; }
.btn-icon:hover { background: var(--neutral-background-default, #1e272e); color: var(--neutral-text-title, #f3f4f6); }
.btn-icon.teal { color: #3ac7a5; }
.btn-icon.danger { color: #f87171; }
.btn-icon.danger:hover { background: rgba(248,113,113,0.1); color: #ef4444; }
.btn-danger { background: #dc2626; color: #fff; border: none; }
.btn-danger:hover { background: #b91c1c; }

/* Badges */
.badge {
  display: inline-flex; align-items: center;
  padding: 3px 10px; border-radius: 20px;
  font-size: 11px; font-weight: 600;
}
.badge-pagada { background: rgba(34,197,94,0.15); color: #4ade80; }
.badge-pendiente { background: rgba(251,191,36,0.15); color: #fbbf24; }
.badge-borrador { background: rgba(156,163,175,0.15); color: var(--neutral-text-caption, #6b7280); }

/* Colors */
.teal { color: #3ac7a5 !important; }
.red { color: #f87171 !important; }

/* Empty */
.empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 60px 24px; gap: 14px; color: var(--neutral-text-body, #9ca3af);
}
.empty-icon { font-size: 52px; opacity: 0.25; }

/* Loading */
.loading-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 64px; gap: 16px; color: var(--neutral-text-body, #9ca3af);
}
.spinner {
  width: 36px; height: 36px;
  border: 3px solid rgba(58,199,165,0.2);
  border-top-color: #3ac7a5;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Responsive */
@media (max-width: 1024px) {
  .kpi-row { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 768px) {
  .kpi-row { grid-template-columns: repeat(2, 1fr); }
  .liq-cols { grid-template-columns: 1fr; }
  .form-grid-3 { grid-template-columns: 1fr 1fr; }
  .col-span-2 { grid-column: span 1; }
}
</style>
