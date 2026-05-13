<script setup>
/**
 * pages/rrhh/asistencia/turnos.vue
 * Gestión de turnos y jornadas de trabajo.
 */
import { ref, computed, onMounted } from "vue"
import { useAsistenciaStore, DIAS_SEMANA, TIPOS_TURNO } from '@/stores/asistencia'

definePageMeta({ layout: 'rrhh' })

const asistencia = useAsistenciaStore()
const global     = {}

onMounted(() => {
  asistencia.init()
  global.title     = 'Asistencia'
  global.namePage  = 'RRHH'
  global.breadcrumb = [
    { name: 'RRHH',      path: '/rrhh/trabajadores' },
    { name: 'Asistencia', path: '/rrhh/asistencia/marcaciones' },
    { name: 'Turnos' },
  ]
})

// ── Tabs de sección compartidos ───────────────────────────────────────────────
const asistenciaTabs = [
  { key: 'marcaciones', label: 'Marcaciones', path: '/rrhh/asistencia/marcaciones', icon: 'u u-check' },
  { key: 'turnos',      label: 'Turnos',       path: '/rrhh/asistencia/turnos',      icon: 'u u-reloj' },
  { key: 'historial',   label: 'Historial',    path: '/rrhh/asistencia/marcaciones?tab=historial', icon: 'u u-calendar' },
  { key: 'incidencias', label: 'Incidencias',  path: '/rrhh/asistencia/marcaciones?tab=incidencias', icon: 'u u-alerta' },
]

// ─── Form ─────────────────────────────────────────────────────────────────
const showModal = ref(false)
const editando  = ref(false)

const emptyForm = () => ({
  id: null,
  nombre: '',
  descripcion: '',
  hora_entrada: '09:00',
  hora_salida:  '18:00',
  horas_diarias: 8,
  horas_semanales: 40,
  colacion_min: 60,
  dias_semana: [1,2,3,4,5],
  tipo: 'completa',
  tolerancia_atraso_min: 5,
  activo: true,
})

const form = ref(emptyForm())
const guardando = ref(false)
const confirmDelete = ref(null)

function abrirNuevo() {
  form.value  = emptyForm()
  editando.value = false
  showModal.value = true
}

function abrirEditar(turno) {
  form.value  = { ...turno, dias_semana: [...(turno.dias_semana || [])] }
  editando.value = true
  showModal.value = true
}

function toggleDia(d) {
  const idx = form.value.dias_semana.indexOf(d)
  if (idx === -1) form.value.dias_semana.push(d)
  else form.value.dias_semana.splice(idx, 1)
}

// Auto-calcular horas al cambiar entrada/salida
function recalcHoras() {
  const [hE, mE] = form.value.hora_entrada.split(':').map(Number)
  const [hS, mS] = form.value.hora_salida.split(':').map(Number)
  const totalMin = (hS * 60 + mS) - (hE * 60 + mE) - (form.value.colacion_min || 0)
  form.value.horas_diarias = Math.max(0, Math.round(totalMin / 60 * 10) / 10)
  form.value.horas_semanales = Math.round(form.value.horas_diarias * (form.value.dias_semana?.length || 5))
}

function guardar() {
  guardando.value = true
  const t = { ...form.value }
  if (!t.id) delete t.id
  asistencia.saveTurno(t)
  setTimeout(() => { guardando.value = false; showModal.value = false }, 300)
}

function eliminar(id) {
  asistencia.deleteTurno(id)
  confirmDelete.value = null
}

// ─── Display helpers ──────────────────────────────────────────────────────
function diasLabel(dias) {
  return (dias || []).map(d => DIAS_SEMANA.find(x => x.value === d)?.label || '').join(' · ')
}

function tipoLabel(t) {
  return TIPOS_TURNO.find(x => x.value === t)?.label || t
}

const TIPO_COLORS = {
  completa:  { bg: 'rgba(58,199,165,0.12)',  color: '#3ac7a5' },
  part_time: { bg: 'rgba(133,140,240,0.15)', color: '#a78bfa' },
  especial:  { bg: 'rgba(244,162,97,0.15)',  color: '#f4a261' },
  flexible:  { bg: 'rgba(74,222,128,0.1)',   color: '#4ade80' },
}
function tipoStyle(t) {
  return TIPO_COLORS[t] || TIPO_COLORS.completa
}
</script>

<template>
  <div class="turnos-page">
    <!-- Tabs de sección: Asistencia unificada -->
    <RrhhSectionTabs :tabs="asistenciaTabs" current="turnos" />
    <!-- Header -->
    <div class="page-header">
      <div>
        <h2 class="page-title">Turnos y Jornadas</h2>
        <p class="page-sub">Define los horarios de trabajo vinculados a los contratos</p>
      </div>
      <button class="btn-primary" @click="abrirNuevo">
        <i class="u u-mas"></i> Nuevo turno
      </button>
    </div>

    <!-- Lista de turnos -->
    <div class="turnos-grid">
      <div
        v-for="turno in asistencia.turnos"
        :key="turno.id"
        class="turno-card"
        :class="{ 'turno-inactivo': !turno.activo }"
      >
        <div class="turno-card-header">
          <div class="turno-tipo-tag" :style="tipoStyle(turno.tipo)">
            {{ tipoLabel(turno.tipo) }}
          </div>
          <div class="turno-actions">
            <button class="btn-icon-xs" @click="abrirEditar(turno)" title="Editar">
              <i class="u u-editar"></i>
            </button>
            <button class="btn-icon-xs btn-icon-red" @click="confirmDelete = turno.id" title="Eliminar">
              <i class="u u-basura"></i>
            </button>
          </div>
        </div>

        <h3 class="turno-nombre">{{ turno.nombre }}</h3>
        <p class="turno-desc">{{ turno.descripcion }}</p>

        <div class="turno-horario">
          <div class="horario-chip">
            <i class="u u-reloj"></i>
            {{ turno.hora_entrada }} — {{ turno.hora_salida }}
          </div>
          <div class="horario-chip">
            <i class="u u-cobros-y-pagos"></i>
            {{ turno.horas_diarias }}h / día
          </div>
          <div class="horario-chip">
            <i class="u u-check"></i>
            {{ turno.horas_semanales }}h semana
          </div>
        </div>

        <div class="turno-dias">
          <span
            v-for="d in DIAS_SEMANA"
            :key="d.value"
            class="dia-dot"
            :class="{ active: turno.dias_semana?.includes(d.value) }"
          >{{ d.label }}</span>
        </div>

        <div class="turno-footer">
          <span class="turno-meta">
            <i class="u u-reloj"></i> Colación {{ turno.colacion_min }} min
          </span>
          <span class="turno-meta">
            Tolerancia {{ turno.tolerancia_atraso_min }} min
          </span>
        </div>
      </div>

      <!-- Empty -->
      <div v-if="!asistencia.turnos.length" class="empty-state">
        <i class="u u-reloj"></i>
        <p>No hay turnos definidos aún</p>
        <button class="btn-primary" @click="abrirNuevo">Crear primer turno</button>
      </div>
    </div>
  </div>

  <!-- ── Modal Turno ─────────────────────────────────────────────────────── -->
  <teleport to="body">
    <div v-if="showModal" class="modal-backdrop" @click.self="showModal = false">
      <div class="modal-box">
        <div class="modal-header">
          <h3>{{ editando ? 'Editar turno' : 'Nuevo turno' }}</h3>
          <button @click="showModal = false"><i class="u u-cerrar"></i></button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <div class="field">
              <label>Nombre del turno</label>
              <input v-model="form.nombre" placeholder="Ej: Jornada Rodaje" />
            </div>
            <div class="field">
              <label>Tipo</label>
              <select v-model="form.tipo">
                <option v-for="t in TIPOS_TURNO" :key="t.value" :value="t.value">{{ t.label }}</option>
              </select>
            </div>
          </div>

          <div class="field">
            <label>Descripción (opcional)</label>
            <input v-model="form.descripcion" placeholder="Descripción breve del turno" />
          </div>

          <div class="form-row">
            <div class="field">
              <label>Hora entrada</label>
              <input type="time" v-model="form.hora_entrada" @change="recalcHoras" />
            </div>
            <div class="field">
              <label>Hora salida</label>
              <input type="time" v-model="form.hora_salida" @change="recalcHoras" />
            </div>
            <div class="field">
              <label>Colación (min)</label>
              <input type="number" v-model.number="form.colacion_min" min="0" max="120" @change="recalcHoras" />
            </div>
          </div>

          <div class="form-row">
            <div class="field">
              <label>Horas / día</label>
              <input type="number" v-model.number="form.horas_diarias" step="0.5" readonly />
            </div>
            <div class="field">
              <label>Horas / semana</label>
              <input type="number" v-model.number="form.horas_semanales" readonly />
            </div>
            <div class="field">
              <label>Tolerancia atraso (min)</label>
              <input type="number" v-model.number="form.tolerancia_atraso_min" min="0" max="60" />
            </div>
          </div>

          <div class="field">
            <label>Días de trabajo</label>
            <div class="dias-selector">
              <button
                v-for="d in DIAS_SEMANA"
                :key="d.value"
                class="dia-btn"
                :class="{ active: form.dias_semana.includes(d.value) }"
                type="button"
                @click="toggleDia(d.value)"
              >{{ d.label }}</button>
            </div>
          </div>

          <div class="field field-toggle">
            <label>Turno activo</label>
            <input type="checkbox" v-model="form.activo" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" @click="showModal = false">Cancelar</button>
          <button class="btn-primary" @click="guardar" :disabled="guardando || !form.nombre">
            <i class="u u-check"></i> {{ guardando ? 'Guardando…' : 'Guardar' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Confirm delete -->
    <div v-if="confirmDelete" class="modal-backdrop" @click.self="confirmDelete = null">
      <div class="modal-box modal-small">
        <div class="modal-body">
          <p style="color:#f3f4f6;font-size:14px">¿Eliminar este turno? Esta acción no se puede deshacer.</p>
          <div style="display:flex;gap:10px;margin-top:16px;justify-content:flex-end">
            <button class="btn-ghost" @click="confirmDelete = null">Cancelar</button>
            <button class="btn-danger" @click="eliminar(confirmDelete)">Eliminar</button>
          </div>
        </div>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.turnos-page { padding: 24px 28px; display: flex; flex-direction: column; gap: 20px; }

.page-header {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
}
.page-title { font-size: 20px; font-weight: 800; color: var(--neutral-text-title, #111827); margin: 0; }
.page-sub   { font-size: 13px; color: var(--neutral-text-subtitle, #6b7280); margin: 4px 0 0; }

/* Grid de tarjetas */
.turnos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.turno-card {
  background: var(--neutral-background-default, #ffffff);
  border: 1.5px solid rgba(255,255,255,0.07);
  border-radius: 14px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: border-color 0.2s;
}
.turno-card:hover { border-color: rgba(58,199,165,0.25); }
.turno-inactivo { opacity: 0.5; }

.turno-card-header { display: flex; align-items: center; justify-content: space-between; }
.turno-tipo-tag {
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
}

.turno-actions { display: flex; gap: 6px; }

.btn-icon-xs {
  background: none; border: 1px solid rgba(255,255,255,0.1);
  color: var(--neutral-text-subtitle, #6b7280); border-radius: 7px;
  width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; font-size: 13px; transition: all 0.15s;
}
.btn-icon-xs:hover { background: rgba(255,255,255,0.07); color: var(--neutral-text-title, #111827); }
.btn-icon-red:hover { background: rgba(239,68,68,0.1); color: #f87171; border-color: rgba(239,68,68,0.3); }

.turno-nombre { font-size: 16px; font-weight: 700; color: var(--neutral-text-title, #111827); margin: 0; }
.turno-desc   { font-size: 12px; color: var(--neutral-text-subtitle, #6b7280); margin: 0; }

.turno-horario { display: flex; flex-wrap: wrap; gap: 8px; }
.horario-chip {
  display: flex; align-items: center; gap: 5px;
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--neutral-border-light, #e2e8f0);
  border-radius: 20px;
  padding: 4px 10px;
  font-size: 12px;
  color: var(--neutral-text-body, #374151);
}
.horario-chip i { color: #3ac7a5; font-size: 11px; }

.turno-dias { display: flex; gap: 5px; }
.dia-dot {
  font-size: 10px;
  font-weight: 600;
  padding: 3px 7px;
  border-radius: 6px;
  background: rgba(255,255,255,0.05);
  color: #4b5563;
  transition: all 0.15s;
}
.dia-dot.active {
  background: rgba(58,199,165,0.15);
  color: #3ac7a5;
}

.turno-footer {
  display: flex;
  justify-content: space-between;
  border-top: 1px solid rgba(255,255,255,0.06);
  padding-top: 10px;
}
.turno-meta {
  display: flex; align-items: center; gap: 4px;
  font-size: 11px; color: var(--neutral-text-subtitle, #6b7280);
}
.turno-meta i { font-size: 10px; }

/* Empty */
.empty-state {
  grid-column: 1/-1;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 60px 20px; gap: 12px;
  color: var(--neutral-text-subtitle, #6b7280);
}
.empty-state i { font-size: 40px; color: #374151; }
.empty-state p { font-size: 14px; margin: 0; }

/* Modal */
.modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000; backdrop-filter: blur(3px);
}
.modal-box {
  background: var(--neutral-background-default, #ffffff);
  border: 1.5px solid rgba(255,255,255,0.1);
  border-radius: 16px;
  width: 580px; max-width: 96vw; max-height: 90vh;
  overflow-y: auto;
}
.modal-small { width: 400px; }
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
}
.modal-header h3 { font-size: 16px; font-weight: 700; color: var(--neutral-text-title, #111827); margin: 0; }
.modal-header button { background: none; border: none; color: var(--neutral-text-subtitle, #6b7280); cursor: pointer; font-size: 18px; }

.modal-body { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
.modal-footer {
  display: flex; justify-content: flex-end; gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid rgba(255,255,255,0.07);
}

.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-row .field:last-child:nth-child(3) { grid-column: auto; }

.field { display: flex; flex-direction: column; gap: 6px; }
.field-toggle { flex-direction: row; align-items: center; justify-content: space-between; }
.field label { font-size: 12px; font-weight: 600; color: var(--neutral-text-caption, #6b7280); }
.field input, .field select {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  padding: 8px 12px;
  color: var(--neutral-text-title, #111827);
  font-size: 13px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s;
}
.field input:focus, .field select:focus { border-color: rgba(58,199,165,0.5); }
.field input[readonly] { opacity: 0.6; cursor: default; }
.field select option { background: var(--neutral-background-default, #ffffff); }

.dias-selector { display: flex; gap: 8px; flex-wrap: wrap; }
.dia-btn {
  font-size: 12px; font-weight: 600;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1.5px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.04);
  color: var(--neutral-text-subtitle, #6b7280);
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}
.dia-btn.active {
  background: rgba(58,199,165,0.15);
  border-color: rgba(58,199,165,0.4);
  color: #3ac7a5;
}

.btn-primary {
  background: #2a9d8f; border: none;
  color: #fff; border-radius: 10px;
  padding: 9px 18px; font-size: 13px; font-weight: 700;
  cursor: pointer; display: flex; align-items: center; gap: 7px;
  font-family: inherit; transition: all 0.15s;
}
.btn-primary:hover:not(:disabled) { background: #3ac7a5; }
.btn-primary:disabled { opacity: 0.5; cursor: default; }

.btn-ghost {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.12);
  color: var(--neutral-text-caption, #6b7280); border-radius: 10px;
  padding: 9px 18px; font-size: 13px; font-weight: 600;
  cursor: pointer; font-family: inherit; transition: all 0.15s;
}
.btn-ghost:hover { background: rgba(255,255,255,0.1); color: var(--neutral-text-title, #111827); }

.btn-danger {
  background: rgba(239,68,68,0.15);
  border: 1px solid rgba(239,68,68,0.3);
  color: #f87171; border-radius: 10px;
  padding: 9px 18px; font-size: 13px; font-weight: 700;
  cursor: pointer; font-family: inherit; transition: all 0.15s;
}
.btn-danger:hover { background: rgba(239,68,68,0.25); }
</style>
