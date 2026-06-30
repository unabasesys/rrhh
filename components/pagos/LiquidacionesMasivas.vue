<template>
  <div class="lm-overlay" @click.self="$emit('close')">
    <div class="lm-modal">

      <!-- Header con pasos -->
      <div class="lm-header">
        <div class="lm-header__title">
          <h2>Liquidaciones masivas</h2>
          <span class="lm-period">{{ nombreMes }} {{ anio }}</span>
        </div>
        <div class="lm-steps">
          <span :class="{ active: paso === 'editar',  done: paso !== 'editar' }">1 · Editar</span>
          <span :class="{ active: paso === 'preview', done: paso === 'confirmar' }">2 · Preview</span>
          <span :class="{ active: paso === 'confirmar' }">3 · Confirmar</span>
        </div>
        <button class="lm-close" @click="$emit('close')">×</button>
      </div>

      <!-- ── PASO 1: Editar planilla ──────────────────────────────────── -->
      <div v-if="paso === 'editar'" class="lm-body lm-body--grid">
        <div class="lm-toolbar">
          <p class="lm-info">
            <strong>{{ filas.length }}</strong> trabajadores con contrato vigente —
            edita bonos y descuentos por persona. Los cálculos finales se ven en el preview.
          </p>
          <button class="lm-btn lm-btn--ghost" @click="aplicarMasivo">
            <i class="u u-agregar"></i> Aplicar a todos…
          </button>
        </div>

        <div class="lm-grid-wrap">
          <table class="lm-grid">
            <thead>
              <tr>
                <th class="col-trab">Trabajador</th>
                <th class="col-base">Sueldo Base</th>
                <th class="col-dias">Días</th>
                <th class="col-horas">H. extra</th>
                <th class="col-bono-tipo">Tipo bono</th>
                <th class="col-bono-monto">Monto bono</th>
                <th class="col-desc-tipo">Tipo descuento</th>
                <th class="col-desc-monto">Monto desc.</th>
                <th class="col-acciones"></th>
              </tr>
            </thead>
            <tbody>
              <template v-for="(fila, i) in filas" :key="fila.trabajador_id">
                <tr
                  v-for="(linea, j) in fila.lineas"
                  :key="j"
                  :class="[
                    `lm-row--zebra-${i % 2}`,
                    { 'lm-row--excluida': fila.excluida },
                    { 'lm-row--sub': j > 0 },
                    j === fila.lineas.length - 1 ? 'lm-row--last' : null,
                  ]"
                >
                  <!-- Primera línea: cabecera del trabajador con rowspan -->
                  <td v-if="j === 0" class="col-trab" :rowspan="fila.lineas.length">
                    <label class="lm-check">
                      <input type="checkbox" :checked="!fila.excluida" @change="fila.excluida = !fila.excluida" />
                      <div class="lm-trab-info">
                        <span class="lm-trab-nombre">{{ fila.nombre }}</span>
                        <span class="lm-trab-cargo">{{ fila.contrato?.cargo || '—' }}</span>
                      </div>
                    </label>
                  </td>
                  <td v-if="j === 0" class="col-base" :rowspan="fila.lineas.length">
                    {{ formatCLP(fila.contrato?.sueldo_base) }}
                  </td>
                  <td v-if="j === 0" :rowspan="fila.lineas.length">
                    <input type="number" v-model.number="fila.dias_trabajados" min="0" max="31" />
                  </td>
                  <td v-if="j === 0" :rowspan="fila.lineas.length">
                    <input type="number" v-model.number="fila.horas_extra" min="0" step="0.5" />
                  </td>

                  <!-- Tipo + monto de bono y descuento — por línea -->
                  <td class="col-bono-tipo">
                    <div class="lm-tipo-cell">
                      <select v-model="linea.bono_tipo" class="lm-tipo-select">
                        <option value="">—</option>
                        <option v-for="b in TIPOS_BONOS" :key="b.tipo" :value="b.tipo">{{ b.nombre }}</option>
                      </select>
                      <span v-if="linea.bono_tipo" class="lm-imp-chip" :class="bonoChipClass(linea.bono_tipo)">
                        {{ bonoEsImponible(linea.bono_tipo) ? 'Imp' : 'No imp' }}
                      </span>
                    </div>
                  </td>
                  <td>
                    <input type="number" v-model.number="linea.bono_monto" min="0" :disabled="!linea.bono_tipo" />
                  </td>
                  <td class="col-desc-tipo">
                    <select v-model="linea.descuento_tipo" class="lm-tipo-select">
                      <option value="">—</option>
                      <option v-for="d in TIPOS_DESCUENTOS" :key="d.tipo" :value="d.tipo">{{ d.nombre }}</option>
                    </select>
                  </td>
                  <td>
                    <input type="number" v-model.number="linea.descuento_monto" min="0" :disabled="!linea.descuento_tipo" />
                  </td>

                  <!-- Botones + / − para gestionar líneas -->
                  <td class="col-acciones">
                    <button
                      v-if="j === fila.lineas.length - 1"
                      class="lm-row-btn lm-row-btn--add"
                      title="Agregar otro bono/descuento"
                      @click="agregarLinea(fila)"
                    >＋</button>
                    <button
                      v-if="fila.lineas.length > 1 || linea.bono_tipo || linea.descuento_tipo"
                      class="lm-row-btn lm-row-btn--rm"
                      :title="fila.lineas.length > 1 ? 'Quitar esta línea' : 'Limpiar'"
                      @click="quitarLinea(fila, j)"
                    >−</button>
                  </td>
                </tr>
              </template>
              <tr v-if="!filas.length">
                <td colspan="9" class="lm-empty">
                  No hay trabajadores pendientes de liquidar para este mes.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ── PASO 2: Preview ──────────────────────────────────────────── -->
      <div v-else-if="paso === 'preview'" class="lm-body">
        <div class="lm-toolbar">
          <p class="lm-info">
            Previsualización de las {{ filasIncluidas.length }} liquidaciones a generar.
            Revisa los montos antes de confirmar.
          </p>
        </div>

        <table class="lm-preview-table">
          <thead>
            <tr>
              <th>Trabajador</th>
              <th>Total haberes</th>
              <th>Descuentos</th>
              <th>Anticipos</th>
              <th>Líquido</th>
              <th>Costo empresa</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in preview" :key="p.trabajador_id">
              <td>
                <div class="lm-trab-nombre">{{ p.nombre }}</div>
                <div class="lm-trab-cargo">{{ p.contrato?.cargo }}</div>
                <!-- Chips de bonos y descuentos aplicados (solo si tiene) -->
                <div v-if="p.bonos.length || p.descuentos.length" class="lm-prev-chips">
                  <span
                    v-for="(b, k) in p.bonos"
                    :key="'b' + k"
                    class="lm-prev-chip"
                    :class="b.imponible ? 'lm-prev-chip--imp' : 'lm-prev-chip--no-imp'"
                    :title="(b.imponible ? 'Imponible' : 'No imponible') + ' — ' + formatCLP(b.monto)"
                  >
                    <span class="lm-prev-chip__name">{{ b.nombre }}</span>
                    <span class="lm-prev-chip__amt">+{{ formatCLP(b.monto) }}</span>
                  </span>
                  <span
                    v-for="(d, k) in p.descuentos"
                    :key="'d' + k"
                    class="lm-prev-chip lm-prev-chip--desc"
                    :title="'Descuento — ' + formatCLP(d.monto)"
                  >
                    <span class="lm-prev-chip__name">{{ d.nombre }}</span>
                    <span class="lm-prev-chip__amt">−{{ formatCLP(d.monto) }}</span>
                  </span>
                </div>
              </td>
              <td>{{ formatCLP(p.calc.total_haberes) }}</td>
              <td class="neg">−{{ formatCLP(p.calc.total_descuentos) }}</td>
              <td class="neg">{{ p.anticipos > 0 ? '−' + formatCLP(p.anticipos) : '—' }}</td>
              <td class="liquido">{{ formatCLP(p.liquido_final) }}</td>
              <td>{{ formatCLP(p.calc.costo_empresa) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td>Total ({{ preview.length }})</td>
              <td>{{ formatCLP(totalHaberes) }}</td>
              <td class="neg">−{{ formatCLP(totalDescuentos) }}</td>
              <td class="neg">−{{ formatCLP(totalAnticipos) }}</td>
              <td class="liquido">{{ formatCLP(totalLiquido) }}</td>
              <td>{{ formatCLP(totalCostoEmpresa) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- ── PASO 3: Confirmación ─────────────────────────────────────── -->
      <div v-else-if="paso === 'confirmar'" class="lm-body lm-body--center">
        <div v-if="generando">
          <div class="lm-spinner"></div>
          <p>Generando liquidaciones… {{ generadas }}/{{ preview.length }}</p>
        </div>
        <div v-else-if="resultadoFinal">
          <div class="lm-success">✓</div>
          <h3>¡{{ resultadoFinal.ok }} liquidaciones generadas!</h3>
          <p v-if="resultadoFinal.errores">{{ resultadoFinal.errores }} con errores</p>
          <p class="muted">Ahora aparecen en la lista del mes. Puedes enviar por email a cada persona desde su ficha.</p>
        </div>
      </div>

      <!-- ── Footer con botones ───────────────────────────────────────── -->
      <div class="lm-footer">
        <button v-if="paso === 'editar'" class="lm-btn lm-btn--ghost" @click="$emit('close')">Cancelar</button>
        <button v-if="paso === 'preview'" class="lm-btn lm-btn--ghost" @click="paso = 'editar'">← Volver a editar</button>
        <button v-if="paso === 'confirmar' && resultadoFinal" class="lm-btn lm-btn--primary" @click="$emit('generadas')">Cerrar</button>
        <div class="lm-spacer"></div>

        <button v-if="paso === 'editar'" class="lm-btn lm-btn--primary" :disabled="!filasIncluidas.length" @click="irAPreview">
          Calcular preview →
        </button>
        <button v-if="paso === 'preview'" class="lm-btn lm-btn--ghost" @click="descargarPreviewPdf">
          Descargar preview PDF
        </button>
        <button v-if="paso === 'preview'" class="lm-btn lm-btn--primary" @click="confirmar">
          Generar {{ preview.length }} liquidaciones →
        </button>
      </div>

      <!-- ── Modal "Aplicar a todos" ────────────────────────────────────── -->
      <div v-if="showMasivoForm" class="lm-mini-overlay" @click.self="showMasivoForm = false">
        <div class="lm-mini">
          <h3>Aplicar a todos los seleccionados</h3>
          <p class="muted">Sobrescribe el bono y/o descuento de cada fila. Deja en blanco lo que no quieras cambiar.</p>
          <div class="lm-mini-grid">
            <label>
              <span>Tipo de bono</span>
              <select v-model="masivo.bono_tipo">
                <option value="">— No cambiar —</option>
                <option v-for="b in TIPOS_BONOS" :key="b.tipo" :value="b.tipo">{{ b.nombre }}</option>
              </select>
            </label>
            <label>
              <span>Monto bono</span>
              <input type="number" v-model.number="masivo.bono_monto" />
            </label>
            <label>
              <span>Tipo de descuento</span>
              <select v-model="masivo.descuento_tipo">
                <option value="">— No cambiar —</option>
                <option v-for="d in TIPOS_DESCUENTOS" :key="d.tipo" :value="d.tipo">{{ d.nombre }}</option>
              </select>
            </label>
            <label>
              <span>Monto descuento</span>
              <input type="number" v-model.number="masivo.descuento_monto" />
            </label>
          </div>
          <div class="lm-mini-actions">
            <button class="lm-btn lm-btn--ghost" @click="showMasivoForm = false">Cancelar</button>
            <button class="lm-btn lm-btn--primary" @click="aplicarMasivoConfirm">Aplicar</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { calcularLiquidacion, TIPOS_BONOS, TIPOS_DESCUENTOS } from '@/stores/rrhh'
import { useIndicadoresStore } from '@/stores/indicadores'

const props = defineProps({
  mes:          { type: Number, required: true },
  anio:         { type: Number, required: true },
  trabajadores: { type: Array,  default: () => [] },
})
const emit = defineEmits(['close', 'generadas'])

const indicadores = useIndicadoresStore()

const meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const nombreMes = computed(() => meses[props.mes] || '')

const paso = ref('editar')   // 'editar' | 'preview' | 'confirmar'

const filas = ref([])
const anticiposPorTrabajador = ref({})

function authHeaders() {
  if (typeof localStorage === 'undefined') return {}
  try {
    const s = JSON.parse(localStorage.getItem('rrhh_session') || '{}')
    return s?.token ? { Authorization: `Bearer ${s.token}` } : {}
  } catch { return {} }
}

onMounted(async () => {
  // Asegurar que indicadores estén cargados (para calcularLiquidacion)
  if (!indicadores.afp_actual && indicadores.initIfEmpty) indicadores.initIfEmpty()

  // Cargar anticipos del mes para descontarlos en el preview
  try {
    const data = await $fetch(`/api/rrhh/anticipos?mes=${props.mes}&anio=${props.anio}`, { headers: authHeaders() })
    const map = {}
    for (const a of (data || [])) {
      map[a.trabajador_id] = (map[a.trabajador_id] || 0) + Number(a.monto || 0)
    }
    anticiposPorTrabajador.value = map
  } catch { anticiposPorTrabajador.value = {} }

  // Build filas — cada trabajador tiene un arreglo de "lineas" donde cada
  // línea es un par bono+descuento. Por default arranca con 1 línea vacía;
  // el usuario agrega/quita con los botones + / − en cada fila.
  filas.value = props.trabajadores.map(t => ({
    trabajador_id:    t._id,
    nombre:           [t.nombre, t.apellido, t.apellido_paterno, t.apellido_materno].filter(Boolean).join(' '),
    contrato:         t.contrato,
    excluida:         false,
    dias_trabajados:  30,
    horas_extra:      0,
    lineas:           [nuevaLinea()],
  }))
})

function nuevaLinea() {
  return { bono_tipo: '', bono_monto: 0, descuento_tipo: '', descuento_monto: 0 }
}
function agregarLinea(fila) {
  fila.lineas.push(nuevaLinea())
}
function quitarLinea(fila, idx) {
  if (fila.lineas.length > 1) fila.lineas.splice(idx, 1)
  else fila.lineas[0] = nuevaLinea()   // si era la única, la "limpia"
}

// Helpers de tipos
function bonoEsImponible(tipo) {
  return TIPOS_BONOS.find(b => b.tipo === tipo)?.imponible ?? false
}
function bonoNombre(tipo) {
  return TIPOS_BONOS.find(b => b.tipo === tipo)?.nombre || tipo
}
function descuentoNombre(tipo) {
  return TIPOS_DESCUENTOS.find(d => d.tipo === tipo)?.nombre || tipo
}
function bonoChipClass(tipo) {
  return bonoEsImponible(tipo) ? 'lm-imp-chip--imp' : 'lm-imp-chip--no-imp'
}

const filasIncluidas = computed(() => filas.value.filter(f => !f.excluida))

const preview = computed(() => filasIncluidas.value.map(f => {
  // Aplanar todas las líneas en arreglos de bonos y descuentos para el
  // motor de cálculo de liquidación.
  const bonos = []
  const descuentos = []
  for (const linea of (f.lineas || [])) {
    if (linea.bono_tipo && linea.bono_monto > 0) {
      bonos.push({
        tipo:      linea.bono_tipo,
        nombre:    bonoNombre(linea.bono_tipo),
        monto:     linea.bono_monto,
        imponible: bonoEsImponible(linea.bono_tipo),
      })
    }
    if (linea.descuento_tipo && linea.descuento_monto > 0) {
      descuentos.push({
        tipo:   linea.descuento_tipo,
        nombre: descuentoNombre(linea.descuento_tipo),
        monto:  linea.descuento_monto,
      })
    }
  }

  // calcularLiquidacion devuelve keys en camelCase (totalHaberes, etc.) —
  // las normalizamos a snake_case para que el resto del componente y el
  // POST a /api/rrhh/liquidaciones consuman la misma forma.
  let raw = {}
  try {
    raw = calcularLiquidacion({
      sueldo_base:     f.contrato?.sueldo_base || 0,
      afp:             f.contrato?.afp,
      sistema_salud:   f.contrato?.sistema_salud,
      tipo_contrato:   f.contrato?.tipo_contrato || 'indefinido',
      gratificacion:   f.contrato?.gratificacion || 'mensual',
      dias_trabajados: f.dias_trabajados,
      horas_extra:     f.horas_extra,
      bonos,
      descuentos,
    }) || {}
  } catch (e) {
    console.error('Error calculando liquidacion para', f.nombre, e)
    raw = {}
  }
  const calc = {
    total_haberes:        raw.totalHaberes        ?? 0,
    total_descuentos:     raw.totalDescuentos     ?? 0,
    liquido_a_pagar:      raw.liquidoAPagar       ?? 0,
    costo_empresa:        raw.costoEmpresa        ?? 0,
    afp_descuento:        raw.afp_descuento       ?? 0,
    salud_descuento:      raw.salud_descuento     ?? 0,
    cesantia_trabajador:  raw.cesantia_trabajador ?? 0,
    cesantia_empleador:   raw.cesantia_empleador  ?? 0,
    impuesto:             raw.impuesto            ?? 0,
    renta_imponible:      raw.rentaImponible      ?? 0,
    renta_tributable:     raw.rentaTributable     ?? 0,
  }
  const anticipos = anticiposPorTrabajador.value[f.trabajador_id] || 0
  const liquidoFinal = Math.max(0, calc.liquido_a_pagar - anticipos)
  return {
    trabajador_id: f.trabajador_id,
    nombre:        f.nombre,
    contrato:      f.contrato,
    fila:          f,
    calc,
    anticipos,
    liquido_final: liquidoFinal,
    bonos,
    descuentos,
  }
}))

const totalHaberes      = computed(() => preview.value.reduce((s, p) => s + (p.calc.total_haberes    || 0), 0))
const totalDescuentos   = computed(() => preview.value.reduce((s, p) => s + (p.calc.total_descuentos || 0), 0))
const totalAnticipos    = computed(() => preview.value.reduce((s, p) => s + (p.anticipos || 0), 0))
const totalLiquido      = computed(() => preview.value.reduce((s, p) => s + (p.liquido_final || 0), 0))
const totalCostoEmpresa = computed(() => preview.value.reduce((s, p) => s + (p.calc.costo_empresa || 0), 0))

function irAPreview() { paso.value = 'preview' }

// ── Aplicar masivamente ───────────────────────────────────────────────
const showMasivoForm = ref(false)
const masivo = ref({ bono_tipo: '', bono_monto: 0, descuento_tipo: '', descuento_monto: 0 })

function aplicarMasivo() { showMasivoForm.value = true }
function aplicarMasivoConfirm() {
  // Aplica los valores del masivo a la PRIMERA línea de cada fila.
  // Si la primera línea ya tenía datos, se sobrescribe.
  for (const f of filas.value) {
    if (f.excluida) continue
    if (!f.lineas || !f.lineas.length) f.lineas = [nuevaLinea()]
    const l = f.lineas[0]
    if (masivo.value.bono_tipo) {
      l.bono_tipo  = masivo.value.bono_tipo
      l.bono_monto = masivo.value.bono_monto || 0
    }
    if (masivo.value.descuento_tipo) {
      l.descuento_tipo  = masivo.value.descuento_tipo
      l.descuento_monto = masivo.value.descuento_monto || 0
    }
  }
  showMasivoForm.value = false
  masivo.value = { bono_tipo: '', bono_monto: 0, descuento_tipo: '', descuento_monto: 0 }
}

// ── Generación ────────────────────────────────────────────────────────
const generando = ref(false)
const generadas = ref(0)
const resultadoFinal = ref(null)

async function confirmar() {
  paso.value      = 'confirmar'
  generando.value = true
  generadas.value = 0
  let ok = 0, errores = 0

  for (const p of preview.value) {
    try {
      await $fetch('/api/rrhh/liquidaciones', {
        method: 'POST',
        headers: authHeaders(),
        body: {
          trabajador_id:        p.trabajador_id,
          trabajador_nombre:    p.nombre,
          mes:                  props.mes,
          anio:                 props.anio,
          dias_trabajados:      p.fila.dias_trabajados,
          horas_extra:          p.fila.horas_extra,
          sueldo_base:          p.contrato?.sueldo_base || 0,
          bonos:                p.bonos,
          descuentos:           p.descuentos,
          total_haberes:        p.calc.total_haberes,
          total_descuentos:     p.calc.total_descuentos,
          liquido_a_pagar:      p.liquido_final,
          costo_empresa:        p.calc.costo_empresa,
          afp_descuento:        p.calc.afp_descuento,
          salud_descuento:      p.calc.salud_descuento,
          cesantia_trabajador:  p.calc.cesantia_trabajador,
          cesantia_empleador:   p.calc.cesantia_empleador,
          impuesto:             p.calc.impuesto,
          renta_imponible:      p.calc.renta_imponible,
          renta_tributable:     p.calc.renta_tributable,
          anticipo_descontado:  p.anticipos,
          estado:               'pendiente',
          orgId:                p.contrato?.orgId,
        },
      })
      ok++
    } catch (e) {
      console.error('Error generando liquidacion', p.nombre, e)
      errores++
    }
    generadas.value++
  }

  resultadoFinal.value = { ok, errores }
  generando.value = false
}

function descargarPreviewPdf() {
  // Por ahora generamos un CSV imprimible; el PDF completo se puede sumar luego.
  const headers = ['Trabajador', 'Cargo', 'Sueldo base', 'Total haberes', 'Descuentos', 'Anticipos', 'Líquido', 'Costo empresa']
  const rows = preview.value.map(p => [
    p.nombre,
    p.contrato?.cargo || '',
    p.contrato?.sueldo_base || 0,
    p.calc.total_haberes || 0,
    p.calc.total_descuentos || 0,
    p.anticipos || 0,
    p.liquido_final || 0,
    p.calc.costo_empresa || 0,
  ])
  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `preview-liquidaciones-${props.mes}-${props.anio}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function formatCLP(n) {
  const v = Math.round(Number(n) || 0)
  return '$' + v.toLocaleString('es-CL')
}
</script>

<style scoped>
.lm-overlay {
  position: fixed; inset: 0;
  background: rgba(7, 17, 26, 0.78);
  backdrop-filter: blur(6px);
  z-index: 10000;
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
}
.lm-modal {
  background: #0f1a26;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px;
  width: 100%; max-width: 1200px;
  max-height: 92vh;
  display: flex; flex-direction: column;
  box-shadow: 0 24px 60px rgba(0,0,0,0.6);
}

/* Header */
.lm-header {
  display: flex; align-items: center; gap: 24px;
  padding: 16px 24px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.lm-header__title h2 {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 18px; font-weight: 700;
  margin: 0; color: #f3f4f6;
}
.lm-period {
  font-size: 12px;
  color: #9ca3af;
  background: rgba(13,207,168,0.08);
  border: 1px solid rgba(13,207,168,0.25);
  border-radius: 99px;
  padding: 2px 10px;
  margin-left: 10px;
}
.lm-steps {
  flex: 1;
  display: flex; gap: 14px; justify-content: center;
  font-size: 12px;
}
.lm-steps span {
  font-family: 'Space Grotesk', sans-serif;
  color: #6b7280;
  font-weight: 600;
}
.lm-steps span.active { color: #0DCFA8; }
.lm-steps span.done   { color: #9ca3af; }
.lm-close {
  background: none; border: none;
  color: #9ca3af;
  font-size: 28px; cursor: pointer;
  width: 32px; height: 32px;
  line-height: 1;
}
.lm-close:hover { color: #f3f4f6; }

/* Body */
.lm-body { flex: 1; overflow: auto; padding: 16px 24px; }
.lm-body--grid { padding: 0; }
.lm-body--center {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center;
  padding: 40px;
  min-height: 280px;
}
.lm-toolbar {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 24px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  gap: 14px;
  flex-wrap: wrap;
}
.lm-info {
  font-size: 13px; color: #9ca3af; margin: 0;
  line-height: 1.4;
}
.lm-info strong { color: #f3f4f6; }

/* Grid Excel-like */
.lm-grid-wrap { overflow: auto; max-height: 56vh; }
.lm-grid {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.lm-grid thead th {
  position: sticky; top: 0;
  background: #0a1420;
  color: #9ca3af;
  text-align: left;
  padding: 10px 12px;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 10px; font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  white-space: nowrap;
}
.lm-grid tbody td {
  padding: 4px 8px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  vertical-align: middle;
}
.lm-grid input[type="number"],
.lm-grid input[type="text"],
.lm-grid select {
  width: 100%;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 4px;
  padding: 6px 8px;
  color: #f3f4f6;
  font-size: 12px;
  font-family: inherit;
}
.lm-grid input:focus,
.lm-grid select:focus {
  outline: none;
  border-color: #0DCFA8;
  background: rgba(13,207,168,0.05);
}
.lm-grid input:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.col-trab       { min-width: 200px; }
.col-base       { color: #d1d5db; font-weight: 500; }
.col-dias       { width: 70px; }
.col-horas      { width: 70px; }
.col-bono-tipo  { min-width: 180px; }
.col-bono-monto { width: 110px; }
.col-desc-tipo  { min-width: 170px; }
.col-desc-monto { width: 110px; }

.lm-tipo-cell {
  display: flex; align-items: center; gap: 6px;
}
.lm-tipo-select { flex: 1; min-width: 0; }
.lm-imp-chip {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 9px; font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 99px;
  flex-shrink: 0;
}
.lm-imp-chip--imp    { background: rgba(74,163,255,0.12); color: #4AA3FF; border: 1px solid rgba(74,163,255,0.3); }
.lm-imp-chip--no-imp { background: rgba(245,200,66,0.12); color: #F5C842; border: 1px solid rgba(245,200,66,0.3); }

/* Sub-rows: líneas adicionales del mismo trabajador, sin separador grueso */
.lm-row--sub td { border-bottom-color: rgba(255,255,255,0.025); }
.lm-row--last td { border-bottom: 1px solid rgba(255,255,255,0.08); }
:root.light-theme .lm-row--sub td  { border-bottom-color: #f8fafc; }
:root.light-theme .lm-row--last td { border-bottom-color: #e5e7eb; }

/* Zebra striping por bloque de trabajador (no por fila) — la clase la
   aplica el v-for usando el índice de la fila padre, así todas las
   líneas de un mismo trabajador comparten el mismo tono. */
.lm-row--zebra-0 td { background: transparent; }
.lm-row--zebra-1 td { background: rgba(255,255,255,0.02); }
:root.light-theme .lm-row--zebra-0 td { background: #ffffff; }
:root.light-theme .lm-row--zebra-1 td { background: #f8fafc; }

/* Botones + / − en la última columna */
.col-acciones { width: 70px; white-space: nowrap; text-align: right; padding-right: 12px; }
.lm-row-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px;
  border-radius: 6px;
  font-size: 14px; font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  margin-left: 4px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  color: #9ca3af;
  line-height: 1;
}
.lm-row-btn:hover { color: #f3f4f6; background: rgba(255,255,255,0.08); }
.lm-row-btn--add:hover { color: #0DCFA8; border-color: rgba(13,207,168,0.4); background: rgba(13,207,168,0.1); }
.lm-row-btn--rm:hover  { color: #f87171; border-color: rgba(239,68,68,0.4);  background: rgba(239,68,68,0.1); }
:root.light-theme .lm-row-btn {
  background: #f1f5f9;
  border-color: #e2e8f0;
  color: #64748b;
}
:root.light-theme .lm-row-btn:hover { background: #e2e8f0; color: #0f172a; }
:root.light-theme .lm-row-btn--add:hover { background: rgba(13,207,168,0.12); border-color: rgba(13,207,168,0.4); color: #0aa688; }
:root.light-theme .lm-row-btn--rm:hover  { background: rgba(239,68,68,0.10); border-color: rgba(239,68,68,0.4); color: #dc2626; }
.lm-row--excluida {
  opacity: 0.35;
}
.lm-row--excluida input { pointer-events: none; }
.lm-check {
  display: flex; align-items: center; gap: 8px;
  cursor: pointer;
}
.lm-check input { width: auto !important; flex-shrink: 0; }
.lm-trab-info { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.lm-trab-nombre { color: #f3f4f6; font-weight: 500; }
.lm-trab-cargo  { font-size: 10px; color: #9ca3af; }

.lm-empty {
  text-align: center;
  padding: 40px;
  color: #9ca3af;
}

/* Preview */
.lm-preview-table {
  width: 100%; border-collapse: collapse;
  font-size: 13px;
}
.lm-preview-table th {
  text-align: left;
  padding: 10px 12px;
  background: #0a1420;
  color: #9ca3af;
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.lm-preview-table td {
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.lm-preview-table tfoot td {
  border-top: 2px solid rgba(255,255,255,0.08);
  border-bottom: none;
  font-weight: 700;
  background: rgba(255,255,255,0.02);
}
.lm-preview-table .neg { color: #f87171; }
.lm-preview-table .liquido { color: #0DCFA8; font-weight: 700; }

/* Chips de bonos/descuentos en el preview, debajo del nombre del trabajador */
.lm-prev-chips {
  display: flex; flex-wrap: wrap; gap: 4px;
  margin-top: 6px;
}
.lm-prev-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 2px 8px;
  border-radius: 99px;
  font-size: 10px;
  font-family: 'Space Grotesk', sans-serif;
  border: 1px solid;
  line-height: 1.6;
}
.lm-prev-chip__name { font-weight: 600; }
.lm-prev-chip__amt  { font-weight: 700; opacity: 0.85; }

/* Bono imponible (azul) y no imponible (amarillo) */
.lm-prev-chip--imp {
  background: rgba(74,163,255,0.10);
  color: #4AA3FF;
  border-color: rgba(74,163,255,0.3);
}
.lm-prev-chip--no-imp {
  background: rgba(245,200,66,0.10);
  color: #F5C842;
  border-color: rgba(245,200,66,0.3);
}
/* Descuento (rojo) */
.lm-prev-chip--desc {
  background: rgba(239,68,68,0.10);
  color: #f87171;
  border-color: rgba(239,68,68,0.3);
}
:root.light-theme .lm-prev-chip--imp {
  background: rgba(74,163,255,0.08);
  color: #2563eb;
  border-color: rgba(74,163,255,0.4);
}
:root.light-theme .lm-prev-chip--no-imp {
  background: rgba(245,158,11,0.10);
  color: #b45309;
  border-color: rgba(245,158,11,0.35);
}
:root.light-theme .lm-prev-chip--desc {
  background: rgba(239,68,68,0.08);
  color: #dc2626;
  border-color: rgba(239,68,68,0.35);
}

/* Footer */
.lm-footer {
  display: flex; gap: 10px; align-items: center;
  padding: 14px 24px;
  border-top: 1px solid rgba(255,255,255,0.06);
}
.lm-spacer { flex: 1; }
.lm-btn {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  padding: 10px 16px;
  color: #d1d5db;
  font-size: 13px; font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  display: inline-flex; align-items: center; gap: 8px;
}
.lm-btn:hover { background: rgba(255,255,255,0.06); }
.lm-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.lm-btn--primary {
  background: #0DCFA8; color: #062D3A;
  border-color: #0DCFA8;
}
.lm-btn--primary:hover { background: #0aa688; }
.lm-btn--ghost { background: transparent; }

.lm-spinner {
  width: 48px; height: 48px;
  border: 3px solid rgba(255,255,255,0.1);
  border-top-color: #0DCFA8;
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
  margin: 0 auto 16px;
}
@keyframes spin { to { transform: rotate(360deg); } }

.lm-success {
  width: 64px; height: 64px;
  background: rgba(13,207,168,0.15);
  border: 2px solid #0DCFA8;
  border-radius: 50%;
  color: #0DCFA8;
  font-size: 32px;
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 14px;
}
.lm-body--center h3 { margin: 0 0 8px; color: #f3f4f6; font-size: 18px; }
.muted { color: #9ca3af; font-size: 13px; }

/* Mini modal "Aplicar a todos" */
.lm-mini-overlay {
  position: absolute; inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center;
  z-index: 10;
  border-radius: 14px;
}
.lm-mini {
  background: #111d2e;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  padding: 20px 24px;
  width: 480px;
  max-width: 90%;
}
.lm-mini h3 { margin: 0 0 4px; color: #f3f4f6; font-size: 16px; }
.lm-mini-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin: 12px 0;
}
.lm-mini-grid label {
  display: flex; flex-direction: column; gap: 4px;
}
.lm-mini-grid span {
  font-size: 11px; color: #9ca3af;
  text-transform: uppercase; letter-spacing: 0.04em;
}
.lm-mini-grid input,
.lm-mini-grid select {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  padding: 8px 10px;
  color: #f3f4f6;
  font-family: inherit;
}
.lm-mini-actions {
  display: flex; gap: 8px; justify-content: flex-end;
  margin-top: 12px;
}

/* ── Light theme overrides ─────────────────────────────────────────── */
:root.light-theme .lm-overlay {
  background: rgba(15, 23, 42, 0.55);
}
:root.light-theme .lm-modal {
  background: #ffffff;
  border-color: #e5e7eb;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.18);
}
:root.light-theme .lm-header,
:root.light-theme .lm-toolbar,
:root.light-theme .lm-footer {
  border-color: #e5e7eb;
}
:root.light-theme .lm-header__title h2 { color: #0f172a; }
:root.light-theme .lm-period {
  background: rgba(13,207,168,0.10);
  color: #0aa688;
  border-color: rgba(13,207,168,0.3);
}
:root.light-theme .lm-steps span        { color: #cbd5e1; }
:root.light-theme .lm-steps span.done   { color: #94a3b8; }
:root.light-theme .lm-steps span.active { color: #0aa688; }
:root.light-theme .lm-close { color: #64748b; }
:root.light-theme .lm-close:hover { color: #0f172a; }

:root.light-theme .lm-info { color: #64748b; }
:root.light-theme .lm-info strong { color: #0f172a; }

:root.light-theme .lm-grid thead th {
  background: #f8fafc;
  color: #64748b;
  border-bottom-color: #e5e7eb;
}
:root.light-theme .lm-grid tbody td   { border-bottom-color: #f1f5f9; }
:root.light-theme .lm-grid input[type="number"],
:root.light-theme .lm-grid input[type="text"],
:root.light-theme .lm-grid select {
  background: #ffffff;
  border-color: #d1d5db;
  color: #0f172a;
}
:root.light-theme .lm-grid input:focus,
:root.light-theme .lm-grid select:focus {
  background: rgba(13,207,168,0.04);
  border-color: #0DCFA8;
}
:root.light-theme .col-base       { color: #475569; }
:root.light-theme .lm-trab-nombre { color: #0f172a; }
:root.light-theme .lm-trab-cargo  { color: #94a3b8; }
:root.light-theme .lm-empty       { color: #94a3b8; }

:root.light-theme .lm-preview-table th {
  background: #f8fafc;
  color: #64748b;
}
:root.light-theme .lm-preview-table td  { border-bottom-color: #f1f5f9; }
:root.light-theme .lm-preview-table tfoot td {
  background: #f8fafc;
  border-top-color: #cbd5e1;
}

:root.light-theme .lm-btn {
  background: #f1f5f9;
  border-color: #e2e8f0;
  color: #334155;
}
:root.light-theme .lm-btn:hover    { background: #e2e8f0; }
:root.light-theme .lm-btn--ghost   { background: transparent; color: #475569; }
:root.light-theme .lm-btn--ghost:hover { background: #f1f5f9; }
:root.light-theme .lm-btn--primary { background: #0DCFA8; color: #062D3A; border-color: #0DCFA8; }
:root.light-theme .lm-btn--primary:hover { background: #0AB89A; border-color: #0AB89A; }

:root.light-theme .lm-body--center h3 { color: #0f172a; }
:root.light-theme .muted { color: #64748b; }

:root.light-theme .lm-mini {
  background: #ffffff;
  border-color: #e5e7eb;
}
:root.light-theme .lm-mini h3 { color: #0f172a; }
:root.light-theme .lm-mini-grid span { color: #64748b; }
:root.light-theme .lm-mini-grid input,
:root.light-theme .lm-mini-grid select {
  background: #ffffff;
  border-color: #d1d5db;
  color: #0f172a;
}
</style>
