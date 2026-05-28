<template>
  <div class="login-page">
    <div class="card">
      <!-- ── Slider izquierda ──────────────────────────────────────── -->
      <div class="slider">
        <TransitionGroup name="img-fade">
          <img
            v-for="s in 6"
            v-show="step === s"
            :key="s"
            :src="`/img/login/${s}.png`"
            class="bg-img"
            alt=""
          />
        </TransitionGroup>

        <div class="slider-overlay">
          <div class="slider-logo">
            <img src="/img/logo-unabase-white.png" alt="Unabase Personas" />
          </div>

          <Transition :name="`slide-${direction}`" mode="out-in">
            <div class="slider-texts" :key="step">
              <h2>{{ slides[step - 1].title }}</h2>
              <span>{{ slides[step - 1].description }}</span>
            </div>
          </Transition>

          <div class="slider-controls">
            <button
              v-for="s in 6"
              :key="s"
              :class="{ selected: step === s }"
              @click="changeStep(s)"
              aria-label="Cambiar slide"
            />
          </div>
        </div>
      </div>

      <!-- ── Form derecha ──────────────────────────────────────────── -->
      <div class="login-form">
        <h2 class="title">Bienvenido</h2>
        <span class="subtitle">Ingresa al módulo de Personas</span>

        <form @submit.prevent="handleLogin">
          <div class="field">
            <label for="email">Correo corporativo</label>
            <input
              id="email"
              v-model="form.email"
              type="email"
              placeholder="ana@estudio.cl"
              autocomplete="email"
              autofocus
              required
              @input="errors.email = ''"
            />
            <span v-if="errors.email" class="error-msg">{{ errors.email }}</span>
          </div>

          <div class="field">
            <label for="password">Contraseña</label>
            <div class="input-wrap">
              <input
                id="password"
                v-model="form.password"
                :type="showPass ? 'text' : 'password'"
                placeholder="••••••••••••"
                autocomplete="current-password"
                required
                @input="errors.password = ''"
              />
              <button type="button" class="eye-btn" @click="showPass = !showPass">
                {{ showPass ? 'Ocultar' : 'Ver' }}
              </button>
            </div>
            <span v-if="errors.password" class="error-msg">{{ errors.password }}</span>
          </div>

          <div class="options-row">
            <label class="check-label">
              <input type="checkbox" v-model="form.remember" />
              <span>Mantener sesión 30 días</span>
            </label>
            <a class="forgot-link" href="#">¿Olvidaste tu clave?</a>
          </div>

          <div v-if="errors.global" class="alert-error">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke="#f87171" stroke-width="1.5"/>
              <path d="M7 4v3M7 9.5v.5" stroke="#f87171" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <span>{{ errors.global }}</span>
          </div>

          <button type="submit" class="sign-in-btn" :disabled="loading">
            <span v-if="loading" class="btn-spinner"></span>
            <span>{{ loading ? 'Entrando...' : 'Entrar al módulo' }}</span>
          </button>
        </form>

        <div class="footer">
          <span>unabase · RRHH v1.2</span>
          <span class="footer-dot">·</span>
          <span class="footer-status">
            <span class="status-dot"></span>
            operativo
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'

definePageMeta({ layout: false, middleware: 'no-auth' })

const router = useRouter()
const route  = useRoute()

// ── Form state ──────────────────────────────────────────────────────────────
const form     = reactive({ email: '', password: '', remember: false })
const errors   = reactive({ email: '', password: '', global: '' })
const loading  = ref(false)
const showPass = ref(false)

const { useAuthStore } = await import('@/stores/auth')
const authStore = useAuthStore()

onMounted(async () => {
  await authStore.init()
  if (authStore.isAuthenticated) {
    router.replace(route.query.redirect || '/rrhh/trabajadores')
  }
})

async function handleLogin() {
  errors.email = ''; errors.password = ''; errors.global = ''
  if (!form.email.trim())    { errors.email    = 'Ingresa tu correo';     return }
  if (!form.password.trim()) { errors.password = 'Ingresa tu contraseña'; return }
  loading.value = true
  try {
    const result = await authStore.login(form.email.trim().toLowerCase(), form.password, form.remember)
    if (result.ok) router.replace(route.query.redirect || '/rrhh/trabajadores')
    else errors.global = result.message || 'Credenciales incorrectas'
  } catch {
    errors.global = 'Error inesperado. Intenta de nuevo.'
  } finally {
    loading.value = false
  }
}

// ── Slider state ────────────────────────────────────────────────────────────
const slides = [
  {
    title: 'Tu equipo, todo en una sola base',
    description: 'Contratos, liquidaciones, finiquitos y horarios para estudios, agencias y productoras.',
  },
  {
    title: 'Horarios sincronizados',
    description: 'Marca entrada y salida desde un iPad. 42 turnos gestionados en Mayo.',
  },
  {
    title: '"Creo liquidaciones en un paso y las organizo en proyectos."',
    description: 'Vale — Vale Producciones',
  },
  {
    title: 'Sueldo Empresarial',
    description: 'Nueva figura tributaria para socios y dueños, con Acta y retención IUSC al día.',
  },
  {
    title: '"Pongo un iPad al empezar la producción y la gente marca entrada y salida. Son cracks."',
    description: 'Rafa — Conciertos SPA',
  },
  {
    title: 'Liquidación lista',
    description: '14 colaboradores listos para el cierre de mes.',
  },
]

const step      = ref(1)
const direction = ref('forward')
let interval = null

function goTo(newStep) {
  direction.value =
    newStep > step.value || (step.value === 6 && newStep === 1)
      ? 'forward'
      : 'backward'
  step.value = newStep
}

function changeStep(newStep) {
  goTo(newStep)
  resetInterval()
}

function resetInterval() {
  clearInterval(interval)
  interval = setInterval(() => {
    goTo(step.value === 6 ? 1 : step.value + 1)
  }, 3000)
}

onMounted(() => { resetInterval() })
onUnmounted(() => { clearInterval(interval) })
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter+Tight:wght@300;400;500;600;700&display=swap');

* { box-sizing: border-box; }

/* ── Página: fondo aún más oscuro que la card ──────────────────────── */
.login-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  width: 100vw;
  background: radial-gradient(ellipse at center, #083542 0%, #041B22 100%);
  font-family: 'Inter Tight', system-ui, sans-serif;
  padding: 24px;
}

/* ── Card 820×620, grid 2 columnas ─────────────────────────────────── */
.card {
  background-color: #0A3845;
  box-shadow: 0 24px 60px rgba(0,0,0,0.5);
  border: 1px solid rgba(245,240,230,0.06);
  border-radius: 24px;
  padding: 24px;
  width: 820px;
  height: 620px;
  display: grid;
  grid-template-columns: 1fr 360px;
  column-gap: 48px;
}

/* ── Slider izquierda ──────────────────────────────────────────────── */
.slider {
  position: relative;
  border-radius: 16px;
  overflow: hidden;
}
.bg-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 16px;
}
.img-fade-enter-active,
.img-fade-leave-active { transition: opacity 0.6s ease; }
.img-fade-enter-from,
.img-fade-leave-to { opacity: 0; }

.slider-overlay {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-rows: 32px 1fr 4px;
  height: 100%;
  padding: 48px 24px;
  row-gap: 24px;
  background-color: rgba(0, 0, 0, 0.5);
}

.slider-logo {
  display: flex;
  justify-content: center;
  align-items: center;
}
.slider-logo img {
  height: 36px;
  width: auto;
}

.slider-texts {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 14px;
}
.slider-texts h2 {
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 600;
  font-size: 24px;
  line-height: 1.3;
  color: #ffffff;
  margin: 0;
}
.slider-texts span {
  font-weight: 500;
  font-size: 14px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.85);
}

.slide-forward-enter-active,
.slide-forward-leave-active,
.slide-backward-enter-active,
.slide-backward-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.slide-forward-enter-from  { opacity: 0; transform: translateX(24px); }
.slide-forward-leave-to    { opacity: 0; transform: translateX(-24px); }
.slide-backward-enter-from { opacity: 0; transform: translateX(-24px); }
.slide-backward-leave-to   { opacity: 0; transform: translateX(24px); }

.slider-controls {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 4px;
  align-items: center;
  padding: 0 24px;
}
.slider-controls button {
  background-color: rgba(255, 255, 255, 0.3);
  height: 4px;
  border-radius: 10px;
  border: none;
  padding: 0;
  transition: background-color 0.3s;
  cursor: pointer;
}
.slider-controls button.selected { background-color: #0DCFA8; }
.slider-controls button:not(.selected):hover { background-color: rgba(255, 255, 255, 0.55); }

/* ── Form derecha ──────────────────────────────────────────────────── */
.login-form {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 24px 0;
}

.title {
  color: #F5F0E6;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 28px;
  line-height: 1.1;
  font-weight: 600;
  margin: 0 0 4px;
  letter-spacing: -0.01em;
}

.subtitle {
  color: rgba(245,240,230,0.55);
  font-size: 14px;
  line-height: 1.4;
}

form {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-top: 28px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field label {
  color: rgba(245,240,230,0.75);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.field input {
  height: 44px;
  width: 100%;
  padding: 0 16px;
  border-radius: 14px;
  border: 1px solid rgba(245,240,230,0.12);
  background: rgba(245,240,230,0.05);
  color: #F5F0E6;
  font-size: 14px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
}
.field input::placeholder { color: rgba(245,240,230,0.3); }
.field input:hover { background: rgba(245,240,230,0.07); }
.field input:focus {
  border-color: #0DCFA8;
  background: rgba(245,240,230,0.07);
  box-shadow: 0 0 0 3px rgba(13,207,168,0.18);
}
.error-msg { font-size: 11px; color: #fca5a5; }

.input-wrap { position: relative; }
.input-wrap input { padding-right: 72px; }
.eye-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  height: 30px;
  padding: 0 12px;
  background: rgba(13,207,168,0.15);
  color: #0DCFA8;
  border: none;
  border-radius: 10px;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.15s;
}
.eye-btn:hover { background: rgba(13,207,168,0.25); }

.options-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.check-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: rgba(245,240,230,0.7);
  cursor: pointer;
  user-select: none;
}
.check-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #0DCFA8;
  cursor: pointer;
}
.forgot-link {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 13px;
  font-weight: 600;
  color: #0DCFA8;
  text-decoration: none;
  transition: color 0.2s, opacity 0.2s;
  opacity: 0.9;
}
.forgot-link:hover { opacity: 1; }

.alert-error {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.3);
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 13px;
  color: #fca5a5;
}

.sign-in-btn {
  background-color: #0DCFA8;
  color: #062D3A;
  height: 48px;
  padding: 0 24px;
  border: none;
  border-radius: 16px;
  width: 100%;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.01em;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  box-shadow: 0 8px 24px rgba(13,207,168,0.25);
  transition: background 0.2s, transform 0.1s, box-shadow 0.2s;
}
.sign-in-btn:not(:disabled):hover {
  background-color: #15dab3;
  box-shadow: 0 10px 28px rgba(13,207,168,0.35);
}
.sign-in-btn:active:not(:disabled) { transform: scale(0.98); }
.sign-in-btn:disabled {
  background-color: rgba(13,207,168,0.4);
  color: rgba(6,45,58,0.6);
  cursor: not-allowed;
  box-shadow: none;
}

.btn-spinner {
  width: 16px; height: 16px;
  border: 2px solid rgba(6,45,58,0.3);
  border-top-color: #062D3A;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Footer ────────────────────────────────────────────────────────── */
.footer {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: rgba(245,240,230,0.4);
  margin-top: 16px;
}
.footer-dot { opacity: 0.5; }
.footer-status {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
}
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #0DCFA8;
  box-shadow: 0 0 0 3px rgba(13,207,168,0.2);
}

/* ── Responsive ────────────────────────────────────────────────────── */
@media only screen and (max-width: 850px) {
  .card {
    grid-template-columns: 1fr;
    width: 480px;
    height: auto;
    min-height: 560px;
  }
  .slider { display: none; }
}
@media only screen and (max-width: 560px) {
  .login-page { padding: 16px; }
  .card {
    width: 100%;
    max-width: 400px;
    padding: 20px;
  }
}
</style>
