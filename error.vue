<template>
  <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#111827;color:#f3f4f6;font-family:'Nunito',sans-serif;gap:16px;padding:40px">
    <div style="font-size:48px">⚠️</div>
    <h1 style="font-size:24px;font-weight:700;margin:0;color:#f3f4f6">Algo salió mal</h1>
    <p style="color:#9ca3af;font-size:14px;text-align:center;max-width:400px;margin:0">
      {{ error?.message || 'Error inesperado en la aplicación.' }}
    </p>
    <p v-if="error?.statusCode" style="color:#6b7280;font-size:12px;margin:0">
      Código: {{ error.statusCode }}
    </p>
    <button
      @click="handleError"
      style="margin-top:16px;padding:10px 24px;background:#3ac7a5;color:#0a1218;border:none;border-radius:8px;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit"
    >
      Volver a intentar
    </button>
  </div>
</template>

<script setup>
const props = defineProps({ error: Object })
const handleError = () => clearError({ redirect: '/rrhh/trabajadores' })
</script>
