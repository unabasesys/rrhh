<template>
  <div class="mi-perfil-page">
    <div class="card">
      <div class="card-header">
        <i class="u u-usuarios" style="font-size:32px;color:#0DCFA8"></i>
        <h1>Hola{{ userName ? `, ${userName}` : '' }}</h1>
      </div>

      <p class="lead">
        Tu acceso es como <strong>trabajador</strong>. Aquí podrás ver tu perfil,
        liquidaciones, marcaciones y documentos personales.
      </p>

      <div v-if="loadingTrabajador" class="state">
        <div class="spinner"></div>
        <p>Cargando tus datos…</p>
      </div>

      <div v-else-if="trabajadorToken" class="state">
        <p>Tu portal de marcaciones está listo:</p>
        <a class="btn btn--primary" :href="`/portal/trabajador/${trabajadorToken}`">
          <i class="u u-check"></i> Ir a mi portal de marcaciones
        </a>
      </div>

      <div v-else class="state state--info">
        <i class="u u-warning" style="font-size:24px;color:#f59e0b"></i>
        <p>
          Tu cuenta aún no está vinculada a una ficha de trabajador.
          Solicita a tu empleador que te envíe el link de tu portal personal.
        </p>
      </div>

      <button class="btn btn--secondary" @click="handleLogout">
        <i class="u u-logout"></i> Cerrar sesión
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

definePageMeta({ layout: false })

const userName         = ref('')
const trabajadorToken  = ref(null)
const loadingTrabajador = ref(false)

onMounted(async () => {
  try {
    const raw = localStorage.getItem('rrhh_session')
    if (!raw) return navigateTo('/login')
    const session = JSON.parse(raw)
    if (!session.token) return navigateTo('/login')

    // Traer perfil para tener nombre y trabajador_id
    loadingTrabajador.value = true
    const me = await $fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${session.token}` },
    }).catch(() => null)

    if (me?.user) {
      userName.value = me.user.nombre || ''
      if (me.user.trabajador_id) {
        // Pedir token del portal (si la API existe) — fallback: usar trabajador_id como token
        trabajadorToken.value = me.user.trabajador_id
      }
    }
  } finally {
    loadingTrabajador.value = false
  }
})

async function handleLogout() {
  const raw = localStorage.getItem('rrhh_session')
  if (raw) {
    try {
      const session = JSON.parse(raw)
      await $fetch('/api/auth/logout', {
        method:  'POST',
        headers: { Authorization: `Bearer ${session.token}` },
      }).catch(() => {})
    } catch {}
  }
  localStorage.removeItem('rrhh_session')
  return navigateTo('/login')
}
</script>

<style scoped>
.mi-perfil-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #062D3A 0%, #0a3f52 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 32px;
  max-width: 480px;
  width: 100%;
  color: #e5e7eb;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}
.card-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 20px;
}
.card-header h1 {
  font-size: 22px;
  font-weight: 700;
  margin: 0;
}
.lead {
  color: #cbd5e1;
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 24px;
}
.state {
  padding: 20px;
  border-radius: 10px;
  background: rgba(13, 207, 168, 0.08);
  border: 1px solid rgba(13, 207, 168, 0.2);
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
}
.state--info {
  background: rgba(245, 158, 11, 0.08);
  border-color: rgba(245, 158, 11, 0.25);
}
.state p {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
}
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px 18px;
  border-radius: 10px;
  font-weight: 600;
  font-size: 14px;
  text-decoration: none;
  cursor: pointer;
  border: none;
  transition: opacity 0.15s ease;
}
.btn:hover { opacity: 0.9; }
.btn--primary {
  background: #0DCFA8;
  color: #062D3A;
}
.btn--secondary {
  width: 100%;
  background: rgba(255, 255, 255, 0.06);
  color: #e5e7eb;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid rgba(13, 207, 168, 0.2);
  border-top-color: #0DCFA8;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
