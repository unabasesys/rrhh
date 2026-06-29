<template>
  <div class="login-page">
    <div class="card">
      <!-- ── Panel izquierdo: carrusel de testimonios ── -->
      <div class="illus-panel">
        <!-- Foto de fondo semitransparente -->
        <transition name="slide-fade">
          <img
            :key="currentSlide"
            :src="`/img/welcome_${currentSlide + 1}.png`"
            alt=""
            class="slide-img"
          />
        </transition>
        <div class="slide-overlay"></div>

        <!-- Logo -->
        <div class="slide-logo">
          <img src="/img/logo-unabase-white.png" alt="unabase personas" />
          <span class="app-name">Personas</span>
        </div>

        <!-- Texto del slide -->
        <div class="slide-content">
          <transition name="text-fade" mode="out-in">
            <div :key="currentSlide" class="slide-text">
              <p class="slide-quote">"{{ slides[currentSlide].quote }}"</p>
              <p class="slide-author">{{ slides[currentSlide].author }}</p>
            </div>
          </transition>

          <!-- Dots -->
          <div class="slide-dots">
            <button
              v-for="(_, i) in slides"
              :key="i"
              class="dot"
              :class="{ 'dot--active': i === currentSlide }"
              @click="goToSlide(i)"
            />
          </div>
        </div>
      </div>

      <!-- ── Form derecha ──────────────────────────────────────────── -->
      <div class="login-form">
        <h2 class="title">Iniciar Sesión</h2>
        <span class="subtitle">Introduce tu correo y contraseña para ingresar</span>

        <!-- Google (inactivo por ahora) -->
        <button type="button" class="google-btn" disabled>
          <img src="/img/googlelogo.png" alt="Google" class="google-icon" />
          Continuar con Google
        </button>

        <div class="divider"><span>o</span></div>

        <form @submit.prevent="handleLogin">
          <div class="field">
            <label for="email">Correo Electrónico</label>
            <input
              id="email"
              v-model="form.email"
              type="email"
              placeholder="example@unabase.com"
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
                placeholder="Mínimo 8 caracteres"
                autocomplete="current-password"
                required
                @input="errors.password = ''"
              />
              <button type="button" class="eye-btn" @click="showPass = !showPass">
                <svg v-if="showPass" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
            </div>
            <span v-if="errors.password" class="error-msg">{{ errors.password }}</span>
          </div>

          <div class="options-row">
            <label class="check-label">
              <input type="checkbox" v-model="form.remember" />
              <span>Mantener sesión iniciada</span>
            </label>
            <a class="forgot-link" href="#">¿Olvidaste tu contraseña?</a>
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
            <span>{{ loading ? 'Entrando...' : 'Iniciar Sesión' }}</span>
          </button>
        </form>

        <div class="form-footer">
          <span class="form-footer-text">¿No tienes cuenta aún?</span>
          <a class="form-footer-link" @click.prevent="router.push('/register')" href="/register">Crea una cuenta aquí</a>
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

// ── Carrusel ────────────────────────────────────────────────────────────────
const slides = [
  { quote: 'Creo liquidaciones en un paso y las organizo en proyectos.', author: 'Vale — Vale Producciones' },
  { quote: 'Antes me tomaba horas calcular la nómina. Ahora es cosa de minutos.', author: 'Rodrigo — Estudio R&A' },
  { quote: 'El portal de firma digital eliminó el 100% del papeleo con mis trabajadores.', author: 'Camila — Agencia Norte' },
  { quote: 'Tener contratos, asistencia y liquidaciones en un solo lugar es un cambio total.', author: 'Martín — Productora Sur' },
]
const currentSlide = ref(0)
let slideTimer = null

function goToSlide(i) {
  currentSlide.value = i
  clearInterval(slideTimer)
  slideTimer = setInterval(nextSlide, 5000)
}

function nextSlide() {
  currentSlide.value = (currentSlide.value + 1) % slides.length
}

// ── Form state ──────────────────────────────────────────────────────────────
const form     = reactive({ email: '', password: '', remember: false })
const errors   = reactive({ email: '', password: '', global: '' })
const loading  = ref(false)
const showPass = ref(false)

const { useAuthStore } = await import('@/stores/auth')
const authStore = useAuthStore()

onMounted(async () => {
  slideTimer = setInterval(nextSlide, 5000)
  await authStore.init()
  if (authStore.isAuthenticated) {
    router.replace(route.query.redirect || '/rrhh/home')
  }
})

onUnmounted(() => clearInterval(slideTimer))

async function handleLogin() {
  errors.email = ''; errors.password = ''; errors.global = ''
  if (!form.email.trim())    { errors.email    = 'Ingresa tu correo';     return }
  if (!form.password.trim()) { errors.password = 'Ingresa tu contraseña'; return }
  loading.value = true
  try {
    const result = await authStore.login(form.email.trim().toLowerCase(), form.password, form.remember)
    if (result.ok) router.replace(route.query.redirect || '/rrhh/home')
    else errors.global = result.message || 'Credenciales incorrectas'
  } catch {
    errors.global = 'Error inesperado. Intenta de nuevo.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter+Tight:wght@300;400;500;600;700&display=swap');

* { box-sizing: border-box; }

/* ── Página: fondo oscuro neutro (igual que VX) ─────────────────── */
.login-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  width: 100vw;
  background: #0f1624;
  font-family: 'Inter Tight', system-ui, sans-serif;
  padding: 24px;
}

/* ── Card 820×620, grid 2 columnas ─────────────────────────────────── */
.card {
  background-color: #111d2e;
  box-shadow: 0 24px 60px rgba(0,0,0,0.6);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 24px;
  padding: 16px;
  width: 820px;
  height: 620px;
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 0;
}

/* ── Panel carrusel (izquierda) ───────────────────────────────────── */
.illus-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 24px;
  background: #071e2b;
  border-radius: 14px;
  overflow: hidden;
}

/* Foto de fondo */
.slide-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  opacity: 0.22;
}

/* Overlay para reforzar legibilidad */
.slide-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(7, 30, 43, 0.6) 0%,
    rgba(7, 30, 43, 0.75) 100%
  );
}

/* Transición foto */
.slide-fade-enter-active, .slide-fade-leave-active { transition: opacity 1s ease; }
.slide-fade-enter-from, .slide-fade-leave-to { opacity: 0; }

/* Logo + app name */
.slide-logo {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  position: relative;
  z-index: 2;
}
.slide-logo img {
  height: 28px;
  width: auto;
  display: block;
  opacity: 0.95;
}
.app-name {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 17px;
  font-weight: 500;
  color: rgba(255,255,255,0.55);
  letter-spacing: 0.01em;
}

/* Texto testimonio */
.slide-content {
  margin-top: auto;
  position: relative;
  z-index: 2;
}
.slide-quote {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 22px;
  font-weight: 600;
  color: #ffffff;
  line-height: 1.35;
  letter-spacing: -0.01em;
  margin: 0 0 16px;
}
.slide-author {
  font-size: 13px;
  color: rgba(255,255,255,0.5);
  margin: 0 0 24px;
}

/* Dots de carrusel */
.slide-dots {
  display: flex;
  gap: 6px;
}
.dot {
  width: 24px;
  height: 3px;
  border-radius: 2px;
  border: none;
  background: rgba(255,255,255,0.2);
  cursor: pointer;
  padding: 0;
  transition: background 0.3s, width 0.3s;
}
.dot--active {
  width: 40px;
  background: #0DCFA8;
}

/* Transición de texto */
.text-fade-enter-active, .text-fade-leave-active { transition: opacity 0.35s ease, transform 0.35s ease; }
.text-fade-enter-from { opacity: 0; transform: translateY(12px); }
.text-fade-leave-to { opacity: 0; transform: translateY(-8px); }

/* Logo dentro del form panel */
.form-logo {
  height: 42px;
  width: auto;
  margin-bottom: 24px;
  object-fit: contain;
  object-position: left center;
}

/* ── Form derecha ──────────────────────────────────────────────────── */
.login-form {
  display: flex;
  flex-direction: column;
  padding: 36px 36px 28px 24px;
}

.title {
  color: #F5F0E6;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 32px;
  line-height: 1.1;
  font-weight: 700;
  margin: 0 0 6px;
  letter-spacing: -0.02em;
}

.subtitle {
  color: rgba(245,240,230,0.5);
  font-size: 14px;
  line-height: 1.4;
}

form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 16px;
}

/* Footer "¿No tienes cuenta?" */
.form-footer {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 18px;
  font-size: 13px;
}
.form-footer-text { color: rgba(245,240,230,0.45); }
.form-footer-link {
  color: #0DCFA8;
  font-weight: 600;
  text-decoration: none;
  font-family: 'Space Grotesk', sans-serif;
}
.form-footer-link:hover { opacity: 0.8; }

/* ── Footer ────────────────────────────────────────────────────────── */
.footer {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: rgba(245,240,230,0.4);
  margin-top: 20px;
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
/* Botón Google */
.google-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  height: 46px;
  margin-top: 20px;
  background: rgba(245,240,230,0.06);
  border: 1px solid rgba(245,240,230,0.12);
  border-radius: 14px;
  color: rgba(245,240,230,0.35);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 14px;
  font-weight: 500;
  cursor: not-allowed;
  opacity: 0.5;
}
.google-icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
  opacity: 0.5;
}

/* Divider "o" */
.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 16px 0 0;
  color: rgba(245,240,230,0.25);
  font-size: 12px;
}
.divider::before, .divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(245,240,230,0.1);
}

.eye-btn {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: rgba(245,240,230,0.4);
  cursor: pointer;
  padding: 0;
  transition: color 0.15s;
}
.eye-btn:hover { color: rgba(245,240,230,0.75); }

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
  .illus-panel { display: none; }
  .login-form { padding: 32px 28px 24px; }
}
@media only screen and (max-width: 560px) {
  .login-page { padding: 16px; }
  .card { width: 100%; max-width: 420px; }
}
</style>
