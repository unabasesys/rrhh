<template>
  <div class="home-page">

    <!-- ── HERO: Bienvenida + Onboarding ──────────────────────────── -->
    <section class="hero">
      <div class="hero-content">
        <div class="hero-meta">
          <span class="dot"></span> DÍA {{ diaDeUso }} · {{ fechaHoy }}
        </div>
        <h1 class="hero-title">
          Bienvenido a<br>
          Unabase Personas{{ nombrePila ? `, ${nombrePila}` : '' }}.
        </h1>
        <p class="hero-lede">
          Tu equipo, tus contratos y tus liquidaciones, en un mismo lugar.
          {{ pasosFaltantes > 0 ? `${pasosFaltantes} ${pasosFaltantes === 1 ? 'paso te separa' : 'pasos te separan'} de tu primera liquidación.` : 'Tu cuenta está lista — explora todas las funciones.' }}
        </p>
        <div class="hero-cta">
          <button class="btn btn-primary" @click="irAlSiguientePaso">
            {{ pasosFaltantes > 0 ? 'Empezar onboarding' : 'Ir a Personas' }} →
          </button>
        </div>
      </div>

      <div class="onboarding-card">
        <div class="onb-header">
          <span class="onb-title">ONBOARDING</span>
          <span class="onb-percent">{{ porcentaje }}%</span>
        </div>
        <div class="onb-bar">
          <div class="onb-bar-fill" :style="{ width: porcentaje + '%' }"></div>
        </div>
        <ul class="onb-list">
          <li v-for="item in checklist" :key="item.id" class="onb-item" :class="{ done: item.done }">
            <span class="onb-check">
              <i v-if="item.done" class="u u-check"></i>
              <span v-else class="onb-pending"></span>
            </span>
            <span class="onb-label">{{ item.label }}</span>
            <span class="onb-meta">{{ item.meta }}</span>
          </li>
        </ul>
      </div>
    </section>

    <!-- ── COSTO EMPRESA POR MES ─────────────────────────────────── -->
    <section class="block">
      <div class="block-head">
        <div>
          <span class="block-kicker">01 COSTO EMPRESA · {{ anioActual }}</span>
          <h2 class="block-title">Costo total mensual por persona</h2>
        </div>
        <div class="costo-totales">
          <div class="costo-stat">
            <span class="costo-stat__label">Acumulado año</span>
            <span class="costo-stat__valor">{{ formatoCLP(totalAnio) }}</span>
          </div>
          <div class="costo-stat">
            <span class="costo-stat__label">Promedio mensual</span>
            <span class="costo-stat__valor">{{ formatoCLP(promedioMensual) }}</span>
          </div>
        </div>
      </div>

      <div class="costo-card">
        <div v-if="!datosChart.tieneData" class="costo-empty">
          <p>Aún no hay liquidaciones generadas para {{ anioActual }}.</p>
          <button class="btn btn-primary" @click="$router.push('/rrhh/liquidaciones')">
            Generar primera liquidación →
          </button>
        </div>

        <div v-else class="costo-chart-wrap">
          <svg :viewBox="`0 0 ${chartW} ${chartH}`" class="costo-chart" preserveAspectRatio="none">
            <!-- Grid horizontal -->
            <g class="grid">
              <line v-for="g in 4" :key="g"
                    :x1="paddingLeft" :x2="chartW - paddingRight"
                    :y1="paddingTop + ((chartH - paddingTop - paddingBottom) * g / 4)"
                    :y2="paddingTop + ((chartH - paddingTop - paddingBottom) * g / 4)" />
            </g>
            <!-- Eje Y labels -->
            <g class="axis-y">
              <text v-for="g in 5" :key="g"
                    :x="paddingLeft - 8"
                    :y="paddingTop + ((chartH - paddingTop - paddingBottom) * (g - 1) / 4) + 4"
                    text-anchor="end">
                {{ formatoCLPCorto(maxValor * (1 - (g - 1) / 4)) }}
              </text>
            </g>
            <!-- Barras apiladas -->
            <g v-for="(barra, mIdx) in datosChart.barras" :key="mIdx">
              <rect v-for="seg in barra.segmentos" :key="seg.trabajadorId"
                    :x="barra.x" :y="seg.y" :width="barWidth" :height="seg.h"
                    :fill="seg.color"
                    :data-tooltip="`${seg.nombre}: ${formatoCLP(seg.valor)}`"
                    @mouseenter="tooltipActivo = { x: barra.x + barWidth / 2, y: seg.y, label: `${seg.nombre} · ${barra.mesLabel}`, valor: seg.valor }"
                    @mouseleave="tooltipActivo = null" />
              <!-- Total mes encima de la barra -->
              <text v-if="barra.total > 0"
                    :x="barra.x + barWidth / 2"
                    :y="barra.topY - 6"
                    text-anchor="middle"
                    class="bar-total">
                {{ formatoCLPCorto(barra.total) }}
              </text>
            </g>
            <!-- Eje X labels -->
            <g class="axis-x">
              <text v-for="(barra, mIdx) in datosChart.barras" :key="mIdx"
                    :x="barra.x + barWidth / 2"
                    :y="chartH - paddingBottom + 18"
                    text-anchor="middle">
                {{ barra.mesLabel }}
              </text>
            </g>
          </svg>

          <!-- Tooltip flotante -->
          <div v-if="tooltipActivo" class="costo-tooltip"
               :style="{ left: `${(tooltipActivo.x / chartW) * 100}%`, top: `${(tooltipActivo.y / chartH) * 100}%` }">
            <div class="costo-tooltip__label">{{ tooltipActivo.label }}</div>
            <div class="costo-tooltip__valor">{{ formatoCLP(tooltipActivo.valor) }}</div>
          </div>
        </div>

        <!-- Leyenda -->
        <div v-if="datosChart.tieneData" class="costo-legend">
          <div v-for="t in datosChart.trabajadoresOrdenados" :key="t.id" class="costo-legend__item">
            <span class="costo-legend__dot" :style="{ background: t.color }"></span>
            <span class="costo-legend__nombre">{{ t.nombre }}</span>
            <span class="costo-legend__monto">{{ formatoCLP(t.totalAnio) }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ── ¿SABÍAS QUE...? ───────────────────────────────────────── -->
    <section class="block">
      <div class="block-head">
        <h2 class="block-title">¿Sabías que…?</h2>
        <div class="carousel-nav">
          <span class="carousel-counter">{{ tipPage + 1 }}/{{ totalTipPages }}</span>
          <button class="carousel-btn" :disabled="tipPage === 0" @click="tipPage--">‹</button>
          <button class="carousel-btn" :disabled="tipPage === totalTipPages - 1" @click="tipPage++">›</button>
        </div>
      </div>

      <div class="tips-grid">
        <article v-for="tip in tipsVisible" :key="tip.id" class="tip-card">
          <div class="tip-icon" :class="`tip-icon--${tip.color}`">
            <i :class="tip.icon"></i>
          </div>
          <div class="tip-meta">
            <span class="tip-num">TIP · {{ tip.num }}</span>
            <span class="tip-cat">{{ tip.categoria }}</span>
          </div>
          <h4 class="tip-title">{{ tip.titulo }}</h4>
          <p class="tip-body">{{ tip.body }}</p>
          <button class="tip-cta" @click="$router.push(tip.ruta)">Aplicar ahora →</button>
        </article>
      </div>
    </section>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import useRrhhStore from '@/stores/rrhh'
import { useAsistenciaStore } from '@/stores/asistencia'
import { useFirmasStore } from '@/stores/firmas'

definePageMeta({ layout: 'rrhh', middleware: 'auth' })

const router = useRouter()
const rrhhStore = useRrhhStore()
const asistencia = useAsistenciaStore()
const firmas = useFirmasStore()

// ── Usuario actual ─────────────────────────────────────────────────────────
const usuario = ref(null)
const fechaCreacionCuenta = ref(null)

onMounted(async () => {
  try {
    const { useAuthStore } = await import('@/stores/auth')
    const authStore = useAuthStore()
    await authStore.init()
    usuario.value = authStore.user
    fechaCreacionCuenta.value = authStore.user?.createdAt || authStore.user?.created || null
  } catch (e) {}

  // Asegurar data cargada (los métodos del store son getX, no fetchX)
  if (!rrhhStore.trabajadores?.length)  await rrhhStore.getTrabajadores?.()
  if (!rrhhStore.contratos?.length)     await rrhhStore.getContratos?.()
  if (!rrhhStore.liquidaciones?.length) await rrhhStore.getLiquidaciones?.()
  // Asistencia y firmas (localStorage por ahora)
  try { asistencia.init?.() } catch {}
  try { firmas.init?.() } catch {}
})

const nombrePila = computed(() => {
  const n = usuario.value?.nombre || usuario.value?.name || ''
  return n.split(' ')[0] || ''
})

const fechaHoy = computed(() => {
  return new Date().toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.')
})

const diaDeUso = computed(() => {
  if (!fechaCreacionCuenta.value) return 1
  const inicio = new Date(fechaCreacionCuenta.value)
  const hoy = new Date()
  return Math.max(1, Math.floor((hoy - inicio) / (1000 * 60 * 60 * 24)) + 1)
})

// ── Checklist onboarding — scopado a la organización activa ────────────────
// "soft": registros sin orgId también cuentan (compat con data antigua de rrhh)
// "strict": solo registros con orgId === currentOrgId (excluye seeds globales)
function byOrg(list, mode = 'soft') {
  const oid = rrhhStore.currentOrgId
  if (!oid) return list || []
  if (mode === 'strict') return (list || []).filter(r => r.orgId === oid)
  return (list || []).filter(r => r.orgId === oid || !r.orgId)
}

const checklist = computed(() => {
  const trabajadoresOrg  = byOrg(rrhhStore.trabajadores)
  const contratosOrg     = byOrg(rrhhStore.contratos)
  const liquidacionesOrg = byOrg(rrhhStore.liquidaciones)
  // Turnos y marcaciones: strict — los seeds globales no cuentan para una org
  const turnosOrg        = byOrg(asistencia.turnos,      'strict')
  const marcacionesOrg   = byOrg(asistencia.marcaciones, 'strict')
  const firmasOrg        = byOrg(firmas.solicitudes,     'strict')

  const tieneTrabajadores  = trabajadoresOrg.length  > 0
  const tieneContratos     = contratosOrg.length     > 0
  const tieneLiquidaciones = liquidacionesOrg.length > 0
  const tieneFirmas        = firmasOrg.length        > 0
  const tieneTurnos        = turnosOrg.length        > 0
  const tieneMarcaciones   = marcacionesOrg.length   > 0

  return [
    { id: 'cuenta',         label: 'Cuenta creada',                  done: true,                meta: 'hecho' },
    { id: 'trabajadores',   label: 'Agrega tu primer trabajador',    done: tieneTrabajadores,   meta: tieneTrabajadores   ? `${trabajadoresOrg.length} personas`     : 'pendiente' },
    { id: 'contratos',      label: 'Crea tu primer contrato',        done: tieneContratos,      meta: tieneContratos      ? `${contratosOrg.length} contratos`       : 'pendiente' },
    { id: 'liquidaciones',  label: 'Genera tu primera liquidación',  done: tieneLiquidaciones,  meta: tieneLiquidaciones  ? `${liquidacionesOrg.length} liquidaciones` : 'pendiente' },
    { id: 'firmas',         label: 'Firma documentos en línea',      done: tieneFirmas,         meta: tieneFirmas         ? `${firmasOrg.length} firmas`             : 'pendiente' },
    { id: 'turnos',         label: 'Genera turnos',                  done: tieneTurnos,         meta: tieneTurnos         ? `${turnosOrg.length} turnos`             : 'pendiente' },
    { id: 'marcaciones',    label: 'Registra marcaciones',           done: tieneMarcaciones,    meta: tieneMarcaciones    ? `${marcacionesOrg.length} marcaciones`   : 'pendiente' },
  ]
})

const completados = computed(() => checklist.value.filter(i => i.done).length)
const pasosFaltantes = computed(() => checklist.value.length - completados.value)
const porcentaje = computed(() => Math.round((completados.value / checklist.value.length) * 100))

function irAlSiguientePaso() {
  const pendiente = checklist.value.find(i => !i.done)
  if (!pendiente) { router.push('/rrhh/trabajadores'); return }
  const rutas = {
    trabajadores:  '/rrhh/trabajadores',
    contratos:     '/rrhh/contratos',
    liquidaciones: '/rrhh/liquidaciones',
    firmas:        '/rrhh/contratos',
    turnos:        '/rrhh/asistencia/turnos',
    marcaciones:   '/rrhh/asistencia/marcaciones',
  }
  router.push(rutas[pendiente.id] || '/rrhh/trabajadores')
}

// ── Costo empresa por mes ──────────────────────────────────────────────────
const anioActual = new Date().getFullYear()

// Paleta de colores para personas (12 tonos distinguibles, ciclan si hay más)
const PALETA_COLORES = [
  '#0DCFA8', '#E07856', '#F5C842', '#7C5BFC', '#FF3D7F', '#4AA3FF',
  '#6ECB63', '#FF8C42', '#B16BFF', '#2DD4BF', '#F472B6', '#60A5FA',
]

const MES_LABELS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

// Dimensiones del gráfico (viewBox)
const chartW = 880
const chartH = 320
const paddingLeft = 60
const paddingRight = 16
const paddingTop = 24
const paddingBottom = 32
const barWidth = 42
const tooltipActivo = ref(null)

const liquidacionesAnio = computed(() => {
  const oid = rrhhStore.currentOrgId
  return (rrhhStore.liquidaciones || []).filter(l => {
    const sameAnio = Number(l.anio) === anioActual
    const sameOrg = !oid || l.orgId === oid || !l.orgId
    return sameAnio && sameOrg
  })
})

const trabajadoresPorId = computed(() => {
  const map = new Map()
  for (const t of rrhhStore.trabajadores || []) map.set(t._id, t)
  return map
})

function resolverNombre(l) {
  if (l.trabajador_nombre && l.trabajador_nombre.trim()) return l.trabajador_nombre
  const t = trabajadoresPorId.value.get(l.trabajador_id)
  if (!t) return 'Sin nombre'
  const partes = [t.nombre, t.apellido_paterno, t.apellido_materno].filter(Boolean)
  return partes.join(' ') || t.nombres || t.rut || 'Sin nombre'
}

const datosChart = computed(() => {
  const liqs = liquidacionesAnio.value
  if (!liqs.length) return { tieneData: false, barras: [], trabajadoresOrdenados: [] }

  // Acumular por trabajador y por mes
  const porTrabajador = new Map() // id -> { id, nombre, totalAnio, porMes: {1..12} }
  for (const l of liqs) {
    const id = l.trabajador_id
    const nombre = resolverNombre(l)
    const costo = Number(l.costo_empresa || 0)
    const mes = Number(l.mes || 0)
    if (!id || mes < 1 || mes > 12) continue
    if (!porTrabajador.has(id)) {
      porTrabajador.set(id, { id, nombre, totalAnio: 0, porMes: {} })
    }
    const t = porTrabajador.get(id)
    t.totalAnio += costo
    t.porMes[mes] = (t.porMes[mes] || 0) + costo
  }

  // Ordenar trabajadores por costo total descendente y asignar color
  const trabajadoresOrdenados = Array.from(porTrabajador.values())
    .sort((a, b) => b.totalAnio - a.totalAnio)
    .map((t, i) => ({ ...t, color: PALETA_COLORES[i % PALETA_COLORES.length] }))

  // Max valor mensual (suma de todos los trabajadores en un mes)
  let maxValorLocal = 0
  for (let m = 1; m <= 12; m++) {
    const total = trabajadoresOrdenados.reduce((acc, t) => acc + (t.porMes[m] || 0), 0)
    if (total > maxValorLocal) maxValorLocal = total
  }
  if (maxValorLocal === 0) return { tieneData: false, barras: [], trabajadoresOrdenados: [] }

  // Redondear hacia arriba para que las grid lines queden lindas
  const orden = Math.pow(10, Math.floor(Math.log10(maxValorLocal)))
  const maxRedondeado = Math.ceil(maxValorLocal / orden) * orden

  const usableW = chartW - paddingLeft - paddingRight
  const usableH = chartH - paddingTop - paddingBottom
  const gap = (usableW - 12 * barWidth) / 13 // espacio entre barras y bordes

  // Construir barras
  const barras = []
  for (let m = 1; m <= 12; m++) {
    const x = paddingLeft + gap + (m - 1) * (barWidth + gap)
    const segmentos = []
    let yAcum = paddingTop + usableH // empezamos desde abajo
    let total = 0
    for (const t of trabajadoresOrdenados) {
      const valor = t.porMes[m] || 0
      if (valor <= 0) continue
      const h = (valor / maxRedondeado) * usableH
      yAcum -= h
      segmentos.push({
        trabajadorId: t.id,
        nombre: t.nombre,
        valor,
        color: t.color,
        y: yAcum,
        h,
      })
      total += valor
    }
    barras.push({
      x,
      mesLabel: MES_LABELS[m - 1],
      segmentos,
      total,
      topY: total > 0 ? yAcum : paddingTop + usableH,
    })
  }

  return { tieneData: true, barras, trabajadoresOrdenados, maxValor: maxRedondeado }
})

const maxValor = computed(() => datosChart.value.maxValor || 0)

const totalAnio = computed(() =>
  datosChart.value.trabajadoresOrdenados.reduce((acc, t) => acc + t.totalAnio, 0)
)

const promedioMensual = computed(() => {
  const liqs = liquidacionesAnio.value
  if (!liqs.length) return 0
  const mesesUnicos = new Set(liqs.map(l => l.mes)).size || 1
  return Math.round(totalAnio.value / mesesUnicos)
})

function formatoCLP(n) {
  if (!n) return '$0'
  return '$' + Math.round(n).toLocaleString('es-CL')
}

function formatoCLPCorto(n) {
  if (!n) return '$0'
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + 'M'
  if (n >= 1_000) return '$' + Math.round(n / 1_000) + 'k'
  return '$' + Math.round(n)
}

// ── Tips ¿Sabías que…? ─────────────────────────────────────────────────────
const tips = [
  // Originales del diseño
  { id: 1, num: '01', categoria: 'CONTRATOS',    icon: 'u u-file-text',  color: 'teal',
    titulo: 'Dos contratos al mismo tiempo, sí se puede.',
    body: 'Honorarios + plazo fijo conviven en una misma persona. Unabase los suma en la liquidación respetando el tope imponible.',
    ruta: '/rrhh/contratos' },
  { id: 2, num: '02', categoria: 'ASISTENCIA',   icon: 'u u-check',      color: 'teal',
    titulo: 'Marcaciones funcionan sin internet.',
    body: 'En obra o en terreno, la app guarda los registros y los sube cuando vuelve la señal — la geolocalización se respeta igual.',
    ruta: '/rrhh/asistencia/marcaciones' },
  { id: 3, num: '03', categoria: 'LIQUIDACIONES', icon: 'u u-money-bag', color: 'gold',
    titulo: 'Liquidar 500 personas toma menos de 4 segundos.',
    body: 'Procesa asignaciones familiares, descuentos, anticipos y APV en una corrida masiva. Y se puede revertir.',
    ruta: '/rrhh/liquidaciones' },
  { id: 4, num: '04', categoria: 'INFORMES',     icon: 'u u-reportes',   color: 'coral',
    titulo: 'Informe Previred en un clic — y firmado.',
    body: 'Genera, firma y carga directamente. F29, libro de remuneraciones electrónico y reportes DT también están listos.',
    ruta: '/rrhh/reportes' },
  { id: 5, num: '05', categoria: 'POWER USER',   icon: 'u u-info-circle', color: 'gold',
    titulo: 'Atajos de teclado para mover liquidaciones.',
    body: 'Cmd+L abre el panel masivo, Cmd+K busca cualquier persona, Cmd+/ muestra todos los atajos. Te ahorran horas al mes.',
    ruta: '/rrhh/liquidaciones' },
  // Nuevos basados en lo que aprendimos
  { id: 6, num: '06', categoria: 'PERSONAS',     icon: 'u u-camera',     color: 'teal',
    titulo: 'Sube la foto de cada trabajador en un click.',
    body: 'Click en el avatar de cualquier ficha y subes la foto. Reconoce a tu equipo de un vistazo y personaliza el módulo.',
    ruta: '/rrhh/trabajadores' },
  { id: 7, num: '07', categoria: 'CONTRATOS',    icon: 'u u-log-out',    color: 'coral',
    titulo: 'Finiquito por contrato, no por persona.',
    body: 'Si un trabajador tiene varios contratos vigentes, puedes finiquitar solo uno — el botón rojo "Terminar contrato" vive en cada tarjeta.',
    ruta: '/rrhh/trabajadores' },
  { id: 8, num: '08', categoria: 'SEGURIDAD',    icon: 'u u-link',       color: 'teal',
    titulo: 'Los formularios no se cierran al click fuera.',
    body: 'Para evitar perder datos largos (contratos, finiquitos, liquidaciones), los modales solo se cierran con la X o al guardar. Tus datos están a salvo.',
    ruta: '/rrhh/trabajadores' },
  { id: 9, num: '09', categoria: 'TRIBUTARIO',   icon: 'u u-money-bag',  color: 'gold',
    titulo: 'Sueldo Empresarial para socios y dueños.',
    body: 'Si eres socio o dueño, usa el tipo "Sueldo Empresarial" (Art. 31 N°6 LIR) al crear el contrato — la figura tributaria se aplica automáticamente.',
    ruta: '/rrhh/contratos' },
]

const PAGE_SIZE = 3
const tipPage = ref(0)
const totalTipPages = computed(() => Math.ceil(tips.length / PAGE_SIZE))
const tipsVisible = computed(() => {
  const start = tipPage.value * PAGE_SIZE
  return tips.slice(start, start + PAGE_SIZE)
})
</script>

<style scoped>
.home-page {
  padding: 24px 32px 48px;
  display: flex;
  flex-direction: column;
  gap: 36px;
  max-width: 1280px;
  margin: 0 auto;
}

/* ── Hero ──────────────────────────────────────────────────────────── */
.hero {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 28px;
  background: var(--neutral-background-subtle, #0f1a26);
  border: 1px solid var(--neutral-border-light, rgba(255,255,255,0.06));
  border-radius: 14px;
  padding: 28px 32px;
}
.hero-content { display: flex; flex-direction: column; gap: 14px; }
.hero-meta {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 11px; font-weight: 600; letter-spacing: 0.1em;
  color: var(--neutral-text-muted, #9ca3af);
  text-transform: uppercase;
}
.dot { width: 6px; height: 6px; border-radius: 50%; background: #0DCFA8; }
.hero-title {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 26px; line-height: 1.2; font-weight: 700;
  color: var(--neutral-text-title, #f3f4f6);
  margin: 0; letter-spacing: -0.01em;
}
.hero-lede {
  font-size: 14px; line-height: 1.55; max-width: 540px;
  color: var(--neutral-text-body, #9ca3af);
  margin: 0;
}
.hero-cta { display: flex; gap: 10px; margin-top: 6px; }

/* Onboarding card */
.onboarding-card {
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
  padding: 18px 20px;
  align-self: flex-start;
}
.onb-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; }
.onb-title {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 11px; font-weight: 600; letter-spacing: 0.12em;
  color: var(--neutral-text-muted, #9ca3af);
}
.onb-percent { font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 700; color: #0DCFA8; }
.onb-bar { height: 3px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden; margin-bottom: 16px; }
.onb-bar-fill { height: 100%; background: #0DCFA8; transition: width 0.4s ease; }
.onb-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
.onb-item { display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--neutral-text-body, #d1d5db); }
.onb-item.done .onb-label { color: var(--neutral-text-title, #f3f4f6); }
.onb-check { width: 16px; height: 16px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.onb-item .onb-check { background: rgba(255,255,255,0.08); }
.onb-item.done .onb-check { background: #0DCFA8; color: #062D3A; font-size: 10px; }
.onb-pending { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.18); }
.onb-label { flex: 1; }
.onb-meta { font-size: 11px; color: var(--neutral-text-muted, #6b7280); font-family: 'Space Grotesk', sans-serif; letter-spacing: 0.02em; }

/* ── Bloques de sección ────────────────────────────────────────────── */
.block { display: flex; flex-direction: column; gap: 18px; }
.block-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; }
.block-kicker {
  display: block;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 11px; font-weight: 600; letter-spacing: 0.12em;
  color: #0DCFA8;
  margin-bottom: 4px;
}
.block-title {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 18px; font-weight: 600;
  color: var(--neutral-text-title, #f3f4f6);
  margin: 0;
  letter-spacing: -0.01em;
}
.carousel-nav { display: flex; align-items: center; gap: 10px; }
.carousel-counter { font-family: 'Space Grotesk', sans-serif; font-size: 12px; color: var(--neutral-text-muted, #9ca3af); }
.carousel-btn {
  width: 32px; height: 32px; border-radius: 8px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  color: var(--neutral-text-body, #d1d5db);
  cursor: pointer; font-size: 16px;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.carousel-btn:hover:not(:disabled) { background: rgba(13,207,168,0.12); border-color: rgba(13,207,168,0.4); color: #0DCFA8; }
.carousel-btn:disabled { opacity: 0.3; cursor: not-allowed; }

/* ── Costo empresa chart ───────────────────────────────────────────── */
.costo-totales { display: flex; gap: 24px; }
.costo-stat { display: flex; flex-direction: column; gap: 2px; text-align: right; }
.costo-stat__label {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 10px; font-weight: 600; letter-spacing: 0.1em;
  color: var(--neutral-text-muted, #9ca3af);
  text-transform: uppercase;
}
.costo-stat__valor {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 16px; font-weight: 700;
  color: var(--neutral-text-title, #f3f4f6);
}

.costo-card {
  background: var(--neutral-background-subtle, #0f1a26);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 14px;
  padding: 24px 24px 20px;
  display: flex; flex-direction: column; gap: 18px;
}
.costo-empty {
  display: flex; flex-direction: column; align-items: center; gap: 16px;
  padding: 32px 0;
  color: var(--neutral-text-muted, #9ca3af);
  text-align: center;
}
.costo-chart-wrap { position: relative; width: 100%; }
.costo-chart {
  width: 100%; height: auto;
  display: block;
  font-family: 'Space Grotesk', sans-serif;
}
.costo-chart .grid line {
  stroke: rgba(255,255,255,0.06);
  stroke-dasharray: 2 4;
}
.costo-chart .axis-x text,
.costo-chart .axis-y text {
  font-size: 10px;
  fill: var(--neutral-text-muted, #9ca3af);
}
.costo-chart .bar-total {
  font-size: 9px; font-weight: 600;
  fill: var(--neutral-text-title, #f3f4f6);
}
.costo-chart rect { cursor: pointer; transition: opacity 0.15s; }
.costo-chart rect:hover { opacity: 0.85; }

.costo-tooltip {
  position: absolute;
  transform: translate(-50%, -110%);
  background: rgba(6, 45, 58, 0.95);
  border: 1px solid rgba(13, 207, 168, 0.4);
  border-radius: 8px;
  padding: 8px 12px;
  pointer-events: none;
  white-space: nowrap;
  z-index: 5;
}
.costo-tooltip__label {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 11px; font-weight: 600;
  color: #f5f0e6;
  margin-bottom: 2px;
}
.costo-tooltip__valor {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 13px; font-weight: 700;
  color: #0DCFA8;
}

.costo-legend {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(255,255,255,0.06);
}
.costo-legend__item {
  display: flex; align-items: center; gap: 8px;
  font-size: 12px;
}
.costo-legend__dot {
  width: 10px; height: 10px; border-radius: 3px;
  flex-shrink: 0;
}
.costo-legend__nombre {
  flex: 1;
  color: var(--neutral-text-body, #d1d5db);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.costo-legend__monto {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 11px; font-weight: 600;
  color: var(--neutral-text-muted, #9ca3af);
}

/* ── Tips ──────────────────────────────────────────────────────────── */
.tips-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
}
.tip-card {
  background: var(--neutral-background-subtle, #0f1a26);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
  padding: 22px 22px 18px;
  display: flex; flex-direction: column; gap: 10px;
}
.tip-icon {
  width: 28px; height: 28px;
  border-radius: 7px;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px;
  margin-bottom: 4px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  color: var(--neutral-text-muted, #9ca3af);
}
/* Variantes neutras — sin color estridente */
.tip-icon--teal,
.tip-icon--gold,
.tip-icon--coral {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.06);
  color: var(--neutral-text-muted, #9ca3af);
}
.tip-meta { display: flex; gap: 8px; align-items: baseline; }
.tip-num {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 10px; font-weight: 700;
  color: var(--neutral-text-title, #f3f4f6);
  letter-spacing: 0.08em;
}
.tip-cat {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 9px; font-weight: 600;
  color: var(--neutral-text-muted, #9ca3af);
  letter-spacing: 0.1em;
}
.tip-title {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 16px; font-weight: 700;
  line-height: 1.3;
  color: var(--neutral-text-title, #f3f4f6);
  margin: 2px 0 0;
}
.tip-body { font-size: 13px; line-height: 1.55; color: var(--neutral-text-body, #9ca3af); margin: 0; }
.tip-cta {
  background: none; border: none;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 12px; font-weight: 600;
  color: #0DCFA8;
  text-align: left;
  cursor: pointer;
  padding: 4px 0 0;
  margin-top: auto;
}
.tip-cta:hover { opacity: 0.8; }

/* ── Responsive ────────────────────────────────────────────────────── */
@media (max-width: 1100px) {
  .hero { grid-template-columns: 1fr; }
  .tips-grid { grid-template-columns: repeat(2, 1fr); }
  .costo-totales { gap: 16px; }
}
@media (max-width: 720px) {
  .block-head { flex-direction: column; align-items: flex-start; }
  .costo-totales { width: 100%; justify-content: space-between; }
  .costo-stat { text-align: left; }
}
@media (max-width: 640px) {
  .home-page { padding: 16px 16px 32px; }
  .hero { padding: 24px 20px; }
  .hero-title { font-size: 28px; }
  .tips-grid { grid-template-columns: 1fr; }
}

/* ── Light theme overrides ─────────────────────────────────────────── */
:root.light-theme .hero {
  background: radial-gradient(circle at top right, rgba(13,207,168,0.10), transparent 60%), #f8fafc;
  border-color: #e5e7eb;
}
:root.light-theme .hero-title { color: #0f172a; }
:root.light-theme .hero-lede { color: #475569; }
:root.light-theme .onboarding-card { background: #ffffff; border-color: #e5e7eb; }
:root.light-theme .onb-bar { background: #e5e7eb; }
:root.light-theme .onb-item .onb-check { background: #e5e7eb; }
:root.light-theme .onb-label { color: #334155; }
:root.light-theme .onb-item.done .onb-label { color: #0f172a; }
:root.light-theme .block-title { color: #0f172a; }
:root.light-theme .tip-card,
:root.light-theme .costo-card {
  background: #ffffff;
  border-color: #e5e7eb;
}
:root.light-theme .tip-title { color: #0f172a; }
:root.light-theme .tip-body { color: #64748b; }
:root.light-theme .carousel-btn { background: #ffffff; border-color: #e5e7eb; color: #475569; }
:root.light-theme .costo-stat__valor { color: #0f172a; }
:root.light-theme .costo-stat__label { color: #64748b; }
:root.light-theme .costo-chart .grid line { stroke: #e5e7eb; }
:root.light-theme .costo-chart .axis-x text,
:root.light-theme .costo-chart .axis-y text { fill: #64748b; }
:root.light-theme .costo-chart .bar-total { fill: #0f172a; }
:root.light-theme .costo-tooltip {
  background: #ffffff;
  border-color: rgba(13, 207, 168, 0.5);
  box-shadow: 0 8px 24px rgba(15,23,42,0.12);
}
:root.light-theme .costo-tooltip__label { color: #0f172a; }
:root.light-theme .costo-legend { border-top-color: #e5e7eb; }
:root.light-theme .costo-legend__nombre { color: #334155; }
:root.light-theme .costo-legend__monto { color: #64748b; }
</style>
