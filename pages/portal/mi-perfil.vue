<template>
  <div class="portal-page">
    <!-- ─── Header ─────────────────────────────────────────────────────── -->
    <header class="portal-header">
      <div class="portal-header__brand">
        <img src="/img/logo-unabase-white.png" alt="Unabase" class="portal-logo" />
      </div>
      <div class="portal-header__user">
        <div class="portal-user-name" v-if="trabajador">
          {{ trabajador.nombre }} {{ trabajador.apellido_paterno || trabajador.apellido || '' }}
        </div>
        <div class="portal-user-org" v-if="organizacion">
          {{ organizacion.nombre }}
        </div>
        <button class="portal-logout" @click="handleLogout">
          <i class="u u-logout"></i> Salir
        </button>
      </div>
    </header>

    <main class="portal-main">
      <!-- ─── Alerta de pago pendiente (informativa) ────────────────────── -->
      <div v-if="orgPagoPendiente" class="portal-billing-alert">
        <i class="u u-warning" style="font-size:18px"></i>
        <div>
          <strong>Tu empresa tiene un pago pendiente con Unabase.</strong>
          <span>
            Algunas funciones podrían dejar de estar disponibles. Por favor, avisa a tu administrador.
          </span>
        </div>
      </div>

      <!-- ─── Sin vínculo ─────────────────────────────────────────────── -->
      <div v-if="!loading && !trabajador" class="empty-state">
        <i class="u u-warning" style="font-size:32px;color:#f59e0b"></i>
        <h2>Tu cuenta no está vinculada a un trabajador</h2>
        <p>Pide a tu empleador que vincule esta cuenta a tu ficha de trabajador.</p>
      </div>

      <!-- ─── Loading ─────────────────────────────────────────────────── -->
      <div v-else-if="loading" class="empty-state">
        <div class="spinner"></div>
        <p>Cargando tu portal…</p>
      </div>

      <!-- ─── Tabs ─────────────────────────────────────────────────────── -->
      <template v-else>
        <nav class="portal-tabs">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            class="portal-tab"
            :class="{ active: activeTab === tab.id }"
            @click="activeTab = tab.id"
          >
            <i :class="tab.icon"></i> {{ tab.label }}
          </button>
        </nav>

        <!-- ═══════ Tab: Inicio / Bienvenida ═══════ -->
        <section v-if="activeTab === 'home'" class="tab-section">
          <div class="welcome-card">
            <h2 class="welcome-title">¡Hola, {{ trabajador.nombre || 'colaborador' }}! 👋</h2>
            <p class="welcome-lede">
              Aquí puedes consultar tus datos, descargar tus liquidaciones, marcar
              asistencia y enviar solicitudes administrativas.
            </p>
          </div>

          <div class="home-grid">
            <!-- Vacaciones acumuladas -->
            <div class="home-card home-card--vacaciones">
              <div class="home-card__icon"><i class="u u-calendar"></i></div>
              <div class="home-card__body">
                <span class="home-card__label">Vacaciones acumuladas</span>
                <span class="home-card__value">{{ vacacionesAcumuladas }} <small>días</small></span>
                <span class="home-card__hint">Legal: 15 días hábiles por año trabajado</span>
              </div>
            </div>

            <!-- Solicitudes -->
            <div class="home-card home-card--solicitudes">
              <div class="home-card__header">
                <h3>Mis solicitudes</h3>
                <button class="btn-text" disabled title="Próximamente">+ Nueva</button>
              </div>
              <div class="home-card__list" v-if="solicitudesMock.length">
                <div v-for="s in solicitudesMock" :key="s.id" class="solicitud-row">
                  <span class="solicitud-tipo" :class="`solicitud-tipo--${s.tipo}`">{{ s.tipo }}</span>
                  <span class="solicitud-fecha">{{ s.fecha }}</span>
                  <span class="solicitud-estado" :class="`estado-${s.estado}`">{{ s.estado }}</span>
                </div>
              </div>
              <div v-else class="home-card__empty">
                <p>Aún no tienes solicitudes.</p>
                <p class="muted">Tipos disponibles: <strong>Permiso</strong> · <strong>Administrativo</strong> · <strong>Vacaciones</strong></p>
              </div>
            </div>
          </div>
        </section>

        <!-- ═══════ Tab: Marcar entrada/salida ═══════ -->
        <section v-else-if="activeTab === 'marcar'" class="tab-section">
          <div class="marcar-card">
            <div class="marcar-clock">{{ horaActualStr }}</div>
            <div class="marcar-date">{{ fechaActualStr }}</div>

            <div v-if="marcacionHoy" class="marcar-status">
              <div class="marcar-status__row">
                <span>Entrada:</span>
                <strong>{{ marcacionHoy.entrada || '—' }}</strong>
              </div>
              <div class="marcar-status__row">
                <span>Salida:</span>
                <strong>{{ marcacionHoy.salida || '—' }}</strong>
              </div>
              <div v-if="marcacionHoy.horas" class="marcar-status__row">
                <span>Horas trabajadas:</span>
                <strong>{{ marcacionHoy.horas }} h</strong>
              </div>
            </div>

            <div class="marcar-actions">
              <button
                class="btn btn--marcar btn--entrada"
                :disabled="!puedeMarcar || marking || (marcacionHoy && marcacionHoy.entrada)"
                @click="marcar('entrada')"
              >
                <i class="u u-check"></i>
                {{ marcacionHoy && marcacionHoy.entrada ? 'Entrada marcada' : 'Marcar entrada' }}
              </button>
              <button
                class="btn btn--marcar btn--salida"
                :disabled="!puedeMarcar || marking || !marcacionHoy?.entrada || marcacionHoy?.salida"
                @click="marcar('salida')"
              >
                <i class="u u-clock"></i>
                {{ marcacionHoy && marcacionHoy.salida ? 'Salida marcada' : 'Marcar salida' }}
              </button>
            </div>

            <div v-if="!puedeMarcar" class="marcar-warning">
              {{ motivoNoPuedeMarcar }}
            </div>
            <div v-if="marcarError" class="error-msg">
              {{ marcarError }}
            </div>
          </div>
        </section>

        <!-- ═══════ Tab: Mis Datos ═══════ -->
        <section v-else-if="activeTab === 'datos'" class="tab-section">
          <div class="data-grid">
            <div class="data-card">
              <h3>Datos Personales</h3>
              <div class="data-rows">
                <div class="data-row"><span>Nombre</span><strong>{{ trabajador.nombre }} {{ trabajador.apellido_paterno || trabajador.apellido || '' }} {{ trabajador.apellido_materno || '' }}</strong></div>
                <div class="data-row"><span>RUT</span><strong>{{ formatRut(trabajador.rut) }}</strong></div>
                <div class="data-row"><span>Email</span><strong>{{ trabajador.email || '—' }}</strong></div>
                <div class="data-row"><span>Teléfono</span><strong>{{ trabajador.telefono || '—' }}</strong></div>
                <div class="data-row"><span>Dirección</span><strong>{{ trabajador.direccion || '—' }}</strong></div>
                <div class="data-row"><span>Nacionalidad</span><strong>{{ trabajador.nacionalidad || '—' }}</strong></div>
              </div>
            </div>

            <div class="data-card">
              <h3>Datos Laborales</h3>
              <div class="data-rows">
                <div class="data-row"><span>Cargo</span><strong>{{ trabajador.cargo || '—' }}</strong></div>
                <div class="data-row"><span>Departamento</span><strong>{{ trabajador.departamento || '—' }}</strong></div>
                <div class="data-row"><span>Fecha ingreso</span><strong>{{ formatFecha(trabajador.fecha_ingreso) }}</strong></div>
                <div class="data-row"><span>Empresa</span><strong>{{ organizacion?.nombre || '—' }}</strong></div>
                <div class="data-row"><span>Estado</span>
                  <strong :style="{ color: trabajador.estado === 'activo' ? '#0DCFA8' : '#ef4444' }">
                    {{ trabajador.estado === 'activo' ? 'Activo' : 'Inactivo' }}
                  </strong>
                </div>
              </div>
            </div>

            <div class="data-card">
              <h3>Previsión</h3>
              <div class="data-rows">
                <div class="data-row"><span>AFP</span><strong>{{ trabajador.afp || '—' }}</strong></div>
                <div class="data-row"><span>Sistema de salud</span><strong>{{ trabajador.sistema_salud || trabajador.isapre || 'FONASA' }}</strong></div>
              </div>
            </div>

            <div class="data-card">
              <h3>Banco</h3>
              <div class="data-rows">
                <div class="data-row"><span>Banco</span><strong>{{ trabajador.banco || '—' }}</strong></div>
                <div class="data-row"><span>Tipo de cuenta</span><strong>{{ trabajador.tipo_cuenta || '—' }}</strong></div>
                <div class="data-row"><span>N° cuenta</span><strong>{{ trabajador.numero_cuenta || '—' }}</strong></div>
              </div>
            </div>

            <div class="data-card data-card--wide">
              <h3>Contratos</h3>
              <div v-if="contratos.length" class="contratos-list">
                <div v-for="c in contratos" :key="c._id" class="contrato-item">
                  <div class="contrato-item__head">
                    <strong>{{ labelContrato(c.tipo_contrato) }}</strong>
                    <span class="contrato-badge" :class="estadoContratoCls(c)">{{ c.estado_contrato || c.estado || '—' }}</span>
                  </div>
                  <div class="contrato-item__body">
                    <div><span>Inicio:</span> {{ formatFecha(c.fecha_inicio || c.fecha_ingreso) }}</div>
                    <div><span>Término:</span> {{ c.fecha_termino ? formatFecha(c.fecha_termino) : 'Indefinido' }}</div>
                    <div v-if="c.cargo"><span>Cargo:</span> {{ c.cargo }}</div>
                    <div v-if="c.sueldo_base"><span>Sueldo base:</span> {{ formatCLP(c.sueldo_base) }}</div>
                  </div>
                </div>
              </div>
              <p v-else class="muted">No tienes contratos registrados.</p>
            </div>
          </div>
        </section>

        <!-- ═══════ Tab: Liquidaciones ═══════ -->
        <!-- ═══════ Tab: Contratos ═══════ -->
        <section v-else-if="activeTab === 'contratos'" class="tab-section">
          <div v-if="contratos.length" class="doc-grid">
            <div v-for="c in contratos" :key="c._id" class="doc-card">
              <div class="doc-card__head">
                <span class="doc-card__type">{{ tipoContratoLabel(c.tipo_contrato) }}</span>
                <span class="doc-card__badge" :class="c.estado">{{ c.estado || '—' }}</span>
              </div>
              <div class="doc-card__body">
                <div class="doc-card__row">
                  <span>Inicio</span>
                  <strong>{{ c.fecha_inicio || '—' }}</strong>
                </div>
                <div class="doc-card__row">
                  <span>Término</span>
                  <strong>{{ c.fecha_termino || 'Indefinido' }}</strong>
                </div>
                <div class="doc-card__row">
                  <span>Cargo</span>
                  <strong>{{ c.cargo || '—' }}</strong>
                </div>
              </div>
              <div class="doc-card__actions">
                <button class="btn-link" @click="descargarContrato(c)" title="Descarga el contrato firmado para tu registro personal">
                  <i class="u u-descargar"></i> Descargar contrato
                </button>
                <button class="btn-link btn-link--firma"
                        @click="solicitarFirma('contrato', c._id, `${tipoContratoLabel(c.tipo_contrato)} (${c.fecha_inicio})`)"
                        title="Firma este contrato online — recibirás un correo con el enlace seguro">
                  <i class="u u-link"></i> Firmar contrato online
                </button>
              </div>
            </div>
          </div>
          <div v-else class="empty-state">
            <i class="u u-folder-open" style="font-size:36px;color:#374151"></i>
            <p>No tienes contratos registrados.</p>
          </div>
        </section>

        <section v-else-if="activeTab === 'liquidaciones'" class="tab-section">
          <div v-if="liquidaciones.length" class="liq-grid">
            <div v-for="liq in liquidaciones" :key="liq._id" class="liq-card">
              <div class="liq-card__head">
                <span class="liq-card__month">{{ mesNombre(liq.mes) }} {{ liq.anio }}</span>
                <span class="liq-card__badge" :class="liq.estado">{{ liq.estado || '—' }}</span>
              </div>
              <div class="liq-card__amount">{{ formatCLP(liq.liquido_a_pagar) }}</div>
              <div class="liq-card__sub">Líquido a pagar</div>
              <div class="liq-card__actions">
                <button class="btn-link" @click="descargarLiquidacion(liq._id, liq.mes, liq.anio)" title="Descarga tu comprobante mensual">
                  <i class="u u-descargar"></i> Descargar PDF
                </button>
                <button class="btn-link btn-link--firma"
                        @click="solicitarFirma('liquidacion', liq._id, `Liquidación ${mesNombre(liq.mes)} ${liq.anio}`)"
                        title="Firma tu liquidación online — recibirás un correo con el enlace seguro">
                  <i class="u u-link"></i> Firmar liquidación online
                </button>
              </div>
            </div>
          </div>
          <div v-else class="empty-state">
            <i class="u u-folder-open" style="font-size:36px;color:#374151"></i>
            <p>Aún no tienes liquidaciones registradas.</p>
          </div>
        </section>

        <!-- ═══════ Tab: Marcaciones ═══════ -->
        <section v-else-if="activeTab === 'marcaciones'" class="tab-section">
          <div class="marc-toolbar">
            <select v-model="marcMes" class="select-month">
              <option v-for="(m, i) in MESES_NAMES" :key="i" :value="i + 1">{{ m }} {{ marcAnio }}</option>
            </select>
            <select v-model="marcAnio" class="select-month">
              <option v-for="y in [marcAnio + 1, marcAnio, marcAnio - 1, marcAnio - 2]" :key="y" :value="y">{{ y }}</option>
            </select>
          </div>
          <div v-if="marcaciones.length" class="marc-table-wrap">
            <table class="marc-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Entrada</th>
                  <th>Salida</th>
                  <th>Horas</th>
                  <th>Proyecto</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="m in marcaciones" :key="m._id">
                  <td>{{ m.fecha }}</td>
                  <td>{{ m.entrada || '—' }}</td>
                  <td>{{ m.salida || '—' }}</td>
                  <td>{{ m.horas || 0 }}</td>
                  <td>{{ m.proyecto_nombre || '—' }}</td>
                  <td>
                    <span class="marc-state" :class="m.estado">{{ m.estado }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="empty-state">
            <i class="u u-clock" style="font-size:36px;color:#374151"></i>
            <p>Sin marcaciones en este período.</p>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

definePageMeta({ layout: false })

const MESES_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const loading = ref(true)
const trabajador   = ref(null)
const contratos    = ref([])
const organizacion = ref(null)
const orgPagoPendiente = ref(false)
const liquidaciones = ref([])
const marcaciones   = ref([])
const marcacionHoy  = ref(null)
const activeTab     = ref('home')
const marking       = ref(false)
const marcarError   = ref('')

const now = new Date()
const marcAnio = ref(now.getFullYear())
const marcMes  = ref(now.getMonth() + 1)

const tabs = [
  { id: 'home',          label: 'Inicio',        icon: 'u u-home' },
  { id: 'datos',         label: 'Mis datos',     icon: 'u u-usuarios' },
  { id: 'contratos',     label: 'Contratos',     icon: 'u u-folder-open' },
  { id: 'liquidaciones', label: 'Liquidaciones', icon: 'u u-cobros-y-pagos' },
  { id: 'marcar',        label: 'Marcar',        icon: 'u u-check' },
  { id: 'marcaciones',   label: 'Marcaciones',   icon: 'u u-clock' },
]

// ─── Contrato vigente + capacidad de marcar ────────────────────────────────
// Solo trabajadores subordinados con turno asignado pueden marcar.
// Honorarios / sueldo_empresarial NO marcan (no son relación laboral).
const TIPOS_QUE_MARCAN = ['indefinido', 'plazo_fijo', 'proyecto', 'jornada', 'part_time']
const contratoVigente = computed(() =>
  (contratos.value || []).find(c => c.estado === 'vigente' || c.estado === 'activo') || null
)
const puedeMarcar = computed(() => {
  const c = contratoVigente.value
  if (!c) return false
  if (!TIPOS_QUE_MARCAN.includes(c.tipo_contrato)) return false
  return !!c.turno_id
})
const motivoNoPuedeMarcar = computed(() => {
  const c = contratoVigente.value
  if (!c) return 'No tienes contrato vigente para marcar.'
  if (!TIPOS_QUE_MARCAN.includes(c.tipo_contrato)) return 'Tu tipo de contrato no requiere marcación.'
  if (!c.turno_id) return 'Tu contrato no tiene turno asignado. Coordina con tu encargado.'
  return ''
})

// ─── Vacaciones acumuladas (cálculo simple basado en antigüedad) ───────────
const vacacionesAcumuladas = computed(() => {
  // Vacaciones legales: 15 días hábiles por año trabajado (Chile)
  // Cálculo simplificado: trabajador.vacaciones_dias guardado en BBDD, o
  // 0 si no se ha calculado/almacenado.
  return trabajador.value?.vacaciones_dias ?? 0
})

// Solicitudes mockup (por ahora vacío — UI lista para integrar)
const solicitudesMock = ref([])

// ── Reloj en vivo ──────────────────────────────────────────────────────────
const horaActual = ref(new Date())
let clockInterval = null
const horaActualStr = computed(() => {
  return horaActual.value.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
})
const fechaActualStr = computed(() => {
  return horaActual.value.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
})

// ── Helpers ────────────────────────────────────────────────────────────────
function authHeaders() {
  if (typeof localStorage === 'undefined') return {}
  try {
    const s = JSON.parse(localStorage.getItem('rrhh_session') || '{}')
    return s.token ? { Authorization: `Bearer ${s.token}` } : {}
  } catch { return {} }
}
function formatRut(rut) {
  if (!rut) return '—'
  const clean = String(rut).replace(/[^0-9kK]/g, '').toUpperCase()
  if (clean.length < 2) return rut
  const dv = clean.slice(-1)
  const num = clean.slice(0, -1)
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv
}
function formatFecha(f) {
  if (!f) return '—'
  try {
    const s = String(f)
    const d = new Date(s + (s.includes('T') ? '' : 'T12:00:00'))
    return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch { return String(f) }
}
function formatCLP(n) {
  if (n == null) return '$0'
  return '$' + Math.round(Number(n) || 0).toLocaleString('es-CL')
}
function mesNombre(m) { return MESES_NAMES[(Number(m) || 1) - 1] }
function labelContrato(t) {
  const labels = {
    indefinido:         'Indefinido',
    plazo_fijo:         'Plazo fijo',
    proyecto:           'Por proyecto/obra',
    honorarios:         'A honorarios',
    part_time:          'Part-time',
    sueldo_empresarial: 'Sueldo Empresarial',
  }
  return labels[t] || t || 'Contrato'
}
function estadoContratoCls(c) {
  const est = (c.estado_contrato || c.estado || '').toLowerCase()
  if (est === 'vigente' || est === 'activo') return 'ok'
  if (est === 'vencido') return 'danger'
  return 'muted'
}

// ── Mount ──────────────────────────────────────────────────────────────────
onMounted(async () => {
  // Verificar sesión
  const raw = localStorage.getItem('rrhh_session')
  if (!raw) return navigateTo('/login')
  try {
    const s = JSON.parse(raw)
    if (!s.token || Date.now() > s.expires) {
      localStorage.removeItem('rrhh_session')
      return navigateTo('/login')
    }
  } catch { return navigateTo('/login') }

  // Reloj
  clockInterval = setInterval(() => { horaActual.value = new Date() }, 1000)

  // Cargar perfil + contratos + org
  try {
    const me = await $fetch('/api/portal/me', { headers: authHeaders() })
    if (me?.ok) {
      trabajador.value   = me.trabajador
      contratos.value    = me.contratos || []
      organizacion.value = me.organizacion
    }
  } catch (e) {
    // No tiene trabajador_id vinculado o sin permisos
    trabajador.value = null
  } finally {
    loading.value = false
  }

  if (trabajador.value) {
    await Promise.all([loadLiquidaciones(), loadMarcaciones(), checkBillingStatus()])
    detectarMarcacionHoy()
  }
})

async function checkBillingStatus() {
  try {
    const r = await $fetch('/api/rrhh/billing/status', { headers: authHeaders() })
    orgPagoPendiente.value = (r?.overdueOrgs || []).length > 0
  } catch {
    orgPagoPendiente.value = false
  }
}

onUnmounted(() => {
  if (clockInterval) clearInterval(clockInterval)
})

watch([marcAnio, marcMes], () => { loadMarcaciones() })

// ── Cargas async ───────────────────────────────────────────────────────────
async function loadLiquidaciones() {
  try {
    const r = await $fetch('/api/portal/liquidaciones', { headers: authHeaders() })
    liquidaciones.value = r?.liquidaciones || []
  } catch { liquidaciones.value = [] }
}

async function loadMarcaciones() {
  try {
    const r = await $fetch(
      `/api/portal/marcaciones?anio=${marcAnio.value}&mes=${marcMes.value}`,
      { headers: authHeaders() }
    )
    marcaciones.value = r?.marcaciones || []
    detectarMarcacionHoy()
  } catch { marcaciones.value = [] }
}

function detectarMarcacionHoy() {
  const today = new Date().toISOString().slice(0, 10)  // YYYY-MM-DD
  marcacionHoy.value = marcaciones.value.find(m => m.fecha === today) || null
}

async function marcar(tipo) {
  marking.value = true
  marcarError.value = ''
  try {
    const r = await $fetch('/api/portal/marcar', {
      method: 'POST',
      headers: authHeaders(),
      body: { tipo },
    })
    if (r?.ok) {
      await loadMarcaciones()
    }
  } catch (e) {
    marcarError.value = e?.data?.message || e?.message || 'Error al marcar'
  } finally {
    marking.value = false
  }
}

async function descargarLiquidacion(id, mes, anio) {
  try {
    const blob = await $fetch(`/api/portal/liquidacion-pdf?id=${id}`, {
      headers: authHeaders(),
      responseType: 'blob',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `liquidacion_${anio}_${String(mes).padStart(2,'0')}.pdf`
    document.body.appendChild(a)
    a.click()
    setTimeout(() => { URL.revokeObjectURL(url); a.remove() }, 100)
  } catch (e) {
    alert(e?.data?.message || 'No se pudo descargar el PDF')
  }
}

async function descargarContrato(contrato) {
  try {
    const blob = await $fetch(`/api/portal/contrato-pdf?id=${contrato._id}`, {
      headers: authHeaders(),
      responseType: 'blob',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `contrato_${contrato.tipo_contrato || 'doc'}.pdf`
    document.body.appendChild(a)
    a.click()
    setTimeout(() => { URL.revokeObjectURL(url); a.remove() }, 100)
  } catch (e) {
    alert(e?.data?.message || 'No se pudo descargar el contrato')
  }
}

// Mockup: solicitar firma de un documento (contrato o liquidación)
function solicitarFirma(tipo, id, descripcion) {
  // TODO: integrar con el sistema de firma real (DocuSign / FirmaVirtual / etc.)
  alert(`Solicitud de firma enviada\n\n` +
        `Documento: ${descripcion}\n` +
        `Recibirás un correo con el enlace para firmar electrónicamente.`)
}

function tipoContratoLabel(t) {
  const map = {
    indefinido:          'Contrato Indefinido',
    plazo_fijo:          'Contrato a Plazo Fijo',
    proyecto:            'Contrato por Proyecto/Obra',
    jornada:             'Contrato por Jornada',
    part_time:           'Contrato Part Time',
    honorarios:          'Boleta de Honorarios',
    sueldo_empresarial:  'Sueldo Empresarial',
  }
  return map[t] || t
}

async function handleLogout() {
  const raw = localStorage.getItem('rrhh_session')
  if (raw) {
    try {
      const s = JSON.parse(raw)
      await $fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${s.token}` } }).catch(() => {})
    } catch {}
  }
  localStorage.removeItem('rrhh_session')
  return navigateTo('/login')
}
</script>

<style scoped>
.portal-page {
  height: 100vh;
  background: #f5f7f9;
  display: flex;
  flex-direction: column;
  color: #1f2937;
  /* Scroll vertical interno — el body global tiene overflow:hidden y no
     permite scroll en páginas standalone como este portal. */
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}
.portal-header { flex-shrink: 0; position: sticky; top: 0; z-index: 10; }

/* ─── Header ─────────────────────────────────────────────────────────── */
.portal-header {
  background: #062D3A;
  color: #fff;
  padding: 14px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.portal-logo { height: 32px; width: auto; display: block; }
.portal-header__user { display: flex; align-items: center; gap: 14px; }
.portal-user-name  { font-weight: 700; }
.portal-user-org   { color: #0DCFA8; font-size: 13px; }
.portal-logout {
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.12);
  color: #fff;
  border-radius: 8px;
  padding: 7px 13px;
  cursor: pointer;
  font-size: 13px;
  display: inline-flex; align-items: center; gap: 6px;
}
.portal-logout:hover { background: rgba(255,255,255,0.14); }

/* ─── Main ───────────────────────────────────────────────────────────── */
.portal-main {
  max-width: 1100px;
  width: 100%;
  margin: 0 auto;
  padding: 24px;
  flex: 1;
}

/* ─── Tabs ───────────────────────────────────────────────────────────── */
.portal-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid #e5e7eb;
  margin-bottom: 24px;
  overflow-x: auto;
}
.portal-tab {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 11px 18px;
  background: transparent;
  border: none;
  color: #6b7280;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  white-space: nowrap;
}
.portal-tab:hover { color: #1f2937; }
.portal-tab.active { color: #0DCFA8; border-bottom-color: #0DCFA8; }

.portal-billing-alert {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 18px;
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-radius: 12px;
  color: #92400e;
  margin-bottom: 20px;
  font-size: 13.5px;
  line-height: 1.45;
}
.portal-billing-alert strong { display: block; margin-bottom: 2px; color: #78350f; }
.portal-billing-alert span { opacity: 0.92; }

.tab-section { animation: fadeIn 0.18s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

/* ─── Tab Inicio (Home) ───────────────────────────────────────────────── */
.welcome-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 24px 28px;
  margin-bottom: 18px;
}
.welcome-title {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 22px;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 6px;
}
.welcome-lede {
  font-size: 14px;
  color: #64748b;
  line-height: 1.5;
  margin: 0;
  max-width: 640px;
}

.home-grid {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 18px;
}
@media (max-width: 700px) {
  .home-grid { grid-template-columns: 1fr; }
}
.home-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 22px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.home-card--vacaciones {
  flex-direction: row;
  align-items: center;
  gap: 16px;
}
.home-card__icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: rgba(13, 207, 168, 0.12);
  color: #0DCFA8;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  flex-shrink: 0;
}
.home-card__body { display: flex; flex-direction: column; gap: 4px; }
.home-card__label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: #64748b;
  text-transform: uppercase;
}
.home-card__value {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 26px;
  font-weight: 700;
  color: #0f172a;
}
.home-card__value small {
  font-size: 13px;
  font-weight: 500;
  color: #64748b;
  margin-left: 4px;
}
.home-card__hint {
  font-size: 11px;
  color: #94a3b8;
}

.home-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.home-card__header h3 {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 15px;
  font-weight: 700;
  margin: 0;
  color: #0f172a;
}
.btn-text {
  background: none;
  border: none;
  color: #0DCFA8;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}
.btn-text:disabled { opacity: 0.4; cursor: not-allowed; }

.home-card__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.solicitud-row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
  background: #f9fafb;
  border-radius: 8px;
  font-size: 13px;
}
.solicitud-tipo {
  font-weight: 600;
  text-transform: capitalize;
}
.solicitud-tipo--permiso { color: #f97316; }
.solicitud-tipo--administrativo { color: #0DCFA8; }
.solicitud-tipo--vacaciones { color: #6366f1; }
.solicitud-fecha { color: #64748b; font-size: 12px; }
.solicitud-estado {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  padding: 3px 8px;
  border-radius: 4px;
}
.estado-pendiente { background: #fef3c7; color: #92400e; }
.estado-aprobado  { background: #d1fae5; color: #065f46; }
.estado-rechazado { background: #fee2e2; color: #991b1b; }

.home-card__empty {
  font-size: 13px;
  color: #64748b;
}
.home-card__empty p { margin: 0 0 6px; }
.home-card__empty .muted { color: #94a3b8; font-size: 12px; }
.home-card__empty strong { color: #475569; }

/* Aviso "no puedes marcar" en tab Marcar */
.marcar-warning {
  margin-top: 14px;
  padding: 10px 14px;
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-radius: 8px;
  color: #92400e;
  font-size: 13px;
  text-align: center;
}

/* ─── Marcar entrada/salida ─────────────────────────────────────────── */
.marcar-card {
  background: #fff;
  border-radius: 16px;
  padding: 36px 30px;
  text-align: center;
  box-shadow: 0 4px 16px rgba(0,0,0,0.05);
  max-width: 540px;
  margin: 0 auto;
}
.marcar-clock {
  font-size: 64px;
  font-weight: 700;
  color: #062D3A;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  letter-spacing: -2px;
}
.marcar-date {
  margin-top: 4px;
  color: #6b7280;
  font-size: 14px;
  text-transform: capitalize;
}
.marcar-status {
  margin: 22px auto 6px;
  background: #f9fafb;
  border-radius: 12px;
  padding: 14px;
  max-width: 280px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.marcar-status__row { display: flex; justify-content: space-between; font-size: 14px; }
.marcar-actions {
  margin-top: 22px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.btn--marcar {
  padding: 14px 16px;
  border: none;
  border-radius: 12px;
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  transition: opacity 0.15s ease;
}
.btn--marcar:disabled { opacity: 0.4; cursor: not-allowed; }
.btn--entrada { background: #0DCFA8; color: #062D3A; }
.btn--salida  { background: #062D3A; color: #fff; }
.error-msg {
  margin-top: 14px;
  color: #ef4444;
  font-size: 13px;
}

/* ─── Datos ──────────────────────────────────────────────────────────── */
.data-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 14px;
}
.data-card {
  background: #fff;
  border-radius: 12px;
  padding: 18px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
.data-card--wide { grid-column: 1 / -1; }
.data-card h3 {
  font-size: 13px;
  font-weight: 700;
  color: #0DCFA8;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  margin: 0 0 12px;
}
.data-rows { display: flex; flex-direction: column; gap: 9px; }
.data-row {
  display: grid;
  grid-template-columns: 130px 1fr;
  align-items: baseline;
  gap: 10px;
  font-size: 13.5px;
}
.data-row span { color: #6b7280; }
.data-row strong { color: #1f2937; font-weight: 600; }

.contratos-list { display: flex; flex-direction: column; gap: 12px; }
.contrato-item {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 12px 14px;
  background: #fafbfb;
}
.contrato-item__head { display: flex; justify-content: space-between; align-items: center; }
.contrato-item__body { font-size: 13px; color: #4b5563; margin-top: 8px; display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 6px; }
.contrato-item__body span { color: #9ca3af; margin-right: 4px; }
.contrato-badge {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 999px;
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 0.4px;
}
.contrato-badge.ok     { background: rgba(13,207,168,0.12);  color: #0DCFA8; }
.contrato-badge.danger { background: rgba(239,68,68,0.12);   color: #ef4444; }
.contrato-badge.muted  { background: rgba(107,114,128,0.12); color: #6b7280; }

/* ─── Tab Contratos (portal trabajador) ──────────────────────────────── */
.doc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 14px;
}
.doc-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.doc-card__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.doc-card__type {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
}
.doc-card__badge {
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 999px;
  text-transform: uppercase;
  font-weight: 700;
  background: rgba(107,114,128,0.12);
  color: #6b7280;
}
.doc-card__badge.vigente,
.doc-card__badge.activo { background: rgba(13,207,168,0.14); color: #0DCFA8; }
.doc-card__body { display: flex; flex-direction: column; gap: 6px; }
.doc-card__row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}
.doc-card__row span { color: #64748b; }
.doc-card__row strong { color: #0f172a; font-weight: 600; }
.doc-card__actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 12px;
  border-top: 1px solid #f1f5f9;
}

/* Botón "Firmar online" — secundario con icono cadena */
.btn-link--firma {
  color: #0DCFA8 !important;
  font-weight: 600;
}
.btn-link--firma:hover { background: rgba(13, 207, 168, 0.08); }

/* Acciones del card liquidación: stack vertical para incluir firma */
.liq-card__actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
}

/* ─── Liquidaciones ──────────────────────────────────────────────────── */
.liq-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 14px;
}
.liq-card {
  background: #fff;
  border-radius: 12px;
  padding: 18px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
.liq-card__head { display: flex; justify-content: space-between; align-items: center; }
.liq-card__month {
  font-size: 13px;
  font-weight: 700;
  color: #1f2937;
  text-transform: capitalize;
}
.liq-card__badge {
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 999px;
  text-transform: uppercase;
  font-weight: 700;
  background: rgba(107,114,128,0.12);
  color: #6b7280;
}
.liq-card__badge.pagada { background: rgba(13,207,168,0.14); color: #0DCFA8; }
.liq-card__amount {
  margin-top: 14px;
  font-size: 26px;
  font-weight: 700;
  color: #0DCFA8;
  letter-spacing: -1px;
}
.liq-card__sub { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.4px; }
.btn-link {
  background: #0DCFA8;
  border: 1px solid #0DCFA8;
  color: #ffffff;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  transition: all 0.15s;
}
.btn-link:hover {
  background: #15dab3;
  border-color: #15dab3;
}
/* Variante secundaria para "Firmar online" — outline teal */
.btn-link--firma {
  background: transparent !important;
  border: 1px solid #0DCFA8 !important;
  color: #0DCFA8 !important;
}
.btn-link--firma:hover {
  background: rgba(13, 207, 168, 0.1) !important;
  color: #0DCFA8 !important;
}

/* ─── Marcaciones ────────────────────────────────────────────────────── */
.marc-toolbar { display: flex; gap: 8px; margin-bottom: 14px; }
.select-month {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 7px 11px;
  font-size: 13px;
  color: #1f2937;
}
.marc-table-wrap {
  background: #fff;
  border-radius: 12px;
  overflow: auto;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
.marc-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.marc-table th {
  background: #f9fafb;
  color: #6b7280;
  text-align: left;
  padding: 10px 12px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.marc-table td { padding: 9px 12px; border-bottom: 1px solid #f3f4f6; }
.marc-state {
  display: inline-block;
  font-size: 10.5px;
  text-transform: uppercase;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(107,114,128,0.12);
  color: #6b7280;
}
.marc-state.confirmada { background: rgba(13,207,168,0.14); color: #0DCFA8; }
.marc-state.rechazada  { background: rgba(239,68,68,0.14);  color: #ef4444; }

/* ─── Empty state ────────────────────────────────────────────────────── */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #6b7280;
}
.empty-state h2 { margin-top: 14px; font-size: 18px; color: #1f2937; }
.empty-state p  { margin-top: 8px; font-size: 14px; }
.muted { color: #9ca3af; }
.spinner {
  width: 32px; height: 32px;
  border: 3px solid rgba(13,207,168,0.2);
  border-top-color: #0DCFA8;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 600px) {
  .marcar-clock { font-size: 48px; }
  .marcar-actions { grid-template-columns: 1fr; }
  .data-row { grid-template-columns: 110px 1fr; font-size: 12.5px; }
  .portal-main { padding: 16px; padding-bottom: 80px; /* safe area iOS */ }
  /* Tabs en móvil: scroll horizontal + iconos más compactos */
  .portal-tabs {
    margin: 0 -16px 18px;
    padding: 0 12px;
    -webkit-overflow-scrolling: touch;
  }
  .portal-tab {
    padding: 10px 12px;
    font-size: 13px;
    gap: 5px;
  }
}
</style>
