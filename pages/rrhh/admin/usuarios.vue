<template>
  <div class="usuarios-page">
    <!-- Header -->
    <div class="page-header">
      <div class="page-header__left">
        <h2 class="page-title">
          <i class="u u-usuarios"></i>
          Gestión de Usuarios
        </h2>
        <span class="page-subtitle">Administra los accesos al sistema RRHH</span>
      </div>
      <div class="page-header__right">
        <button class="btn btn--primary" @click="openCreate">
          <i class="u u-plus"></i> Nuevo usuario
        </button>
      </div>
    </div>

    <!-- Acceso denegado -->
    <div v-if="!isAdmin" class="access-denied">
      <i class="u u-lock" style="font-size:48px;color:#4b5563"></i>
      <h3>Acceso restringido</h3>
      <p>Solo los administradores pueden gestionar usuarios.</p>
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

      <!-- Tabla de usuarios -->
      <div class="users-table-wrap">
        <table class="users-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Creado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in users" :key="u.id" :class="{ 'row--inactive': !u.activo }">
              <td>
                <div class="user-cell">
                  <span class="user-avatar-sm" :style="{ background: u.id === authStore?.user?.id ? '#2a9d8f' : '#374151' }">
                    {{ u.nombre?.charAt(0).toUpperCase() }}
                  </span>
                  <div>
                    <div class="user-cell__name">
                      {{ u.nombre }}
                      <span v-if="u.id === authStore?.user?.id" class="you-badge">Tú</span>
                    </div>
                    <div class="user-cell__email">{{ u.email }}</div>
                  </div>
                </div>
              </td>
              <td>
                <span class="rol-badge" :class="`rol-badge--${u.rol}`">
                  {{ ROLE_LABELS[u.rol] || u.rol }}
                </span>
              </td>
              <td>
                <span class="status-dot" :class="u.activo ? 'status-dot--active' : 'status-dot--inactive'">
                  {{ u.activo ? 'Activo' : 'Inactivo' }}
                </span>
              </td>
              <td class="date-cell">{{ formatDate(u.createdAt) }}</td>
              <td>
                <div class="actions-cell">
                  <button class="icon-btn" title="Editar" @click="openEdit(u)">
                    <i class="u u-edit"></i>
                  </button>
                  <button class="icon-btn" title="Cambiar contraseña" @click="openPassword(u)">
                    <i class="u u-lock"></i>
                  </button>
                  <button
                    class="icon-btn"
                    :title="u.activo ? 'Desactivar' : 'Activar'"
                    @click="toggleUser(u)"
                    :disabled="u.id === authStore?.user?.id"
                  >
                    <i :class="u.activo ? 'u u-eye-off' : 'u u-eye'"></i>
                  </button>
                  <button
                    class="icon-btn icon-btn--danger"
                    title="Eliminar"
                    @click="confirmDelete(u)"
                    :disabled="u.id === authStore?.user?.id"
                  >
                    <i class="u u-trash"></i>
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="users.length === 0">
              <td colspan="5" class="empty-row">No hay usuarios registrados.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- ── Modal Crear / Editar ────────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="modal.open" class="modal-overlay" @click.self="closeModal">
        <div class="modal-box">
          <div class="modal-header">
            <span>{{ modal.mode === 'create' ? 'Nuevo usuario' : 'Editar usuario' }}</span>
            <button class="modal-close" @click="closeModal"><i class="u u-x"></i></button>
          </div>
          <div class="modal-body">
            <div class="form-field">
              <label>Nombre completo *</label>
              <input v-model="form.nombre" type="text" placeholder="Ej: Juan Pérez" class="form-input" />
            </div>
            <div class="form-field">
              <label>Email *</label>
              <input v-model="form.email" type="email" placeholder="juan@empresa.cl" class="form-input" :disabled="modal.mode === 'edit'" />
              <span v-if="modal.mode === 'edit'" class="field-hint">El email no puede modificarse</span>
            </div>
            <div v-if="modal.mode === 'create'" class="form-field">
              <label>Contraseña *</label>
              <div class="pass-wrap">
                <input v-model="form.password" :type="showPass ? 'text' : 'password'" placeholder="Mínimo 6 caracteres" class="form-input" />
                <button type="button" class="pass-toggle" @click="showPass = !showPass">
                  <i :class="showPass ? 'u u-eye-off' : 'u u-eye'"></i>
                </button>
              </div>
            </div>
            <div class="form-field">
              <label>Rol *</label>
              <select v-model="form.rol" class="form-input">
                <option v-for="(label, key) in ROLE_LABELS" :key="key" :value="key">{{ label }}</option>
              </select>
              <span class="field-hint">{{ roleDesc[form.rol] }}</span>
            </div>

            <div v-if="modal.error" class="form-error">
              <i class="u u-warning"></i> {{ modal.error }}
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn--secondary" @click="closeModal">Cancelar</button>
            <button class="btn btn--primary" @click="saveUser" :disabled="modal.loading">
              <span v-if="modal.loading" class="spinner-sm"></span>
              <span v-else>{{ modal.mode === 'create' ? 'Crear usuario' : 'Guardar cambios' }}</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ── Modal Cambiar Contraseña ──────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="passModal.open" class="modal-overlay" @click.self="passModal.open = false">
        <div class="modal-box modal-box--sm">
          <div class="modal-header">
            <span>Cambiar contraseña — {{ passModal.user?.nombre }}</span>
            <button class="modal-close" @click="passModal.open = false"><i class="u u-x"></i></button>
          </div>
          <div class="modal-body">
            <div class="form-field">
              <label>Nueva contraseña *</label>
              <div class="pass-wrap">
                <input v-model="passModal.password" :type="passModal.show ? 'text' : 'password'" placeholder="Mínimo 6 caracteres" class="form-input" />
                <button type="button" class="pass-toggle" @click="passModal.show = !passModal.show">
                  <i :class="passModal.show ? 'u u-eye-off' : 'u u-eye'"></i>
                </button>
              </div>
            </div>
            <div class="form-field">
              <label>Repetir contraseña *</label>
              <input v-model="passModal.confirm" :type="passModal.show ? 'text' : 'password'" placeholder="Repetir contraseña" class="form-input" />
            </div>
            <div v-if="passModal.error" class="form-error">
              <i class="u u-warning"></i> {{ passModal.error }}
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn--secondary" @click="passModal.open = false">Cancelar</button>
            <button class="btn btn--primary" @click="savePassword" :disabled="passModal.loading">
              <span v-if="passModal.loading" class="spinner-sm"></span>
              <span v-else>Cambiar contraseña</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ── Modal Confirmar Eliminar ──────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="deleteModal.open" class="modal-overlay" @click.self="deleteModal.open = false">
        <div class="modal-box modal-box--sm">
          <div class="modal-header modal-header--danger">
            <span>Eliminar usuario</span>
            <button class="modal-close" @click="deleteModal.open = false"><i class="u u-x"></i></button>
          </div>
          <div class="modal-body" style="text-align:center;padding:28px 24px">
            <i class="u u-trash" style="font-size:36px;color:#ef4444;margin-bottom:12px;display:block"></i>
            <p style="font-size:15px;margin-bottom:6px">¿Eliminar a <strong>{{ deleteModal.user?.nombre }}</strong>?</p>
            <p style="font-size:13px;color:#9ca3af">Esta acción no se puede deshacer.</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn--secondary" @click="deleteModal.open = false">Cancelar</button>
            <button class="btn btn--danger" @click="deleteUser">Eliminar</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Toast notificación -->
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
useHead({ title: 'Usuarios · RRHH' })

// Auth
const { useAuthStore, ROLE_LABELS } = await import('@/stores/auth')
const authStore = useAuthStore()
await authStore.init()

const isAdmin = computed(() => authStore.isAdmin)

const users = ref([])

function loadUsers() {
  users.value = authStore.getUsers()
}

onMounted(loadUsers)

// Descripción de roles
const roleDesc = {
  admin:   'Acceso total: puede crear, editar, eliminar y gestionar usuarios.',
  manager: 'Puede ver, crear y editar registros. No puede eliminar ni gestionar usuarios.',
  viewer:  'Solo puede ver información, sin hacer cambios.',
}

// ── Modal crear/editar ─────────────────────────────────────────────────────
const modal = reactive({ open: false, mode: 'create', editId: null, loading: false, error: '' })
const form  = reactive({ nombre: '', email: '', password: '', rol: 'viewer' })
const showPass = ref(false)

function openCreate() {
  Object.assign(form, { nombre: '', email: '', password: '', rol: 'viewer' })
  Object.assign(modal, { open: true, mode: 'create', editId: null, error: '' })
  showPass.value = false
}

function openEdit(u) {
  Object.assign(form, { nombre: u.nombre, email: u.email, rol: u.rol })
  Object.assign(modal, { open: true, mode: 'edit', editId: u.id, error: '' })
}

function closeModal() {
  modal.open = false
  modal.error = ''
}

async function saveUser() {
  modal.error = ''
  if (!form.nombre.trim()) { modal.error = 'Ingresa el nombre'; return }
  if (!form.email.trim())  { modal.error = 'Ingresa el email'; return }
  if (modal.mode === 'create' && form.password.length < 6) {
    modal.error = 'La contraseña debe tener al menos 6 caracteres'; return
  }

  modal.loading = true
  try {
    let result
    if (modal.mode === 'create') {
      result = await authStore.createUser({ nombre: form.nombre, email: form.email, password: form.password, rol: form.rol })
    } else {
      result = await authStore.updateUser(modal.editId, { nombre: form.nombre, rol: form.rol })
    }
    if (!result.ok) { modal.error = result.message; return }
    closeModal()
    loadUsers()
    showToast(modal.mode === 'create' ? 'Usuario creado' : 'Usuario actualizado', 'success')
  } finally {
    modal.loading = false
  }
}

// ── Modal cambiar contraseña ───────────────────────────────────────────────
const passModal = reactive({ open: false, user: null, password: '', confirm: '', show: false, loading: false, error: '' })

function openPassword(u) {
  Object.assign(passModal, { open: true, user: u, password: '', confirm: '', show: false, error: '' })
}

async function savePassword() {
  passModal.error = ''
  if (passModal.password.length < 6) { passModal.error = 'Mínimo 6 caracteres'; return }
  if (passModal.password !== passModal.confirm) { passModal.error = 'Las contraseñas no coinciden'; return }

  passModal.loading = true
  try {
    const result = await authStore.changePassword(passModal.user.id, passModal.password)
    if (!result.ok) { passModal.error = result.message; return }
    passModal.open = false
    showToast('Contraseña actualizada', 'success')
  } finally {
    passModal.loading = false
  }
}

// ── Toggle activo/inactivo ─────────────────────────────────────────────────
function toggleUser(u) {
  const result = authStore.toggleUser(u.id)
  if (!result.ok) { showToast(result.message || 'Error', 'error'); return }
  loadUsers()
  showToast(result.activo ? 'Usuario activado' : 'Usuario desactivado', 'success')
}

// ── Modal eliminar ─────────────────────────────────────────────────────────
const deleteModal = reactive({ open: false, user: null })

function confirmDelete(u) {
  deleteModal.user = u
  deleteModal.open = true
}

function deleteUser() {
  const result = authStore.deleteUser(deleteModal.user.id)
  deleteModal.open = false
  if (!result.ok) { showToast(result.message || 'No se pudo eliminar', 'error'); return }
  loadUsers()
  showToast('Usuario eliminado', 'success')
}

// ── Toast ──────────────────────────────────────────────────────────────────
const toast = reactive({ show: false, msg: '', type: 'success' })
let toastTimer = null

function showToast(msg, type = 'success') {
  clearTimeout(toastTimer)
  toast.msg  = msg
  toast.type = type
  toast.show = true
  toastTimer = setTimeout(() => { toast.show = false }, 3000)
}

// ── Formatear fecha ────────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
</script>

<style scoped>
.usuarios-page {
  padding: 28px 32px;
  max-width: 960px;
  margin: 0 auto;
}

/* Header */
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
  margin-bottom: 24px;
}

.stat-card {
  background: rgba(42,157,143,0.08);
  border: 1px solid rgba(42,157,143,0.15);
  border-radius: 12px;
  padding: 16px 24px;
  text-align: center;
  min-width: 100px;
}

.stat-value {
  display: block;
  font-size: 28px;
  font-weight: 800;
  color: #2a9d8f;
}

.stat-label {
  font-size: 11px;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

/* Tabla */
.users-table-wrap {
  background: #0f1923;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
  overflow: hidden;
}

.users-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.users-table th {
  padding: 12px 16px;
  text-align: left;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #6b7280;
  background: rgba(255,255,255,0.03);
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.users-table td {
  padding: 13px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  color: #d1d5db;
  vertical-align: middle;
}

.users-table tr:last-child td { border-bottom: none; }
.users-table tr:hover td { background: rgba(255,255,255,0.02); }
.row--inactive td { opacity: 0.5; }

/* User cell */
.user-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-avatar-sm {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 800;
  color: #fff;
  flex-shrink: 0;
}

.user-cell__name {
  font-weight: 600;
  color: #e5e7eb;
  display: flex;
  align-items: center;
  gap: 6px;
}

.user-cell__email { font-size: 11px; color: #6b7280; }

.you-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 8px;
  background: rgba(42,157,143,0.2);
  color: #2a9d8f;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Rol badge */
.rol-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 10px;
  border: 1px solid transparent;
}

.rol-badge--admin   { background: rgba(42,157,143,0.15); color: #2a9d8f; border-color: rgba(42,157,143,0.3); }
.rol-badge--manager { background: rgba(59,130,246,0.15); color: #60a5fa; border-color: rgba(59,130,246,0.3); }
.rol-badge--viewer  { background: rgba(107,114,128,0.15); color: #9ca3af; border-color: rgba(107,114,128,0.3); }

/* Status */
.status-dot {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.status-dot::before {
  content: '';
  width: 7px; height: 7px;
  border-radius: 50%;
  display: inline-block;
}

.status-dot--active  { color: #34d399; }
.status-dot--active::before { background: #34d399; }
.status-dot--inactive { color: #6b7280; }
.status-dot--inactive::before { background: #6b7280; }

.date-cell { font-size: 12px; color: #6b7280; }

/* Actions */
.actions-cell { display: flex; align-items: center; gap: 4px; }

.icon-btn {
  width: 30px; height: 30px;
  border-radius: 7px;
  border: none;
  background: rgba(255,255,255,0.05);
  color: #9ca3af;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  transition: all 0.15s;
}

.icon-btn:hover { background: rgba(255,255,255,0.1); color: #e5e7eb; }
.icon-btn--danger:hover { background: rgba(239,68,68,0.15); color: #ef4444; }
.icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }

.empty-row { text-align: center; color: #6b7280; padding: 32px !important; }

/* Access denied */
.access-denied {
  text-align: center;
  padding: 60px 20px;
  color: #6b7280;
}

.access-denied h3 {
  font-size: 18px;
  color: #d1d5db;
  margin: 16px 0 8px;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 18px;
  border-radius: 9px;
  border: none;
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
}

.btn:active:not(:disabled) { transform: scale(0.97); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.btn--primary   { background: #2a9d8f; color: #fff; }
.btn--primary:hover:not(:disabled) { background: #21867a; }
.btn--secondary { background: rgba(255,255,255,0.07); color: #d1d5db; }
.btn--secondary:hover:not(:disabled) { background: rgba(255,255,255,0.12); }
.btn--danger    { background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); }
.btn--danger:hover:not(:disabled) { background: rgba(239,68,68,0.25); }

/* Modal */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.7);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-box {
  background: #0f1923;
  border: 1px solid rgba(42,157,143,0.2);
  border-radius: 16px;
  width: 100%;
  max-width: 460px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.5);
}

.modal-box--sm { max-width: 380px; }

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  font-size: 15px;
  font-weight: 700;
  color: #e5e7eb;
}

.modal-header--danger { border-color: rgba(239,68,68,0.2); }

.modal-close {
  background: none; border: none; color: #6b7280; cursor: pointer; padding: 4px;
  border-radius: 6px; font-size: 16px;
  display: flex; align-items: center;
}
.modal-close:hover { color: #e5e7eb; }

.modal-body { padding: 22px; }

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 22px;
  border-top: 1px solid rgba(255,255,255,0.06);
}

/* Form */
.form-field { margin-bottom: 18px; }

.form-field label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #9ca3af;
  margin-bottom: 7px;
}

.form-input {
  width: 100%;
  padding: 10px 13px;
  background: #1e2d3a;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 9px;
  color: #e5e7eb;
  font-size: 14px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s;
}

.form-input:focus { border-color: rgba(42,157,143,0.6); }
.form-input:disabled { opacity: 0.5; cursor: not-allowed; }

.pass-wrap { position: relative; }
.pass-wrap .form-input { padding-right: 40px; }

.pass-toggle {
  position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
  background: none; border: none; color: #6b7280; cursor: pointer; padding: 4px;
}

.field-hint { font-size: 11px; color: #6b7280; margin-top: 4px; display: block; }

.form-error {
  display: flex;
  align-items: center;
  gap: 7px;
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.25);
  border-radius: 8px;
  padding: 9px 13px;
  font-size: 13px;
  color: #fca5a5;
  margin-top: 4px;
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
  position: fixed;
  bottom: 28px;
  right: 28px;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 12px 20px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  z-index: 9999;
}

.toast--success { background: #065f46; color: #6ee7b7; border: 1px solid rgba(110,231,183,0.2); }
.toast--error   { background: #7f1d1d; color: #fca5a5; border: 1px solid rgba(252,165,165,0.2); }

.toast-fade-enter-active { transition: all 0.25s ease; }
.toast-fade-leave-active { transition: all 0.2s ease; }
.toast-fade-enter-from { opacity: 0; transform: translateY(12px); }
.toast-fade-leave-to  { opacity: 0; transform: translateY(12px); }
</style>
