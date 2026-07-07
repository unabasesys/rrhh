<template>
  <div class="billing-page">
    <!-- Header -->
    <div class="page-header">
      <div class="page-header__left">
        <h2 class="page-title">
          <i class="u u-ventas"></i>
          Facturación · Planes
        </h2>
        <span class="page-subtitle">Gestión de planes y pagos por organización</span>
      </div>
    </div>

    <!-- Auth loading -->
    <div v-if="authLoading" class="access-denied">
      <div class="spinner-lg"></div>
      <p style="color:#6b7280;font-size:13px">Verificando acceso...</p>
    </div>

    <!-- Acceso denegado -->
    <div v-else-if="!isSuperAdmin" class="access-denied">
      <i class="u u-locked" style="font-size:48px;color:#4b5563"></i>
      <h3>Acceso restringido</h3>
      <p>Solo el super-administrador puede gestionar facturación.</p>
      <button class="btn btn--secondary" @click="$router.back()">Volver</button>
    </div>

    <template v-else>
      <!-- Stats row -->
      <div class="stats-row">
        <div class="stat-card">
          <span class="stat-value">{{ orgs.length }}</span>
          <span class="stat-label">Total orgs</span>
        </div>
        <div class="stat-card">
          <span class="stat-value stat-value--teal">{{ orgs.filter(o => o.plan === 'free').length }}</span>
          <span class="stat-label">Plan Free</span>
        </div>
        <div class="stat-card">
          <span class="stat-value stat-value--coral">{{ orgs.filter(o => o.plan === 'paid').length }}</span>
          <span class="stat-label">Plan Paid</span>
        </div>
        <div class="stat-card">
          <span class="stat-value stat-value--coral">${{ ingresosMes.toLocaleString('en-US') }}</span>
          <span class="stat-label">USD/mes estimado</span>
        </div>
        <div class="stat-card">
          <span class="stat-value" style="font-size:16px">{{ formatCLP(ingresosMes * CLP_PER_USD) }}</span>
          <span class="stat-label">CLP/mes estimado</span>
        </div>
      </div>

      <!-- Loading orgs -->
      <div v-if="loadingOrgs" class="empty-state">
        <div class="spinner-lg" style="margin: 0 auto 12px"></div>
        <p>Cargando datos de facturación...</p>
      </div>

      <!-- Empty -->
      <div v-else-if="orgs.length === 0" class="empty-state">
        <i class="u u-empresa" style="font-size:48px;color:#374151;margin-bottom:12px;display:block"></i>
        <p>No hay organizaciones registradas.</p>
      </div>

      <!-- Table -->
      <div v-else class="table-wrap">
        <table class="billing-table">
          <thead>
            <tr>
              <th>Organización</th>
              <th>Plan</th>
              <th class="text-right">Trabajadores</th>
              <th class="text-right">Costo/mes USD</th>
              <th class="text-right">Costo/mes CLP</th>
              <th>Email facturación</th>
              <th>Estado</th>
              <th>Próx. renovación</th>
              <th class="text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="org in orgs" :key="org._id">
              <!-- Org name + logo -->
              <td>
                <div class="org-cell">
                  <div class="org-avatar">
                    <img v-if="org.logo" :src="org.logo" :alt="org.nombre" />
                    <span v-else>{{ org.nombre?.charAt(0).toUpperCase() }}</span>
                  </div>
                  <div class="org-info">
                    <span class="org-name">{{ org.nombre }}</span>
                    <span class="org-id">{{ org._id }}</span>
                  </div>
                </div>
              </td>

              <!-- Plan badge -->
              <td>
                <span class="plan-badge" :class="org.plan === 'paid' ? 'plan-badge--paid' : 'plan-badge--free'">
                  {{ org.plan === 'paid' ? 'PAID' : 'FREE' }}
                </span>
              </td>

              <!-- Workers -->
              <td class="text-right">
                <span class="num">{{ org.workersActivos }}</span>
              </td>

              <!-- Monthly USD -->
              <td class="text-right">
                <span class="num" :class="org.plan === 'paid' ? 'num--highlight' : 'num--muted'">
                  {{ org.plan === 'paid' ? `$${org.monthlyCostUSD.toLocaleString('en-US')}` : '—' }}
                </span>
              </td>

              <!-- Monthly CLP -->
              <td class="text-right">
                <span class="num num--sm" :class="org.plan === 'paid' ? '' : 'num--muted'">
                  {{ org.plan === 'paid' ? formatCLP(org.monthlyCostUSD * CLP_PER_USD) : '—' }}
                </span>
              </td>

              <!-- Billing email -->
              <td>
                <span class="email-cell">{{ org.billingEmail || '—' }}</span>
              </td>

              <!-- Billing status -->
              <td>
                <span class="status-badge" :class="`status-badge--${org.billingStatus || 'active'}`">
                  {{ statusLabel(org.billingStatus) }}
                </span>
              </td>

              <!-- Renovación -->
              <td>
                <span class="date-cell">{{ org.billingRenovacion ? formatDate(org.billingRenovacion) : '—' }}</span>
              </td>

              <!-- Actions -->
              <td class="text-center">
                <div class="actions-cell">
                  <button class="action-btn action-btn--plan" @click="openPlanModal(org)" title="Cambiar plan">
                    <i class="u u-edit"></i>
                    <span>Plan</span>
                  </button>
                  <button
                    class="action-btn action-btn--pay"
                    @click="openPayModal(org)"
                    :disabled="org.plan === 'free' || org.workersActivos === 0"
                    title="Procesar pago"
                  >
                    <i class="u u-ventas"></i>
                    <span>Cobrar</span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Gateway status section -->
      <div class="section-label" style="margin-top:36px">Pasarelas de pago configuradas</div>
      <div class="gateways-row">
        <div
          v-for="gw in gateways"
          :key="gw.key"
          class="gateway-card"
          :class="{ 'gateway-card--ready': gatewayStatus[gw.key], 'gateway-card--pending': !gatewayStatus[gw.key] }"
        >
          <div class="gateway-icon">{{ gw.icon }}</div>
          <div class="gateway-body">
            <div class="gateway-name">{{ gw.name }}</div>
            <div class="gateway-coverage">{{ gw.coverage }}</div>
            <div class="gateway-env">
              <code>{{ gw.envVar }}</code>
            </div>
          </div>
          <div class="gateway-status">
            <span v-if="gatewayStatus[gw.key]" class="status-dot status-dot--green">Listo</span>
            <span v-else class="status-dot status-dot--amber">Pendiente configuración</span>
          </div>
        </div>
      </div>
    </template>

    <!-- ── Modal: Cambiar plan ─────────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="planModal.open" class="modal-overlay">
        <div class="modal-box">
          <div class="modal-header">
            <span>Cambiar plan · {{ planModal.org?.nombre }}</span>
            <button class="modal-close" @click="planModal.open = false"><i class="u u-x"></i></button>
          </div>
          <div class="modal-body">
            <div class="form-field">
              <label>Plan</label>
              <div class="plan-selector">
                <button
                  class="plan-option"
                  :class="{ 'plan-option--active-free': planForm.plan === 'free' }"
                  @click="planForm.plan = 'free'"
                >
                  <span class="plan-option__badge plan-badge--free">FREE</span>
                  <span class="plan-option__desc">Sin costo mensual</span>
                </button>
                <button
                  class="plan-option"
                  :class="{ 'plan-option--active-paid': planForm.plan === 'paid' }"
                  @click="planForm.plan = 'paid'"
                >
                  <span class="plan-option__badge plan-badge--paid">PAID</span>
                  <span class="plan-option__desc">${{ planForm.planPrecioUSD }} USD por trabajador/mes</span>
                </button>
              </div>
            </div>

            <div class="form-field" style="margin-top:16px">
              <label>Precio por trabajador (USD)</label>
              <input v-model.number="planForm.planPrecioUSD" type="number" min="1" class="form-input" />
            </div>

            <div class="form-field" style="margin-top:16px">
              <label>Email de facturación</label>
              <input v-model="planForm.billingEmail" type="email" placeholder="facturacion@empresa.com" class="form-input" />
            </div>

            <div class="form-field" style="margin-top:16px">
              <label>Estado de facturación</label>
              <select v-model="planForm.billingStatus" class="form-input">
                <option value="active">Activo</option>
                <option value="trialing">En prueba</option>
                <option value="past_due">Pago vencido</option>
                <option value="canceled">Cancelado</option>
              </select>
            </div>

            <div class="form-field" style="margin-top:16px">
              <label>Próxima renovación</label>
              <input v-model="planForm.billingRenovacion" type="date" class="form-input" />
            </div>

            <div v-if="planModal.error" class="form-error">
              <i class="u u-warning"></i> {{ planModal.error }}
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn--secondary" @click="planModal.open = false">Cancelar</button>
            <button class="btn btn--primary" @click="savePlan" :disabled="planModal.loading">
              <span v-if="planModal.loading" class="spinner-sm"></span>
              <span v-else>Guardar cambios</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ── Modal: Procesar pago ───────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="payModal.open" class="modal-overlay">
        <div class="modal-box">
          <div class="modal-header">
            <span>Procesar pago · {{ payModal.org?.nombre }}</span>
            <button class="modal-close" @click="payModal.open = false"><i class="u u-x"></i></button>
          </div>
          <div class="modal-body">
            <!-- Amount summary -->
            <div class="pay-summary">
              <div class="pay-summary__row">
                <span>Trabajadores activos</span>
                <strong>{{ payModal.org?.workersActivos }}</strong>
              </div>
              <div class="pay-summary__row">
                <span>Precio por trabajador</span>
                <strong>${{ payModal.org?.planPrecioUSD ?? 40 }} USD</strong>
              </div>
              <div class="pay-summary__divider"></div>
              <div class="pay-summary__row pay-summary__row--total">
                <span>Total del mes</span>
                <strong class="pay-total-usd">${{ payModal.totalUSD?.toLocaleString('en-US') }} USD</strong>
              </div>
              <div class="pay-summary__row pay-summary__row--clp">
                <span>Equivalente CLP (ref. {{ CLP_PER_USD }}/USD)</span>
                <strong>{{ formatCLP(payModal.totalUSD * CLP_PER_USD) }}</strong>
              </div>
            </div>

            <!-- Gateway buttons -->
            <div class="section-label" style="margin-top:20px;margin-bottom:12px">Seleccionar pasarela de pago</div>
            <div class="gateway-buttons">
              <!-- Stripe -->
              <button
                class="gw-btn gw-btn--stripe"
                :class="{ 'gw-btn--disabled': !gatewayStatus.stripe }"
                @click="processCheckout('stripe')"
                :disabled="payModal.procesando || !gatewayStatus.stripe"
              >
                <span class="gw-btn__icon">S</span>
                <div class="gw-btn__info">
                  <span class="gw-btn__name">Stripe</span>
                  <span class="gw-btn__sub">Global · USD</span>
                </div>
                <span v-if="!gatewayStatus.stripe" class="gw-btn__warn">
                  <i class="u u-warning"></i> Sin configurar
                </span>
              </button>

              <!-- MercadoPago -->
              <button
                class="gw-btn gw-btn--mp"
                :class="{ 'gw-btn--disabled': !gatewayStatus.mercadopago }"
                @click="processCheckout('mercadopago')"
                :disabled="payModal.procesando || !gatewayStatus.mercadopago"
              >
                <span class="gw-btn__icon" style="background:#009ee3">M</span>
                <div class="gw-btn__info">
                  <span class="gw-btn__name">MercadoPago</span>
                  <span class="gw-btn__sub">Latinoamérica · CLP/USD</span>
                </div>
                <span v-if="!gatewayStatus.mercadopago" class="gw-btn__warn">
                  <i class="u u-warning"></i> Sin configurar
                </span>
              </button>

              <!-- Transbank -->
              <button
                class="gw-btn gw-btn--tb"
                :class="{ 'gw-btn--disabled': !gatewayStatus.transbank }"
                @click="processCheckout('transbank')"
                :disabled="payModal.procesando || !gatewayStatus.transbank"
              >
                <span class="gw-btn__icon" style="background:#e4002b">T</span>
                <div class="gw-btn__info">
                  <span class="gw-btn__name">Transbank Webpay</span>
                  <span class="gw-btn__sub">Chile · CLP</span>
                </div>
                <span v-if="!gatewayStatus.transbank" class="gw-btn__warn">
                  <i class="u u-warning"></i> Sin configurar
                </span>
              </button>
            </div>

            <div v-if="!gatewayStatus.stripe && !gatewayStatus.mercadopago && !gatewayStatus.transbank" class="form-warning">
              <i class="u u-warning"></i>
              Ninguna pasarela está configurada. Define las variables de entorno correspondientes y reinicia el servidor.
            </div>

            <div v-if="payModal.error" class="form-error" style="margin-top:12px">
              <i class="u u-warning"></i> {{ payModal.error }}
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn--secondary" @click="payModal.open = false">Cerrar</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Toast -->
    <Teleport to="body">
      <transition name="toast-fade">
        <div v-if="toast.show" class="toast" :class="`toast--${toast.type}`">
          <i :class="toast.type === 'success' ? 'u u-check' : 'u u-warning'"></i>
          {{ toast.msg }}
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'

definePageMeta({ layout: 'rrhh' })
useHead({ title: 'Facturación · RRHH' })

const router = useRouter()

const { useAuthStore } = await import('@/stores/auth')
const authStore = useAuthStore()

const authLoading = ref(true)
const loadingOrgs = ref(false)
const orgs        = ref([])
const gatewayStatus = ref({ stripe: false, mercadopago: false, transbank: false })

const CLP_PER_USD = 950

const isSuperAdmin = computed(() => authStore.isSuperAdmin)

const ingresosMes = computed(() =>
  orgs.value
    .filter(o => o.plan === 'paid')
    .reduce((sum, o) => sum + (o.monthlyCostUSD || 0), 0)
)

// ── Fetch ──────────────────────────────────────────────────────────────────
async function fetchBilling() {
  loadingOrgs.value = true
  try {
    const data = await $fetch('/api/rrhh/billing', {
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
    orgs.value = data.orgs || []
  } catch (err) {
    showToast(err?.data?.message || 'Error al cargar facturación', 'error')
  } finally {
    loadingOrgs.value = false
  }
}

async function fetchGatewayStatus() {
  try {
    gatewayStatus.value = await $fetch('/api/rrhh/billing/gateway-status', {
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
  } catch {
    // silencioso
  }
}

onMounted(async () => {
  await authStore.init()
  authLoading.value = false
  if (authStore.isSuperAdmin) {
    await Promise.all([fetchBilling(), fetchGatewayStatus()])
  }
})

// ── Formatters ─────────────────────────────────────────────────────────────
function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CL', { year: 'numeric', month: 'short', day: '2-digit' })
}

function formatCLP(amount) {
  return `$${Math.round(amount).toLocaleString('es-CL')} CLP`
}

function statusLabel(status) {
  return {
    active:   'Activo',
    trialing: 'En prueba',
    past_due: 'Vencido',
    canceled: 'Cancelado',
  }[status] || status
}

// ── Gateways config ────────────────────────────────────────────────────────
const gateways = [
  {
    key:      'stripe',
    name:     'Stripe',
    icon:     'S',
    coverage: 'Global (USD)',
    envVar:   'STRIPE_SECRET_KEY',
  },
  {
    key:      'mercadopago',
    name:     'MercadoPago',
    icon:     'M',
    coverage: 'Latinoamérica (CLP/USD)',
    envVar:   'MP_ACCESS_TOKEN',
  },
  {
    key:      'transbank',
    name:     'Transbank Webpay',
    icon:     'T',
    coverage: 'Chile (CLP)',
    envVar:   'TB_COMMERCE_CODE + TB_API_KEY_SECRET',
  },
]

// ── Modal: Cambiar plan ────────────────────────────────────────────────────
const planModal = reactive({ open: false, org: null, loading: false, error: '' })
const planForm  = reactive({
  plan:              'free',
  planPrecioUSD:     40,
  billingEmail:      '',
  billingStatus:     'active',
  billingRenovacion: '',
})

function openPlanModal(org) {
  Object.assign(planForm, {
    plan:              org.plan || 'free',
    planPrecioUSD:     org.planPrecioUSD ?? 40,
    billingEmail:      org.billingEmail || '',
    billingStatus:     org.billingStatus || 'active',
    billingRenovacion: org.billingRenovacion
      ? new Date(org.billingRenovacion).toISOString().slice(0, 10)
      : '',
  })
  Object.assign(planModal, { open: true, org, error: '' })
}

async function savePlan() {
  planModal.error   = ''
  planModal.loading = true
  try {
    await $fetch(`/api/rrhh/billing/${planModal.org._id}`, {
      method:  'PUT',
      headers: { Authorization: `Bearer ${authStore.token}` },
      body: {
        plan:              planForm.plan,
        planPrecioUSD:     planForm.planPrecioUSD,
        billingEmail:      planForm.billingEmail,
        billingStatus:     planForm.billingStatus,
        billingRenovacion: planForm.billingRenovacion || null,
      },
    })
    planModal.open = false
    showToast('Plan actualizado', 'success')
    await fetchBilling()
  } catch (err) {
    planModal.error = err?.data?.message || 'Error al guardar'
  } finally {
    planModal.loading = false
  }
}

// ── Modal: Procesar pago ───────────────────────────────────────────────────
const payModal = reactive({ open: false, org: null, totalUSD: 0, procesando: false, error: '' })

function openPayModal(org) {
  const totalUSD = (org.workersActivos || 0) * (org.planPrecioUSD ?? 40)
  Object.assign(payModal, { open: true, org, totalUSD, procesando: false, error: '' })
}

async function processCheckout(gateway) {
  payModal.procesando = true
  payModal.error      = ''
  const base = window.location.origin

  try {
    if (gateway === 'stripe') {
      const data = await $fetch('/api/rrhh/billing/checkout/stripe', {
        method:  'POST',
        headers: { Authorization: `Bearer ${authStore.token}` },
        body: {
          orgId:      payModal.org._id,
          successUrl: `${base}/rrhh/admin/billing?payment=success`,
          cancelUrl:  `${base}/rrhh/admin/billing?payment=canceled`,
        },
      })
      window.location.href = data.url

    } else if (gateway === 'mercadopago') {
      const data = await $fetch('/api/rrhh/billing/checkout/mercadopago', {
        method:  'POST',
        headers: { Authorization: `Bearer ${authStore.token}` },
        body: {
          orgId:      payModal.org._id,
          successUrl: `${base}/rrhh/admin/billing?payment=success`,
          failureUrl: `${base}/rrhh/admin/billing?payment=failure`,
          pendingUrl: `${base}/rrhh/admin/billing?payment=pending`,
        },
      })
      window.location.href = data.init_point

    } else if (gateway === 'transbank') {
      const data = await $fetch('/api/rrhh/billing/checkout/transbank', {
        method:  'POST',
        headers: { Authorization: `Bearer ${authStore.token}` },
        body: {
          orgId:     payModal.org._id,
          returnUrl: `${base}/rrhh/admin/billing?payment=transbank`,
        },
      })
      // Transbank: redirigir con token en el form (método POST estándar)
      // Aquí usamos GET con token como parámetro de query para simplificar
      window.location.href = `${data.url}?token_ws=${data.token}`
    }
  } catch (err) {
    payModal.error = err?.data?.message || 'Error al iniciar el pago'
  } finally {
    payModal.procesando = false
  }
}

// ── Toast ──────────────────────────────────────────────────────────────────
const toast = reactive({ show: false, msg: '', type: 'success' })
let toastTimer = null

function showToast(msg, type = 'success') {
  clearTimeout(toastTimer)
  Object.assign(toast, { show: true, msg, type })
  toastTimer = setTimeout(() => { toast.show = false }, 3000)
}
</script>

<style scoped>
.billing-page {
  padding: 28px 32px;
  max-width: 1300px;
  margin: 0 auto;
}

/* ── Header ── */
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 24px;
  gap: 16px;
}

.page-title {
  font-size: 20px;
  font-weight: 800;
  color: var(--neutral-text-title, #fff);
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
}

.page-subtitle {
  font-size: 12px;
  color: #6b7280;
  display: block;
  margin-top: 4px;
  padding-left: 30px;
}

/* ── Stats ── */
.stats-row {
  display: flex;
  gap: 14px;
  margin-bottom: 28px;
  flex-wrap: wrap;
}

.stat-card {
  background: rgba(42,157,143,0.08);
  border: 1px solid rgba(42,157,143,0.15);
  border-radius: 12px;
  padding: 16px 22px;
  text-align: center;
  min-width: 110px;
  flex: 1;
}

.stat-value {
  display: block;
  font-size: 26px;
  font-weight: 800;
  color: #2a9d8f;
}
.stat-value--teal  { color: #0DCFA8; }
.stat-value--coral { color: #E07856; }
.stat-label {
  font-size: 10px;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  display: block;
  margin-top: 2px;
}

/* ── Table ── */
.table-wrap {
  background: #132028;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 14px;
  overflow-x: auto;
}

.billing-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.billing-table thead tr {
  background: rgba(0,0,0,0.2);
}

.billing-table th {
  padding: 12px 16px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #6b7280;
  text-align: left;
  white-space: nowrap;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.billing-table td {
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  color: #e5e7eb;
  vertical-align: middle;
}

.billing-table tbody tr:hover td {
  background: rgba(255,255,255,0.025);
}

.billing-table tbody tr:last-child td {
  border-bottom: none;
}

.text-right  { text-align: right !important; }
.text-center { text-align: center !important; }

/* Org cell */
.org-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.org-avatar {
  width: 36px;
  height: 36px;
  border-radius: 9px;
  background: rgba(42,157,143,0.12);
  border: 1px solid rgba(42,157,143,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  font-size: 16px;
  font-weight: 800;
  color: #2a9d8f;
}

.org-avatar img { width: 100%; height: 100%; object-fit: contain; }

.org-info { display: flex; flex-direction: column; gap: 2px; }
.org-name { font-weight: 700; color: #e5e7eb; font-size: 13px; }
.org-id   { font-size: 10px; color: #6b7280; font-family: monospace; }

/* Plan badge */
.plan-badge {
  display: inline-block;
  padding: 3px 9px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.plan-badge--free { background: rgba(13,207,168,0.15); color: #0DCFA8; border: 1px solid rgba(13,207,168,0.25); }
.plan-badge--paid { background: rgba(224,120,86,0.15); color: #E07856; border: 1px solid rgba(224,120,86,0.25); }

/* Status badge */
.status-badge {
  display: inline-block;
  padding: 3px 9px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.status-badge--active   { background: rgba(34,197,94,0.12);  color: #4ade80; border: 1px solid rgba(34,197,94,0.2); }
.status-badge--trialing { background: rgba(59,130,246,0.12); color: #60a5fa; border: 1px solid rgba(59,130,246,0.2); }
.status-badge--past_due { background: rgba(245,158,11,0.12); color: #fbbf24; border: 1px solid rgba(245,158,11,0.2); }
.status-badge--canceled { background: rgba(239,68,68,0.12);  color: #f87171; border: 1px solid rgba(239,68,68,0.2); }

/* Numbers */
.num         { font-weight: 700; font-variant-numeric: tabular-nums; }
.num--highlight { color: #E07856; }
.num--muted     { color: #4b5563; }
.num--sm        { font-size: 12px; }

.email-cell { color: #9ca3af; font-size: 12px; }
.date-cell  { color: #9ca3af; font-size: 12px; }

/* Actions */
.actions-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: center;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 7px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.04);
  color: #9ca3af;
  cursor: pointer;
  font-size: 11px;
  font-weight: 700;
  font-family: inherit;
  transition: all 0.15s;
  white-space: nowrap;
}

.action-btn--plan:hover {
  background: rgba(13,207,168,0.12);
  border-color: rgba(13,207,168,0.3);
  color: #0DCFA8;
}

.action-btn--pay:hover:not(:disabled) {
  background: rgba(224,120,86,0.12);
  border-color: rgba(224,120,86,0.3);
  color: #E07856;
}

.action-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* ── Gateways section ── */
.section-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #4b5563;
  margin-bottom: 14px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.gateways-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
  margin-bottom: 32px;
}

.gateway-card {
  background: #132028;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
  padding: 18px;
  display: flex;
  align-items: flex-start;
  gap: 14px;
  transition: border-color 0.2s;
}
.gateway-card--ready   { border-color: rgba(34,197,94,0.2); }
.gateway-card--pending { border-color: rgba(245,158,11,0.15); }

.gateway-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgba(255,255,255,0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 900;
  color: #e5e7eb;
  flex-shrink: 0;
}

.gateway-body { flex: 1; display: flex; flex-direction: column; gap: 3px; }
.gateway-name { font-size: 14px; font-weight: 700; color: #e5e7eb; }
.gateway-coverage { font-size: 11px; color: #9ca3af; }
.gateway-env { margin-top: 4px; }
.gateway-env code {
  font-size: 10px;
  background: rgba(0,0,0,0.3);
  padding: 2px 6px;
  border-radius: 4px;
  color: #0DCFA8;
  font-family: monospace;
}

.gateway-status { flex-shrink: 0; }

.status-dot {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
}
.status-dot--green { background: rgba(34,197,94,0.12); color: #4ade80; border: 1px solid rgba(34,197,94,0.2); }
.status-dot--amber { background: rgba(245,158,11,0.12); color: #fbbf24; border: 1px solid rgba(245,158,11,0.2); }

/* ── Modals ── */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.75);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000; padding: 20px;
}

.modal-box {
  background: #0f1923;
  border: 1px solid rgba(42,157,143,0.2);
  border-radius: 16px;
  width: 100%;
  max-width: 520px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.5);
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  font-size: 15px; font-weight: 700; color: #e5e7eb;
  position: sticky; top: 0; background: #0f1923; z-index: 1;
}

.modal-close {
  background: none; border: none; color: #6b7280; cursor: pointer;
  padding: 4px; border-radius: 6px; font-size: 16px;
  display: flex; align-items: center;
}
.modal-close:hover { color: #e5e7eb; }

.modal-body { padding: 22px; }

.modal-footer {
  display: flex; justify-content: flex-end; gap: 10px;
  padding: 16px 22px;
  border-top: 1px solid rgba(255,255,255,0.06);
  position: sticky; bottom: 0; background: #0f1923;
}

/* Plan selector */
.plan-selector {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 6px;
}

.plan-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  padding: 14px;
  border-radius: 10px;
  border: 2px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.03);
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
}

.plan-option:hover {
  border-color: rgba(255,255,255,0.15);
}

.plan-option--active-free {
  border-color: rgba(13,207,168,0.5) !important;
  background: rgba(13,207,168,0.08) !important;
}

.plan-option--active-paid {
  border-color: rgba(224,120,86,0.5) !important;
  background: rgba(224,120,86,0.08) !important;
}

.plan-option__badge { /* plan-badge styles already defined */ }
.plan-option__desc  { font-size: 11px; color: #9ca3af; }

/* Form */
.form-field { display: flex; flex-direction: column; gap: 7px; }

.form-field label {
  font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.08em;
  color: #9ca3af;
}

.form-input {
  width: 100%; padding: 10px 13px;
  background: #1e2d3a;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 9px; color: #e5e7eb;
  font-size: 14px; font-family: inherit;
  outline: none; transition: border-color 0.2s; box-sizing: border-box;
}
.form-input:focus { border-color: rgba(42,157,143,0.6); }
.form-input option { background: #1e2d3a; }

.form-error {
  display: flex; align-items: center; gap: 7px;
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.25);
  border-radius: 8px;
  padding: 9px 13px; font-size: 13px; color: #fca5a5; margin-top: 8px;
}

.form-warning {
  display: flex; align-items: flex-start; gap: 8px;
  background: rgba(245,158,11,0.08);
  border: 1px solid rgba(245,158,11,0.2);
  border-radius: 8px;
  padding: 10px 13px; font-size: 12px; color: #fbbf24; margin-top: 14px;
  line-height: 1.5;
}

/* Pay summary */
.pay-summary {
  background: rgba(0,0,0,0.2);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px;
  padding: 16px 18px;
}

.pay-summary__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: #9ca3af;
  padding: 4px 0;
}

.pay-summary__row strong { color: #e5e7eb; }

.pay-summary__divider {
  height: 1px;
  background: rgba(255,255,255,0.07);
  margin: 8px 0;
}

.pay-summary__row--total {
  font-size: 15px;
  font-weight: 700;
}

.pay-total-usd { color: #E07856; font-size: 17px; }

.pay-summary__row--clp {
  font-size: 11px;
  color: #6b7280;
  margin-top: 2px;
}

.pay-summary__row--clp strong { color: #9ca3af; }

/* Gateway buttons */
.gateway-buttons {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.gw-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 16px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.04);
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
  text-align: left;
  width: 100%;
}

.gw-btn:hover:not(:disabled) {
  border-color: rgba(42,157,143,0.35);
  background: rgba(42,157,143,0.08);
}

.gw-btn--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.gw-btn__icon {
  width: 38px;
  height: 38px;
  border-radius: 9px;
  background: #635bff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 900;
  color: #fff;
  flex-shrink: 0;
}

.gw-btn__info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.gw-btn__name { font-size: 14px; font-weight: 700; color: #e5e7eb; }
.gw-btn__sub  { font-size: 11px; color: #9ca3af; }

.gw-btn__warn {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #fbbf24;
  flex-shrink: 0;
}

/* ── Misc ── */
.access-denied { text-align: center; padding: 60px 20px; color: #6b7280; }
.access-denied h3 { font-size: 18px; color: #d1d5db; margin: 16px 0 8px; }

.empty-state { text-align: center; padding: 60px 20px; color: #6b7280; }

/* Buttons */
.btn {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 9px 18px; border-radius: 9px; border: none;
  font-family: inherit; font-size: 13px; font-weight: 700;
  cursor: pointer; transition: background 0.15s, transform 0.1s;
}
.btn:active:not(:disabled) { transform: scale(0.97); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn--primary   { background: #2a9d8f; color: #fff; }
.btn--primary:hover:not(:disabled) { background: #21867a; }
.btn--secondary { background: rgba(255,255,255,0.07); color: #d1d5db; }
.btn--secondary:hover:not(:disabled) { background: rgba(255,255,255,0.12); }

/* Spinners */
.spinner-sm {
  width: 15px; height: 15px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
.spinner-lg {
  width: 32px; height: 32px;
  border: 3px solid rgba(6,204,180,0.2);
  border-top-color: #06CCB4;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Toast */
.toast {
  position: fixed; bottom: 28px; right: 28px;
  display: flex; align-items: center; gap: 9px;
  padding: 12px 20px; border-radius: 10px;
  font-size: 13px; font-weight: 600;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4); z-index: 9999;
}
.toast--success { background: #065f46; color: #6ee7b7; border: 1px solid rgba(110,231,183,0.2); }
.toast--error   { background: #7f1d1d; color: #fca5a5; border: 1px solid rgba(252,165,165,0.2); }
.toast-fade-enter-active { transition: all 0.25s ease; }
.toast-fade-leave-active { transition: all 0.2s ease; }
.toast-fade-enter-from, .toast-fade-leave-to { opacity: 0; transform: translateY(12px); }
</style>
