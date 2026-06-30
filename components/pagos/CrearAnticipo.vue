<template>
  <div class="ant-overlay" @click.self="$emit('close')">
    <div class="ant-modal">
      <div class="ant-header">
        <h2>Crear anticipo</h2>
        <button class="ant-close" @click="$emit('close')">×</button>
      </div>

      <div class="ant-body">
        <p class="ant-info">
          El anticipo se descontará automáticamente al generar la liquidación del mes seleccionado.
        </p>

        <div class="ant-field">
          <label>Trabajador</label>
          <select v-model="form.trabajador_id">
            <option value="">— Selecciona —</option>
            <option v-for="t in trabajadores" :key="t._id" :value="t._id">
              {{ nombreCompleto(t) }}
            </option>
          </select>
        </div>

        <div class="ant-row">
          <div class="ant-field">
            <label>Mes</label>
            <select v-model.number="form.mes">
              <option v-for="m in mesesOpts" :key="m.v" :value="m.v">{{ m.l }}</option>
            </select>
          </div>
          <div class="ant-field">
            <label>Año</label>
            <input type="number" v-model.number="form.anio" min="2020" max="2100" />
          </div>
          <div class="ant-field">
            <label>Fecha de pago</label>
            <input type="date" v-model="form.fecha" />
          </div>
        </div>

        <div class="ant-field">
          <label>Monto</label>
          <input type="number" v-model.number="form.monto" min="0" step="1000" placeholder="0" />
          <small v-if="form.monto > 0" class="ant-preview">{{ formatCLP(form.monto) }}</small>
        </div>

        <div class="ant-field">
          <label>Motivo (opcional)</label>
          <textarea v-model="form.motivo" rows="2" placeholder="Adelanto solicitado…"></textarea>
        </div>

        <div v-if="error" class="ant-error">{{ error }}</div>
      </div>

      <div class="ant-footer">
        <button class="ant-btn ant-btn--ghost" @click="$emit('close')">Cancelar</button>
        <button class="ant-btn ant-btn--primary" :disabled="!puedeGuardar || guardando" @click="guardar">
          {{ guardando ? 'Guardando…' : 'Crear anticipo' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  mes:          { type: Number, required: true },
  anio:         { type: Number, required: true },
  trabajadores: { type: Array,  default: () => [] },
})
const emit = defineEmits(['close', 'creado'])

const mesesOpts = [
  { v: 1, l: 'Enero' }, { v: 2, l: 'Febrero' }, { v: 3, l: 'Marzo' },
  { v: 4, l: 'Abril' }, { v: 5, l: 'Mayo' }, { v: 6, l: 'Junio' },
  { v: 7, l: 'Julio' }, { v: 8, l: 'Agosto' }, { v: 9, l: 'Septiembre' },
  { v: 10, l: 'Octubre' }, { v: 11, l: 'Noviembre' }, { v: 12, l: 'Diciembre' },
]

const form = ref({
  trabajador_id: '',
  mes:           props.mes,
  anio:          props.anio,
  fecha:         new Date().toISOString().slice(0, 10),
  monto:         0,
  motivo:        '',
})

const guardando = ref(false)
const error     = ref('')

function authHeaders() {
  if (typeof localStorage === 'undefined') return {}
  try {
    const s = JSON.parse(localStorage.getItem('rrhh_session') || '{}')
    return s?.token ? { Authorization: `Bearer ${s.token}` } : {}
  } catch { return {} }
}

const puedeGuardar = computed(() =>
  !!form.value.trabajador_id && form.value.monto > 0 && form.value.mes && form.value.anio
)

async function guardar() {
  error.value     = ''
  guardando.value = true
  try {
    await $fetch('/api/rrhh/anticipos', {
      method: 'POST',
      headers: authHeaders(),
      body: form.value,
    })
    emit('creado')
  } catch (e) {
    error.value = e?.data?.message || 'No se pudo crear el anticipo'
  } finally {
    guardando.value = false
  }
}

function nombreCompleto(t) {
  return [t.nombre, t.apellido, t.apellido_paterno, t.apellido_materno].filter(Boolean).join(' ')
}

function formatCLP(n) {
  return '$' + Math.round(Number(n) || 0).toLocaleString('es-CL')
}
</script>

<style scoped>
.ant-overlay {
  position: fixed; inset: 0;
  background: rgba(7,17,26,0.78);
  backdrop-filter: blur(6px);
  z-index: 10000;
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
}
.ant-modal {
  background: #0f1a26;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  width: 100%; max-width: 480px;
  display: flex; flex-direction: column;
}
.ant-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 22px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.ant-header h2 {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 18px; font-weight: 700;
  color: #f3f4f6;
  margin: 0;
}
.ant-close {
  background: none; border: none; color: #9ca3af;
  font-size: 26px; cursor: pointer; line-height: 1;
}

.ant-body {
  padding: 20px 22px;
  display: flex; flex-direction: column; gap: 14px;
}
.ant-info {
  font-size: 12px;
  color: #9ca3af;
  background: rgba(245,200,66,0.08);
  border: 1px solid rgba(245,200,66,0.25);
  border-radius: 6px;
  padding: 8px 12px;
  margin: 0;
}
.ant-field {
  display: flex; flex-direction: column; gap: 5px;
}
.ant-field label {
  font-size: 11px;
  font-family: 'Space Grotesk', sans-serif;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 600;
}
.ant-field input,
.ant-field select,
.ant-field textarea {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  padding: 9px 11px;
  color: #f3f4f6;
  font-family: inherit;
  font-size: 14px;
}
.ant-field textarea { resize: vertical; min-height: 60px; }
.ant-row { display: grid; grid-template-columns: 1fr 100px 1fr; gap: 10px; }
.ant-preview { color: #0DCFA8; font-size: 12px; font-weight: 600; }

.ant-error {
  background: rgba(239,68,68,0.12);
  border: 1px solid rgba(239,68,68,0.3);
  color: #f87171;
  font-size: 12px;
  padding: 8px 12px;
  border-radius: 6px;
}

.ant-footer {
  display: flex; gap: 8px; justify-content: flex-end;
  padding: 14px 22px;
  border-top: 1px solid rgba(255,255,255,0.06);
}
.ant-btn {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 7px;
  padding: 9px 16px;
  color: #d1d5db;
  font-size: 13px; font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}
.ant-btn:hover { background: rgba(255,255,255,0.07); }
.ant-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.ant-btn--primary {
  background: #0DCFA8; color: #062D3A;
  border-color: #0DCFA8;
}
.ant-btn--primary:hover { background: #0aa688; }
.ant-btn--ghost { background: transparent; }
</style>
