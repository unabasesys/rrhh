<script setup>
/**
 * pages/portal/trabajador/[token].vue
 * Portal móvil para trabajadores — marcar entrada y salida.
 * No requiere login. URL única por trabajador.
 * Diseño mobile-first, funciona en cualquier dispositivo.
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute }   from 'vue-router'

// Sin layout RRHH — página standalone
definePageMeta({ layout: false })

const route = useRoute()

// ─── Estado ──────────────────────────────────────────────────────────────
const cargando     = ref(true)
const error        = ref('')
const tokenStr     = ref('')
const trabajador   = ref(null)
const marcacionHoy = ref(null)
const turnos       = ref([])
const proyectos    = ref([])

// Proyecto y turno seleccionados (al marcar entrada)
const proyectoSel  = ref('')
const lineaSel     = ref('')
const turnoSel     = ref('')
const ubicacion    = ref(null)

// ── Vacaciones ──────────────────────────────────────────────────────
const vacBalance     = ref({})
const vacSolicitudes = ref([])
const vacFormOpen    = ref(false)
const vacReq         = ref({ fecha_inicio: '', fecha_fin: '', motivo: '' })
const vacSubmitting  = ref(false)
const vacMsg         = ref('')
const vacMsgOk       = ref(false)

async function cargarVacaciones() {
  try {
    const data = await $fetch(`/api/portal/by-token/${tokenStr.value}/vacaciones`)
    vacBalance.value     = data.balance || {}
    vacSolicitudes.value = data.solicitudes || []
  } catch {
    vacBalance.value = {}
    vacSolicitudes.value = []
  }
}

async function solicitarVacaciones() {
  vacSubmitting.value = true
  vacMsg.value = ''
  try {
    await $fetch(`/api/portal/by-token/${tokenStr.value}/vacaciones`, {
      method: 'POST',
      body: { ...vacReq.value },
    })
    vacMsgOk.value = true
    vacMsg.value = '¡Solicitud enviada! Te avisarán cuando se apruebe.'
    vacReq.value = { fecha_inicio: '', fecha_fin: '', motivo: '' }
    await cargarVacaciones()
    setTimeout(() => { vacFormOpen.value = false; vacMsg.value = '' }, 2000)
  } catch (e) {
    vacMsgOk.value = false
    vacMsg.value = e?.data?.message || 'No se pudo enviar la solicitud'
  } finally {
    vacSubmitting.value = false
  }
}

// Helpers de fecha
function fechaHoy() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getProyecto(id) {
  return proyectos.value.find(p => (p._id || p.id) === id) || null
}

function getTurno(id) {
  return turnos.value.find(t => (t._id || t.id) === id) || null
}

const step = ref('loading') // 'loading' | 'error' | 'select' | 'dentro' | 'fuera'
const marcando = ref(false)
const resultado = ref(null)

// ─── Hora actual en tiempo real ───────────────────────────────────────────
const horaActual = ref('')
let clockInterval = null

function tickClock() {
  const now = new Date()
  horaActual.value = now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// ─── Init ─────────────────────────────────────────────────────────────────
onUnmounted(() => {
  if (clockInterval) clearInterval(clockInterval)
})

onMounted(async () => {
  tickClock()
  clockInterval = setInterval(tickClock, 1000)

  tokenStr.value = route.params.token

  try {
    const data = await $fetch(`/api/portal/by-token/${tokenStr.value}`)
    trabajador.value   = data.trabajador
    turnos.value       = data.turnos || []
    proyectos.value    = data.proyectos || []
    marcacionHoy.value = data.marcacionHoy || null

    // Pre-seleccionar primer turno y primer proyecto
    if (turnos.value[0])    turnoSel.value    = turnos.value[0]._id
    if (proyectos.value[0]) {
      proyectoSel.value = proyectos.value[0]._id
      lineaSel.value    = proyectos.value[0].lineas?.[0]?._id || proyectos.value[0].lineas?.[0]?.id || ''
    }

    // Estado actual del día
    const m = marcacionHoy.value
    if (!m || !m.entrada)   step.value = 'select'
    else if (!m.salida)     step.value = 'dentro'
    else                    step.value = 'fuera'

    // Cargar vacaciones en paralelo (no bloqueante para el flujo principal)
    cargarVacaciones()
  } catch (e) {
    error.value = e?.data?.message || 'El link no es válido o ha expirado. Solicita uno nuevo a tu encargado de RRHH.'
    step.value  = 'error'
  } finally {
    cargando.value = false
  }

  // Obtener ubicación en segundo plano (no bloqueante)
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => { ubicacion.value = { lat: pos.coords.latitude, lng: pos.coords.longitude } },
      () => {}
    )
  }
})

// ─── Líneas del proyecto seleccionado ────────────────────────────────────
const lineasProySel = computed(() => {
  const p = getProyecto(proyectoSel.value)
  return p?.lineas || []
})

// Auto-seleccionar primera línea al cambiar proyecto
function onProyectoChange() {
  const lineas = lineasProySel.value
  lineaSel.value = lineas[0]?._id || lineas[0]?.id || ''
}

// ─── Marcar Entrada ───────────────────────────────────────────────────────
async function marcarEntrada() {
  marcando.value = true
  try {
    const data = await $fetch(`/api/portal/by-token/${tokenStr.value}/marcar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        tipo: 'entrada',
        turno_id:    turnoSel.value,
        proyecto_id: proyectoSel.value,
        linea_id:    lineaSel.value,
        ubicacion:   ubicacion.value,
      },
    })
    marcacionHoy.value = data.marcacion
    resultado.value = {
      tipo: 'entrada',
      hora: data.marcacion.entrada,
      atraso: data.marcacion.atraso_minutos,
    }
    step.value = 'dentro'
  } catch (e) {
    error.value = e?.data?.message || 'Error al marcar entrada'
    // Si el server devolvió la marcación existente, actualizar estado
    const existing = e?.data?.data?.marcacion
    if (existing) {
      marcacionHoy.value = existing
      step.value = existing.salida ? 'fuera' : 'dentro'
    }
  } finally {
    marcando.value = false
  }
}

// ─── Marcar Salida ────────────────────────────────────────────────────────
async function marcarSalida() {
  marcando.value = true
  try {
    const data = await $fetch(`/api/portal/by-token/${tokenStr.value}/marcar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        tipo: 'salida',
        ubicacion: ubicacion.value,
      },
    })
    marcacionHoy.value = data.marcacion
    resultado.value = {
      tipo: 'salida',
      hora: data.marcacion.salida,
      horasTrabajadas: data.marcacion.horas_trabajadas,
      horasExtra: data.marcacion.horas_extra,
    }
    step.value = 'fuera'
  } catch (e) {
    error.value = e?.data?.message || 'Error al marcar salida'
  } finally {
    marcando.value = false
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function initiales(n) {
  return n?.split(' ').slice(0,2).map(p=>p[0]).join('').toUpperCase() || '?'
}

function hoyLabel() {
  return new Date().toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })
}
</script>

<template>
  <div class="portal-root">

    <!-- Loading -->
    <div v-if="step === 'loading'" class="portal-center">
      <div class="spinner"></div>
      <p>Cargando…</p>
    </div>

    <!-- Error -->
    <div v-else-if="step === 'error'" class="portal-center">
      <div class="error-icon">
        <i class="u u-cerrar"></i>
      </div>
      <h2>Link inválido</h2>
      <p class="portal-msg">{{ error }}</p>
    </div>

    <!-- Portal activo -->
    <template v-else>
      <!-- Header -->
      <div class="portal-header">
        <div class="portal-logo">
          <i class="u u-usuarios"></i>
        </div>
        <div class="header-info">
          <span class="header-brand">Unabase · RRHH</span>
          <span class="header-fecha">{{ hoyLabel() }}</span>
        </div>
      </div>

      <!-- Tarjeta trabajador -->
      <div class="worker-card">
        <div class="worker-avatar">{{ initiales(trabajador?.nombre) }}</div>
        <div class="worker-info">
          <div class="worker-name">{{ trabajador?.nombre }}</div>
          <div class="worker-cargo">{{ trabajador?.cargo }}</div>
        </div>
      </div>

      <!-- Reloj en tiempo real -->
      <div class="clock-display">
        <div class="clock-time">{{ horaActual }}</div>
        <div class="clock-label">Hora actual</div>
      </div>

      <!-- ═══════════════════════════════════════════════════════════ -->
      <!-- Step: Seleccionar proyecto + marcar entrada -->
      <!-- ═══════════════════════════════════════════════════════════ -->
      <div v-if="step === 'select'" class="portal-card">
        <h3 class="card-title">Selecciona tu trabajo de hoy</h3>

        <div class="form-group">
          <label>Turno</label>
          <select v-model="turnoSel">
            <option v-for="t in turnos" :key="t._id || t.id" :value="t._id || t.id">
              {{ t.nombre }} ({{ t.hora_entrada }}–{{ t.hora_salida }})
            </option>
          </select>
        </div>

        <div class="form-group">
          <label>Proyecto</label>
          <select v-model="proyectoSel" @change="onProyectoChange">
            <option v-for="p in proyectos" :key="p._id || p.id" :value="p._id || p.id">{{ p.nombre }}</option>
          </select>
        </div>

        <div class="form-group">
          <label>Línea / Tarea</label>
          <select v-model="lineaSel">
            <option v-for="l in lineasProySel" :key="l._id || l.id" :value="l._id || l.id">
              [{{ l.codigo }}] {{ l.nombre }}
            </option>
          </select>
        </div>

        <button
          class="btn-entrada"
          @click="marcarEntrada"
          :disabled="marcando || !turnoSel"
        >
          <div class="btn-inner">
            <i v-if="!marcando" class="u u-check btn-big-icon"></i>
            <div v-else class="btn-spinner"></div>
            <span>{{ marcando ? 'Registrando…' : 'Marcar Entrada' }}</span>
          </div>
        </button>

        <p v-if="error" class="inline-error">{{ error }}</p>
      </div>

      <!-- ═══════════════════════════════════════════════════════════ -->
      <!-- Step: Dentro — puede marcar salida -->
      <!-- ═══════════════════════════════════════════════════════════ -->
      <div v-else-if="step === 'dentro'" class="portal-card">
        <!-- Confirmación de entrada (si acaba de marcar) -->
        <div v-if="resultado?.tipo === 'entrada'" class="confirm-chip confirm-entrada">
          <i class="u u-check"></i>
          Entrada registrada a las <strong>{{ resultado.hora }}</strong>
          <span v-if="resultado.atraso > 0" class="atraso-note">(+{{ resultado.atraso }} min)</span>
        </div>

        <div class="estado-badge estado-dentro">
          <i class="u u-check"></i>
          En trabajo
        </div>

        <div class="entrada-info">
          <div class="info-row">
            <span class="info-label">Entrada</span>
            <span class="info-val mono">{{ marcacionHoy?.entrada }}</span>
          </div>
          <div class="info-row" v-if="getProyecto(marcacionHoy?.proyecto_id)">
            <span class="info-label">Proyecto</span>
            <span class="info-val">{{ getProyecto(marcacionHoy?.proyecto_id)?.nombre }}</span>
          </div>
          <div class="info-row" v-if="getTurno(marcacionHoy?.turno_id)">
            <span class="info-label">Turno</span>
            <span class="info-val">{{ getTurno(marcacionHoy?.turno_id)?.nombre }}</span>
          </div>
        </div>

        <button class="btn-salida" @click="marcarSalida" :disabled="marcando">
          <div class="btn-inner">
            <i v-if="!marcando" class="u u-cerrar btn-big-icon"></i>
            <div v-else class="btn-spinner"></div>
            <span>{{ marcando ? 'Registrando…' : 'Marcar Salida' }}</span>
          </div>
        </button>

        <p v-if="error" class="inline-error">{{ error }}</p>
      </div>

      <!-- ═══════════════════════════════════════════════════════════ -->
      <!-- Step: Fuera — jornada completa -->
      <!-- ═══════════════════════════════════════════════════════════ -->
      <div v-else-if="step === 'fuera'" class="portal-card">
        <div class="estado-badge estado-fuera">
          <i class="u u-check"></i>
          Jornada completada
        </div>

        <div class="resumen-jornada">
          <div class="rj-row">
            <span class="rj-label">Entrada</span>
            <span class="rj-val mono">{{ marcacionHoy?.entrada }}</span>
          </div>
          <div class="rj-row">
            <span class="rj-label">Salida</span>
            <span class="rj-val mono">{{ marcacionHoy?.salida || resultado?.hora }}</span>
          </div>
          <div class="rj-row rj-highlight">
            <span class="rj-label">Horas trabajadas</span>
            <span class="rj-val text-teal">
              {{ resultado?.horasTrabajadas || marcacionHoy?.horas_trabajadas }}h
            </span>
          </div>
          <div class="rj-row" v-if="(resultado?.horasExtra || marcacionHoy?.horas_extra) > 0">
            <span class="rj-label">Horas extra</span>
            <span class="rj-val text-purple">
              +{{ resultado?.horasExtra || marcacionHoy?.horas_extra }}h
            </span>
          </div>
          <div class="rj-row" v-if="marcacionHoy?.atraso_minutos > 0">
            <span class="rj-label">Atraso</span>
            <span class="rj-val text-orange">+{{ marcacionHoy.atraso_minutos }} min</span>
          </div>
        </div>

        <div class="done-msg">
          <i class="u u-check"></i>
          ¡Hasta mañana, {{ trabajador?.nombre?.split(' ')[0] }}!
        </div>
      </div>

    </template>

    <!-- ── Vacaciones ───────────────────────────────────────────────── -->
    <div v-if="step !== 'loading' && step !== 'error'" class="vac-section">
      <div class="vac-section__head">
        <h3>Vacaciones</h3>
        <button class="vac-btn" @click="vacFormOpen = !vacFormOpen">
          {{ vacFormOpen ? 'Cerrar' : 'Solicitar días' }}
        </button>
      </div>

      <div class="vac-mini-grid">
        <div class="vac-mini">
          <span class="vac-mini__num">{{ vacBalance.disponible ?? 0 }}</span>
          <span class="vac-mini__label">Disponibles</span>
        </div>
        <div class="vac-mini vac-mini--pen">
          <span class="vac-mini__num">{{ vacBalance.pendientes ?? 0 }}</span>
          <span class="vac-mini__label">Pendientes</span>
        </div>
        <div class="vac-mini vac-mini--apr">
          <span class="vac-mini__num">{{ vacBalance.aprobadas ?? 0 }}</span>
          <span class="vac-mini__label">Aprobadas</span>
        </div>
      </div>

      <form v-if="vacFormOpen" class="vac-form" @submit.prevent="solicitarVacaciones">
        <label class="vac-form__row">
          <span>Desde</span>
          <input type="date" v-model="vacReq.fecha_inicio" required />
        </label>
        <label class="vac-form__row">
          <span>Hasta</span>
          <input type="date" v-model="vacReq.fecha_fin" required />
        </label>
        <label class="vac-form__row">
          <span>Motivo (opcional)</span>
          <textarea v-model="vacReq.motivo" rows="2" placeholder="Ej: viaje familiar"></textarea>
        </label>
        <button type="submit" class="vac-form__submit" :disabled="!vacReq.fecha_inicio || !vacReq.fecha_fin || vacSubmitting">
          {{ vacSubmitting ? 'Enviando…' : 'Enviar solicitud' }}
        </button>
        <p v-if="vacMsg" class="vac-form__msg" :class="{ ok: vacMsgOk }">{{ vacMsg }}</p>
      </form>

      <div v-if="vacSolicitudes.length" class="vac-history">
        <div v-for="v in vacSolicitudes" :key="v._id" class="vac-history__item" :class="`vac-history__item--${v.estado}`">
          <div class="vac-history__row1">
            <span class="vac-history__fechas">{{ v.fecha_inicio }} → {{ v.fecha_fin }}</span>
            <span class="vac-history__estado">{{ v.estado }}</span>
          </div>
          <div class="vac-history__row2">{{ v.dias_habiles }} día(s) hábil(es){{ v.motivo ? ' · ' + v.motivo : '' }}</div>
          <div v-if="v.notas_aprobacion" class="vac-history__nota">"{{ v.notas_aprobacion }}"</div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* ── Base ─────────────────────────────────────────────────────────────────── */
.portal-root {
  min-height: 100vh;
  background: #111b22;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 0 40px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #f3f4f6;
}

/* ── Header ──────────────────────────────────────────────────────────────── */
.portal-header {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: #161f27;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  margin-bottom: 24px;
}

.portal-logo {
  width: 38px; height: 38px;
  border-radius: 10px;
  background: #2a9d8f;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; color: #fff; flex-shrink: 0;
}

.header-info { display: flex; flex-direction: column; gap: 1px; }
.header-brand { font-size: 14px; font-weight: 800; color: #f3f4f6; letter-spacing: 0.02em; }
.header-fecha { font-size: 11px; color: #6b7280; text-transform: capitalize; }

/* ── Loading / Error ─────────────────────────────────────────────────────── */
.portal-center {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 16px; padding: 40px 20px;
  text-align: center;
}

.portal-center p { color: #9ca3af; font-size: 15px; max-width: 300px; line-height: 1.6; }
.portal-center h2 { font-size: 20px; font-weight: 800; color: #f3f4f6; margin: 0; }

.error-icon {
  width: 64px; height: 64px;
  border-radius: 50%;
  background: rgba(239,68,68,0.12);
  display: flex; align-items: center; justify-content: center;
  font-size: 28px; color: #f87171;
}

.portal-msg { color: #9ca3af; font-size: 14px; max-width: 320px; }

.spinner {
  width: 40px; height: 40px;
  border: 3px solid rgba(58,199,165,0.2);
  border-top-color: #3ac7a5;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Worker card ─────────────────────────────────────────────────────────── */
.worker-card {
  width: 100%; max-width: 420px;
  background: #1e2d3a;
  border: 1.5px solid rgba(255,255,255,0.08);
  border-radius: 16px;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 0 16px 16px;
}

.worker-avatar {
  width: 52px; height: 52px;
  border-radius: 50%;
  background: #2a9d8f;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; font-weight: 800; color: #fff;
  flex-shrink: 0;
}

.worker-info { flex: 1; }
.worker-name  { font-size: 17px; font-weight: 800; color: #f3f4f6; }
.worker-cargo { font-size: 13px; color: #9ca3af; margin-top: 3px; }

/* ── Reloj ───────────────────────────────────────────────────────────────── */
.clock-display {
  margin: 0 16px 16px;
  text-align: center;
}
.clock-time {
  font-size: 48px; font-weight: 900;
  font-variant-numeric: tabular-nums;
  letter-spacing: -1px;
  color: #f3f4f6;
  font-family: 'Roboto Mono', 'SF Mono', monospace;
  line-height: 1.1;
}
.clock-label { font-size: 12px; color: #6b7280; margin-top: 2px; }

/* ── Portal card ─────────────────────────────────────────────────────────── */
.portal-card {
  width: 100%; max-width: 420px;
  background: #1e2d3a;
  border: 1.5px solid rgba(255,255,255,0.08);
  border-radius: 20px;
  padding: 24px 20px;
  margin: 0 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card-title {
  font-size: 16px; font-weight: 800; color: #f3f4f6; margin: 0;
  text-align: center;
}

/* ── Form ────────────────────────────────────────────────────────────────── */
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-group label {
  font-size: 12px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.07em;
}
.form-group select {
  background: rgba(255,255,255,0.07);
  border: 1.5px solid rgba(255,255,255,0.12);
  border-radius: 12px;
  padding: 12px 14px;
  color: #f3f4f6;
  font-size: 14px;
  font-family: inherit;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%239ca3af' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 14px center;
  padding-right: 36px;
}
.form-group select:focus { border-color: rgba(58,199,165,0.5); }
.form-group select option { background: #1e2d3a; }

/* ── Botón Entrada ───────────────────────────────────────────────────────── */
.btn-entrada {
  background: linear-gradient(135deg, #2a9d8f 0%, #3ac7a5 100%);
  border: none;
  border-radius: 16px;
  padding: 18px;
  cursor: pointer;
  margin-top: 8px;
  transition: all 0.2s;
  box-shadow: 0 4px 24px rgba(42,157,143,0.35);
}
.btn-entrada:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 28px rgba(42,157,143,0.45); }
.btn-entrada:active:not(:disabled) { transform: translateY(1px); }
.btn-entrada:disabled { opacity: 0.6; cursor: default; transform: none; }

/* ── Botón Salida ────────────────────────────────────────────────────────── */
.btn-salida {
  background: linear-gradient(135deg, #e63946 0%, #f87171 100%);
  border: none;
  border-radius: 16px;
  padding: 18px;
  cursor: pointer;
  margin-top: 8px;
  transition: all 0.2s;
  box-shadow: 0 4px 24px rgba(230,57,70,0.3);
}
.btn-salida:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 28px rgba(230,57,70,0.4); }
.btn-salida:active:not(:disabled) { transform: translateY(1px); }
.btn-salida:disabled { opacity: 0.6; cursor: default; transform: none; }

.btn-inner {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  color: #fff; font-size: 17px; font-weight: 800;
}
.btn-big-icon { font-size: 22px; }
.btn-spinner {
  width: 22px; height: 22px;
  border: 2.5px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

/* ── Estado badges ───────────────────────────────────────────────────────── */
.estado-badge {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 10px;
  border-radius: 12px;
  font-size: 15px; font-weight: 700;
}
.estado-dentro { background: rgba(74,222,128,0.12); color: #4ade80; }
.estado-fuera  { background: rgba(58,199,165,0.12); color: #3ac7a5; }

/* Confirm chip */
.confirm-chip {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px; font-weight: 600;
  animation: fadeIn 0.4s ease;
}
.confirm-entrada { background: rgba(58,199,165,0.1); color: #3ac7a5; border: 1px solid rgba(58,199,165,0.2); }
.atraso-note { color: #f4a261; font-size: 12px; }

@keyframes fadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }

/* ── Info rows ───────────────────────────────────────────────────────────── */
.entrada-info, .resumen-jornada {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 12px;
  overflow: hidden;
}
.info-row, .rj-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 11px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.info-row:last-child, .rj-row:last-child { border-bottom: none; }
.rj-highlight { background: rgba(58,199,165,0.04); }

.info-label, .rj-label { font-size: 13px; color: #6b7280; }
.info-val, .rj-val { font-size: 14px; font-weight: 700; color: #f3f4f6; }
.mono { font-family: 'Roboto Mono', monospace; }
.text-teal   { color: #3ac7a5; }
.text-orange { color: #f4a261; }
.text-purple { color: #a78bfa; }

/* Done message */
.done-msg {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  font-size: 16px; font-weight: 700; color: #3ac7a5;
  padding: 12px;
}

/* Inline error */
.inline-error {
  font-size: 13px; color: #f87171;
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.2);
  border-radius: 10px;
  padding: 10px 14px;
  margin: 0;
  text-align: center;
}

/* ── Responsive ─────────────────────────────────────────────────────────── */
@media (max-width: 480px) {
  .clock-time { font-size: 40px; }
  .portal-card, .worker-card { margin: 0 12px; }
}

/* ── Vacaciones (portal trabajador) ─────────────────────────────────── */
.vac-section {
  margin: 24px 16px 32px;
  padding: 18px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 14px;
}
.vac-section__head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 14px;
}
.vac-section__head h3 {
  margin: 0;
  font-size: 16px;
  color: #f3f4f6;
}
.vac-btn {
  background: #0DCFA8; color: #062D3A;
  border: none; border-radius: 8px;
  padding: 8px 14px;
  font-size: 13px; font-weight: 600;
  cursor: pointer;
}
.vac-mini-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.vac-mini {
  background: rgba(13, 207, 168, 0.08);
  border: 1px solid rgba(13, 207, 168, 0.25);
  border-radius: 10px;
  padding: 12px 8px;
  text-align: center;
}
.vac-mini--pen { background: rgba(245, 200, 66, 0.08); border-color: rgba(245, 200, 66, 0.3); }
.vac-mini--apr { background: rgba(74, 163, 255, 0.08); border-color: rgba(74, 163, 255, 0.3); }
.vac-mini__num { display: block; font-size: 22px; font-weight: 700; color: #f3f4f6; }
.vac-mini__label { display: block; font-size: 10px; letter-spacing: 0.06em; color: #9ca3af; margin-top: 2px; text-transform: uppercase; }

.vac-form {
  margin-top: 14px;
  padding: 14px;
  background: rgba(255,255,255,0.02);
  border: 1px dashed rgba(255,255,255,0.1);
  border-radius: 10px;
  display: flex; flex-direction: column; gap: 10px;
}
.vac-form__row { display: flex; flex-direction: column; gap: 4px; }
.vac-form__row span { font-size: 11px; color: #9ca3af; letter-spacing: 0.06em; text-transform: uppercase; }
.vac-form__row input,
.vac-form__row textarea {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px;
  padding: 8px 10px;
  color: #f3f4f6;
  font-family: inherit;
  font-size: 14px;
}
.vac-form__submit {
  background: #0DCFA8; color: #062D3A;
  border: none; border-radius: 8px;
  padding: 11px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 4px;
}
.vac-form__submit:disabled { opacity: 0.5; cursor: not-allowed; }
.vac-form__msg { margin: 6px 0 0; font-size: 13px; color: #E07856; }
.vac-form__msg.ok { color: #0DCFA8; }

.vac-history { margin-top: 14px; display: flex; flex-direction: column; gap: 8px; }
.vac-history__item {
  padding: 10px 12px;
  background: rgba(255,255,255,0.02);
  border-left: 3px solid rgba(255,255,255,0.15);
  border-radius: 6px;
}
.vac-history__item--pendiente { border-left-color: #F5C842; }
.vac-history__item--aprobada  { border-left-color: #4AA3FF; }
.vac-history__item--rechazada { border-left-color: #E07856; }
.vac-history__row1 { display: flex; justify-content: space-between; font-size: 13px; color: #f3f4f6; }
.vac-history__estado {
  text-transform: uppercase;
  font-size: 10px; letter-spacing: 0.08em;
  color: #9ca3af;
}
.vac-history__row2 { font-size: 12px; color: #9ca3af; margin-top: 2px; }
.vac-history__nota { font-size: 12px; color: #94a3b8; font-style: italic; margin-top: 4px; }
</style>
