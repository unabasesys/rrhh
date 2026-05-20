<script setup>
/**
 * layouts/rrhh.vue — Módulo RRHH Unabase (standalone)
 * 100% independiente: sin auth, sin globalStore de la plataforma.
 * Al integrar con Unabase OS, se conectará vía props/events al sistema central.
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import useRrhhStore   from '@/stores/rrhh'
import { useAsistenciaStore } from '@/stores/asistencia'
import { useIndicadoresStore } from '@/stores/indicadores'
import { ROLE_LABELS, ROLE_COLORS } from '@/stores/auth'

const rrhhStore    = useRrhhStore()
const asistencia   = useAsistenciaStore()
const indicadores  = useIndicadoresStore()
const route   = useRoute()
const router  = useRouter()

// Auth store — carga dinámica para evitar SSR issues
let authStore = null
const currentUser = ref(null)
const showUserMenu = ref(false)

const sidebarExpanded = ref(true)
const orgName = ref('Mi Empresa')
const pageTitle  = ref('Recursos Humanos')
const breadcrumb = ref([])
const isDark = ref(false)

function toggleTheme() {
  isDark.value = !isDark.value
  if (isDark.value) {
    document.documentElement.classList.add('dark-theme')
    document.documentElement.classList.remove('light-theme')
    localStorage.setItem('rrhh_theme', 'dark')
  } else {
    document.documentElement.classList.remove('dark-theme')
    document.documentElement.classList.add('light-theme')
    localStorage.setItem('rrhh_theme', 'light')
  }
}

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

// Personas sin marcación hoy — solo visible en días laborales (L-V) dentro de horario laboral
const badgeAsistencia = computed(() => {
  const ahora = new Date()
  const dow  = ahora.getDay()          // 0=dom, 6=sab
  const hora = ahora.getHours()
  // Solo lunes-viernes entre 08:00 y 20:00
  if (dow === 0 || dow === 6) return 0
  if (hora < 8 || hora >= 20) return 0

  const hoy = ahora.toISOString().slice(0, 10)
  const marcadas = new Set(
    (asistencia.marcaciones || [])
      .filter(m => m.fecha === hoy)
      .map(m => m.trabajador_id)
  )
  const activos = (rrhhStore.trabajadores || []).filter(t =>
    t.estado === 'activo' || t.estado === 'Activo'
  )
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
        icon:    'u u-home',
        path:    '/rrhh/asistencia',
        matches: (p) => p === '/rrhh/asistencia',
        badge:   null,
        badgeColor: null,
      },
      {
        label:   'Turnos',
        icon:    'u u-clock',
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
      {
        label:   'Indicadores',
        icon:    'u u-info-circle',
        path:    '/rrhh/indicadores',
        matches: (p) => p.startsWith('/rrhh/indicadores'),
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

onMounted(async () => {
  // Todo lo que usa localStorage solo puede ejecutarse en el cliente
  orgName.value = localStorage.getItem('rrhh_org_name') || 'Mi Empresa'
  // Leer tema guardado
  const savedTheme = localStorage.getItem('rrhh_theme') || 'light'
  isDark.value = savedTheme === 'dark'
  if (isDark.value) {
    document.documentElement.classList.add('dark-theme')
    document.documentElement.classList.remove('light-theme')
  } else {
    document.documentElement.classList.remove('dark-theme')
    document.documentElement.classList.add('light-theme')
  }
  indicadores.initIfEmpty()
  // Cargar datos necesarios para badges si no están en memoria
  if (!rrhhStore.contratos?.length)   rrhhStore.getContratos?.()
  if (!rrhhStore.trabajadores?.length) rrhhStore.getTrabajadores?.()
  asistencia.init?.()

  // Cargar auth store
  const { useAuthStore } = await import('@/stores/auth')
  authStore = useAuthStore()
  await authStore.init()
  currentUser.value = authStore.user
})

function handleLogout() {
  showUserMenu.value = false
  authStore?.logout()
}

function userInitial(nombre) {
  return (nombre || '?').charAt(0).toUpperCase()
}

function rolLabel(rol) {
  return ROLE_LABELS[rol] || rol
}

function rolColor(rol) {
  return ROLE_COLORS[rol] || '#6b7280'
}

// Cerrar dropdown al hacer click fuera
function handleOutsideClick(e) {
  if (showUserMenu.value && !e.target.closest('.user-menu-wrap')) {
    showUserMenu.value = false
  }
}

// Registrar/desregistrar listener para cerrar dropdown
onMounted(() => { document.addEventListener('click', handleOutsideClick) })
onUnmounted(() => { document.removeEventListener('click', handleOutsideClick) })

// Las páginas setean el título via useHead() o directamente vía provide/inject en futuras versiones
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

      <!-- Footer: versión del módulo -->
      <div class="sidebar-footer">
        <div class="module-version">
          <transition name="fade-label">
            <span v-if="sidebarExpanded" style="font-size:10px;color:#4b5563;font-weight:600;letter-spacing:0.05em">RRHH · v1.1</span>
          </transition>
          <span v-if="!sidebarExpanded" style="font-size:9px;color:#4b5563">v1.1</span>
        </div>
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
          <!-- Toggle Dark/Light -->
          <button class="theme-toggle" @click="toggleTheme" :title="isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'">
            <span v-if="isDark">☀️</span>
            <span v-else>🌙</span>
          </button>
          <span class="org-chip">
            <i class="u u-empresa"></i>
            {{ orgName }}
          </span>
          <!-- Usuario actual -->
          <div v-if="currentUser" class="user-menu-wrap">
            <button class="user-chip" @click="showUserMenu = !showUserMenu">
              <span class="user-avatar">{{ userInitial(currentUser.nombre) }}</span>
              <span class="user-name">{{ currentUser.nombre }}</span>
              <span class="user-rol-badge" :style="{ background: rolColor(currentUser.rol) + '22', color: rolColor(currentUser.rol), borderColor: rolColor(currentUser.rol) + '44' }">
                {{ rolLabel(currentUser.rol) }}
              </span>
              <i class="u u-chevron-down" style="font-size:11px;opacity:0.5"></i>
            </button>
            <!-- Dropdown -->
            <div v-if="showUserMenu" class="user-dropdown" @click.stop>
              <div class="user-dropdown__header">
                <span class="user-avatar user-avatar--lg">{{ userInitial(currentUser.nombre) }}</span>
                <div>
                  <div class="user-dropdown__name">{{ currentUser.nombre }}</div>
                  <div class="user-dropdown__email">{{ currentUser.email }}</div>
                </div>
              </div>
              <div class="user-dropdown__divider"></div>
              <button v-if="authStore?.isAdmin" class="user-dropdown__item" @click="router.push('/rrhh/admin/usuarios'); showUserMenu = false">
                <i class="u u-usuarios"></i> Gestión de usuarios
              </button>
              <button class="user-dropdown__item user-dropdown__item--danger" @click="handleLogout">
                <i class="u u-logout"></i> Cerrar sesión
              </button>
            </div>
          </div>
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
  background: var(--neutral-background-darker, #111827);
  overflow: hidden;
  transition: grid-template-columns 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.rrhh-layout.expanded  { grid-template-columns: 220px 1fr; }
.rrhh-layout.collapsed { grid-template-columns: 72px 1fr; }

/* ── Sidebar ─────────────────────────────────────────────────────────────── */
.rrhh-sidebar {
  display: flex;
  flex-direction: column;
  background: var(--neutral-background-default, #ffffff);
  border-right: 1px solid var(--neutral-border-light, rgba(0,0,0,0.08));
  height: 100vh;
  overflow: hidden;
  position: relative;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 16px 16px;
  border-bottom: 1px solid var(--neutral-border-light, rgba(0,0,0,0.08));
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
  color: var(--neutral-text-title, #111827);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  flex: 1;
  white-space: nowrap;
}

.collapse-btn {
  background: none;
  border: none;
  color: var(--neutral-text-body, #4b5563);
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
  background: var(--neutral-background-strong, #e5e7eb);
  color: var(--neutral-text-title, #111827);
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
  color: var(--neutral-text-body, #4b5563);
  transition: all 0.18s;
  width: 100%;
  text-align: left;
  position: relative;
  white-space: nowrap;
  overflow: hidden;
}

.nav-item:hover {
  background: var(--neutral-background-strong, #e5e7eb);
  color: var(--neutral-text-title, #111827);
}

.nav-item.active {
  background: rgba(58, 199, 165, 0.15);
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
  background: rgba(0,0,0,0.08);
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
  border-top: 1px solid var(--neutral-border-light, rgba(0,0,0,0.08));
}

.back-btn {
  color: var(--neutral-text-body, #6b7280);
  font-size: 12px;
}

.back-btn:hover {
  background: var(--neutral-background-strong, #e5e7eb);
  color: var(--neutral-text-body, #4b5563);
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
  border-bottom: 1px solid var(--neutral-border-light, rgba(0,0,0,0.08));
  flex-shrink: 0;
  background: var(--neutral-background-default, #ffffff);
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
  color: var(--neutral-text-title, #111827);
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
  color: var(--neutral-text-body, #4b5563);
}

.crumb-link {
  cursor: pointer;
  color: var(--primary-text-default, #3ac7a5);
  text-decoration: none;
}

.crumb-link:hover { text-decoration: underline; }

.crumb-sep { opacity: 0.4; }

.crumb-current { color: var(--neutral-text-body, #4b5563); }

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.theme-toggle {
  background: none;
  border: 1.5px solid var(--neutral-border-light, rgba(0,0,0,0.1));
  border-radius: 8px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  transition: all 0.15s;
  display: flex;
  align-items: center;
}
.theme-toggle:hover {
  background: var(--neutral-background-light, #f3f4f6);
  border-color: var(--primary-text-default, #3ac7a5);
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

/* ── User chip ───────────────────────────────────────────────────────────── */
.user-menu-wrap {
  position: relative;
}

.user-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px 5px 6px;
  border-radius: 20px;
  border: 1px solid var(--neutral-border-light, rgba(0,0,0,0.1));
  background: none;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  color: var(--neutral-text-title, #111827);
  transition: background 0.15s;
}

.user-chip:hover {
  background: var(--neutral-background-strong, #f1f5f9);
}

.user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #2a9d8f;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 800;
  flex-shrink: 0;
}

.user-avatar--lg {
  width: 38px;
  height: 38px;
  font-size: 15px;
}

.user-name {
  font-weight: 600;
  white-space: nowrap;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-rol-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 10px;
  border: 1px solid transparent;
  white-space: nowrap;
}

/* Dropdown */
.user-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: var(--neutral-background-default, #ffffff);
  border: 1px solid var(--neutral-border-light, rgba(0,0,0,0.1));
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  min-width: 220px;
  z-index: 999;
  overflow: hidden;
}

.user-dropdown__header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
}

.user-dropdown__name {
  font-size: 14px;
  font-weight: 700;
  color: var(--neutral-text-title, #111827);
}

.user-dropdown__email {
  font-size: 11px;
  color: var(--neutral-text-body, #6b7280);
  margin-top: 2px;
}

.user-dropdown__divider {
  height: 1px;
  background: var(--neutral-border-light, rgba(0,0,0,0.08));
  margin: 0;
}

.user-dropdown__item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 16px;
  border: none;
  background: none;
  font-family: inherit;
  font-size: 13px;
  color: var(--neutral-text-body, #374151);
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
}

.user-dropdown__item:hover {
  background: var(--neutral-background-strong, #f1f5f9);
}

.user-dropdown__item--danger {
  color: #ef4444;
}

.user-dropdown__item--danger:hover {
  background: rgba(239, 68, 68, 0.08);
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

<!-- Estilos globales (sin scoped) para el tema claro — se aplican a todas las páginas hijas -->
<style>
:root.light-theme .rrhh-content {
  background: #f8fafc !important;
}

/* ── Páginas principales ── */
:root.light-theme .trabajadores-page,
:root.light-theme .contratos-page,
:root.light-theme .liquidaciones-page,
:root.light-theme .reportes-page,
:root.light-theme .asistencia-page,
:root.light-theme .asistencia-dashboard,
:root.light-theme .turnos-page,
:root.light-theme .informes-page,
:root.light-theme .indicadores-page,
:root.light-theme .ficha-trabajador {
  background: #f8fafc !important;
  color: #111827 !important;
}

/* ── Toolbars / Filtros ── */
:root.light-theme .page-toolbar,
:root.light-theme .filter-bar,
:root.light-theme .page-header,
:root.light-theme .page-header__left,
:root.light-theme .page-header__right {
  background: #ffffff !important;
  border-color: #e2e8f0 !important;
  color: #111827 !important;
}

/* ── KPI cards ── */
:root.light-theme .kpi-row,
:root.light-theme .kpi-bar {
  background: #f1f5f9 !important;
  border-color: #e2e8f0 !important;
}
:root.light-theme .kpi-card {
  background: #ffffff !important;
  border-color: #e2e8f0 !important;
  color: #111827 !important;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08) !important;
}
:root.light-theme .kpi-label { color: #6b7280 !important; }
:root.light-theme .kpi-value { color: #111827 !important; }
:root.light-theme .kpi-sub { color: #9ca3af !important; }

/* ── Tabla ── */
:root.light-theme .table-container,
:root.light-theme .table-wrap,
:root.light-theme .centralizacion-table-wrap,
:root.light-theme .data-table-wrap {
  background: #ffffff !important;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}
:root.light-theme .data-table thead tr,
:root.light-theme .data-table th {
  background: #f8fafc !important;
  color: #374151 !important;
  border-color: #e2e8f0 !important;
}
:root.light-theme .data-table td,
:root.light-theme .data-table tr {
  background: #ffffff !important;
  border-color: #f1f5f9 !important;
  color: #111827 !important;
}
:root.light-theme .data-table tr:hover td { background: #f0fdf9 !important; }
:root.light-theme .worker-name { color: #111827 !important; }
:root.light-theme .worker-cargo { color: #6b7280 !important; }

/* ── Contratos cards (ficha trabajador + vista contratos) ── */
:root.light-theme .contrato-card {
  background: #ffffff !important;
  border-color: #e2e8f0 !important;
  color: #111827 !important;
}
:root.light-theme .contrato-card:hover {
  background: #f0fdf9 !important;
  border-color: rgba(58,199,165,0.3) !important;
}
:root.light-theme .contrato-card-title,
:root.light-theme .contrato-card-meta,
:root.light-theme .cv-tipo,
:root.light-theme .cv-fechas,
:root.light-theme .cv-proyecto,
:root.light-theme .contrato-tipo,
:root.light-theme .contrato-fechas,
:root.light-theme .contrato-proyecto {
  color: #374151 !important;
}
/* Variables CSS para light mode */
:root.light-theme {
  --neutral-background-strong: #f1f5f9;
  --neutral-background-strong-hover: #e5e7eb;
}
:root.light-theme .contrato-card-header,
:root.light-theme .contrato-card-body,
:root.light-theme .contrato-card-footer {
  background: transparent !important;
  border-color: #f1f5f9 !important;
  color: #111827 !important;
}

/* ── Inputs ── */
:root.light-theme .form-input,
:root.light-theme input[type="text"],
:root.light-theme input[type="number"],
:root.light-theme input[type="date"],
:root.light-theme input[type="email"],
:root.light-theme input[type="month"],
:root.light-theme select,
:root.light-theme textarea {
  background: #ffffff !important;
  color: #111827 !important;
  border-color: #cbd5e1 !important;
}
:root.light-theme .search-input,
:root.light-theme .filterInput input {
  color: #111827 !important;
}

/* ── Alertas / banners ── */
:root.light-theme .alerts-row,
:root.light-theme .alert-banner {
  background: #fef9c3 !important;
  border-color: #fbbf24 !important;
  color: #78350f !important;
}

/* ── Tabs ── */
:root.light-theme .tabs-bar,
:root.light-theme .report-tabs,
:root.light-theme .view-toggle {
  background: #f1f5f9 !important;
  border-color: #e2e8f0 !important;
}
:root.light-theme .tab-btn:not(.active) { color: #6b7280 !important; background: transparent !important; }

/* ── Modales ── */
:root.light-theme .modal-box {
  background: #ffffff !important;
  color: #111827 !important;
  border-color: #e2e8f0 !important;
}
:root.light-theme .modal-header {
  background: #f8fafc !important;
  border-color: #e2e8f0 !important;
  color: #111827 !important;
}
:root.light-theme .modal-body { background: #ffffff !important; color: #111827 !important; }

/* ── Labels y textos de form ── */
:root.light-theme label,
:root.light-theme .section-label,
:root.light-theme .form-section h4 {
  color: #374151 !important;
}

/* ── Ficha trabajador tabs ── */
:root.light-theme .tab-content { background: #ffffff !important; color: #111827 !important; }
:root.light-theme .info-row { border-color: #f1f5f9 !important; }
:root.light-theme .info-label { color: #6b7280 !important; }
:root.light-theme .info-value { color: #111827 !important; }
</style>
