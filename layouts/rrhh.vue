<script setup>
/**
 * layouts/rrhh.vue
 * Layout dedicado para el módulo RRHH.
 * Completamente aislado del layout principal (default.vue):
 *  - Sin window.location.reload() en visibilitychange
 *  - Sin dependencia de organizationStore ni permissionsStore
 *  - Sin redirección a /incomes
 *  - Sidebar propio solo con navegación RRHH
 *
 * Integración mínima con la plataforma:
 *  - Usa globalStore.coverInfo para los PDFs (si está disponible)
 *  - Auth middleware sigue activo (dev bypass automático)
 */
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import useGlobalStore from '@/stores/global'
import useRrhhStore   from '@/stores/rrhh'
import { useAsistenciaStore } from '@/stores/asistencia'

const globalStore = useGlobalStore()
const rrhhStore   = useRrhhStore()
const asistencia  = useAsistenciaStore()
const route   = useRoute()
const router  = useRouter()

const sidebarExpanded = ref(true)

// Org info
const orgName = computed(() =>
  globalStore.organization?.name || globalStore.organization?.razon_social || 'RRHH'
)

// ── Badges dinámicos ─────────────────────────────────────────────────────────
// Contratos que vencen en los próximos 30 días (misma lógica que proximosVencer en contratos/index)
const badgeContratos = computed(() => {
  const contratos = rrhhStore.contratos || []
  const hoy = new Date()
  return contratos.filter(c => {
    if (!c.fecha_termino) return false
    if (c.estado === 'vencido') return false
    const dias = Math.ceil((new Date(c.fecha_termino) - hoy) / 86400000)
    return dias > 0 && dias <= 30
  }).length
})

// Personas sin marcación hoy
const badgeAsistencia = computed(() => {
  const hoy = new Date().toISOString().slice(0,10)
  const marcadas = new Set(
    (asistencia.marcaciones || [])
      .filter(m => m.fecha === hoy || m.fecha?.startsWith(hoy))
      .map(m => m.trabajador_id)
  )
  const activos = (rrhhStore.trabajadores || []).filter(t => t.estado === 'activo' || t.estado === 'Activo')
  return activos.filter(t => !marcadas.has(t._id || t.id)).length
})

// ── Navegación v1.1 ──────────────────────────────────────────────────────────
const navSections = computed(() => [
  {
    label: 'Principal',
    items: [
      {
        label:   'Personas',
        icon:    'u u-usuarios',
        path:    '/rrhh/trabajadores',
        matches: (p) => p.startsWith('/rrhh/trabajadores'),
        badge:   null,
        badgeColor: null,
      },
      {
        label:   'Contratos y Liq.',
        icon:    'u u-ventas',
        path:    '/rrhh/contratos',
        matches: (p) => p.startsWith('/rrhh/contratos') || p.startsWith('/rrhh/liquidaciones'),
        badge:   badgeContratos.value > 0 ? badgeContratos.value : null,
        badgeColor: 'orange',
      },
      {
        label:   'Asistencia',
        icon:    'u u-check',
        path:    '/rrhh/asistencia/marcaciones',
        matches: (p) => p === '/rrhh/asistencia/marcaciones' || p === '/rrhh/asistencia/informes',
        badge:   badgeAsistencia.value > 0 ? badgeAsistencia.value : null,
        badgeColor: 'red',
      },
    ],
  },
  {
    label: 'Herramientas',
    items: [
      {
        label:   'Dashboard',
        icon:    'u u-dashboard',
        path:    '/rrhh/asistencia',
        matches: (p) => p === '/rrhh/asistencia',
        badge:   null,
        badgeColor: null,
      },
      {
        label:   'Turnos',
        icon:    'u u-reloj',
        path:    '/rrhh/asistencia/turnos',
        matches: (p) => p === '/rrhh/asistencia/turnos',
        badge:   null,
        badgeColor: null,
      },
      {
        label:   'Reportes',
        icon:    'u u-reportes',
        path:    '/rrhh/reportes',
        matches: (p) => p.startsWith('/rrhh/reportes') || p.startsWith('/rrhh/asistencia/informes'),
        badge:   null,
        badgeColor: null,
      },
    ],
  },
])

const isActive = (item) => item.matches(route.path)

function goTo(path) {
  router.push(path)
}

function toggleSidebar() {
  sidebarExpanded.value = !sidebarExpanded.value
}

onMounted(() => {
  // Cargar datos necesarios para badges si no están en memoria
  if (!rrhhStore.contratos?.length)   rrhhStore.getContratos?.()
  if (!rrhhStore.trabajadores?.length) rrhhStore.getTrabajadores?.()
  asistencia.init?.()
})

// Breadcrumb reactivo desde el store
// Las páginas pueden usar { name, path } o { label, path }
const breadcrumb = computed(() => globalStore.breadcrumb || [])
const pageTitle  = computed(() =>
  globalStore.title || globalStore.namePage || 'Recursos Humanos'
)
</script>

<template>
  <div class="rrhh-layout" :class="{ expanded: sidebarExpanded, collapsed: !sidebarExpanded }">

    <!-- ── Sidebar ─────────────────────────────────────────────────────────── -->
    <aside class="rrhh-sidebar">
      <!-- Logo / Módulo -->
      <div class="sidebar-brand">
        <div class="brand-icon">
          <i class="u u-usuarios"></i>
        </div>
        <transition name="fade-label">
          <span v-if="sidebarExpanded" class="brand-name">RRHH</span>
        </transition>
        <button class="collapse-btn" @click="toggleSidebar" :title="sidebarExpanded ? 'Colapsar' : 'Expandir'">
          <i :class="sidebarExpanded ? 'u u-arrow-left' : 'u u-arrow-right'"></i>
        </button>
      </div>

      <!-- Nav items agrupados por sección -->
      <nav class="sidebar-nav">
        <template v-for="section in navSections" :key="section.label">
          <!-- Separador de sección -->
          <div v-if="sidebarExpanded" class="nav-section-label">{{ section.label }}</div>
          <div v-else class="nav-section-divider"></div>

          <button
            v-for="item in section.items"
            :key="item.path"
            class="nav-item"
            :class="{ active: isActive(item) }"
            @click="goTo(item.path)"
            :title="!sidebarExpanded ? item.label : ''"
          >
            <i :class="item.icon" class="nav-icon"></i>
            <transition name="fade-label">
              <span v-if="sidebarExpanded" class="nav-label">{{ item.label }}</span>
            </transition>
            <!-- Badge dinámico -->
            <transition name="fade-label">
              <span
                v-if="sidebarExpanded && item.badge"
                class="nav-badge"
                :class="`nav-badge--${item.badgeColor}`"
              >{{ item.badge }}</span>
            </transition>
            <span v-if="isActive(item) && sidebarExpanded" class="nav-active-bar"></span>
          </button>
        </template>
      </nav>

      <!-- Botón volver al VX -->
      <div class="sidebar-footer">
        <button class="nav-item back-btn" @click="goTo('/incomes')" title="Volver a Unabase">
          <i class="u u-arrow-left nav-icon"></i>
          <transition name="fade-label">
            <span v-if="sidebarExpanded" class="nav-label">Volver a Unabase</span>
          </transition>
        </button>
      </div>
    </aside>

    <!-- ── Main ───────────────────────────────────────────────────────────── -->
    <div class="rrhh-main">
      <!-- Header -->
      <header class="rrhh-header">
        <div class="header-left">
          <h1 class="header-title">{{ pageTitle }}</h1>
          <nav v-if="breadcrumb.length" class="header-breadcrumb" aria-label="breadcrumb">
            <span
              v-for="(crumb, i) in breadcrumb"
              :key="i"
              class="crumb"
            >
              <a v-if="crumb.path" @click.prevent="goTo(crumb.path)" class="crumb-link">
                {{ crumb.label || crumb.name }}
              </a>
              <span v-else class="crumb-current">{{ crumb.label || crumb.name }}</span>
              <span v-if="i < breadcrumb.length - 1" class="crumb-sep">/</span>
            </span>
          </nav>
        </div>
        <div class="header-right">
          <span class="org-chip">
            <i class="u u-empresa"></i>
            {{ orgName }}
          </span>
        </div>
      </header>

      <!-- Page content -->
      <main class="rrhh-content">
        <NuxtPage />
      </main>
    </div>

  </div>
</template>

<style scoped>
/* ── Layout grid ─────────────────────────────────────────────────────────── */
.rrhh-layout {
  display: grid;
  width: 100vw;
  height: 100vh;
  background: var(--neutral-background-darker, #161f27);
  overflow: hidden;
  transition: grid-template-columns 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.rrhh-layout.expanded  { grid-template-columns: 220px 1fr; }
.rrhh-layout.collapsed { grid-template-columns: 72px 1fr; }

/* ── Sidebar ─────────────────────────────────────────────────────────────── */
.rrhh-sidebar {
  display: flex;
  flex-direction: column;
  background: var(--neutral-background-default, #1e272e);
  border-right: 1px solid var(--neutral-border-light, rgba(255,255,255,0.07));
  height: 100vh;
  overflow: hidden;
  position: relative;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 16px 16px;
  border-bottom: 1px solid var(--neutral-border-light, rgba(255,255,255,0.07));
  min-height: 64px;
}

.brand-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--primary-surface-default, #2a9d8f);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.brand-icon i {
  color: #fff;
  font-size: 18px;
}

.brand-name {
  font-size: 15px;
  font-weight: 800;
  color: var(--neutral-text-title, #f3f4f6);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  flex: 1;
  white-space: nowrap;
}

.collapse-btn {
  background: none;
  border: none;
  color: var(--neutral-text-body, #9ca3af);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  flex-shrink: 0;
}

.collapse-btn:hover {
  background: var(--neutral-background-strong, #2a3a4a);
  color: var(--neutral-text-title, #f3f4f6);
}

/* Nav */
.sidebar-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 12px 10px;
  gap: 4px;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  border: none;
  background: none;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  color: var(--neutral-text-body, #9ca3af);
  transition: all 0.18s;
  width: 100%;
  text-align: left;
  position: relative;
  white-space: nowrap;
  overflow: hidden;
}

.nav-item:hover {
  background: var(--neutral-background-strong, #2a3a4a);
  color: var(--neutral-text-title, #f3f4f6);
}

.nav-item.active {
  background: rgba(58, 199, 165, 0.12);
  color: var(--primary-text-default, #3ac7a5);
  font-weight: 600;
}

.nav-icon {
  font-size: 18px;
  flex-shrink: 0;
  width: 20px;
  text-align: center;
}

.nav-label { flex: 1; }

/* Badge en nav — solo número, estilo notificación */
.nav-badge {
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
  flex-shrink: 0;
  margin-left: auto;
}
.nav-badge--orange {
  background: #f4a261;
  color: #1a1a1a;
}
.nav-badge--red {
  background: #f87171;
  color: #1a1a1a;
}
.nav-badge--teal {
  background: #3ac7a5;
  color: #0a1218;
}

/* Secciones del nav */
.nav-section-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.3);
  padding: 12px 12px 4px;
  white-space: nowrap;
  overflow: hidden;
}

.nav-section-divider {
  height: 1px;
  background: rgba(255,255,255,0.07);
  margin: 8px 10px;
}

.nav-active-bar {
  position: absolute;
  right: 0; top: 25%; bottom: 25%;
  width: 3px;
  background: var(--primary-text-default, #3ac7a5);
  border-radius: 3px;
}

/* Footer */
.sidebar-footer {
  padding: 10px;
  border-top: 1px solid var(--neutral-border-light, rgba(255,255,255,0.07));
}

.back-btn {
  color: var(--neutral-text-body, #6b7280);
  font-size: 12px;
}

.back-btn:hover {
  background: var(--neutral-background-strong, #2a3a4a);
  color: var(--neutral-text-body, #9ca3af);
}

/* ── Main area ────────────────────────────────────────────────────────────── */
.rrhh-main {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

/* Header */
.rrhh-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 28px;
  height: 64px;
  border-bottom: 1px solid var(--neutral-border-light, rgba(255,255,255,0.07));
  flex-shrink: 0;
  background: var(--neutral-background-default, #1e272e);
  gap: 16px;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.header-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--neutral-text-title, #f3f4f6);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-breadcrumb {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--neutral-text-body, #9ca3af);
}

.crumb-link {
  cursor: pointer;
  color: var(--primary-text-default, #3ac7a5);
  text-decoration: none;
}

.crumb-link:hover { text-decoration: underline; }

.crumb-sep { opacity: 0.4; }

.crumb-current { color: var(--neutral-text-body, #9ca3af); }

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.org-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  background: rgba(58, 199, 165, 0.08);
  border: 1px solid rgba(58, 199, 165, 0.2);
  color: var(--primary-text-default, #3ac7a5);
  white-space: nowrap;
}

/* Content */
.rrhh-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  /* Necesario para que hijos con height:100% funcionen */
  display: flex;
  flex-direction: column;
}

/* ── Transitions ─────────────────────────────────────────────────────────── */
.fade-label-enter-active { transition: opacity 0.2s ease, width 0.2s ease; }
.fade-label-leave-active { transition: opacity 0.12s ease, width 0.12s ease; }
.fade-label-enter-from, .fade-label-leave-to { opacity: 0; width: 0; }

/* ── Responsive ──────────────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .rrhh-layout.expanded,
  .rrhh-layout.collapsed {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }

  .rrhh-sidebar {
    display: none;
  }
}
</style>
