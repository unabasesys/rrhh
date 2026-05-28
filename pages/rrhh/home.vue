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

    <!-- ── TUTORIALES ────────────────────────────────────────────── -->
    <section class="block">
      <div class="block-head">
        <div>
          <span class="block-kicker">01 TUTORIAL · PRIMEROS PASOS</span>
          <h2 class="block-title">Configura tu cuenta en 3 pasos</h2>
        </div>
      </div>

      <div class="tutorial-grid">
        <article v-for="(tut, i) in tutoriales" :key="tut.id" class="tutorial-card">
          <div class="tut-media" @click="abrirVideo(tut)">
            <iframe
              v-if="tut.videoActivo && tut.youtubeId && videoAbierto === tut.id"
              :src="`https://www.youtube.com/embed/${tut.youtubeId}?autoplay=1`"
              frameborder="0"
              allow="autoplay; encrypted-media"
              allowfullscreen
              class="tut-iframe"
            ></iframe>
            <template v-else>
              <div class="tut-stripes"></div>
              <div class="tut-play" :class="`tut-play--${tut.color}`">
                <i class="u u-play"></i>
              </div>
              <span class="tut-dur">{{ tut.duracion }}</span>
              <span class="tut-tag">video · {{ tut.tag }}</span>
            </template>
          </div>
          <div class="tut-body">
            <span class="tut-step">{{ String(i + 1).padStart(2, '0') }}</span>
            <span class="tut-clock">⏱ {{ tut.minutos }}</span>
            <h3 class="tut-title">{{ tut.titulo }}</h3>
            <p class="tut-desc">{{ tut.descripcion }}</p>
            <ul class="tut-features">
              <li v-for="f in tut.features" :key="f">✓ {{ f }}</li>
            </ul>
            <button class="btn tut-cta" :class="i === 0 ? 'btn-primary' : 'btn-outline'" @click="$router.push(tut.ruta)">
              {{ i === 0 ? 'Empezar acá' : 'Ver tutorial' }} →
            </button>
          </div>
        </article>
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

  // Asegurar data cargada
  if (!rrhhStore.trabajadores?.length) await rrhhStore.fetchTrabajadores?.()
  if (!rrhhStore.contratos?.length)    await rrhhStore.fetchContratos?.()
  if (!rrhhStore.liquidaciones?.length) await rrhhStore.fetchLiquidaciones?.()
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

// ── Tutoriales ─────────────────────────────────────────────────────────────
const videoAbierto = ref(null)
function abrirVideo(tut) {
  if (tut.videoActivo && tut.youtubeId) videoAbierto.value = tut.id
}

const tutoriales = [
  {
    id: 'crear-trabajadores',
    titulo: 'Crea tus trabajadores',
    tag: 'alta de personas',
    color: 'teal',
    duracion: '2:14',
    minutos: '4 min',
    descripcion: 'Importa desde planilla, agrega uno a uno o copia desde otro sistema. Datos previsionales, modalidad, sueldo y centro de costo en una sola vista.',
    features: ['Carga masiva CSV / Excel', 'Datos AFP, salud, AFC', 'Asignación a proyecto y CECO'],
    ruta: '/rrhh/trabajadores',
    youtubeId: 'lYCX-Dg1vP8',
    videoActivo: true,
  },
  {
    id: 'crear-contratos',
    titulo: 'Genera contratos',
    tag: 'contratos y firma',
    color: 'gold',
    duracion: '2:14',
    minutos: '3 min',
    descripcion: 'Plantillas chilenas pre-validadas — indefinido, plazo fijo, por proyecto, honorarios — con firma electrónica y anexos automáticos.',
    features: ['Plantillas Dirección del Trabajo', 'Firma electrónica avanzada', 'Anexos por modificación'],
    ruta: '/rrhh/contratos',
    youtubeId: '',
    videoActivo: false,
  },
  {
    id: 'gestiona-dia',
    titulo: 'Gestiona el día a día',
    tag: 'gestión mensual',
    color: 'coral',
    duracion: '2:14',
    minutos: '5 min',
    descripcion: 'Marcaciones, vacaciones, anticipos, liquidaciones, informes para DT y Previred. Todo desde un solo panel mensual.',
    features: ['Marcaciones GPS y app', 'Liquidación masiva (<4 s para 500 personas)', 'Informes F29, Previred, libro electrónico'],
    ruta: '/rrhh/asistencia',
    youtubeId: '',
    videoActivo: false,
  },
]

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

/* ── Tutoriales ────────────────────────────────────────────────────── */
.tutorial-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
}
.tutorial-card {
  background: var(--neutral-background-subtle, #0f1a26);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 14px;
  overflow: hidden;
  display: flex; flex-direction: column;
}
.tut-media {
  aspect-ratio: 16/9;
  position: relative;
  background: linear-gradient(135deg, #0a1b22 0%, #062d3a 100%);
  cursor: pointer;
  overflow: hidden;
}
.tut-stripes {
  position: absolute; inset: 0;
  background-image: repeating-linear-gradient(135deg, transparent 0 12px, rgba(255,255,255,0.025) 12px 14px);
}
.tut-play {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 52px; height: 52px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: rgba(13, 207, 168, 0.12);
  border: 1px solid rgba(13, 207, 168, 0.35);
  color: #0DCFA8;
  font-size: 18px;
  transition: all 0.15s;
}
.tut-play--teal,
.tut-play--gold,
.tut-play--coral {
  /* Todas las variantes ahora son teal sutil — color unificado */
  background: rgba(13, 207, 168, 0.12);
  border-color: rgba(13, 207, 168, 0.35);
  color: #0DCFA8;
  box-shadow: none;
}
.tut-media:hover .tut-play {
  background: rgba(13, 207, 168, 0.2);
  transform: translate(-50%, -50%) scale(1.05);
}
.tut-dur {
  position: absolute; top: 12px; right: 12px;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 11px; font-weight: 600;
  color: rgba(255,255,255,0.7);
}
.tut-tag {
  position: absolute; bottom: 12px; left: 12px;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 11px; letter-spacing: 0.06em;
  color: rgba(255,255,255,0.55);
}
.tut-iframe { position: absolute; inset: 0; width: 100%; height: 100%; }

.tut-body { padding: 18px 20px 20px; display: flex; flex-direction: column; gap: 8px; flex: 1; }
.tut-step {
  display: inline-block; align-self: flex-start;
  background: rgba(13,207,168,0.12);
  color: #0DCFA8;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 11px; font-weight: 700;
  padding: 3px 8px; border-radius: 5px;
  letter-spacing: 0.04em;
}
.tut-clock {
  position: absolute; right: 20px; margin-top: 2px;
  font-size: 11px; color: var(--neutral-text-muted, #9ca3af);
}
.tut-title {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 17px; font-weight: 700;
  color: var(--neutral-text-title, #f3f4f6);
  margin: 4px 0 0;
}
.tut-desc { font-size: 13px; line-height: 1.5; color: var(--neutral-text-body, #9ca3af); margin: 0; }
.tut-features { list-style: none; padding: 0; margin: 4px 0 12px; display: flex; flex-direction: column; gap: 4px; }
.tut-features li { font-size: 12px; color: var(--neutral-text-body, #d1d5db); }
.tut-cta { margin-top: auto; justify-content: center; }

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
  .tutorial-grid { grid-template-columns: 1fr; }
  .tips-grid { grid-template-columns: repeat(2, 1fr); }
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
:root.light-theme .tutorial-card,
:root.light-theme .tip-card {
  background: #ffffff;
  border-color: #e5e7eb;
}
:root.light-theme .tut-title,
:root.light-theme .tip-title { color: #0f172a; }
:root.light-theme .tut-desc,
:root.light-theme .tip-body { color: #64748b; }
:root.light-theme .tut-features li { color: #334155; }
:root.light-theme .carousel-btn { background: #ffffff; border-color: #e5e7eb; color: #475569; }
</style>
