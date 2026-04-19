<template>
  <div class="contratos-page">
    <!-- Tabs de sección unificada -->
    <RrhhSectionTabs :tabs="sectionTabs" :current="sectionTabActual" />

    <!-- Page header: título + acciones -->
    <div class="page-header">
      <div class="page-header__left">
        <h2 class="page-header__title">Contratos y Liquidaciones</h2>
        <span class="page-header__sub">{{ contratosFiltrados.length }} contratos · {{ rrhhStore.contratos?.length || 0 }} total</span>
      </div>
      <div class="page-header__right">
        <button class="btn btn-outline" @click="exportarContratos">
          <i class="u u-descargar"></i> Exportar
        </button>
        <button class="btn btn-primary" @click="openNewContrato">
          <i class="u u-agregar"></i> Nuevo Contrato
        </button>
      </div>
    </div>

    <!-- Filter bar: idéntico a Personas -->
    <div class="filter-bar">
      <div class="filterInput">
        <span class="u u-buscar"></span>
        <input v-model="searchQ" type="text" placeholder="Buscar contrato..." />
      </div>

      <!-- Estado: chips (igual que Personas) -->
      <button
        v-for="f in estadoFiltros"
        :key="f.v"
        :class="['chip', filtroEstado === f.v && 'active']"
        @click="filtroEstado = f.v"
      >{{ f.l }}</button>

      <!-- Separador -->
      <div class="filter-sep"></div>

      <!-- Tipo: chips -->
      <button
        v-for="f in tipoFiltros.slice(1)"
        :key="f.v"
        :class="['chip', filtroTipo === f.v && 'active']"
        @click="filtroTipo = filtroTipo === f.v ? 'todos' : f.v"
      >{{ f.l }}</button>
    </div>

    <!-- Alertas próximos vencimientos -->
    <div class="alerts-row" v-if="proximosVencer.length">
      <div class="alert-banner">
        <i class="u u-alerta alert-icon"></i>
        <span>
          <strong>{{ proximosVencer.length }} contrato{{ proximosVencer.length > 1 ? 's' : '' }}</strong>
          vence{{ proximosVencer.length > 1 ? 'n' : '' }} en los próximos 30 días:
          {{ proximosVencer.map(c => getNombreTrabajador(c.trabajador_id)).join(', ') }}
        </span>
        <button class="btn btn-ghost btn-sm" @click="filtroEstado = 'por_vencer'">Ver todos</button>
      </div>
    </div>

    <!-- Lista de contratos - Cards view -->
    <div class="contratos-grid" v-if="!globalStore.loading && contratosFiltrados.length">
      <div
        class="contrato-card"
        v-for="c in contratosFiltrados"
        :key="c._id"
        @click="openDetail(c)"
      >
        <div class="contrato-card-header">
          <div class="worker-info">
            <div class="mini-avatar">{{ getInitials(c) }}</div>
            <div>
              <div class="worker-name">{{ getNombreTrabajador(c.trabajador_id) }}</div>
              <div class="worker-cargo">{{ getCargo(c.trabajador_id) }}</div>
            </div>
          </div>
          <span class="badge" :class="`badge-estado-${c.estado}`">{{ labelEstado(c.estado) }}</span>
        </div>

        <div class="contrato-card-body">
          <div class="tipo-badge" :class="`tipo-${c.tipo_contrato}`">
            <i class="u u-folder-open"></i>
            {{ labelContrato(c.tipo_contrato) }}
          </div>

          <div class="contrato-fechas">
            <div class="fecha-item">
              <span class="fecha-label">Inicio</span>
              <span class="fecha-value">{{ formatDate(c.fecha_inicio) }}</span>
            </div>
            <div class="fecha-sep">→</div>
            <div class="fecha-item">
              <span class="fecha-label">Término</span>
              <span class="fecha-value" :class="{ 'fecha-vence': isProximoVencer(c) }">
                {{ c.fecha_termino ? formatDate(c.fecha_termino) : 'Indefinido' }}
              </span>
            </div>
          </div>

          <div v-if="c.nombre_proyecto" class="proyecto-info">
            <i class="u u-ventas"></i> {{ c.nombre_proyecto }}
          </div>

          <div class="contrato-sueldo">
            <span>Sueldo</span>
            <span v-if="c.tipo_contrato === 'honorarios'" class="sueldo-var">Variable</span>
            <span v-else-if="c.tipo_contrato === 'proyecto'" class="sueldo-var">Por contrato</span>
            <span v-else-if="c.sueldo_base" class="teal">{{ formatCLP(c.sueldo_base) }}</span>
            <span v-else-if="getSueldoTrabajador(c.trabajador_id)" class="teal">{{ formatCLP(getSueldoTrabajador(c.trabajador_id)) }}</span>
            <span v-else class="sueldo-nd">No definido</span>
          </div>
          <!-- Pills de estado doble -->
          <div class="contrato-status-pills">
            <span :class="['pill-contrato-v', estadoContratoInfo(c).cls]">{{ estadoContratoInfo(c).label }}</span>
          </div>
        </div>

        <div class="contrato-card-footer" @click.stop>
          <button class="btn-icon" title="Ver trabajador" @click="irFicha(c.trabajador_id)"><i class="u u-eye"></i></button>
          <button class="btn-icon" :class="{ loading: pdfLoading === c._id }" title="Descargar Contrato PDF" @click="descargarContratoPDF(c)">
            <i :class="pdfLoading === c._id ? 'u u-loading' : 'u u-descargar'"></i>
          </button>
          <button class="btn-icon" title="Editar"><i class="u u-editar"></i></button>
          <div class="spacer"></div>
          <span v-if="getDiasVence(c)" class="dias-vence" :class="{ urgent: getDiasVence(c) < 15 }">
            Vence en {{ getDiasVence(c) }} días
          </span>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div class="empty-state" v-else-if="!globalStore.loading">
      <i class="u u-folder-open empty-icon"></i>
      <p>No hay contratos que coincidan con los filtros</p>
      <button class="btn btn-primary" @click="openNewContrato">Crear primer contrato</button>
    </div>

    <!-- Loading -->
    <div class="loading-state" v-if="globalStore.loading">
      <div class="spinner"></div>
      <p>Cargando contratos...</p>
    </div>

    <!-- Modal Seleccionar Trabajador -->
    <div v-if="showPickTrabajador" class="modal-overlay" @click.self="showPickTrabajador = false">
      <div class="modal-box" style="max-width:460px">
        <div class="modal-header">
          <h2 class="modal-title">¿Para qué trabajador?</h2>
          <button class="modal-close" @click="showPickTrabajador = false">×</button>
        </div>
        <div class="modal-body" style="padding:16px 24px">
          <p style="font-size:13px;color:var(--text-secondary,#94a3b8);margin-bottom:12px">
            Selecciona el trabajador para crear el contrato en su ficha:
          </p>
          <div style="display:flex;flex-direction:column;gap:6px;max-height:320px;overflow-y:auto">
            <button
              v-for="t in rrhhStore.trabajadoresActivos"
              :key="t._id"
              class="pick-trab-btn"
              @click="irNuevoContratoTrabajador(t._id)"
            >
              <div class="pick-avatar">{{ (t.nombre||'')[0] }}{{ (t.apellido||'')[0] }}</div>
              <div>
                <div style="font-weight:600;font-size:13px">{{ t.nombre }} {{ t.apellido }}</div>
                <div style="font-size:11px;color:var(--text-secondary,#94a3b8)">{{ t.cargo }}</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Nuevo Contrato -->
    <div v-if="showNewModal" class="modal-overlay" @click.self="showNewModal = false">
      <div class="modal-box modal-lg">
        <div class="modal-header">
          <h2>{{ modalEditMode ? 'Editar Contrato' : 'Nuevo Contrato' }}</h2>
          <button class="modal-close" @click="showNewModal = false">×</button>
        </div>
        <div class="modal-body">
          <!-- Trabajador -->
          <div class="form-section">
            <h4 class="section-title">Trabajador</h4>
            <div class="form-group">
              <label>Trabajador *</label>
              <select v-model="form.trabajador_id" class="form-input">
                <option value="">Seleccionar trabajador...</option>
                <option v-for="t in rrhhStore.trabajadoresActivos" :key="t._id" :value="t._id">
                  {{ t.nombre }} {{ t.apellido }} — {{ t.cargo }}
                </option>
              </select>
            </div>
          </div>

          <!-- Tipo contrato -->
          <div class="form-section">
            <h4 class="section-title">Tipo de Contrato</h4>
            <div class="tipo-selector">
              <button
                v-for="tipo in tiposContrato"
                :key="tipo.v"
                class="tipo-btn"
                :class="{ active: form.tipo_contrato === tipo.v }"
                @click="form.tipo_contrato = tipo.v"
              >
                <i :class="tipo.icon"></i>
                <span>{{ tipo.l }}</span>
              </button>
            </div>

            <!-- Alerta Ley 19.981 para proyectos -->
            <div class="ley-alert" v-if="form.tipo_contrato === 'proyecto'">
              <i class="u u-alerta"></i>
              <div>
                <strong>Contrato por Proyecto — Ley N° 19.981</strong>
                <p>Este tipo de contrato aplica para obras audiovisuales. El contrato debe especificar la obra, el servicio a prestar y la duración estimada del proyecto.</p>
              </div>
            </div>
          </div>

          <!-- Fechas -->
          <div class="form-section">
            <h4 class="section-title">Vigencia</h4>
            <div class="form-grid-2">
              <div class="form-group">
                <label>Fecha de Inicio *</label>
                <input v-model="form.fecha_inicio" type="date" class="form-input" />
              </div>
              <div class="form-group" v-if="form.tipo_contrato !== 'indefinido'">
                <label>Fecha de Término</label>
                <input v-model="form.fecha_termino" type="date" class="form-input" />
              </div>
            </div>
            <div class="form-group" v-if="form.tipo_contrato === 'proyecto'">
              <label>Nombre del Proyecto / Obra</label>
              <input v-model="form.nombre_proyecto" type="text" class="form-input" placeholder="Ej: Serie Documental Patagonia 2026" />
            </div>
            <div class="form-group" v-if="form.tipo_contrato === 'proyecto'">
              <label>Descripción del Rol en el Proyecto</label>
              <textarea v-model="form.descripcion_rol" class="form-input form-textarea" placeholder="Describir el servicio o función a prestar en la obra audiovisual..."></textarea>
            </div>
          </div>

          <!-- Condiciones laborales -->
          <div class="form-section">
            <h4 class="section-title">Condiciones Laborales</h4>
            <div class="form-grid-3">
              <div class="form-group">
                <label>Cargo / Función *</label>
                <input v-model="form.cargo" type="text" class="form-input" placeholder="Ej: Camarógrafo" />
              </div>
              <div class="form-group">
                <label>Jornada Semanal (hrs)</label>
                <select v-model.number="form.jornada_horas" class="form-input">
                  <option :value="45">45 horas (completa)</option>
                  <option :value="30">30 horas (part time)</option>
                  <option :value="20">20 horas (part time)</option>
                  <option :value="0">Jornada variable</option>
                </select>
              </div>
              <div class="form-group">
                <label>Lugar de Trabajo</label>
                <input v-model="form.lugar_trabajo" type="text" class="form-input" placeholder="Ciudad o dirección" />
              </div>
              <div class="form-group">
                <label>Sueldo Base *</label>
                <input v-model.number="form.sueldo_base" type="number" class="form-input" min="0" />
              </div>
              <div class="form-group">
                <label>Gratificación</label>
                <select v-model="form.gratificacion" class="form-input">
                  <option value="mensual">Mensual (1/12 anual)</option>
                  <option value="anual">Anual (25% utilidades)</option>
                </select>
              </div>
              <div class="form-group">
                <label>Modalidad</label>
                <select v-model="form.modalidad" class="form-input">
                  <option value="presencial">Presencial</option>
                  <option value="hibrido">Híbrido</option>
                  <option value="remoto">Remoto / Teletrabajo</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Cláusulas adicionales -->
          <div class="form-section">
            <h4 class="section-title">Cláusulas Adicionales</h4>
            <div class="clausulas-check">
              <label class="check-item" v-for="c in clausulasOpcionales" :key="c.id">
                <input type="checkbox" v-model="form.clausulas" :value="c.id" class="checkbox-input" />
                <div>
                  <div class="check-label">{{ c.label }}</div>
                  <div class="check-desc">{{ c.desc }}</div>
                </div>
              </label>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="showNewModal = false">Cancelar</button>
          <button class="btn btn-outline" @click="saveContrato('borrador')">Guardar Borrador</button>
          <button class="btn btn-primary" @click="saveContrato('vigente')">
            <i class="u u-folder-open"></i> Generar Contrato
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Detalle Contrato -->
    <div v-if="showDetailModal && selectedContrato" class="modal-overlay" @click.self="showDetailModal = false">
      <div class="modal-box">
        <div class="modal-header">
          <div>
            <h2>Contrato — {{ getNombreTrabajador(selectedContrato.trabajador_id) }}</h2>
            <p class="modal-subtitle">{{ labelContrato(selectedContrato.tipo_contrato) }}</p>
          </div>
          <button class="modal-close" @click="showDetailModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="detail-grid">
            <div class="detail-row">
              <span class="detail-label">Estado</span>
              <span class="badge" :class="`badge-estado-${selectedContrato.estado}`">{{ labelEstado(selectedContrato.estado) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Tipo</span>
              <span>{{ labelContrato(selectedContrato.tipo_contrato) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Inicio</span>
              <span>{{ formatDate(selectedContrato.fecha_inicio) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Término</span>
              <span>{{ selectedContrato.fecha_termino ? formatDate(selectedContrato.fecha_termino) : 'Indefinido' }}</span>
            </div>
            <div class="detail-row" v-if="selectedContrato.nombre_proyecto">
              <span class="detail-label">Proyecto</span>
              <span>{{ selectedContrato.nombre_proyecto }}</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="showDetailModal = false">Cerrar</button>
          <button class="btn btn-outline" @click="editContrato(selectedContrato)">
            <i class="u u-editar"></i> Editar
          </button>
          <button class="btn btn-primary" @click="descargarContrato(selectedContrato)">
            <i class="u u-descargar"></i> Descargar PDF
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import useRrhhStore from '@/stores/rrhh'
import useGlobalStore from '@/stores/global'

definePageMeta({ name: 'rrhh-contratos', layout: 'rrhh', middleware: ['auth'] })

// ── Tabs de sección: Contratos + Liquidaciones unificados ────────────────────
const sectionTabs = computed(() => {
  const porVencer = (rrhhStore.contratos || []).filter(c => {
    if (!['vigente','activo','borrador'].includes(c.estado)) return false
    if (!c.fecha_termino) return false
    const fin = new Date(c.fecha_termino + 'T12:00:00')
    const lim = new Date(); lim.setDate(lim.getDate() + 30)
    return fin >= new Date() && fin <= lim
  }).length

  return [
    { key: 'contratos',    label: 'Contratos',     path: '/rrhh/contratos',    icon: 'u u-ventas' },
    { key: 'liquidaciones',label: 'Liquidaciones',  path: '/rrhh/liquidaciones', icon: 'u u-cobros-y-pagos' },
    { key: 'vencimientos', label: 'Vencimientos',   path: '/rrhh/contratos?tab=vencimientos', icon: 'u u-alerta',
      badge: porVencer > 0 ? `${porVencer}` : null, badgeColor: 'orange' },
  ]
})

const { t } = useI18n()
const rrhhStore   = useRrhhStore()
const globalStore = useGlobalStore()
const router = useRouter()
const route  = useRoute()

const pdfLoading = ref(null)

const searchQ = ref('')
const filtroEstado = ref('vigente')

// ── Tab "Vencimientos" via query param ?tab=vencimientos ─────────────────────
watch(() => route.query.tab, (tab) => {
  if (tab === 'vencimientos') filtroEstado.value = 'por_vencer'
  // no resetear a 'todos' cuando no hay tab — dejar el default vigente
}, { immediate: true })

// Current tab para el SectionTabs (qué pestaña está activa visualmente)
const sectionTabActual = computed(() =>
  route.query.tab === 'vencimientos' ? 'vencimientos' : 'contratos'
)

// Helpers de estado para pills
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
const filtroTipo = ref('todos')
const showNewModal = ref(false)
const showDetailModal = ref(false)
const selectedContrato = ref(null)
const modalEditMode = ref(false)

const estadoFiltros = [
  { v: 'todos', l: 'Todos' },
  { v: 'vigente', l: 'Vigentes' },
  { v: 'vencido', l: 'Vencidos' },
  { v: 'por_vencer', l: 'Por vencer' },
  { v: 'borrador', l: 'Borradores' },
]

const tipoFiltros = [
  { v: 'todos', l: 'Todos' },
  { v: 'indefinido', l: 'Indefinido' },
  { v: 'plazo_fijo', l: 'Plazo Fijo' },
  { v: 'proyecto', l: 'Proyecto' },
]

const tiposContrato = [
  { v: 'indefinido', l: 'Indefinido', icon: 'u u-usuarios' },
  { v: 'plazo_fijo', l: 'Plazo Fijo', icon: 'u u-calendario' },
  { v: 'proyecto', l: 'Por Proyecto', icon: 'u u-ventas' },
  { v: 'part_time', l: 'Part Time', icon: 'u u-settings' },
]

const clausulasOpcionales = [
  { id: 'confidencialidad', label: 'Cláusula de Confidencialidad', desc: 'El trabajador se compromete a no divulgar información reservada de la empresa.' },
  { id: 'no_competencia', label: 'No Competencia (post contrato)', desc: 'Restricción de trabajar en empresas competidoras por 6 meses tras el término.' },
  { id: 'propiedad_intelectual', label: 'Propiedad Intelectual', desc: 'Las obras creadas durante el contrato pertenecen a la empresa (Art. 74 Ley 17.336).' },
  { id: 'teletrabajo', label: 'Teletrabajo (Ley 21.220)', desc: 'Regula el trabajo a distancia según normativa vigente.' },
]

const defaultForm = () => ({
  trabajador_id: '',
  tipo_contrato: 'indefinido',
  fecha_inicio: new Date().toISOString().split('T')[0],
  fecha_termino: '',
  nombre_proyecto: '',
  descripcion_rol: '',
  cargo: '',
  jornada_horas: 45,
  lugar_trabajo: '',
  sueldo_base: 0,
  gratificacion: 'mensual',
  modalidad: 'presencial',
  clausulas: [],
  estado: 'vigente',
})

const form = ref(defaultForm())

const today = new Date()

const proximosVencer = computed(() => {
  return rrhhStore.contratos.filter(c => {
    if (!c.fecha_termino || c.estado === 'vencido') return false
    const dias = getDiasVence(c)
    return dias !== null && dias <= 30 && dias > 0
  })
})

const contratosFiltrados = computed(() => {
  let list = rrhhStore.contratos || []

  if (filtroEstado.value !== 'todos') {
    if (filtroEstado.value === 'por_vencer') {
      // vence en los próximos 30 días (y no está ya vencido)
      list = list.filter(c => {
        const dias = getDiasVence(c)
        return dias !== null && dias <= 30 && dias > 0
      })
    } else if (filtroEstado.value === 'vigente') {
      // Vigente = cualquier contrato activo (incluye los "por vencer", siguen siendo válidos)
      list = list.filter(c => {
        if (c.estado === 'borrador') return false
        if (!c.fecha_termino) return true                // sin término → indefinido, siempre vigente
        const dias = getDiasVence(c)
        return dias !== null && dias > 0                 // fecha_termino en el futuro
      })
    } else if (filtroEstado.value === 'vencido') {
      // vencido real = fecha_termino pasada O estado guardado como vencido
      list = list.filter(c => {
        if (c.estado === 'vencido') return true
        if (!c.fecha_termino) return false
        const dias = getDiasVence(c)
        return dias === null                             // getDiasVence devuelve null si ya venció
      })
    } else {
      // borrador: filtrar por campo estado directamente
      list = list.filter(c => c.estado === filtroEstado.value)
    }
  }

  if (filtroTipo.value !== 'todos') {
    list = list.filter(c => c.tipo_contrato === filtroTipo.value)
  }

  if (searchQ.value) {
    const q = searchQ.value.toLowerCase()
    list = list.filter(c => {
      const nombre = getNombreTrabajador(c.trabajador_id).toLowerCase()
      return nombre.includes(q) || (c.nombre_proyecto || '').toLowerCase().includes(q)
    })
  }

  return list
})

function getNombreTrabajador(id) {
  const t = rrhhStore.trabajadores.find(t => t._id === id)
  return t ? `${t.nombre} ${t.apellido}` : id || '—'
}

function getCargo(id) {
  return rrhhStore.trabajadores.find(t => t._id === id)?.cargo || ''
}

function getSueldoTrabajador(id) {
  return rrhhStore.trabajadores.find(t => t._id === id)?.sueldo_base || 0
}

function getInitials(c) {
  const nombre = getNombreTrabajador(c.trabajador_id)
  const parts = nombre.trim().split(' ')
  return `${parts[0]?.[0] || ''}${parts[1]?.[0] || ''}`.toUpperCase()
}

function labelContrato(tipo) {
  return { indefinido: 'Indefinido', plazo_fijo: 'Plazo Fijo', proyecto: 'Por Proyecto', honorarios: 'Honorarios', part_time: 'Part Time' }[tipo] || tipo
}

function labelEstado(e) {
  return { vigente: 'Vigente', vencido: 'Vencido', borrador: 'Borrador', firmado: 'Firmado' }[e] || e
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatCLP(v) {
  if (!v && v !== 0) return '—'
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v)
}

function getDiasVence(c) {
  if (!c.fecha_termino) return null
  // Usar T12:00:00 (noon local) igual que estadoContratoInfo → sin discrepancias de timezone
  const fin  = new Date(c.fecha_termino + 'T12:00:00')
  const diff = fin - new Date()
  const dias = Math.ceil(diff / 86400000)
  return dias > 0 ? dias : null
}

function isProximoVencer(c) {
  const dias = getDiasVence(c)
  return dias !== null && dias <= 30
}

// Trabajador seleccionado para nuevo contrato (selector rápido)
const trabajadorSeleccionadoId = ref('')
const showPickTrabajador = ref(false)

function openNewContrato() {
  // Si ya hay un trabajador en el filtro de búsqueda, usar ese
  if (trabajadorSeleccionadoId.value) {
    router.push(`/rrhh/trabajadores/${trabajadorSeleccionadoId.value}?nuevoContrato=1`)
  } else {
    showPickTrabajador.value = true
  }
}

function irNuevoContratoTrabajador(id) {
  showPickTrabajador.value = false
  router.push(`/rrhh/trabajadores/${id}?nuevoContrato=1`)
}

function openDetail(c) {
  selectedContrato.value = c
  showDetailModal.value = true
}

function editContrato(c) {
  // Navegar a ficha del trabajador con el contrato a editar
  router.push(`/rrhh/trabajadores/${c.trabajador_id}?editContrato=${c._id}`)
}

async function saveContrato(estado) {
  await rrhhStore.createContrato({ ...form.value, estado })
  showNewModal.value = false
  await rrhhStore.getContratos()
}

function irFicha(trabajador_id) {
  router.push(`/rrhh/trabajadores/${trabajador_id}`)
}

async function descargarContratoPDF(c) {
  if (pdfLoading.value) return
  pdfLoading.value = c._id
  try {
    const orgInfo = globalStore.organization || {}
    const trab = rrhhStore.trabajadores.find(t => t._id === c.trabajador_id) || {}

    const payload = {
      tipo_contrato: c.tipo_contrato,
      organizacion: {
        nombre:        orgInfo.name || orgInfo.razon_social || 'Empresa',
        rut:           orgInfo.rut  || '',
        representante: orgInfo.representative || orgInfo.representante || '',
        giro:          orgInfo.businessType || orgInfo.giro || '',
        domicilio:     orgInfo.address || orgInfo.domicilio || '',
      },
      trabajador: {
        nombre_completo: `${trab.nombre || ''} ${trab.apellido || ''}`.trim(),
        rut:             trab.rut || '',
        cargo:           c.cargo || trab.cargo || '',
        domicilio:       trab.direccion || '',
        fecha_ingreso:   c.fecha_inicio || trab.fecha_ingreso,
        fecha_termino:   c.fecha_termino || null,
        nombre_proyecto: c.nombre_proyecto || '',
        horas_semana:    c.jornada_horas || 45,
        lugar_prestacion: c.lugar_trabajo || 'Santiago',
        afp:             trab.afp || '',
        sistema_salud:   trab.sistema_salud || 'FONASA',
        tipo_contrato:   c.tipo_contrato,
      },
      remuneracion: {
        sueldo_base:  c.sueldo_base || trab.sueldo_base || 0,
        gratificacion: c.gratificacion || trab.gratificacion || 'mensual',
        colacion:     trab.colacion || 0,
        movilizacion: trab.movilizacion || 0,
      },
      logo_base64: orgInfo.logoBase64 || null,
    }

    const res = await $fetch('/api/rrhh/contrato-pdf', {
      method: 'POST',
      body: payload,
      responseType: 'blob',
    })
    const url = URL.createObjectURL(new Blob([res], { type: 'application/pdf' }))
    const a = document.createElement('a')
    a.href = url
    const rutTrab = (trab.rut || 'doc').replace(/\./g, '').replace(/-/g, '')
    a.download = `contrato-${c.tipo_contrato}-${rutTrab}.pdf`
    a.click()
    URL.revokeObjectURL(url)
    showDetailModal.value = false
  } catch (e) {
    console.error('Error generando contrato PDF:', e)
    alert('Error al generar el contrato PDF. Verifica que el servidor esté activo.')
  } finally {
    pdfLoading.value = null
  }
}

function descargarContrato(c) {
  descargarContratoPDF(c)
}

function exportarContratos() {
  console.log('Exportar contratos')
}

onMounted(async () => {
  globalStore.updatedTitle('Contratos y Liquidaciones')
  globalStore.updatedBreadcrumb([
    { label: 'RRHH', path: '/rrhh/trabajadores' },
    { label: 'Contratos y Liquidaciones', path: '' },
  ])
  globalStore.loading = true
  await Promise.all([
    rrhhStore.getContratos(),
    rrhhStore.getTrabajadores(),
  ])
  globalStore.loading = false
})

onUnmounted(() => {
  globalStore.updatedTitle('')
  globalStore.loading = false
})
</script>

<style scoped>
.contratos-page { padding: 24px; }

/* ── Page header (título + botones de acción) ────────────────────────────── */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.page-header__left { display: flex; flex-direction: column; gap: 2px; }
.page-header__title {
  font-size: 20px; font-weight: 800; color: #f3f4f6; margin: 0;
}
.page-header__sub { font-size: 12px; color: #6b7280; }
.page-header__right { display: flex; gap: 10px; align-items: center; }

/* ── Filter bar (buscador + chips) ──────────────────────────────────────── */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

/* ── Search input — idéntico a Personas ────────────────────────────────── */
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
  font-family: Nunito, sans-serif; font-size: 13px;
  color: #f3f4f6; width: 210px;
}
.filterInput span { color: #9ca3af; font-size: 14px; }


/* Separador entre grupos */
.filter-sep { width: 1px; height: 24px; background: rgba(255,255,255,0.12); margin: 0 4px; align-self: center; }

/* ── Chips (idéntico a Personas) ───────────────────────────────────────── */
.chip {
  height: 32px; padding: 0 14px; border-radius: 20px;
  font-family: Nunito, sans-serif; font-size: 12px; font-weight: 600;
  color: #9ca3af;
  background: transparent;
  border: 1.5px solid rgba(255,255,255,0.1);
  cursor: pointer; transition: all .15s;
}
.chip.active { background: rgba(58,199,165,0.15); color: #3ac7a5; border-color: rgba(58,199,165,0.5); }
.chip:not(.active):hover { background: rgba(255,255,255,0.05); color: #f3f4f6; border-color: rgba(255,255,255,0.18); }

/* ── Toggle groups (idéntico a Personas) ───────────────────────────────── */
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
  padding: 0 13px; height: 32px;
  font-family: Nunito, sans-serif; font-size: 12px; font-weight: 600;
  color: #6b7280;
  background: transparent;
  border: none; cursor: pointer;
  white-space: nowrap;
  transition: all .15s;
}
.view-btn + .view-btn { border-left: 1px solid rgba(255,255,255,0.08); }
.view-btn:hover { color: #f3f4f6; background: rgba(255,255,255,0.05); }
.view-btn.active { color: #3ac7a5; background: rgba(58,199,165,0.1); }

/* Alert banner */
.alerts-row { margin-bottom: 20px; }
.alert-banner { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.3); border-radius: 10px; color: #fbbf24; font-size: 13px; }
.alert-icon { font-size: 18px; flex-shrink: 0; }

/* Contratos grid */
.contratos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
}

.contrato-card {
  background: var(--neutral-background-strong, #2a3a4a);
  border: 1px solid var(--neutral-border-light, rgba(255,255,255,0.07));
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
}
.contrato-card:hover {
  border-color: rgba(58,199,165,0.3);
  box-shadow: 0 4px 20px rgba(0,0,0,0.2);
}

.contrato-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 18px;
  border-bottom: 1px solid var(--neutral-border-light, rgba(255,255,255,0.05));
}

.worker-info { display: flex; align-items: center; gap: 12px; }
.mini-avatar { width: 36px; height: 36px; border-radius: 50%; background: var(--primary-surface-default, #2a9d8f); color: #fff; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.worker-name { font-size: 14px; font-weight: 600; color: var(--neutral-text-title, #f3f4f6); }
.worker-cargo { font-size: 12px; color: var(--neutral-text-body, #9ca3af); }

.contrato-card-body { padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; }

.tipo-badge { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
.tipo-indefinido { background: rgba(58,199,165,0.12); color: #3ac7a5; }
.tipo-plazo_fijo { background: rgba(251,191,36,0.12); color: #fbbf24; }
.tipo-proyecto { background: rgba(139,92,246,0.12); color: #a78bfa; }
.tipo-part_time { background: rgba(96,165,250,0.12); color: #60a5fa; }
.tipo-honorarios { background: rgba(249,115,22,0.12); color: #fb923c; }

.contrato-fechas { display: flex; align-items: center; gap: 12px; }
.fecha-item { display: flex; flex-direction: column; gap: 2px; }
.fecha-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--neutral-text-body, #9ca3af); font-weight: 600; }
.fecha-value { font-size: 13px; font-weight: 500; color: var(--neutral-text-title, #f3f4f6); }
.fecha-value.fecha-vence { color: #fbbf24; }
.fecha-sep { color: var(--neutral-text-body, #9ca3af); font-size: 16px; }

.proyecto-info { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--neutral-text-body, #9ca3af); }
.contrato-sueldo { display: flex; justify-content: space-between; font-size: 13px; color: var(--neutral-text-body, #9ca3af); padding-top: 8px; border-top: 1px solid var(--neutral-border-light, rgba(255,255,255,0.05)); }

.contrato-card-footer {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 10px 14px;
  background: rgba(0,0,0,0.1);
  border-top: 1px solid var(--neutral-border-light, rgba(255,255,255,0.04));
}
.spacer { flex: 1; }
.dias-vence { font-size: 11px; color: var(--neutral-text-body, #9ca3af); }
.dias-vence.urgent { color: #f87171; font-weight: 600; }

/* Sprint 2: sueldo contextual + pills estado contrato */
.sueldo-var { font-size: 12px; color: #9ca3af; font-style: italic; }
.sueldo-nd  { font-size: 12px; color: #6b7280; font-style: italic; }

.contrato-status-pills {
  display: flex; gap: 5px; flex-wrap: wrap;
  padding-top: 6px;
}
.pill-contrato-v {
  display: inline-flex; align-items: center;
  padding: 2px 9px; border-radius: 20px;
  font-size: 10.5px; font-weight: 700;
  border: 1px solid transparent;
}
.pill-contrato-v.vigente-c    { background: rgba(58,199,165,0.1);  color: #3ac7a5; border-color: rgba(58,199,165,0.25); }
.pill-contrato-v.indefinido-c { background: rgba(58,199,165,0.1);  color: #3ac7a5; border-color: rgba(58,199,165,0.25); }
.pill-contrato-v.por-vencer-c { background: rgba(244,162,97,0.12); color: #f4a261; border-color: rgba(244,162,97,0.3); }
.pill-contrato-v.vencido-c    { background: rgba(239,68,68,0.1);   color: #f87171; border-color: rgba(239,68,68,0.25); }
.pill-contrato-v.sin-contrato { background: rgba(107,114,128,0.1); color: #6b7280; border-color: rgba(107,114,128,0.2); }

/* Highlight de fila cuando está "por vencer" */
.contrato-card:has(.por-vencer-c) {
  border-color: rgba(244,162,97,0.35);
  background: linear-gradient(135deg, rgba(244,162,97,0.04) 0%, transparent 60%);
}

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(4px); }
.modal-box { background: var(--neutral-background-strong, #2a3a4a); border-radius: 16px; border: 1px solid var(--neutral-border-light, rgba(255,255,255,0.1)); box-shadow: 0 20px 60px rgba(0,0,0,0.5); width: 90%; max-width: 580px; max-height: 90vh; overflow-y: auto; }
.modal-lg { max-width: 700px; }
.modal-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 20px 24px; border-bottom: 1px solid var(--neutral-border-light, rgba(255,255,255,0.08)); }
.modal-header h2 { font-size: 17px; font-weight: 700; color: var(--neutral-text-title, #f3f4f6); margin: 0 0 2px; }
.modal-subtitle { font-size: 13px; color: var(--neutral-text-body, #9ca3af); margin: 0; }
.modal-close { background: none; border: none; font-size: 22px; color: var(--neutral-text-body, #9ca3af); cursor: pointer; padding: 2px 6px; }
.modal-close:hover { color: var(--neutral-text-title, #f3f4f6); }
.modal-body { padding: 24px; }
.modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 16px 24px; border-top: 1px solid var(--neutral-border-light, rgba(255,255,255,0.08)); }

/* Form */
.form-section { margin-bottom: 20px; }
.section-title { font-size: 12px; font-weight: 700; color: var(--primary-text-default, #3ac7a5); text-transform: uppercase; letter-spacing: 0.06em; margin: 0 0 12px; }
.form-group { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }
.form-group label { font-size: 11px; font-weight: 600; color: var(--neutral-text-body, #9ca3af); text-transform: uppercase; letter-spacing: 0.04em; }
.form-input { background: var(--neutral-background-default, #1e272e); border: 1.5px solid var(--neutral-border-light, rgba(255,255,255,0.1)); border-radius: 8px; padding: 8px 12px; color: var(--neutral-text-title, #f3f4f6); font-size: 13px; font-family: inherit; width: 100%; box-sizing: border-box; transition: border-color 0.2s; }
.form-input:focus { outline: none; border-color: var(--primary-text-default, #3ac7a5); }
.form-textarea { resize: vertical; min-height: 80px; }
.form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.form-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }

/* Tipo selector */
.tipo-selector { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
.tipo-btn { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 16px; background: var(--neutral-background-default, #1e272e); border: 1.5px solid var(--neutral-border-light, rgba(255,255,255,0.1)); border-radius: 10px; cursor: pointer; color: var(--neutral-text-body, #9ca3af); font-family: inherit; font-size: 12px; font-weight: 500; transition: all 0.2s; min-width: 90px; }
.tipo-btn i { font-size: 20px; }
.tipo-btn.active { border-color: var(--primary-text-default, #3ac7a5); color: var(--primary-text-default, #3ac7a5); background: var(--primary-surface-shadow-8a, rgba(58,199,165,0.08)); }
.tipo-btn:hover:not(.active) { border-color: rgba(255,255,255,0.2); color: var(--neutral-text-title, #f3f4f6); }

/* Ley alert */
.ley-alert { display: flex; gap: 12px; padding: 14px; background: rgba(139,92,246,0.1); border: 1px solid rgba(139,92,246,0.3); border-radius: 8px; font-size: 13px; color: var(--neutral-text-title, #f3f4f6); margin-top: 10px; }
.ley-alert i { font-size: 20px; color: #a78bfa; flex-shrink: 0; margin-top: 2px; }
.ley-alert strong { display: block; margin-bottom: 4px; color: #a78bfa; }
.ley-alert p { margin: 0; color: var(--neutral-text-body, #9ca3af); font-size: 12px; }

/* Cláusulas */
.clausulas-check { display: flex; flex-direction: column; gap: 10px; }
.check-item { display: flex; align-items: flex-start; gap: 10px; cursor: pointer; }
.checkbox-input { accent-color: var(--primary-text-default, #3ac7a5); margin-top: 3px; flex-shrink: 0; }
.check-label { font-size: 13px; font-weight: 500; color: var(--neutral-text-title, #f3f4f6); }
.check-desc { font-size: 11px; color: var(--neutral-text-body, #9ca3af); margin-top: 2px; }

/* Detail modal */
.detail-grid { display: flex; flex-direction: column; gap: 12px; }
.detail-row { display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; border-bottom: 1px solid var(--neutral-border-light, rgba(255,255,255,0.05)); font-size: 14px; color: var(--neutral-text-title, #f3f4f6); }
.detail-row:last-child { border-bottom: none; }
.detail-label { color: var(--neutral-text-body, #9ca3af); }

/* Badges */
.badge { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
.badge-estado-vigente { background: rgba(34,197,94,0.15); color: #4ade80; }
.badge-estado-vencido { background: rgba(239,68,68,0.15); color: #f87171; }
.badge-estado-borrador { background: rgba(156,163,175,0.15); color: #9ca3af; }
.badge-estado-firmado { background: rgba(58,199,165,0.15); color: #3ac7a5; }

/* Buttons */
.btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; font-family: inherit; transition: all 0.2s; white-space: nowrap; }
.btn-sm { padding: 6px 12px; font-size: 12px; }
.btn-primary { background: var(--primary-surface-default, #2a9d8f); color: #fff; }
.btn-primary:hover { opacity: 0.85; }
.btn-outline { background: transparent; border: 1.5px solid var(--primary-text-default, #3ac7a5); color: var(--primary-text-default, #3ac7a5); }
.btn-outline:hover { background: var(--primary-surface-shadow-8a, rgba(58,199,165,0.08)); }
.btn-ghost { background: transparent; color: var(--neutral-text-body, #9ca3af); }
.btn-ghost:hover { color: var(--neutral-text-title, #f3f4f6); }
.btn-icon { background: none; border: none; color: var(--neutral-text-body, #9ca3af); cursor: pointer; padding: 6px; border-radius: 6px; font-size: 14px; transition: all 0.15s; }
.btn-icon:hover { background: var(--neutral-background-default, #1e272e); color: var(--neutral-text-title, #f3f4f6); }

/* Colors */
.teal { color: #3ac7a5 !important; }
.red { color: #f87171 !important; }

/* Empty & loading */
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 64px; gap: 14px; color: var(--neutral-text-body, #9ca3af); }
.empty-icon { font-size: 52px; opacity: 0.25; }
.loading-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 64px; gap: 16px; color: var(--neutral-text-body, #9ca3af); }
.spinner { width: 36px; height: 36px; border: 3px solid rgba(58,199,165,0.2); border-top-color: #3ac7a5; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 768px) {
  .contratos-grid { grid-template-columns: 1fr; }
  .form-grid-2, .form-grid-3 { grid-template-columns: 1fr; }
}

.pick-trab-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 14px;
  background: var(--bg-secondary, #1e2d3a);
  border: 1.5px solid var(--border, rgba(255,255,255,0.08));
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  transition: border-color .15s, background .15s;
}
.pick-trab-btn:hover {
  border-color: var(--primary, #3ac7a5);
  background: rgba(58,199,165,0.06);
}
.pick-avatar {
  width: 34px; height: 34px;
  border-radius: 50%;
  background: var(--primary, #3ac7a5);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
</style>
