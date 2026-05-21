<template>
  <div class="users-page">
    <!-- Header -->
    <div class="page-header">
      <div class="page-header__left">
        <h2 class="page-title">
          <i class="u u-usuarios"></i>
          Usuarios del Sistema
        </h2>
        <span class="page-subtitle">Gestiona quién puede acceder a la plataforma</span>
      </div>
      <div class="page-header__right">
        <button class="btn btn--primary" @click="openCreate">
          <i class="u u-plus-circle"></i> Nuevo usuario
        </button>
      </div>
    </div>

    <!-- Cargando -->
    <div v-if="authLoading" class="access-denied">
      <div class="spinner"></div>
      <p style="color:#6b7280;font-size:13px">Verificando acceso...</p>
    </div>

    <!-- Acceso denegado -->
    <div v-else-if="!isSuperAdmin" class="access-denied">
      <i class="u u-locked" style="font-size:48px;color:#4b5563"></i>
      <h3>Acceso restringido</h3>
      <p>Solo el administrador puede gestionar usuarios.</p>
      <button class="btn btn--secondary" @click="$router.back()">Volver</button>
    </div>

    <template v-else>
      <!-- Stats -->
      <div class="stats-row">
        <div class="stat-card">
          <span class="stat-value">{{ users.length }}</span>
          <span class="stat-label">Total</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ users.filter(u => u.activo).length }}</span>
          <span class="stat-label">Activos</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ users.filter(u => u.rol === 'admin').length }}</span>
          <span class="stat-label">Admins</span>
        </div>
      </div>

      <!-- Tabla -->
      <div class="table-wrap">
        <div v-if="loading" class="loading-overlay">
          <div class="spinner"></div>
        </div>

        <div v-if="users.length === 0 && !loading" class="empty-state">
          <i class="u u-usuarios" style="font-size:48px;color:#374151;margin-bottom:12px;display:block"></i>
          <p>No hay usuarios registrados.</p>
        </div>

        <table v-else class="users-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Organización</th>
              <th>Estado</th>
              <th>Creado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user._id" :class="{ 'row--inactive': !user.activo }">
              <td>
                <div class="user-cell">
                  <div class="user-avatar" :style="{ background: avatarColor(user) }">
                    {{ initials(user.nombre) }}
                  </div>
                  <div class="user-info">
                    <span class="user-name">{{ user.nombre }}</span>
                    <span class="user-email">{{ user.email }}</span>
                  </div>
                </div>
              </td>
              <td>
                <span class="role-badge" :style="{ background: roleBg(user.rol), color: roleColor(user.rol) }">
                  {{ ROLE_LABELS[user.rol] || user.rol }}
                </span>
              </td>
              <td>
                <span class="org-label">{{ orgName(user.orgId) }}</span>
              </td>
              <td>
                <span class="status-badge" :class="user.activo ? 'status-badge--active' : 'status-badge--inactive'">
                  {{ user.activo ? 'Activo' : 'Inactivo' }}
                </span>
              </td>
              <td class="date-cell">{{ formatDate(user.createdAt) }}</td>
              <td>
                <div class="actions">
                  <button class="action-btn" title="Editar" @click="openEdit(user)">
                    <i class="u u-edit"></i>
                  </button>
                  <button class="action-btn" title="Cambiar contraseña" @click="openPassword(user)">
                    <i class="u u-locked"></i>
                  </button>
                  <button
                    class="action-btn"
                    :title="user.activo ? 'Desactivar' : 'Activar'"
                    @click="handleToggle(user)"
                    :disabled="actionLoading === user._id"
                  >
                    <i :class="user.activo ? 'u u-no-show' : 'u u-show'"></i>
                  </button>
                  <button
                    class="action-btn action-btn--danger"
                    title="Eliminar"
                    @click="confirmDelete(user)"
                    :disabled="actionLoading === user._id"
                  >
                    <i class="u u-delete"></i>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- Modal Crear / Editar -->
    <div v-if="modal.open" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal__header">
          <h3>{{ modal.mode === 'create' ? 'Nuevo usuario' : 'Editar usuario' }}</h3>
          <button class="modal__close" @click="closeModal"><i class="u u-close"></i></button>
        </div>
        <div class="modal__body">
          <div class="field">
            <label>Nombre</label>
            <input v-model="form.nombre" type="text" placeholder="Juan Pérez" />
          </div>
          <div class="field">
            <label>Email</label>
            <input v-model="form.email" type="email" placeholder="juan@empresa.cl" :disabled="modal.mode === 'edit'" />
          </div>
          <div v-if="modal.mode === 'create'" class="field">
            <label>Contraseña inicial</label>
            <div class="input-wrap">
              <input v-model="form.password" :type="showPass ? 'text' : 'password'" placeholder="Mínimo 6 caracteres" />
              <button type="button" class="toggle-pass" @click="showPass = !showPass">
                <i :class="showPass ? 'u u-no-show' : 'u u-show'"></i>
              </button>
            </div>
          </div>
          <div class="field">
            <label>Rol</label>
            <select v-model="form.rol">
              <option value="viewer">Visualizador</option>
              <option value="manager">Manager</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <div class="field">
            <label>Organización</label>
            <select v-model="form.orgId">
              <option :value="null">— Sin organización (super-admin) —</option>
              <option v-for="org in orgs" :key="org._id || org.id" :value="org._id || org.id">
                {{ org.nombre }}
              </option>
            </select>
          </div>
          <div v-if="modal.error" class="modal-error">
            <i class="u u-warning"></i> {{ modal.error }}
          </div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--secondary" @click="closeModal">Cancelar</button>
          <button class="btn btn--primary" @click="handleSave" :disabled="modal.saving">
            <span v-if="modal.saving" class="btn-spinner"></span>
            <span v-else>{{ modal.mode === 'create' ? 'Crear usuario' : 'Guardar cambios' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Cambiar contraseña -->
    <div v-if="pwdModal.open" class="modal-overlay" @click.self="closePwd">
      <div class="modal modal--sm">
        <div class="modal__header">
          <h3>Cambiar contraseña</h3>
          <button class="modal__close" @click="closePwd"><i class="u u-close"></i></button>
        </div>
        <div class="modal__body">
          <p style="color:#9ca3af;font-size:13px;margin-bottom:4px">
            Usuario: <strong style="color:#e5e7eb">{{ pwdModal.user?.nombre }}</strong>
          </p>
          <div class="field">
            <label>Nueva contraseña</label>
            <div class="input-wrap">
              <input v-model="pwdModal.password" :type="showPass2 ? 'text' : 'password'" placeholder="Mínimo 6 caracteres" />
              <button type="button" class="toggle-pass" @click="showPass2 = !showPass2">
                <i :class="showPass2 ? 'u u-no-show' : 'u u-show'"></i>
              </button>
            </div>
          </div>
          <div v-if="pwdModal.error" class="modal-error">
            <i class="u u-warning"></i> {{ pwdModal.error }}
          </div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--secondary" @click="closePwd">Cancelar</button>
          <button class="btn btn--primary" @click="handleChangePassword" :disabled="pwdModal.saving">
            <span v-if="pwdModal.saving" class="btn-spinner"></span>
            <span v-else>Cambiar contraseña</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Eliminar -->
    <div v-if="deleteModal.open" class="modal-overlay" @click.self="deleteModal.open = false">
      <div class="modal modal--sm">
        <div class="modal__header">
          <h3>Eliminar usuario</h3>
          <button class="modal__close" @click="deleteModal.open = false"><i class="u u-close"></i></button>
        </div>
        <div class="modal__body">
          <p style="color:#9ca3af;font-size:14px">
            ¿Eliminar a <strong style="color:#f87171">{{ deleteModal.user?.nombre }}</strong>?
            Esta acción no se puede deshacer.
          </p>
          <div v-if="deleteModal.error" class="modal-error" style="margin-top:12px">
            <i class="u u-warning"></i> {{ deleteModal.error }}
          </div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--secondary" @click="deleteModal.open = false">Cancelar</button>
          <button class="btn btn--danger" @click="handleDelete" :disabled="deleteModal.saving">
            <span v-if="deleteModal.saving" class="btn-spinner"></span>
            <span v-else><i class="u u-delete"></i> Eliminar</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ROLE_LABELS, ROLE_COLORS } from '@/stores/auth'

definePageMeta({ layout: 'rrhh', middleware: 'auth' })

let authStore = null
let orgStore  = null

const authLoading   = ref(true)
const isSuperAdmin  = ref(false)
const users         = ref([])
const orgs          = ref([])
const loading       = ref(false)
const actionLoading = ref(null)

onMounted(async () => {
  const { useAuthStore } = await import('@/stores/auth')
  const { useOrgStore }  = await import('@/stores/org')
  authStore = useAuthStore()
  orgStore  = useOrgStore()

  await authStore.init()
  authLoading.value  = false
  isSuperAdmin.value = authStore.isSuperAdmin

  if (!isSuperAdmin.value) return

  orgStore.init()
  orgs.value = orgStore.orgs || []
  await loadUsers()
})

async function loadUsers() {
  loading.value = true
  try {
    users.value = await authStore.getUsers() || []
    orgs.value  = orgStore?.orgs || []
  } finally {
    loading.value = false
  }
}

/* Helpers */
function initials(nombre) {
  return (nombre || '?').split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}
function avatarColor(user) {
  const colors = ['#2a9d8f', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981']
  return colors[(user.nombre || '').charCodeAt(0) % colors.length]
}
function roleBg(rol) {
  return { admin: 'rgba(42,157,143,0.15)', manager: 'rgba(59,130,246,0.15)', viewer: 'rgba(107,114,128,0.15)' }[rol] || 'rgba(107,114,128,0.15)'
}
function roleColor(rol) { return ROLE_COLORS[rol] || '#6b7280' }
function orgName(orgId) {
  if (!orgId) return '— Global —'
  const org = (orgs.value || []).find(o => (o._id || o.id) === orgId)
  return org?.nombre || orgId
}
function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

/* Modal Crear / Editar */
const modal    = reactive({ open: false, mode: 'create', userId: null, saving: false, error: '' })
const form     = reactive({ nombre: '', email: '', password: '', rol: 'viewer', orgId: null })
const showPass = ref(false)

function openCreate() {
  Object.assign(form, { nombre: '', email: '', password: '', rol: 'viewer', orgId: null })
  Object.assign(modal, { open: true, mode: 'create', userId: null, error: '' })
  showPass.value = false
}
function openEdit(user) {
  Object.assign(form, { nombre: user.nombre, email: user.email, password: '', rol: user.rol, orgId: user.orgId || null })
  Object.assign(modal, { open: true, mode: 'edit', userId: user._id, error: '' })
}
function closeModal() { modal.open = false }

async function handleSave() {
  if (!form.nombre.trim()) { modal.error = 'El nombre es requerido'; return }
  if (!form.email.trim())  { modal.error = 'El email es requerido'; return }
  if (modal.mode === 'create' && !form.password.trim()) { modal.error = 'La contraseña es requerida'; return }

  modal.saving = true
  modal.error  = ''
  const result = modal.mode === 'create'
    ? await authStore.createUser({ ...form })
    : await authStore.updateUser(modal.userId, { nombre: form.nombre, rol: form.rol, orgId: form.orgId })
  modal.saving = false

  if (result?.ok) { closeModal(); await loadUsers() }
  else modal.error = result?.message || 'Error inesperado'
}

/* Modal Contraseña */
const pwdModal  = reactive({ open: false, user: null, password: '', saving: false, error: '' })
const showPass2 = ref(false)

function openPassword(user) {
  Object.assign(pwdModal, { open: true, user, password: '', error: '' })
  showPass2.value = false
}
function closePwd() { pwdModal.open = false }

async function handleChangePassword() {
  if (!pwdModal.password || pwdModal.password.length < 6) { pwdModal.error = 'Mínimo 6 caracteres'; return }
  pwdModal.saving = true
  pwdModal.error  = ''
  const result = await authStore.changePassword(pwdModal.user._id, pwdModal.password)
  pwdModal.saving = false
  if (result?.ok) closePwd()
  else pwdModal.error = result?.message || 'Error'
}

/* Toggle */
async function handleToggle(user) {
  actionLoading.value = user._id
  await authStore.toggleUser(user._id)
  await loadUsers()
  actionLoading.value = null
}

/* Modal Eliminar */
const deleteModal = reactive({ open: false, user: null, saving: false, error: '' })

function confirmDelete(user) {
  Object.assign(deleteModal, { open: true, user, error: '' })
}
async function handleDelete() {
  deleteModal.saving = true
  deleteModal.error  = ''
  const result = await authStore.deleteUser(deleteModal.user._id)
  deleteModal.saving = false
  if (result?.ok) { deleteModal.open = false; await loadUsers() }
  else deleteModal.error = result?.message || 'Error al eliminar'
}
</script>

<style scoped>
* { box-sizing: border-box; }

.users-page {
  padding: 32px;
  max-width: 1100px;
  color: #e5e7eb;
  font-family: 'Nunito', sans-serif;
}

.page-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  margin-bottom: 28px; flex-wrap: wrap; gap: 12px;
}
.page-title {
  font-size: 22px; font-weight: 700; color: #f3f4f6;
  margin: 0 0 4px; display: flex; align-items: center; gap: 10px;
}
.page-title .u { font-size: 20px; color: #06CCB4; }
.page-subtitle { font-size: 13px; color: #6b7280; }

.stats-row { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
.stat-card {
  background: #1e2d3a; border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px; padding: 16px 24px;
  display: flex; flex-direction: column; gap: 4px; min-width: 100px;
}
.stat-value { font-size: 28px; font-weight: 700; color: #06CCB4; line-height: 1; }
.stat-label { font-size: 12px; color: #6b7280; }

.table-wrap {
  position: relative; background: #1e2d3a;
  border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; overflow: hidden;
}
.loading-overlay {
  position: absolute; inset: 0; background: rgba(15,25,35,0.6);
  display: flex; align-items: center; justify-content: center; z-index: 10;
}
.users-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.users-table th {
  padding: 12px 16px; text-align: left;
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.6px; color: #6b7280;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.users-table td {
  padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.04);
  color: #d1d5db; vertical-align: middle;
}
.users-table tr:last-child td { border-bottom: none; }
.users-table tr.row--inactive td { opacity: 0.5; }
.users-table tr:hover td { background: rgba(255,255,255,0.02); }

.user-cell { display: flex; align-items: center; gap: 12px; }
.user-avatar {
  width: 36px; height: 36px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; color: #fff; flex-shrink: 0;
}
.user-info { display: flex; flex-direction: column; gap: 2px; }
.user-name  { font-weight: 600; color: #f3f4f6; font-size: 13px; }
.user-email { font-size: 11px; color: #6b7280; }

.role-badge {
  display: inline-block; padding: 3px 10px; border-radius: 20px;
  font-size: 11px; font-weight: 700;
}
.status-badge {
  display: inline-block; padding: 3px 10px; border-radius: 20px;
  font-size: 11px; font-weight: 600;
}
.status-badge--active  { background: rgba(6,204,180,0.12); color: #06CCB4; }
.status-badge--inactive{ background: rgba(239,68,68,0.12);  color: #f87171; }
.org-label  { font-size: 12px; color: #9ca3af; }
.date-cell  { font-size: 12px; color: #6b7280; white-space: nowrap; }

.actions { display: flex; gap: 4px; justify-content: flex-end; }
.action-btn {
  width: 30px; height: 30px;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);
  border-radius: 6px; color: #9ca3af; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; transition: background 0.15s, color 0.15s;
}
.action-btn:hover:not(:disabled) { background: rgba(255,255,255,0.08); color: #e5e7eb; }
.action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.action-btn--danger:hover:not(:disabled) { background: rgba(239,68,68,0.15); color: #f87171; border-color: rgba(239,68,68,0.3); }

.btn {
  padding: 9px 18px; border-radius: 8px; font-size: 13px; font-weight: 600;
  font-family: 'Nunito', sans-serif; cursor: pointer; border: none;
  display: inline-flex; align-items: center; gap: 6px;
  transition: background 0.15s, opacity 0.15s;
}
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.btn--primary  { background: #06CCB4; color: #002C3E; }
.btn--primary:hover:not(:disabled) { background: #05b8a2; }
.btn--secondary{ background: rgba(255,255,255,0.06); color: #d1d5db; border: 1px solid rgba(255,255,255,0.1); }
.btn--secondary:hover:not(:disabled) { background: rgba(255,255,255,0.1); }
.btn--danger   { background: rgba(239,68,68,0.15); color: #f87171; border: 1px solid rgba(239,68,68,0.3); }
.btn--danger:hover:not(:disabled) { background: rgba(239,68,68,0.25); }
.btn-spinner {
  width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;
  border-radius: 50%; animation: spin 0.7s linear infinite;
}

.access-denied, .empty-state { text-align: center; padding: 64px 32px; color: #6b7280; }
.access-denied h3 { font-size: 16px; color: #9ca3af; margin: 12px 0 8px; }
.access-denied p  { font-size: 13px; margin-bottom: 20px; }

.spinner {
  width: 28px; height: 28px;
  border: 3px solid rgba(6,204,180,0.2); border-top-color: #06CCB4;
  border-radius: 50%; animation: spin 0.8s linear infinite;
  margin: 0 auto 12px;
}
@keyframes spin { to { transform: rotate(360deg); } }

.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 9999; padding: 20px;
}
.modal {
  background: #1a2332; border: 1px solid rgba(255,255,255,0.1);
  border-radius: 14px; width: 100%; max-width: 480px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.5);
}
.modal--sm { max-width: 380px; }
.modal__header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 24px 16px; border-bottom: 1px solid rgba(255,255,255,0.06);
}
.modal__header h3 { font-size: 16px; font-weight: 700; color: #f3f4f6; margin: 0; }
.modal__close {
  width: 28px; height: 28px; background: none; border: none; cursor: pointer;
  color: #6b7280; font-size: 16px; display: flex; align-items: center; justify-content: center;
  border-radius: 6px; transition: background 0.15s;
}
.modal__close:hover { background: rgba(255,255,255,0.08); color: #9ca3af; }
.modal__body { padding: 20px 24px; display: flex; flex-direction: column; gap: 16px; }
.modal__footer {
  padding: 16px 24px; border-top: 1px solid rgba(255,255,255,0.06);
  display: flex; justify-content: flex-end; gap: 10px;
}

.field { display: flex; flex-direction: column; gap: 6px; }
.field label {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.6px; color: #9ca3af;
}
.field input, .field select {
  padding: 10px 14px; background: #0f1923;
  border: 1px solid rgba(255,255,255,0.08); border-radius: 8px;
  color: #e5e7eb; font-size: 13px; font-family: 'Nunito', sans-serif;
  outline: none; transition: border-color 0.2s; width: 100%;
}
.field input:focus, .field select:focus { border-color: rgba(6,204,180,0.5); }
.field input:disabled { opacity: 0.5; cursor: not-allowed; }
.field select option { background: #1a2332; }
.input-wrap { position: relative; display: flex; align-items: center; }
.input-wrap input { padding-right: 40px; }
.toggle-pass {
  position: absolute; right: 10px; background: none; border: none;
  cursor: pointer; color: #4b5563; font-size: 16px; padding: 4px;
}
.toggle-pass:hover { color: #9ca3af; }

.modal-error {
  background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.25);
  border-radius: 8px; padding: 10px 14px; font-size: 12px; color: #fca5a5;
  display: flex; align-items: center; gap: 6px;
}
</style>
