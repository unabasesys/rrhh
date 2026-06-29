<template>
  <div class="login-page">
    <div class="card">
      <!-- Panel izquierdo: bienvenida -->
      <div class="illus-panel">
        <div class="slide-logo">
          <img src="/img/logo-unabase-white.png" alt="unabase personas" />
          <span class="app-name">Personas</span>
        </div>

        <div class="slide-content">
          <div class="slide-text">
            <p class="slide-quote">"Empieza con datos demo. Configura tu empresa real cuando estés listo."</p>
            <p class="slide-author">unabase · onboarding</p>
          </div>
        </div>
      </div>

      <!-- Form derecha -->
      <div class="login-form">
        <h2 class="title">Crear cuenta</h2>
        <span class="subtitle">Te pondremos a probar el módulo con datos demo en segundos</span>

        <form @submit.prevent="handleRegister">
          <div class="field">
            <label for="r-nombre">Nombre completo</label>
            <input id="r-nombre" v-model="form.nombre" type="text" placeholder="Tu nombre" autocomplete="name" autofocus required />
          </div>

          <div class="field">
            <label for="r-email">Correo electrónico</label>
            <input id="r-email" v-model="form.email" type="email" placeholder="tucorreo@empresa.cl" autocomplete="email" required />
          </div>

          <div class="field">
            <label for="r-pass">Contraseña</label>
            <div class="input-wrap">
              <input
                id="r-pass"
                v-model="form.password"
                :type="showPass ? 'text' : 'password'"
                placeholder="Mínimo 8 caracteres"
                autocomplete="new-password"
                required
              />
              <button type="button" class="eye-btn" @click="showPass = !showPass">
                <svg v-if="showPass" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
            </div>
          </div>

          <div v-if="error" class="alert-error">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke="#f87171" stroke-width="1.5"/>
              <path d="M7 4v3M7 9.5v.5" stroke="#f87171" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <span>{{ error }}</span>
          </div>

          <button type="submit" class="sign-in-btn" :disabled="loading">
            <span v-if="loading" class="btn-spinner"></span>
            <span>{{ loading ? 'Creando cuenta...' : 'Crear cuenta y entrar' }}</span>
          </button>
        </form>

        <div class="form-footer">
          <span class="form-footer-text">¿Ya tienes cuenta?</span>
          <a class="form-footer-link" @click.prevent="$router.push('/login')">Inicia sesión aquí</a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'

definePageMeta({ layout: false, middleware: 'no-auth' })

const router  = useRouter()
const form    = reactive({ nombre: '', email: '', password: '' })
const error   = ref('')
const loading = ref(false)
const showPass = ref(false)

async function handleRegister() {
  error.value = ''
  if (!form.nombre.trim() || !form.email.trim() || form.password.length < 8) {
    error.value = 'Completa todos los campos (contraseña mín. 8 caracteres)'
    return
  }
  loading.value = true
  try {
    const data = await $fetch('/api/auth/register', {
      method: 'POST',
      body: {
        nombre:   form.nombre.trim(),
        email:    form.email.trim().toLowerCase(),
        password: form.password,
      },
    })
    // Persistir la sesión + org demo pre-seleccionada
    localStorage.setItem('rrhh_session', JSON.stringify({
      token:        data.token,
      expires:      data.expires,
      currentOrgId: data.currentOrgId || null,
    }))
    // Llevar al home
    router.replace('/rrhh/home')
  } catch (e) {
    error.value = e?.data?.message || e?.message || 'No se pudo crear la cuenta'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter+Tight:wght@300;400;500;600;700&display=swap');

* { box-sizing: border-box; }

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

.card {
  background-color: #111d2e;
  box-shadow: 0 24px 60px rgba(0,0,0,0.6);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 24px;
  overflow: hidden;
  width: 820px;
  height: 620px;
  display: grid;
  grid-template-columns: 1fr 360px;
}

.illus-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 28px;
  background: #071e2b;
  border-right: 1px solid rgba(255,255,255,0.05);
}

.slide-logo { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
.slide-logo img { height: 28px; width: auto; display: block; opacity: 0.95; }
.app-name {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 17px; font-weight: 500;
  color: rgba(255,255,255,0.55);
  letter-spacing: 0.01em;
}

.slide-content { margin-top: auto; }
.slide-quote {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 22px; font-weight: 600;
  color: #ffffff; line-height: 1.35;
  letter-spacing: -0.01em;
  margin: 0 0 16px;
}
.slide-author { font-size: 13px; color: rgba(255,255,255,0.5); margin: 0; }

.login-form {
  display: flex;
  flex-direction: column;
  padding: 36px 36px 28px 24px;
}

.title {
  color: #F5F0E6;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 32px; line-height: 1.1; font-weight: 700;
  margin: 0 0 6px; letter-spacing: -0.02em;
}
.subtitle { color: rgba(245,240,230,0.5); font-size: 14px; line-height: 1.4; }

form { display: flex; flex-direction: column; gap: 16px; margin-top: 16px; }

.field { display: flex; flex-direction: column; gap: 6px; }
.field label {
  color: rgba(245,240,230,0.75);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 11px; font-weight: 600;
  line-height: 1.4; letter-spacing: 0.06em;
  text-transform: uppercase;
}
.field input {
  height: 44px; width: 100%;
  padding: 0 16px;
  border-radius: 14px;
  border: 1px solid rgba(245,240,230,0.12);
  background: rgba(245,240,230,0.05);
  color: #F5F0E6;
  font-size: 14px; font-family: inherit;
  outline: none;
}
.field input::placeholder { color: rgba(245,240,230,0.3); }
.field input:focus {
  border-color: #0DCFA8;
  background: rgba(245,240,230,0.07);
  box-shadow: 0 0 0 3px rgba(13,207,168,0.18);
}

.input-wrap { position: relative; }
.input-wrap input { padding-right: 48px; }
.eye-btn {
  position: absolute;
  right: 10px; top: 50%;
  transform: translateY(-50%);
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  background: none; border: none;
  color: rgba(245,240,230,0.4);
  cursor: pointer; padding: 0;
}
.eye-btn:hover { color: rgba(245,240,230,0.75); }

.alert-error {
  display: flex; align-items: center; gap: 8px;
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.3);
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 13px; color: #fca5a5;
}

.sign-in-btn {
  background-color: #0DCFA8; color: #062D3A;
  height: 48px; padding: 0 24px;
  border: none; border-radius: 16px;
  width: 100%;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 15px; font-weight: 600;
  letter-spacing: 0.01em; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  gap: 10px;
  box-shadow: 0 8px 24px rgba(13,207,168,0.25);
  transition: background 0.2s;
}
.sign-in-btn:not(:disabled):hover { background-color: #15dab3; }
.sign-in-btn:disabled { background-color: rgba(13,207,168,0.4); color: rgba(6,45,58,0.6); cursor: not-allowed; }

.btn-spinner {
  width: 16px; height: 16px;
  border: 2px solid rgba(6,45,58,0.3);
  border-top-color: #062D3A;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.form-footer {
  display: flex; align-items: center; gap: 6px;
  margin-top: 18px; font-size: 13px;
}
.form-footer-text { color: rgba(245,240,230,0.45); }
.form-footer-link {
  color: #0DCFA8;
  font-weight: 600;
  text-decoration: none;
  font-family: 'Space Grotesk', sans-serif;
  cursor: pointer;
}
.form-footer-link:hover { opacity: 0.8; }

@media (max-width: 850px) {
  .card { grid-template-columns: 1fr; width: 480px; height: auto; min-height: 560px; }
  .illus-panel { display: none; }
  .login-form { padding: 32px 28px 24px; }
}
@media (max-width: 560px) {
  .login-page { padding: 16px; }
  .card { width: 100%; max-width: 420px; }
}
</style>
