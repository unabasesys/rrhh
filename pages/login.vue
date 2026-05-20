<template>
  <div class="login-root">
    <!-- Fondo animado -->
    <div class="login-bg">
      <div class="login-bg__orb login-bg__orb--1"></div>
      <div class="login-bg__orb login-bg__orb--2"></div>
    </div>

    <div class="login-card">
      <!-- Header -->
      <div class="login-header">
        <div class="login-logo">
          <i class="u u-personas" style="font-size:28px;color:#2a9d8f"></i>
        </div>
        <h1 class="login-title">RRHH</h1>
        <p class="login-subtitle">Recursos Humanos · Unabase</p>
      </div>

      <!-- Form -->
      <form class="login-form" @submit.prevent="handleLogin">
        <div class="login-field" :class="{ 'login-field--error': errors.email }">
          <label>Email</label>
          <div class="login-input-wrap">
            <i class="u u-mail"></i>
            <input
              v-model="form.email"
              type="email"
              placeholder="usuario@empresa.cl"
              autocomplete="email"
              autofocus
              @input="errors.email = ''"
            />
          </div>
          <span v-if="errors.email" class="login-error-msg">{{ errors.email }}</span>
        </div>

        <div class="login-field" :class="{ 'login-field--error': errors.password }">
          <label>Contraseña</label>
          <div class="login-input-wrap">
            <i class="u u-lock"></i>
            <input
              v-model="form.password"
              :type="showPass ? 'text' : 'password'"
              placeholder="••••••••"
              autocomplete="current-password"
              @input="errors.password = ''"
            />
            <button type="button" class="login-toggle-pass" @click="showPass = !showPass" tabindex="-1">
              <i :class="showPass ? 'u u-eye-off' : 'u u-eye'"></i>
            </button>
          </div>
          <span v-if="errors.password" class="login-error-msg">{{ errors.password }}</span>
        </div>

        <div class="login-options">
          <label class="login-remember">
            <input v-model="form.remember" type="checkbox" />
            <span>Recordar sesión (30 días)</span>
          </label>
        </div>

        <!-- Error global -->
        <div v-if="errors.global" class="login-alert">
          <i class="u u-warning"></i>
          {{ errors.global }}
        </div>

        <button type="submit" class="login-btn" :disabled="loading">
          <span v-if="loading" class="login-btn__spinner"></span>
          <span v-else><i class="u u-arrow-right"></i> Ingresar</span>
        </button>
      </form>

      <!-- Footer -->
      <div class="login-footer">
        <span>RRHH v1.1 · Unabase</span>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ layout: false })

const router = useRouter()
const route  = useRoute()

const form = reactive({ email: '', password: '', remember: false })
const errors = reactive({ email: '', password: '', global: '' })
const loading = ref(false)
const showPass = ref(false)

// Importar el auth store
const { useAuthStore } = await import('@/stores/auth')
const authStore = useAuthStore()

// Inicializar store (seed admin si localStorage está vacío) y verificar sesión activa
onMounted(async () => {
  await authStore.init()
  if (authStore.isAuthenticated) {
    router.replace(route.query.redirect || '/rrhh/trabajadores')
  }
})

async function handleLogin() {
  errors.email   = ''
  errors.password = ''
  errors.global  = ''

  if (!form.email.trim())    { errors.email    = 'Ingresa tu email'; return }
  if (!form.password.trim()) { errors.password = 'Ingresa tu contraseña'; return }

  loading.value = true
  try {
    const result = await authStore.login(form.email.trim().toLowerCase(), form.password, form.remember)
    if (result.ok) {
      router.replace(route.query.redirect || '/rrhh/trabajadores')
    } else {
      errors.global = result.message || 'Credenciales incorrectas'
    }
  } catch (e) {
    errors.global = 'Error inesperado. Intenta de nuevo.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
* { box-sizing: border-box; margin: 0; padding: 0; }

.login-root {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0a121a;
  font-family: 'Nunito', sans-serif;
  position: relative;
  overflow: hidden;
}

/* Orbs de fondo */
.login-bg { position: absolute; inset: 0; pointer-events: none; }
.login-bg__orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.15;
}
.login-bg__orb--1 {
  width: 500px; height: 500px;
  background: #2a9d8f;
  top: -150px; left: -100px;
  animation: float1 8s ease-in-out infinite;
}
.login-bg__orb--2 {
  width: 400px; height: 400px;
  background: #1a6b63;
  bottom: -100px; right: -100px;
  animation: float2 10s ease-in-out infinite;
}
@keyframes float1 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(30px,20px); } }
@keyframes float2 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-20px,-30px); } }

/* Card */
.login-card {
  position: relative;
  z-index: 10;
  width: 100%;
  max-width: 420px;
  background: #0f1923;
  border: 1px solid rgba(42,157,143,0.2);
  border-radius: 16px;
  padding: 40px 36px 32px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.5);
}

/* Header */
.login-header { text-align: center; margin-bottom: 32px; }
.login-logo {
  width: 56px; height: 56px;
  background: rgba(42,157,143,0.12);
  border: 1px solid rgba(42,157,143,0.3);
  border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 14px;
}
.login-title {
  font-size: 26px; font-weight: 800;
  color: #fff;
  letter-spacing: 2px;
}
.login-subtitle {
  font-size: 12px; color: #6b7280;
  margin-top: 4px;
}

/* Fields */
.login-field { margin-bottom: 20px; }
.login-field label {
  display: block;
  font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.8px;
  color: #9ca3af;
  margin-bottom: 8px;
}
.login-input-wrap {
  position: relative;
  display: flex; align-items: center;
}
.login-input-wrap > .u {
  position: absolute; left: 14px;
  font-size: 15px; color: #4b5563;
  pointer-events: none;
}
.login-input-wrap input {
  width: 100%;
  padding: 11px 40px 11px 40px;
  background: #1e2d3a;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  color: #e5e7eb;
  font-size: 14px;
  font-family: 'Nunito', sans-serif;
  outline: none;
  transition: border-color 0.2s;
}
.login-input-wrap input:focus {
  border-color: rgba(42,157,143,0.6);
  background: #1a2733;
}
.login-input-wrap input::placeholder { color: #4b5563; }
.login-toggle-pass {
  position: absolute; right: 12px;
  background: none; border: none; cursor: pointer;
  color: #4b5563; padding: 4px;
  transition: color 0.2s;
}
.login-toggle-pass:hover { color: #9ca3af; }

.login-field--error .login-input-wrap input { border-color: rgba(239,68,68,0.5); }
.login-error-msg { font-size: 11px; color: #f87171; margin-top: 5px; display: block; }

/* Options */
.login-options { margin-bottom: 20px; }
.login-remember {
  display: flex; align-items: center; gap: 8px;
  cursor: pointer; font-size: 13px; color: #9ca3af;
}
.login-remember input[type="checkbox"] {
  accent-color: #2a9d8f;
  width: 14px; height: 14px;
}

/* Alert global */
.login-alert {
  display: flex; align-items: center; gap: 8px;
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.3);
  border-radius: 8px;
  padding: 10px 14px;
  color: #fca5a5;
  font-size: 13px;
  margin-bottom: 16px;
}

/* Button */
.login-btn {
  width: 100%;
  padding: 13px;
  background: #2a9d8f;
  border: none;
  border-radius: 10px;
  color: #fff;
  font-size: 14px; font-weight: 700;
  font-family: 'Nunito', sans-serif;
  cursor: pointer;
  transition: background 0.2s, transform 0.1s;
  display: flex; align-items: center; justify-content: center; gap: 8px;
}
.login-btn:hover:not(:disabled) { background: #21867a; }
.login-btn:active:not(:disabled) { transform: scale(0.98); }
.login-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.login-btn__spinner {
  width: 18px; height: 18px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Footer */
.login-footer {
  text-align: center;
  margin-top: 24px;
  font-size: 11px; color: #374151;
}
</style>
