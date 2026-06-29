<template>
  <!-- ── Modal de bienvenida (Step 0) ──────────────────────────────────── -->
  <div v-if="step === 0" class="ow-overlay" @click.self="cerrar">
    <div class="ow-modal">
      <div class="ow-modal__hero">
        <div class="ow-modal__logo">
          <img src="/img/logo-unabase-white.png" alt="unabase" />
          <span>Personas</span>
        </div>
        <h2>¡Bienvenido a Unabase Personas!</h2>
        <p>
          El módulo de RRHH para estudios, agencias y productoras chilenas.
          Contratos, liquidaciones, marcaciones y firma electrónica — todo en
          un solo lugar.
        </p>
        <p class="ow-modal__lede">
          Te dejamos una <strong>empresa DEMO</strong> precargada con 7 trabajadores,
          3 proyectos y 7 contratos vigentes para que explores libremente sin
          configurar nada.
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
  overflow: hidden;
  box-shadow: 0 24px 60px rgba(0,0,0,0.6);
  animation: ow-pop 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes ow-pop { from { transform: scale(0.92); opacity: 0; } to { transform: scale(1); opacity: 1; } }

.ow-modal__hero {
  padding: 32px 32px 24px;
  background: radial-gradient(ellipse at top, rgba(13, 207, 168, 0.18), transparent 60%);
}
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
</style>
