<template>
  <!-- ── Modal de bienvenida (Step 0) ──────────────────────────────────── -->
  <div v-if="step === 0" class="ow-overlay" @click.self="cerrar">
    <div class="ow-modal ow-modal--wide">
      <div class="ow-modal__hero">
        <div class="ow-modal__logo">
          <img src="/img/logo-unabase-white.png" alt="unabase" />
          <span>People</span>
        </div>
        <h2>Te damos la bienvenida a People 👋</h2>
        <p>
          <strong>People</strong> es el módulo de recursos humanos de unabase:
          el espacio donde gestionas a las personas que hacen funcionar tu
          empresa. Desde aquí administras a tu equipo, generas contratos y
          liquidaciones, calculas sueldos, controlas turnos y horarios, y
          asocias a cada persona a los proyectos en los que participa, todo
          desde un mismo lugar y conectado con el resto de tu operación.
        </p>

        <h3>Esto es lo que puedes hacer:</h3>
        <ul class="ow-list">
          <li><strong>Arma tu equipo</strong> — registra a cada colaborador y mantén su información ordenada y al día: datos personales, cargo, fechas y todo lo que necesitas tener a mano.</li>
          <li><strong>Asocia a tu equipo a proyectos</strong> — vincula a cada persona a los proyectos o presupuestos en los que trabaja, estén o no conectados a unabase. Así sabes quién participa en qué y cómo se distribuyen los costos de tu equipo.</li>
          <li><strong>Genera contratos</strong> — crea, edita y guarda los contratos de tu equipo de forma simple, dejando todo documentado en un solo lugar.</li>
          <li><strong>Calcula sueldos y liquidaciones</strong> — procesa las remuneraciones de tu equipo y emite sus liquidaciones sin perder tiempo en planillas.</li>
          <li><strong>Controla turnos y horarios</strong> — organiza la jornada de cada persona y lleva el registro de asistencia para que nada se te escape.</li>
        </ul>

        <h3>¿Por dónde empezar?</h3>
        <ol class="ow-list ow-list--steps">
          <li><strong>Agrega a tu primer colaborador</strong> — comienza armando tu equipo. Es el punto de partida para todo lo demás.</li>
          <li><strong>Completa la información de cada persona</strong> — mientras más completo el perfil, más fácil será generar contratos y liquidaciones después.</li>
          <li><strong>Asócialos a un proyecto o presupuesto</strong> — conecta a tu equipo con los proyectos en los que participa, dentro o fuera de unabase, para tener visibilidad de costos y dedicación.</li>
          <li><strong>Define turnos y horarios</strong> — configura las jornadas de tu equipo para empezar a llevar el control de asistencia.</li>
          <li><strong>Genera tu primer contrato o liquidación</strong> — con tu equipo cargado, ya puedes emitir documentos en minutos.</li>
        </ol>

        <p class="ow-modal__lede">
          Tómate tu tiempo para explorar. <strong>People crece contigo</strong>:
          mientras más uses el módulo, más ordenada y simple se vuelve la
          gestión de tu equipo.
        </p>
      </div>

      <div class="ow-modal__actions">
        <button class="ow-btn ow-btn--ghost" @click="cerrar">
          Saltar tour
        </button>
        <button class="ow-btn ow-btn--primary" @click="step = 1">
          Hacer tour guiado →
        </button>
      </div>
    </div>
  </div>

  <!-- ── Tooltips contextuales (Steps 1+) ──────────────────────────────── -->
  <div v-else-if="step > 0 && step <= tooltips.length" class="ow-tour" @click.self="cerrar">
    <div
      class="ow-tooltip"
      :style="tooltipPos"
      @click.stop
    >
      <div class="ow-tooltip__head">
        <span class="ow-tooltip__step">{{ step }} / {{ tooltips.length }}</span>
        <button class="ow-tooltip__close" @click="cerrar" title="Saltar">×</button>
      </div>
      <h3 class="ow-tooltip__title">{{ current.titulo }}</h3>
      <p class="ow-tooltip__body">{{ current.body }}</p>
      <div class="ow-tooltip__actions">
        <button v-if="step > 1" class="ow-btn ow-btn--ghost-sm" @click="step--">Anterior</button>
        <div class="ow-tooltip__spacer"></div>
        <button v-if="step < tooltips.length" class="ow-btn ow-btn--primary-sm" @click="step++">Siguiente →</button>
        <button v-else class="ow-btn ow-btn--primary-sm" @click="finalizar">¡Listo! Explorar</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'

const props = defineProps({
  storageKey: { type: String, default: 'rrhh_wizard_done' },
})

// Cada tooltip apunta a un elemento del sidebar identificado por data-tour
const tooltips = [
  {
    target: '[data-tour="home"]',
    titulo: 'Home',
    body:   'Tu panel de bienvenida. Aquí ves tu progreso de configuración, tutoriales y tips útiles del sistema.',
    side:   'right',
  },
  {
    target: '[data-tour="personas"]',
    titulo: 'Personas',
    body:   'Gestiona a todo tu equipo: ficha personal, foto, datos previsionales (AFP, FONASA/Isapre), contratos y liquidaciones de cada trabajador.',
    side:   'right',
  },
  {
    target: '[data-tour="marcaciones"]',
    titulo: 'Marcaciones',
    body:   'Registro de entrada y salida — los trabajadores marcan desde su portal móvil. Tú revisas atrasos, horas extra y exportas a Previred.',
    side:   'right',
  },
  {
    target: '[data-tour="reportes"]',
    titulo: 'Reportes',
    body:   'Genera el archivo TXT para Previred, el PDF de Leyes Sociales y reportes mensuales de nómina filtrados por mes/año.',
    side:   'right',
  },
  {
    target: '[data-tour="indicadores"]',
    titulo: 'Indicadores',
    body:   'UTM, UF, sueldo mínimo, comisiones AFP, tasa SIS — siempre al día. El sistema se actualiza automáticamente 2 veces al mes desde Previred.',
    side:   'right',
  },
]

const step = ref(-1)   // -1 = no inicializado, 0 = modal welcome, 1+ = tooltips

const current = computed(() => tooltips[step.value - 1] || null)

// Posicionar el tooltip junto al target en pantalla
const tooltipPos = ref({})
function updateTooltipPos() {
  if (!current.value) return
  const el = document.querySelector(current.value.target)
  if (!el) {
    tooltipPos.value = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
    return
  }
  const r = el.getBoundingClientRect()
  const margin = 14
  // Lado derecho del item del sidebar
  tooltipPos.value = {
    top:  `${Math.max(20, r.top + r.height / 2 - 80)}px`,
    left: `${r.right + margin}px`,
  }
  // Resaltar el target
  document.querySelectorAll('.ow-target').forEach(n => n.classList.remove('ow-target'))
  el.classList.add('ow-target')
}

let scrollHandler = null
let resizeHandler = null

function cerrar() {
  document.querySelectorAll('.ow-target').forEach(n => n.classList.remove('ow-target'))
  try { localStorage.setItem(props.storageKey, '1') } catch {}
  step.value = -2  // sale del DOM
}
function finalizar() {
  cerrar()
}

// Recalcular posición cuando cambia el step
import { watch } from 'vue'
watch(step, async (v) => {
  if (v > 0) {
    await nextTick()
    updateTooltipPos()
  }
})

onMounted(() => {
  let yaHecho = false
  try { yaHecho = localStorage.getItem(props.storageKey) === '1' } catch {}
  if (yaHecho) { step.value = -2; return }
  step.value = 0
  scrollHandler = () => updateTooltipPos()
  resizeHandler = () => updateTooltipPos()
  window.addEventListener('scroll', scrollHandler, true)
  window.addEventListener('resize', resizeHandler)
})
onUnmounted(() => {
  if (scrollHandler) window.removeEventListener('scroll', scrollHandler, true)
  if (resizeHandler) window.removeEventListener('resize', resizeHandler)
  document.querySelectorAll('.ow-target').forEach(n => n.classList.remove('ow-target'))
})
</script>

<style>
/* Resalta el elemento del sidebar al que apunta el tooltip — global porque
   el sidebar está fuera del scope de este componente */
.ow-target {
  position: relative;
  z-index: 10001 !important;
  box-shadow: 0 0 0 3px rgba(13, 207, 168, 0.5), 0 0 24px rgba(13, 207, 168, 0.35);
  border-radius: 10px;
  background: rgba(13, 207, 168, 0.08) !important;
  transition: box-shadow 0.3s;
}
</style>

<style scoped>
/* ── Modal de bienvenida (step 0) ────────────────────────────────────── */
.ow-overlay {
  position: fixed; inset: 0;
  background: rgba(7, 17, 26, 0.75);
  backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
  z-index: 10000;
  padding: 20px;
  animation: ow-fade 0.25s ease;
}
@keyframes ow-fade { from { opacity: 0; } to { opacity: 1; } }

.ow-modal {
  background: #111d2e;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 18px;
  width: 100%; max-width: 540px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 60px rgba(0,0,0,0.6);
  animation: ow-pop 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.ow-modal--wide { max-width: 680px; }
.ow-modal__hero {
  overflow-y: auto;
  flex: 1;
}
@keyframes ow-pop { from { transform: scale(0.92); opacity: 0; } to { transform: scale(1); opacity: 1; } }

.ow-modal__hero {
  padding: 32px 32px 24px;
  background: radial-gradient(ellipse at top, rgba(13, 207, 168, 0.18), transparent 40%);
  overflow-y: auto;
  flex: 1;
}
.ow-modal__hero h3 {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 14px;
  font-weight: 700;
  color: #0DCFA8;
  margin: 20px 0 10px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.ow-list {
  margin: 0 0 16px;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ow-list li {
  font-size: 13.5px;
  line-height: 1.55;
  color: rgba(245, 240, 230, 0.78);
  padding-left: 22px;
  position: relative;
}
.ow-list li::before {
  content: '';
  position: absolute;
  left: 4px; top: 9px;
  width: 6px; height: 6px;
  border-radius: 50%;
  background: rgba(13, 207, 168, 0.7);
}
.ow-list li strong { color: #f5f0e6; font-weight: 600; }
.ow-list--steps { counter-reset: ow-step; }
.ow-list--steps li::before {
  counter-increment: ow-step;
  content: counter(ow-step);
  position: absolute;
  left: -2px; top: 0;
  width: 18px; height: 18px;
  border-radius: 50%;
  background: rgba(13, 207, 168, 0.16);
  color: #0DCFA8;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ow-list--steps li { padding-left: 28px; }
.ow-modal__logo {
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 18px;
}
.ow-modal__logo img { height: 24px; width: auto; }
.ow-modal__logo span {
  font-family: 'Space Grotesk', sans-serif;
  color: rgba(255, 255, 255, 0.55);
  font-size: 14px;
}
.ow-modal__hero h2 {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 24px; font-weight: 700;
  color: #f5f0e6;
  margin: 0 0 12px;
  letter-spacing: -0.01em;
}
.ow-modal__hero p {
  font-size: 14px; line-height: 1.55;
  color: rgba(245, 240, 230, 0.7);
  margin: 0 0 12px;
}
.ow-modal__lede {
  background: rgba(13, 207, 168, 0.08);
  border: 1px solid rgba(13, 207, 168, 0.2);
  border-radius: 10px;
  padding: 12px 14px;
  margin-top: 6px !important;
}
.ow-modal__lede strong { color: #0DCFA8; }

.ow-modal__actions {
  display: flex; gap: 10px; justify-content: flex-end;
  padding: 18px 26px 24px;
  border-top: 1px solid rgba(255,255,255,0.05);
}

/* ── Tooltip contextual (steps 1+) ───────────────────────────────────── */
.ow-tour {
  position: fixed; inset: 0;
  background: rgba(7, 17, 26, 0.55);
  z-index: 10000;
  animation: ow-fade 0.2s ease;
}
.ow-tooltip {
  position: fixed;
  background: #111d2e;
  border: 1px solid rgba(13, 207, 168, 0.35);
  border-radius: 14px;
  width: 320px;
  padding: 16px 18px 14px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.55);
  z-index: 10002;
  animation: ow-tooltip-in 0.25s ease;
}
@keyframes ow-tooltip-in {
  from { opacity: 0; transform: translateX(-8px); }
  to   { opacity: 1; transform: translateX(0); }
}
.ow-tooltip::before {
  content: '';
  position: absolute;
  left: -8px; top: 50%;
  width: 14px; height: 14px;
  background: #111d2e;
  border-left: 1px solid rgba(13, 207, 168, 0.35);
  border-bottom: 1px solid rgba(13, 207, 168, 0.35);
  transform: translateY(-50%) rotate(45deg);
}

.ow-tooltip__head {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 8px;
}
.ow-tooltip__step {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 11px; font-weight: 600;
  color: #0DCFA8;
  letter-spacing: 0.08em;
}
.ow-tooltip__close {
  background: none; border: none;
  color: rgba(255,255,255,0.4);
  font-size: 22px; line-height: 1;
  cursor: pointer; padding: 0 4px;
}
.ow-tooltip__close:hover { color: #fff; }

.ow-tooltip__title {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 16px; font-weight: 700;
  color: #f5f0e6;
  margin: 0 0 6px;
}
.ow-tooltip__body {
  font-size: 13px; line-height: 1.5;
  color: rgba(245, 240, 230, 0.7);
  margin: 0 0 14px;
}
.ow-tooltip__actions {
  display: flex; align-items: center;
  gap: 6px;
}
.ow-tooltip__spacer { flex: 1; }

/* ── Botones ─────────────────────────────────────────────────────────── */
.ow-btn {
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 600;
  cursor: pointer;
  border: none;
  border-radius: 10px;
  transition: background 0.15s, transform 0.1s;
}
.ow-btn--primary {
  background: #0DCFA8; color: #062D3A;
  padding: 11px 20px; font-size: 14px;
}
.ow-btn--primary:hover { background: #15dab3; }
.ow-btn--primary-sm {
  background: #0DCFA8; color: #062D3A;
  padding: 7px 14px; font-size: 12px;
  border-radius: 8px;
}
.ow-btn--ghost {
  background: transparent;
  color: rgba(245, 240, 230, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.12);
  padding: 11px 20px; font-size: 14px;
}
.ow-btn--ghost:hover { background: rgba(255,255,255,0.05); color: #f5f0e6; }
.ow-btn--ghost-sm {
  background: transparent;
  color: rgba(245, 240, 230, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.12);
  padding: 7px 14px; font-size: 12px;
  border-radius: 8px;
}

/* ── Modo claro (light theme) ────────────────────────────────────────── */
:root.light-theme .ow-modal,
:root.light-theme .ow-tooltip {
  background: #ffffff;
  border-color: #e5e7eb;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.25);
}
:root.light-theme .ow-tooltip {
  border-color: rgba(13, 207, 168, 0.4);
}
:root.light-theme .ow-tooltip::before {
  background: #ffffff;
  border-color: rgba(13, 207, 168, 0.4);
}
:root.light-theme .ow-modal__hero {
  background: radial-gradient(ellipse at top, rgba(13, 207, 168, 0.10), transparent 50%);
}
:root.light-theme .ow-modal__hero h2,
:root.light-theme .ow-tooltip__title {
  color: #0f172a;
}
:root.light-theme .ow-modal__logo span,
:root.light-theme .ow-list li,
:root.light-theme .ow-modal__hero p,
:root.light-theme .ow-tooltip__body {
  color: #475569;
}
:root.light-theme .ow-list li strong,
:root.light-theme .ow-modal__hero p strong { color: #0f172a; }
:root.light-theme .ow-modal__hero h3 { color: #0DCFA8; }
:root.light-theme .ow-modal__lede {
  background: rgba(13, 207, 168, 0.06);
  border-color: rgba(13, 207, 168, 0.25);
  color: #334155;
}
:root.light-theme .ow-modal__actions {
  border-top-color: #f1f5f9;
}
:root.light-theme .ow-tooltip__close {
  color: #94a3b8;
}
:root.light-theme .ow-tooltip__close:hover { color: #0f172a; }
:root.light-theme .ow-btn--ghost,
:root.light-theme .ow-btn--ghost-sm {
  color: #475569;
  border-color: #d1d5db;
}
:root.light-theme .ow-btn--ghost:hover,
:root.light-theme .ow-btn--ghost-sm:hover {
  background: #f1f5f9;
  color: #0f172a;
}
/* Logo: en light usar versión color en lugar de la blanca */
:root.light-theme .ow-modal__logo img {
  /* Sin filtros: el PNG blanco no se ve en fondo blanco. Usamos uno color
     vía content alternativo en el template no es trivial, así que aquí
     invertimos el blanco al navy del brand */
  filter: invert(1) brightness(0.3) sepia(1) hue-rotate(165deg) saturate(2);
}
</style>
