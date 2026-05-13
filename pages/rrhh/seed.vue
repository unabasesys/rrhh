<template>
  <div style="padding:40px;font-family:sans-serif">
    <h2>Seeding data...</h2>
    <p>{{ status }}</p>
  </div>
</template>

<script setup>
const status = ref('Cargando...')

onMounted(() => {
  // Marcación de hoy para Vicente Espinoza (Productor)
  const marc = {
    _id: 'marc_ve_' + Date.now(),
    trabajador_id: 'w_1777968729877_1g8n7',
    fecha: '2026-05-05',
    entrada: '08:30',
    salida: '18:30',
    horas: 10,
    horas_extra: 2,
    atraso: 0,
    proyecto_nombre: 'Serie Patagonia 2026',
    tipo: 'normal',
    estado: 'confirmada'
  }
  const key = 'rrhh_marcaciones'
  const existing = JSON.parse(localStorage.getItem(key) || '[]')
  // Evitar duplicados
  const exists = existing.find(m => m.trabajador_id === marc.trabajador_id && m.fecha === marc.fecha)
  if (!exists) {
    existing.unshift(marc)
    localStorage.setItem(key, JSON.stringify(existing))
    status.value = '✅ Marcación agregada. Redirigiendo...'
  } else {
    status.value = '⚠️ Ya existe marcación para hoy. Redirigiendo...'
  }
  setTimeout(() => navigateTo('/rrhh/asistencia/marcaciones'), 1000)
})
</script>
