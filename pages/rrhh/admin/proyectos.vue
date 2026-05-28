<template>
  <div class="proyectos-page">
    <!-- Header -->
    <div class="page-header">
      <div class="page-header__left">
        <h2 class="page-title">
          <i class="u u-ventas"></i>
          Proyectos y Líneas
        </h2>
        <span class="page-subtitle">Gestión de proyectos y líneas presupuestales</span>
      </div>
      <div class="page-header__right" style="display:flex;gap:8px">
        <button class="btn btn--secondary" :disabled="seedLoading" @click="cargarEjemplos">
          <i class="u u-importar"></i>
          {{ seedLoading ? 'Cargando...' : 'Cargar ejemplos' }}
        </button>
        <button class="btn btn--primary" @click="abrirModalProyecto(null)">
          <i class="u u-agregar"></i> Nuevo Proyecto
        </button>
      </div>
    </div>

    <!-- Acceso denegado -->
    <div v-if="authLoading" class="access-denied">
      <div style="width:32px;height:32px;border:3px solid rgba(6,204,180,0.2);border-top-color:#06CCB4;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 12px"></div>
      <p style="color:#6b7280;font-size:13px">Verificando acceso...</p>
    </div>

    <div v-else-if="!isAdmin" class="access-denied">
      <i class="u u-locked" style="font-size:48px;color:#4b5563"></i>
      <h3>Acceso restringido</h3>
      <p>Solo administradores pueden gestionar proyectos.</p>
      <button class="btn btn--secondary" @click="$router.back()">Volver</button>
    </div>

    <template v-else>
      <!-- Mensaje feedback -->
      <div v-if="feedback" class="feedback-banner" :class="feedback.type">
        {{ feedback.msg }}
      </div>

      <!-- Loading -->
      <div v-if="loading" class="loading-state">
        <div class="spinner-sm"></div>
        <span>Cargando proyectos...</span>
      </div>

      <!-- Lista vacía -->
      <div v-else-if="proyectos.length === 0" class="empty-state">
        <i class="u u-ventas" style="font-size:48px;color:#374151;margin-bottom:12px;display:block"></i>
        <p>No hay proyectos aún. Crea el primero o usa "Cargar ejemplos".</p>
      </div>

      <!-- Lista de proyectos -->
      <div v-else class="proyectos-list">
        <div
          v-for="proy in proyectos"
          :key="proy._id"
          class="proyecto-card"
          :class="{ expanded: expandedId === proy._id }"
        >
          <!-- Cabecera del proyecto -->
          <div class="proyecto-card__header" @click="toggleExpand(proy._id)">
            <div class="proyecto-card__info">
              <span class="badge" :class="proy.tipo === 'gasto' ? 'badge--orange' : 'badge--teal'">
                {{ proy.tipo === 'gasto' ? 'Gasto' : 'Venta' }}
              </span>
              <span class="proyecto-nombre">{{ proy.nombre }}</span>
              <span class="proyecto-codigo">{{ proy.codigo }}</span>
            </div>
            <div class="proyecto-card__actions" @click.stop>
              <button class="btn-icon" title="Editar" @click="abrirModalProyecto(proy)">
                <i class="u u-editar"></i>
              </button>
              <button class="btn-icon btn-icon--danger" title="Eliminar" @click="eliminarProyecto(proy)">
                <i class="u u-basura"></i>
              </button>
              <i class="u u-chevron-abajo chevron" :class="{ rotated: expandedId === proy._id }"></i>
            </div>
          </div>

          <!-- Lineas expandidas -->
          <div v-if="expandedId === proy._id" class="proyecto-card__lineas">
            <div class="lineas-header">
              <span>Líneas presupuestales</span>
              <button class="btn btn--ghost btn-sm" @click="abrirAddLinea(proy._id)">
                <i class="u u-agregar"></i> Agregar línea
              </button>
            </div>

            <!-- Form inline para nueva línea -->
            <div v-if="addLineaProyId === proy._id" class="add-linea-form">
              <input v-model="lineaForm.nombre" class="form-input form-input-sm" placeholder="Nombre de la línea *" />
              <input v-model="lineaForm.codigo" class="form-input form-input-sm" placeholder="Código (ej: 1403-0001)" />
              <input v-model="lineaForm.categoria" class="form-input form-input-sm" placeholder="Categoría (ej: Camera)" />
              <div class="add-linea-form__actions">
                <button class="btn btn--ghost btn-sm" @click="cancelarAddLinea">Cancelar</button>
                <button class="btn btn--primary btn-sm" @click="guardarLinea(proy._id)">Guardar</button>
              </div>
            </div>

            <!-- Tabla de líneas -->
            <div v-if="lineasPorProyecto[proy._id]?.length" class="lineas-table">
              <div
                v-for="linea in lineasPorProyecto[proy._id]"
                :key="linea._id"
                class="linea-row"
              >
                <span class="linea-codigo">{{ linea.codigo }}</span>
                <span class="linea-nombre">{{ linea.nombre }}</span>
                <span class="linea-cat">{{ linea.categoria }}</span>
                <button class="btn-icon btn-icon--danger btn-icon--xs" @click="eliminarLinea(linea, proy._id)">
                  <i class="u u-basura"></i>
                </button>
              </div>
            </div>
            <p v-else-if="addLineaProyId !== proy._id" class="lineas-empty">
              Sin líneas. Agrega una arriba.
            </p>
          </div>
        </div>
      </div>
    </template>

    <!-- Modal crear/editar proyecto -->
    <div v-if="showModal" class="modal-overlay">
      <div class="modal-box">
        <div class="modal-header">
          <h3>{{ modalMode === 'edit' ? 'Editar Proyecto' : 'Nuevo Proyecto' }}</h3>
          <button class="modal-close" @click="cerrarModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Nombre *</label>
            <input v-model="proyForm.nombre" class="form-input" placeholder="Ej: Producción Serie 2026" />
          </div>
          <div class="form-group">
            <label>Código</label>
            <input v-model="proyForm.codigo" class="form-input" placeholder="Ej: PROD-2026" />
          </div>
          <div class="form-group">
            <label>Tipo</label>
            <select v-model="proyForm.tipo" class="form-input">
              <option value="venta">Proyecto (venta)</option>
              <option value="gasto">Presupuesto de gasto</option>
            </select>
          </div>
          <div class="form-group">
            <label>Descripción</label>
            <textarea v-model="proyForm.descripcion" class="form-input" rows="3" placeholder="Descripción opcional"></textarea>
          </div>
          <p v-if="modalError" class="error-text">{{ modalError }}</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn--ghost" @click="cerrarModal">Cancelar</button>
          <button class="btn btn--primary" :disabled="modalSaving" @click="guardarProyecto">
            {{ modalSaving ? 'Guardando...' : (modalMode === 'edit' ? 'Guardar cambios' : 'Crear proyecto') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'

definePageMeta({ name: 'rrhh-admin-proyectos', layout: 'rrhh', middleware: ['auth'] })

const isAdmin     = ref(false)
const authLoading = ref(true)
const loading     = ref(false)
const seedLoading = ref(false)
const feedback    = ref(null)

const proyectos          = ref([])
const expandedId         = ref(null)
const lineasPorProyecto  = reactive({})

const showModal   = ref(false)
const modalMode   = ref('create') // 'create' | 'edit'
const modalSaving = ref(false)
const modalError  = ref('')
const editingId   = ref(null)
const proyForm    = ref({ nombre: '', codigo: '', tipo: 'venta', descripcion: '' })

const addLineaProyId = ref(null)
const lineaForm      = ref({ nombre: '', codigo: '', categoria: '' })

let _authStore = null
let _orgStore  = null

function showFeedback(msg, type = 'success') {
  feedback.value = { msg, type }
  setTimeout(() => { feedback.value = null }, 4000)
}

async function cargarProyectos() {
  loading.value = true
  try {
    const orgId = _authStore?.currentOrgId || null
    const url   = orgId ? `/api/rrhh/proyectos?orgId=${orgId}` : '/api/rrhh/proyectos'
    proyectos.value = await $fetch(url)
  } catch { proyectos.value = [] }
  finally { loading.value = false }
}

async function cargarLineas(proyId) {
  try {
    lineasPorProyecto[proyId] = await $fetch(`/api/rrhh/lineas?proyectoId=${proyId}`)
  } catch { lineasPorProyecto[proyId] = [] }
}

async function toggleExpand(id) {
  if (expandedId.value === id) {
    expandedId.value = null
    return
  }
  expandedId.value = id
  if (!lineasPorProyecto[id]) {
    await cargarLineas(id)
  }
}

function abrirModalProyecto(proy) {
  modalError.value = ''
  if (proy) {
    modalMode.value  = 'edit'
    editingId.value  = proy._id
    proyForm.value   = { nombre: proy.nombre, codigo: proy.codigo || '', tipo: proy.tipo || 'venta', descripcion: proy.descripcion || '' }
  } else {
    modalMode.value  = 'create'
    editingId.value  = null
    proyForm.value   = { nombre: '', codigo: '', tipo: 'venta', descripcion: '' }
  }
  showModal.value = true
}

function cerrarModal() {
  showModal.value = false
}

async function guardarProyecto() {
  if (!proyForm.value.nombre.trim()) { modalError.value = 'El nombre es requerido'; return }
  modalSaving.value = true
  modalError.value  = ''
  try {
    const orgId = _authStore?.currentOrgId || null
    if (modalMode.value === 'create') {
      const nuevo = await $fetch('/api/rrhh/proyectos', {
        method: 'POST',
        body: { ...proyForm.value, orgId },
      })
      proyectos.value = [...proyectos.value, nuevo]
      showFeedback('Proyecto creado correctamente.')
    } else {
      const updated = await $fetch(`/api/rrhh/proyectos/${editingId.value}`, {
        method: 'PUT',
        body: proyForm.value,
      })
      proyectos.value = proyectos.value.map(p => p._id === editingId.value ? updated : p)
      showFeedback('Proyecto actualizado.')
    }
    cerrarModal()
  } catch (e) {
    modalError.value = e?.data?.message || 'Error al guardar'
  } finally {
    modalSaving.value = false
  }
}

async function eliminarProyecto(proy) {
  if (!confirm(`¿Eliminar el proyecto "${proy.nombre}" y todas sus líneas?`)) return
  try {
    await $fetch(`/api/rrhh/proyectos/${proy._id}`, { method: 'DELETE' })
    proyectos.value = proyectos.value.filter(p => p._id !== proy._id)
    delete lineasPorProyecto[proy._id]
    if (expandedId.value === proy._id) expandedId.value = null
    showFeedback('Proyecto eliminado.')
  } catch (e) {
    showFeedback(e?.data?.message || 'Error al eliminar', 'error')
  }
}

function abrirAddLinea(proyId) {
  addLineaProyId.value = proyId
  lineaForm.value      = { nombre: '', codigo: '', categoria: '' }
}

function cancelarAddLinea() {
  addLineaProyId.value = null
}

async function guardarLinea(proyId) {
  if (!lineaForm.value.nombre.trim()) return
  try {
    const orgId = _authStore?.currentOrgId || null
    const linea = await $fetch('/api/rrhh/lineas', {
      method: 'POST',
      body: { ...lineaForm.value, proyectoId: proyId, orgId },
    })
    if (!lineasPorProyecto[proyId]) lineasPorProyecto[proyId] = []
    lineasPorProyecto[proyId] = [...lineasPorProyecto[proyId], linea]
    cancelarAddLinea()
    showFeedback('Línea agregada.')
  } catch (e) {
    showFeedback(e?.data?.message || 'Error al agregar línea', 'error')
  }
}

async function eliminarLinea(linea, proyId) {
  if (!confirm(`¿Eliminar la línea "${linea.nombre}"?`)) return
  try {
    await $fetch(`/api/rrhh/lineas/${linea._id}`, { method: 'DELETE' })
    lineasPorProyecto[proyId] = lineasPorProyecto[proyId].filter(l => l._id !== linea._id)
    showFeedback('Línea eliminada.')
  } catch (e) {
    showFeedback(e?.data?.message || 'Error al eliminar línea', 'error')
  }
}

async function cargarEjemplos() {
  seedLoading.value = true
  try {
    const orgId = _authStore?.currentOrgId || null
    const res = await $fetch('/api/rrhh/admin/seed-proyectos', {
      method: 'POST',
      body: { orgId },
    })
    if (res.creados > 0) {
      showFeedback(`${res.creados} proyecto(s) de ejemplo creados.`)
      await cargarProyectos()
    } else {
      showFeedback('Los proyectos de ejemplo ya existen.')
    }
  } catch (e) {
    showFeedback(e?.data?.message || 'Error al cargar ejemplos', 'error')
  } finally {
    seedLoading.value = false
  }
}

onMounted(async () => {
  const { useAuthStore } = await import('@/stores/auth')
  const { useOrgStore }  = await import('@/stores/org')
  _authStore = useAuthStore()
  _orgStore  = useOrgStore()
  isAdmin.value     = _authStore?.isAdmin || _authStore?.isSuperAdmin || false
  authLoading.value = false
  if (isAdmin.value) {
    await cargarProyectos()
  }
})
</script>

<style scoped>
.proyectos-page {
  padding: 24px;
  max-width: 960px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 12px;
}

.page-header__left { display: flex; flex-direction: column; gap: 4px; }
.page-title { font-size: 20px; font-weight: 700; color: var(--color-text, #f9fafb); margin: 0; display: flex; align-items: center; gap: 8px; }
.page-subtitle { font-size: 13px; color: #6b7280; }
.page-header__right { display: flex; gap: 8px; align-items: center; }

.feedback-banner {
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 13px;
  margin-bottom: 16px;
}
.feedback-banner.success { background: rgba(6,204,180,0.12); color: #06CCB4; border: 1px solid rgba(6,204,180,0.25); }
.feedback-banner.error   { background: rgba(239,68,68,0.12);  color: #ef4444; border: 1px solid rgba(239,68,68,0.25); }

.loading-state {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #6b7280;
  font-size: 13px;
  padding: 32px 0;
}

.empty-state {
  text-align: center;
  padding: 48px 0;
  color: #6b7280;
}

.access-denied {
  text-align: center;
  padding: 80px 24px;
  color: #6b7280;
}
.access-denied h3 { color: #f9fafb; margin-bottom: 8px; }

/* Proyectos */
.proyectos-list { display: flex; flex-direction: column; gap: 12px; }

.proyecto-card {
  background: var(--card-bg, #111827);
  border: 1px solid var(--border-color, #1f2937);
  border-radius: 10px;
  overflow: hidden;
  transition: border-color 0.2s;
}
.proyecto-card.expanded { border-color: rgba(6,204,180,0.35); }

.proyecto-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  cursor: pointer;
  user-select: none;
  gap: 12px;
}
.proyecto-card__header:hover { background: rgba(255,255,255,0.03); }

.proyecto-card__info { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
.proyecto-nombre { font-size: 14px; font-weight: 600; color: #f9fafb; }
.proyecto-codigo { font-size: 12px; color: #6b7280; }

.proyecto-card__actions { display: flex; align-items: center; gap: 6px; }

.badge { font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; }
.badge--teal   { background: rgba(6,204,180,0.15); color: #06CCB4; }
.badge--orange { background: rgba(249,115,22,0.15); color: #f97316; }

.btn-icon {
  background: transparent;
  border: none;
  cursor: pointer;
  color: #6b7280;
  padding: 4px 6px;
  border-radius: 6px;
  font-size: 14px;
  transition: color 0.15s, background 0.15s;
}
.btn-icon:hover { background: rgba(255,255,255,0.06); color: #d1d5db; }
.btn-icon--danger:hover { color: #ef4444; }
.btn-icon--xs { font-size: 12px; padding: 2px 5px; }

.chevron { color: #6b7280; transition: transform 0.2s; font-size: 12px; }
.chevron.rotated { transform: rotate(180deg); }

/* Líneas */
.proyecto-card__lineas {
  border-top: 1px solid var(--border-color, #1f2937);
  padding: 12px 16px;
  background: rgba(0,0,0,0.2);
}

.lineas-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  font-size: 12px;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.add-linea-form {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
  background: rgba(255,255,255,0.03);
  padding: 10px;
  border-radius: 8px;
}
.add-linea-form__actions { display: flex; gap: 6px; }

.lineas-table { display: flex; flex-direction: column; gap: 4px; }

.linea-row {
  display: grid;
  grid-template-columns: 120px 1fr auto auto;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 13px;
  background: rgba(255,255,255,0.03);
}
.linea-codigo { font-family: monospace; font-size: 12px; color: #9ca3af; }
.linea-nombre { color: #f3f4f6; }
.linea-cat    { font-size: 11px; color: #6b7280; }

.lineas-empty { font-size: 13px; color: #4b5563; padding: 8px 0; }

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.modal-box {
  background: var(--card-bg, #111827);
  border: 1px solid var(--border-color, #1f2937);
  border-radius: 12px;
  width: 100%;
  max-width: 480px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, #1f2937);
}
.modal-header h3 { margin: 0; font-size: 16px; color: #f9fafb; }
.modal-close { background: transparent; border: none; font-size: 20px; cursor: pointer; color: #6b7280; line-height: 1; }
.modal-close:hover { color: #f9fafb; }
.modal-body { padding: 16px 20px; display: flex; flex-direction: column; gap: 12px; }
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--border-color, #1f2937);
}

.form-group { display: flex; flex-direction: column; gap: 4px; }
.form-group label { font-size: 12px; color: #9ca3af; }

.error-text { color: #ef4444; font-size: 12px; margin: 0; }

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: opacity 0.15s;
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn--primary  { background: #06CCB4; color: #0a0f1a; }
.btn--primary:hover:not(:disabled) { opacity: 0.85; }
.btn--secondary { background: rgba(255,255,255,0.07); color: #f3f4f6; border: 1px solid rgba(255,255,255,0.1); }
.btn--secondary:hover:not(:disabled) { background: rgba(255,255,255,0.11); }
.btn--ghost { background: transparent; color: #9ca3af; border: 1px solid rgba(255,255,255,0.1); }
.btn--ghost:hover:not(:disabled) { background: rgba(255,255,255,0.05); }
.btn-sm { padding: 5px 10px; font-size: 12px; }

.form-input {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  padding: 8px 12px;
  color: #f3f4f6;
  font-size: 13px;
  outline: none;
  width: 100%;
  box-sizing: border-box;
}
.form-input:focus { border-color: rgba(6,204,180,0.5); }
.form-input-sm { padding: 5px 8px; font-size: 12px; }

.spinner-sm {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(6,204,180,0.2);
  border-top-color: #06CCB4;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
