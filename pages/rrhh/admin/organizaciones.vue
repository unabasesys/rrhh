<template>
  <div class="orgs-page">
    <!-- Header -->
    <div class="page-header">
      <div class="page-header__left">
        <h2 class="page-title">
          <i class="u u-empresa"></i>
          Organizaciones
        </h2>
        <span class="page-subtitle">Empresas registradas en el sistema RRHH</span>
      </div>
      <div class="page-header__right">
        <button class="btn btn--primary" @click="openCreate">
          <i class="u u-plus"></i> Nueva organización
        </button>
      </div>
    </div>

    <!-- Cargando sesión (SSR → client) -->
    <div v-if="authLoading" class="access-denied">
      <div style="width:32px;height:32px;border:3px solid rgba(6,204,180,0.2);border-top-color:#06CCB4;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 12px"></div>
      <p style="color:#6b7280;font-size:13px">Verificando acceso...</p>
    </div>

    <!-- Acceso denegado -->
    <div v-else-if="!isSuperAdmin" class="access-denied">
      <i class="u u-locked" style="font-size:48px;color:#4b5563"></i>
      <h3>Acceso restringido</h3>
      <p>Solo el super-administrador puede gestionar organizaciones.</p>
      <button class="btn btn--secondary" @click="$router.back()">Volver</button>
    </div>

    <template v-else-if="isSuperAdmin">
      <!-- Stats -->
      <div class="stats-row">
        <div class="stat-card">
          <span class="stat-value">{{ orgs.length }}</span>
          <span class="stat-label">Total</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ orgs.filter(o => o.activo !== false).length }}</span>
          <span class="stat-label">Activas</span>
        </div>
      </div>

      <!-- Grid de organizaciones -->
      <div v-if="orgs.length === 0" class="empty-state">
        <i class="u u-empresa" style="font-size:48px;color:#374151;margin-bottom:12px;display:block"></i>
        <p>No hay organizaciones. Crea la primera para empezar.</p>
      </div>

      <div v-else class="orgs-grid">
        <div
          v-for="org in orgs"
          :key="org.id"
          class="org-card"
          :class="{ 'org-card--inactive': org.activo === false, 'org-card--active': authStore?.currentOrgId === org.id }"
        >
          <!-- Logo / inicial -->
          <div class="org-card__logo">
            <img v-if="org.logo" :src="org.logo" :alt="org.nombre" class="org-logo-img" />
            <span v-else class="org-logo-initial">{{ org.nombre?.charAt(0).toUpperCase() }}</span>
          </div>

          <div class="org-card__body">
            <div class="org-card__name">
              {{ org.nombre }}
              <span v-if="authStore?.currentOrgId === org.id" class="active-badge">Activa</span>
            </div>
            <div class="org-card__rut">{{ org.rut || 'Sin RUT' }}</div>
            <div v-if="org.ciudad || org.comuna" class="org-card__location">
              <i class="u u-location" style="font-size:12px"></i>
              {{ [org.comuna, org.ciudad].filter(Boolean).join(', ') }}
            </div>
            <div v-if="org.representanteLegal?.nombre" class="org-card__rep">
              <i class="u u-user" style="font-size:12px"></i>
              {{ org.representanteLegal.nombre }}
            </div>

            <!-- Badge personas -->
            <button
              class="people-badge"
              :title="`Ver personas de ${org.nombre}`"
              @click="goToWorkers(org.id)"
            >
              <i class="u u-user" style="font-size:11px"></i>
              {{ workerCounts[org.id] ?? 0 }} persona{{ (workerCounts[org.id] ?? 0) !== 1 ? 's' : '' }}
            </button>
          </div>

          <div class="org-card__actions">
            <!-- Activar como org actual (super-admin) -->
            <button
              class="action-btn action-btn--primary"
              title="Usar esta org"
              @click="switchToOrg(org.id)"
              :disabled="authStore?.currentOrgId === org.id"
            >
              <i class="u u-chevron-right"></i>
            </button>
            <button class="action-btn" title="Editar" @click="openEdit(org)">
              <i class="u u-edit"></i>
            </button>
            <button
              class="action-btn"
              :title="org.activo !== false ? 'Desactivar' : 'Activar'"
              @click="toggleOrg(org.id)"
            >
              <i :class="org.activo !== false ? 'u u-no-show' : 'u u-show'"></i>
            </button>
            <button class="action-btn action-btn--danger" title="Eliminar" @click="confirmDelete(org)">
              <i class="u u-delete"></i>
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- ── Modal Crear / Editar ──────────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="modal.open" class="modal-overlay">
        <div class="modal-box">
          <div class="modal-header">
            <span>{{ modal.mode === 'create' ? 'Nueva organización' : 'Editar organización' }}</span>
            <button class="modal-close" @click="closeModal"><i class="u u-x"></i></button>
          </div>

          <div class="modal-body">
            <!-- Logo -->
            <div class="logo-upload-row">
              <div class="logo-preview">
                <img v-if="form.logo" :src="form.logo" alt="Logo" class="logo-preview-img" />
                <span v-else class="logo-preview-initial">{{ form.nombre?.charAt(0)?.toUpperCase() || '?' }}</span>
              </div>
              <div class="logo-upload-info">
                <label class="btn btn--secondary btn--sm" style="cursor:pointer">
                  <i class="u u-upload"></i> Subir logo
                  <input type="file" accept="image/*" @change="onLogoChange" style="display:none" />
                </label>
                <button v-if="form.logo" class="btn btn--ghost btn--sm" @click="form.logo = null">Quitar</button>
                <span class="field-hint">PNG o JPG · máx 200KB · se guarda como base64</span>
              </div>
            </div>

            <div class="form-grid">
              <div class="form-field form-field--full">
                <label>Razón social *</label>
                <input v-model="form.nombre" type="text" placeholder="Empresa Ejemplo SpA" class="form-input" />
              </div>
              <div class="form-field">
                <label>RUT empresa *</label>
                <input v-model="form.rut" type="text" placeholder="76.123.456-7" class="form-input" @input="form.rut = formatRut(form.rut)" />
              </div>
              <div class="form-field">
                <label>Ciudad</label>
                <input v-model="form.ciudad" type="text" placeholder="Santiago" class="form-input" />
              </div>
              <div class="form-field">
                <label>Comuna</label>
                <input v-model="form.comuna" type="text" placeholder="Las Condes" class="form-input" />
              </div>
              <div class="form-field form-field--full">
                <label>Dirección</label>
                <input v-model="form.direccion" type="text" placeholder="Av. Ejemplo 123, Of. 456" class="form-input" />
              </div>
            </div>

            <!-- Representante legal -->
            <div class="section-label">Representante Legal</div>
            <div class="form-grid">
              <div class="form-field">
                <label>Nombre completo</label>
                <input v-model="form.repNombre" type="text" placeholder="Juan Pérez González" class="form-input" />
              </div>
              <div class="form-field">
                <label>RUT representante</label>
                <input v-model="form.repRut" type="text" placeholder="12.345.678-9" class="form-input" @input="form.repRut = formatRut(form.repRut)" />
              </div>
            </div>

            <div v-if="modal.error" class="form-error">
              <i class="u u-warning"></i> {{ modal.error }}
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn btn--secondary" @click="closeModal">Cancelar</button>
            <button class="btn btn--primary" @click="saveOrg" :disabled="modal.loading">
              <span v-if="modal.loading" class="spinner-sm"></span>
              <span v-else>{{ modal.mode === 'create' ? 'Crear organización' : 'Guardar cambios' }}</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ── Modal Confirmar Eliminar ──────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="deleteModal.open" class="modal-overlay" @click.self="deleteModal.open = false">
        <div class="modal-box modal-box--sm">
          <div class="modal-header modal-header--danger">
            <span>Eliminar organización</span>
            <button class="modal-close" @click="deleteModal.open = false"><i class="u u-x"></i></button>
          </div>
          <div class="modal-body" style="text-align:center;padding:28px 24px">
            <i class="u u-trash" style="font-size:36px;color:#ef4444;margin-bottom:12px;display:block"></i>
            <p style="font-size:15px;margin-bottom:6px">¿Eliminar <strong>{{ deleteModal.org?.nombre }}</strong>?</p>
            <p style="font-size:13px;color:#9ca3af">Los trabajadores y datos asociados NO se eliminarán.</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn--secondary" @click="deleteModal.open = false">Cancelar</button>
            <button class="btn btn--danger" @click="doDelete">Eliminar</button>
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
useHead({ title: 'Organizaciones · RRHH' })

const router = useRouter()

const { useAuthStore }   = await import('@/stores/auth')
const { useOrgStore }    = await import('@/stores/org')

const authStore = useAuthStore()
const orgStore  = useOrgStore()

// authLoading: true mientras no hemos corrido init() en el cliente
const authLoading = ref(true)

const isSuperAdmin = computed(() => authStore.isSuperAdmin)
const orgs = computed(() => orgStore.orgs)

// Conteo de trabajadores por org
const workerCounts = ref({})

async function fetchWorkerCounts() {
  try {
    let headers = {}
    try {
      const s = JSON.parse(localStorage.getItem('rrhh_session') || '{}')
      if (s?.token) headers = { Authorization: `Bearer ${s.token}` }
    } catch {}
    const counts = await $fetch('/api/rrhh/trabajadores/counts', { headers })
    workerCounts.value = counts
  } catch {
    // si falla, simplemente no mostramos conteos
  }
}

onMounted(async () => {
  // init() restaura la sesión desde localStorage (necesario tras SSR)
  await authStore.init()
  authLoading.value = false
  await orgStore.init()
  fetchWorkerCounts()
})

// ── Ir a trabajadores de una org ───────────────────────────────────────────
function goToWorkers(orgId) {
  authStore.switchOrg(orgId)
  router.push('/rrhh/trabajadores')
}

// ── Switch org activa ──────────────────────────────────────────────────────
function switchToOrg(orgId) {
  authStore.switchOrg(orgId)
  // También actualizar el rrhh store
  const { default: useRrhhStore } = useNuxtApp().$pinia._s.get('rrhh')
    ? { default: () => useNuxtApp().$pinia._s.get('rrhh') }
    : { default: null }
  showToast(`Cambiado a ${orgStore.getById(orgId)?.nombre}`, 'success')
}

// ── Modal crear/editar ─────────────────────────────────────────────────────
const modal = reactive({ open: false, mode: 'create', editId: null, loading: false, error: '' })
const form  = reactive({
  nombre: '', rut: '', logo: null,
  direccion: '', comuna: '', ciudad: '',
  repNombre: '', repRut: '',
})

function openCreate() {
  Object.assign(form, { nombre: '', rut: '', logo: null, direccion: '', comuna: '', ciudad: '', repNombre: '', repRut: '' })
  Object.assign(modal, { open: true, mode: 'create', editId: null, error: '' })
}

function openEdit(org) {
  Object.assign(form, {
    nombre:    org.nombre || '',
    rut:       org.rut || '',
    logo:      org.logo || null,
    direccion: org.direccion || '',
    comuna:    org.comuna || '',
    ciudad:    org.ciudad || '',
    repNombre: org.representanteLegal?.nombre || '',
    repRut:    org.representanteLegal?.rut || '',
  })
  Object.assign(modal, { open: true, mode: 'edit', editId: org.id, error: '' })
}

function closeModal() {
  modal.open  = false
  modal.error = ''
}

async function saveOrg() {
  modal.error = ''
  if (!form.nombre.trim()) { modal.error = 'La razón social es requerida'; return }
  if (!form.rut.trim())    { modal.error = 'El RUT es requerido'; return }

  modal.loading = true
  const payload = {
    nombre:    form.nombre.trim(),
    rut:       form.rut.trim(),
    logo:      form.logo || null,
    direccion: form.direccion.trim(),
    comuna:    form.comuna.trim(),
    ciudad:    form.ciudad.trim(),
    representanteLegal: (form.repNombre || form.repRut)
      ? { nombre: form.repNombre.trim(), rut: form.repRut.trim() }
      : null,
  }

  let result
  if (modal.mode === 'create') {
    result = await orgStore.createOrg(payload)
  } else {
    result = await orgStore.updateOrg(modal.editId, payload)
  }

  modal.loading = false
  if (!result.ok) { modal.error = result.message; return }
  const modeLabel = modal.mode
  closeModal()
  showToast(modeLabel === 'create' ? 'Organización creada' : 'Organización actualizada', 'success')
}

// ── Toggle ─────────────────────────────────────────────────────────────────
async function toggleOrg(id) {
  const result = await orgStore.toggleOrg(id)
  if (result.ok) showToast(result.activo ? 'Organización activada' : 'Organización desactivada', 'success')
}

// ── Eliminar ───────────────────────────────────────────────────────────────
const deleteModal = reactive({ open: false, org: null })

function confirmDelete(org) {
  deleteModal.org  = org
  deleteModal.open = true
}

async function doDelete() {
  await orgStore.deleteOrg(deleteModal.org.id)
  deleteModal.open = false
  showToast('Organización eliminada', 'success')
}

// ── Logo upload ────────────────────────────────────────────────────────────
function onLogoChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  if (file.size > 200 * 1024) { showToast('La imagen supera 200KB', 'error'); return }
  const reader = new FileReader()
  reader.onload = (ev) => { form.logo = ev.target.result }
  reader.readAsDataURL(file)
}

// ── Formato RUT ────────────────────────────────────────────────────────────
function formatRut(value) {
  if (!value) return ''
  const clean = value.replace(/[^0-9kK]/g, '').toUpperCase()
  if (clean.length < 2) return clean
  const dv   = clean.slice(-1)
  const body = clean.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${body}-${dv}`
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
.orgs-page {
  padding: 28px 32px;
  max-width: 1100px;
  margin: 0 auto;
}

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

/* Stats */
.stats-row {
  display: flex;
  gap: 16px;
  margin-bottom: 28px;
}

.stat-card {
  background: rgba(42,157,143,0.08);
  border: 1px solid rgba(42,157,143,0.15);
  border-radius: 12px;
  padding: 16px 24px;
  text-align: center;
  min-width: 100px;
}

.stat-value { display: block; font-size: 28px; font-weight: 800; color: #2a9d8f; }
.stat-label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.08em; }

/* Grid orgs */
.orgs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.org-card {
  background: #0f1923;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 14px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  transition: border-color 0.2s;
}

.org-card:hover { border-color: rgba(42,157,143,0.25); }
.org-card--active { border-color: rgba(42,157,143,0.5) !important; }
.org-card--inactive { opacity: 0.5; }

/* Logo */
.org-card__logo {
  width: 52px;
  height: 52px;
  border-radius: 12px;
  background: rgba(42,157,143,0.12);
  border: 1px solid rgba(42,157,143,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.org-logo-img { width: 100%; height: 100%; object-fit: contain; }
.org-logo-initial { font-size: 22px; font-weight: 800; color: #2a9d8f; }

/* Body */
.org-card__body { flex: 1; display: flex; flex-direction: column; gap: 4px; }

.org-card__name {
  font-size: 15px;
  font-weight: 700;
  color: #e5e7eb;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.active-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 8px;
  background: rgba(42,157,143,0.2);
  color: #2a9d8f;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.org-card__rut,
.org-card__location,
.org-card__rep {
  font-size: 12px;
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 5px;
}

/* People badge */
.people-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 8px;
  padding: 4px 10px;
  border-radius: 20px;
  border: 1px solid rgba(42,157,143,0.25);
  background: rgba(42,157,143,0.08);
  color: #2a9d8f;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  font-family: inherit;
  align-self: flex-start;
}
.people-badge:hover {
  background: rgba(42,157,143,0.18);
  border-color: rgba(42,157,143,0.45);
}

/* Actions */
.org-card__actions {
  display: flex;
  align-items: center;
  gap: 6px;
  border-top: 1px solid rgba(255,255,255,0.05);
  padding-top: 14px;
}

.action-btn {
  flex: 1;
  height: 32px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.03);
  color: #9ca3af;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  transition: all 0.15s;
}

.action-btn:hover { background: rgba(255,255,255,0.08); color: #e5e7eb; }
.action-btn--primary { border-color: rgba(42,157,143,0.3); color: #2a9d8f; }
.action-btn--primary:hover { background: rgba(42,157,143,0.15); }
.action-btn--primary:disabled { opacity: 0.3; cursor: not-allowed; }
.action-btn--danger:hover { background: rgba(239,68,68,0.15); color: #ef4444; border-color: rgba(239,68,68,0.3); }

/* Empty */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #6b7280;
}

/* Access denied */
.access-denied { text-align: center; padding: 60px 20px; color: #6b7280; }
.access-denied h3 { font-size: 18px; color: #d1d5db; margin: 16px 0 8px; }

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
.btn--ghost     { background: none; border: 1px solid rgba(255,255,255,0.1); color: #9ca3af; padding: 6px 12px; }
.btn--ghost:hover { background: rgba(255,255,255,0.05); }
.btn--danger    { background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); }
.btn--danger:hover:not(:disabled) { background: rgba(239,68,68,0.25); }
.btn--sm        { padding: 6px 12px; font-size: 12px; }

/* Logo upload */
.logo-upload-row {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
  padding: 14px;
  background: rgba(255,255,255,0.03);
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.06);
}

.logo-preview {
  width: 60px; height: 60px;
  border-radius: 12px;
  background: rgba(42,157,143,0.1);
  border: 1px solid rgba(42,157,143,0.2);
  display: flex; align-items: center; justify-content: center;
  overflow: hidden; flex-shrink: 0;
}

.logo-preview-img { width: 100%; height: 100%; object-fit: contain; }
.logo-preview-initial { font-size: 24px; font-weight: 800; color: #2a9d8f; }

.logo-upload-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* Form */
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

.form-field { display: flex; flex-direction: column; gap: 7px; }
.form-field--full { grid-column: 1 / -1; }

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

.section-label {
  font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.1em;
  color: #4b5563;
  margin: 8px 0 14px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.field-hint { font-size: 11px; color: #6b7280; }

.form-error {
  display: flex; align-items: center; gap: 7px;
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.25);
  border-radius: 8px;
  padding: 9px 13px; font-size: 13px; color: #fca5a5; margin-top: 8px;
}

/* Modal */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.7);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000; padding: 20px;
}

.modal-box {
  background: #0f1923;
  border: 1px solid rgba(42,157,143,0.2);
  border-radius: 16px; width: 100%; max-width: 560px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.5);
  max-height: 90vh; overflow-y: auto;
}

.modal-box--sm { max-width: 380px; }

.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  font-size: 15px; font-weight: 700; color: #e5e7eb;
  position: sticky; top: 0; background: #0f1923; z-index: 1;
}

.modal-header--danger { border-color: rgba(239,68,68,0.2); }

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

/* Spinner */
.spinner-sm {
  width: 15px; height: 15px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
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
