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

// Auth + Org stores — carga dinámica para evitar SSR issues
let authStore = null
let orgStore  = null
const currentUser    = ref(null)
const showUserMenu   = ref(false)
const currentOrg     = ref(null)
const showOrgMenu    = ref(false)
const allOrgs        = ref([])
const defaultOrgId   = ref(null)

const sidebarExpanded = ref(true)
const sidebarMobileOpen = ref(false)
const isMobile = ref(false)
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
  // Sección Admin (solo super-admin)
  ...(authStore?.isSuperAdmin ? [{
    label: 'Sistema',
    items: [
      {
        label:   'Organizaciones',
        icon:    'u u-empresa',
        path:    '/rrhh/admin/organizaciones',
        matches: (p) => p.startsWith('/rrhh/admin/organizaciones'),
        badge:   null,
        badgeColor: null,
      },
      {
        label:   'Usuarios',
        icon:    'u u-usuarios',
        path:    '/rrhh/admin/usuarios',
        matches: (p) => p.startsWith('/rrhh/admin/usuarios'),
        badge:   null,
        badgeColor: null,
      },
      {
        label:   'Proyectos y Líneas',
        icon:    'u u-ventas',
        path:    '/rrhh/admin/proyectos',
        matches: (p) => p.startsWith('/rrhh/admin/proyectos'),
        badge:   null,
        badgeColor: null,
      },
    ],
  }] : []),
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
  if (isMobile.value) sidebarMobileOpen.value = false
}

function toggleSidebar() {
  if (isMobile.value) {
    sidebarMobileOpen.value = !sidebarMobileOpen.value
  } else {
    sidebarExpanded.value = !sidebarExpanded.value
  }
}

function closeMobileSidebar() {
  sidebarMobileOpen.value = false
}

function handleResize() {
  isMobile.value = window.innerWidth < 768
  if (!isMobile.value) sidebarMobileOpen.value = false
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

  // Cargar auth + org stores
  const { useAuthStore } = await import('@/stores/auth')
  const { useOrgStore }  = await import('@/stores/org')
  authStore = useAuthStore()
  orgStore  = useOrgStore()
  await authStore.init()
  await orgStore.init()

  currentUser.value = authStore.user

  // Org por defecto
  defaultOrgId.value = localStorage.getItem('rrhh_default_org') || null

  // Org activa
  allOrgs.value = orgStore.orgs
  // Si no hay org activa pero hay una por defecto, activarla automáticamente
  const orgToUse = authStore.currentOrgId || defaultOrgId.value
  if (orgToUse) {
    authStore.switchOrg(orgToUse)
    currentOrg.value = orgStore.getById(orgToUse)
    orgName.value    = currentOrg.value?.nombre || orgName.value
  } else if (allOrgs.value.length === 1) {
    // Si solo hay una org, activarla automáticamente
    const soloOrg = allOrgs.value[0]
    authStore.switchOrg(soloOrg.id)
    currentOrg.value = soloOrg
    orgName.value    = soloOrg.nombre
  }

  // Sincronizar currentOrgId con el rrhh store
  rrhhStore.setOrgId(authStore.currentOrgId)
})

function handleLogout() {
  showUserMenu.value = false
  authStore?.logout()
}

function switchOrg(orgId) {
  showOrgMenu.value = false
  authStore?.switchOrg(orgId)
  currentOrg.value  = orgStore?.getById(orgId) || null
  orgName.value     = currentOrg.value?.nombre || 'Mi Empresa'
  allOrgs.value     = orgStore?.orgs || []
  // Actualizar contexto del rrhh store y recargar datos
  rrhhStore.setOrgId(orgId)
  rrhhStore.trabajadores = []
  rrhhStore.contratos    = []
  rrhhStore.liquidaciones = []
  rrhhStore.getTrabajadores?.()
  rrhhStore.getContratos?.()
}

function setDefaultOrg(orgId) {
  // Toggle: si ya es el default, quitar; si no, poner
  if (defaultOrgId.value === orgId) {
    defaultOrgId.value = null
    localStorage.removeItem('rrhh_default_org')
  } else {
    defaultOrgId.value = orgId
    localStorage.setItem('rrhh_default_org', orgId)
  }
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

// Cerrar dropdowns al hacer click fuera
function handleOutsideClick(e) {
  if (showUserMenu.value && !e.target.closest('.user-menu-wrap')) {
    showUserMenu.value = false
  }
  if (showOrgMenu.value && !e.target.closest('.org-selector-wrap')) {
    showOrgMenu.value = false
  }
}

// Registrar/desregistrar listener para cerrar dropdown
onMounted(() => {
  document.addEventListener('click', handleOutsideClick)
  handleResize()
  window.addEventListener('resize', handleResize)
})
onUnmounted(() => {
  document.removeEventListener('click', handleOutsideClick)
  window.removeEventListener('resize', handleResize)
})

// Las páginas setean el título via useHead() o directamente vía provide/inject en futuras versiones
</script>

<template>
  <div class="rrhh-layout" :class="{ expanded: sidebarExpanded, collapsed: !sidebarExpanded, 'is-mobile': isMobile }">

    <!-- ── Backdrop móvil (se muestra sobre el contenido cuando el drawer está abierto) -->
    <div v-if="sidebarMobileOpen" class="sidebar-backdrop" @click="closeMobileSidebar"></div>

    <!-- ── Sidebar (desktop: columna fija; móvil: drawer deslizante) ─────────── -->
    <aside class="rrhh-sidebar" :class="{ 'mobile-open': sidebarMobileOpen }">
      <!-- Logo / Módulo -->
      <div class="sidebar-brand">
        <div class="brand-icon">
          <!-- Isotipo Unabase: dark (blanco) en sidebar oscuro, light (navy) en sidebar claro -->
          <img
            :src="(isMobile || isDark) ? '/img/isotipo-dark.svg' : '/img/isotipo-light.svg'"
            alt="Unabase"
            width="26"
            height="26"
          />
        </div>
        <transition name="fade-label">
          <div v-if="sidebarExpanded || isMobile" class="brand-name">
            <span class="brand-name__una">una</span><span class="brand-name__base">base</span>
            <span class="brand-name__module">Personas</span>
          </div>
        </transition>
        <button
          class="collapse-btn"
          @click="isMobile ? closeMobileSidebar() : toggleSidebar()"
          :title="isMobile ? 'Cerrar' : (sidebarExpanded ? 'Colapsar' : 'Expandir')"
        >
          <i :class="isMobile ? 'u u-close' : (sidebarExpanded ? 'u u-arrow-left' : 'u u-arrow-right')"></i>
        </button>
      </div>

      <!-- Nav items agrupados por sección -->
      <nav class="sidebar-nav">
        <template v-for="section in navSections" :key="section.label">
          <!-- Separador de sección -->
          <div v-if="sidebarExpanded || isMobile" class="nav-section-label">{{ section.label }}</div>
          <div v-else class="nav-section-divider"></div>

          <button
            v-for="item in section.items"
            :key="item.path"
            class="nav-item"
            :class="{ active: isActive(item) }"
            @click="goTo(item.path)"
            :title="(!sidebarExpanded && !isMobile) ? item.label : ''"
          >
            <i :class="item.icon" class="nav-icon"></i>
            <transition name="fade-label">
              <span v-if="sidebarExpanded || isMobile" class="nav-label">{{ item.label }}</span>
            </transition>
            <!-- Badge dinámico -->
            <transition name="fade-label">
              <span
                v-if="(sidebarExpanded || isMobile) && item.badge"
                class="nav-badge"
                :class="`nav-badge--${item.badgeColor}`"
              >{{ item.badge }}</span>
            </transition>
            <span v-if="isActive(item) && (sidebarExpanded || isMobile)" class="nav-active-bar"></span>
          </button>
        </template>
      </nav>

      <!-- Footer: versión del módulo -->
      <div class="sidebar-footer">
        <div class="module-version">
          <transition name="fade-label">
            <span v-if="sidebarExpanded || isMobile" style="font-size:10px;font-weight:600;letter-spacing:0.05em">Personas · v1.1</span>
          </transition>
          <span v-if="!sidebarExpanded && !isMobile" style="font-size:9px">v1.1</span>
        </div>
      </div>
    </aside>

    <!-- ── Main ───────────────────────────────────────────────────────────── -->
    <div class="rrhh-main">
      <!-- Header -->
      <header class="rrhh-header">
        <!-- Hamburger (solo móvil) -->
        <button v-if="isMobile" class="hamburger-btn" @click="toggleSidebar">
          <span></span><span></span><span></span>
        </button>
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
          <!-- Selector de org activa (super-admin con múltiples orgs) -->
          <div v-if="authStore?.isSuperAdmin && allOrgs.length > 0" class="org-selector-wrap">
            <button class="org-chip org-chip--btn" @click="showOrgMenu = !showOrgMenu">
              <span v-if="currentOrg?.logo" class="org-chip-logo">
                <img :src="currentOrg.logo" alt="" />
              </span>
              <i v-else class="u u-empresa"></i>
              <span>{{ currentOrg?.nombre || 'Sin org activa' }}</span>
              <i class="u u-chevron-down" style="font-size:11px;opacity:0.5"></i>
            </button>
            <!-- Dropdown orgs -->
            <div v-if="showOrgMenu" class="org-dropdown">
              <div class="org-dropdown__label">Cambiar organización</div>
              <div
                v-for="org in allOrgs"
                :key="org.id"
                class="org-dropdown__row"
                :class="{ 'org-dropdown__row--active': authStore?.currentOrgId === org.id }"
              >
                <button
                  class="org-dropdown__item org-dropdown__item--main"
                  @click="switchOrg(org.id)"
                >
                  <span class="org-item-logo">
                    <img v-if="org.logo" :src="org.logo" alt="" />
                    <span v-else>{{ org.nombre?.charAt(0).toUpperCase() }}</span>
                  </span>
                  <span class="org-item-info">
                    <span class="org-item-name">{{ org.nombre }}</span>
                    <span class="org-item-rut">{{ org.rut }}</span>
                  </span>
                  <i v-if="authStore?.currentOrgId === org.id" class="u u-check" style="color:#2a9d8f;font-size:13px;flex-shrink:0"></i>
                </button>
                <!-- Estrella default -->
                <button
                  class="org-star-btn"
                  :class="{ 'org-star-btn--active': defaultOrgId === org.id }"
                  :title="defaultOrgId === org.id ? 'Quitar como predeterminada' : 'Marcar como predeterminada'"
                  @click.stop="setDefaultOrg(org.id)"
                >
                  <svg v-if="defaultOrgId === org.id" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                  </svg>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="15" height="15">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
                  </svg>
                </button>
              </div>
              <div class="org-dropdown__divider"></div>
              <button class="org-dropdown__item" @click="router.push('/rrhh/admin/organizaciones'); showOrgMenu = false">
                <i class="u u-settings" style="font-size:15px;width:28px;text-align:center"></i>
                <span>Gestionar organizaciones</span>
              </button>
            </div>
          </div>
          <span v-else class="org-chip">
            <i class="u u-empresa"></i>
            {{ currentOrg?.nombre || orgName }}
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
              <button v-if="authStore?.isSuperAdmin" class="user-dropdown__item" @click="router.push('/rrhh/admin/organizaciones'); showUserMenu = false">
                <i class="u u-empresa"></i> Organizaciones
              </button>
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
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: transparent;
}

.brand-name {
  display: flex;
  align-items: baseline;
  gap: 0;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  flex-wrap: nowrap;
  line-height: 1;
}
.brand-name__una,
.brand-name__base {
  font-family: 'Syne', 'Nunito', sans-serif;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.3px;
}
.brand-name__una  { color: var(--neutral-text-title, #111827); }
.brand-name__base { color: var(--primary-text-default, #06CCB4); }
.brand-name__module {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--neutral-text-body, #9ca3af);
  margin-left: 6px;
  align-self: center;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(6, 204, 180, 0.1);
  border: 1px solid rgba(6, 204, 180, 0.2);
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

/* ── Org selector ────────────────────────────────────────────────────────── */
.org-selector-wrap {
  position: relative;
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

.org-chip--btn {
  cursor: pointer;
  background: none;
  font-family: inherit;
  transition: background 0.15s;
}
.org-chip--btn:hover { background: rgba(58,199,165,0.12); }

.org-chip-logo {
  width: 18px; height: 18px; border-radius: 4px; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
}
.org-chip-logo img { width: 100%; height: 100%; object-fit: contain; }

.org-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: var(--neutral-background-default, #fff);
  border: 1px solid rgba(0,0,0,0.1);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  min-width: 240px;
  z-index: 999;
  overflow: hidden;
}

.org-dropdown__label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #6b7280;
  padding: 10px 14px 6px;
}

/* Fila org: item principal + estrella */
.org-dropdown__row {
  display: flex;
  align-items: center;
}
.org-dropdown__row--active { background: rgba(42,157,143,0.08); }
.org-dropdown__row:hover   { background: rgba(0,0,0,0.04); }

.org-dropdown__item {
  display: flex;
  align-items: center;
  gap: 10px;
  border: none;
  background: none;
  font-family: inherit;
  font-size: 13px;
  color: var(--neutral-text-body, #374151);
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
}

.org-dropdown__item--main {
  flex: 1;
  padding: 9px 4px 9px 14px;
}

/* Item sin wrapper (Gestionar org) */
.org-dropdown__item:not(.org-dropdown__item--main) {
  width: 100%;
  padding: 9px 14px;
}
.org-dropdown__item:not(.org-dropdown__item--main):hover { background: rgba(0,0,0,0.04); }

/* Estrella */
.org-star-btn {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: #d1d5db;
  transition: color 0.15s, background 0.15s;
  margin-right: 6px;
}
.org-star-btn:hover { color: #f59e0b; background: rgba(245,158,11,0.08); }
.org-star-btn--active { color: #f59e0b; }

.org-item-logo {
  width: 28px; height: 28px; border-radius: 8px;
  background: rgba(42,157,143,0.1);
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 800; color: #2a9d8f;
  overflow: hidden; flex-shrink: 0;
}
.org-item-logo img { width: 100%; height: 100%; object-fit: contain; }

.org-item-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.org-item-name { font-weight: 600; font-size: 13px; }
.org-item-rut  { font-size: 11px; color: #9ca3af; }

.org-dropdown__divider { height: 1px; background: rgba(0,0,0,0.07); margin: 4px 0; }

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

/* ── Responsive base (el sidebar mobile se maneja vía Teleport en el <style> global) ── */
@media (max-width: 768px) {
  .rrhh-layout.expanded,
  .rrhh-layout.collapsed {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }
  /* Desktop sidebar oculto en móvil (el Teleport lo reemplaza) */
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

/* ═══════════════════════════════════════════════════════════════════════════
   RESPONSIVE — Mobile first (< 768px)
   ═══════════════════════════════════════════════════════════════════════════ */

/* Backdrop para cerrar el sidebar en móvil */
/* Estilos del sidebar/backdrop teleportado — NO scoped (van al body) */
</style>

<!-- Estilos globales para el sidebar teleportado en móvil -->
<style>
.sidebar-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.70);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  z-index: 9998;
}

/* (Teleport eliminado — sidebar único con CSS drawer) */

/* Botón hamburger */
.hamburger-btn {
  display: none;
  flex-direction: column;
  gap: 5px;
  padding: 8px;
  background: none;
  border: none;
  cursor: pointer;
  flex-shrink: 0;
  border-radius: 8px;
  transition: background 0.15s;
}
.hamburger-btn:hover { background: var(--neutral-background-strong, #e5e7eb); }
.hamburger-btn span {
  display: block;
  width: 20px;
  height: 2px;
  background: var(--neutral-text-title, #111827);
  border-radius: 2px;
  transition: all 0.2s;
}

@media (max-width: 767px) {
  /* Layout: grid de 1 columna (sidebar fuera del flujo) */
  .rrhh-layout {
    grid-template-columns: 1fr !important;
  }

  /* Sidebar: drawer fijo que aparece desde la izquierda */
  /* !important necesario para vencer la especificidad del CSS scoped (data-v-xxxx) */
  .rrhh-sidebar {
    position: fixed !important;
    left: 0 !important;
    top: 0 !important;
    bottom: 0 !important;
    width: 260px !important;
    height: 100vh !important;
    z-index: 9999 !important;
    transform: translateX(-100%) !important;
    transition: transform 0.28s cubic-bezier(0.25, 0.46, 0.45, 0.94) !important;
    box-shadow: 6px 0 32px rgba(0,0,0,0.5) !important;
    background: #1a2332 !important;
    border-right: 1px solid rgba(255,255,255,0.1) !important;
  }

  .rrhh-sidebar.mobile-open {
    transform: translateX(0) !important;
  }

  /* Textos del sidebar visibles en móvil */
  .brand-name__una  { color: #f1f5f9 !important; }
  .brand-name__base { color: #06CCB4 !important; }
  .brand-name__module {
    color: rgba(255,255,255,0.65) !important;
    background: rgba(6,204,180,0.15) !important;
    border-color: rgba(6,204,180,0.25) !important;
  }
  /* Nav items: buen contraste sobre fondo oscuro */
  .nav-item {
    color: #e2e8f0 !important;        /* antes #cbd5e1 — ahora más legible */
    font-weight: 500 !important;
  }
  .nav-item.active {
    color: #3ac7a5 !important;
    background: rgba(58,199,165,0.15) !important;
    font-weight: 700 !important;
  }
  .nav-item:hover {
    background: rgba(255,255,255,0.09) !important;
    color: #ffffff !important;
  }
  .nav-icon {
    color: inherit !important;
    opacity: 0.85;
  }
  .nav-item.active .nav-icon { opacity: 1; }
  .nav-section-label {
    color: rgba(255,255,255,0.5) !important;   /* antes .35 — más visible */
    font-size: 9px !important;
    letter-spacing: 0.12em !important;
  }
  .collapse-btn {
    color: #94a3b8 !important;
  }
  .sidebar-footer {
    border-top-color: rgba(255,255,255,0.12) !important;
  }

  /* Siempre expandido en móvil */
  .brand-name {
    display: flex !important;
    opacity: 1 !important;
  }
  .nav-label,
  .nav-section-label,
  .nav-badge {
    display: flex !important;
    opacity: 1 !important;
  }

  /* Hamburger visible */
  .hamburger-btn {
    display: flex;
  }

  /* Header compacto */
  .rrhh-header {
    padding: 0 16px;
    gap: 8px;
  }

  /* Ocultar breadcrumb en móvil (muy estrecho) */
  .header-breadcrumb {
    display: none;
  }

  /* Título más pequeño */
  .header-title {
    font-size: 14px;
  }

  /* Org chip: solo icono en móvil */
  .org-chip span:not(.org-chip-logo) {
    display: none;
  }
  .org-chip {
    padding: 5px 8px;
  }

  /* User chip: solo avatar */
  .user-name,
  .user-rol-badge,
  .user-chip .u-chevron-down {
    display: none;
  }
  .user-chip {
    padding: 4px;
    gap: 0;
  }

  /* Ocultar theme toggle en móvil para ahorrar espacio */
  .theme-toggle {
    display: none;
  }

  /* Contenido: scroll normal */
  .rrhh-content {
    overflow-y: auto;
  }
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
