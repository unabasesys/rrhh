<script setup>
/**
 * components/rrhh/SectionTabs.vue
 * Barra de tabs compartida para secciones unificadas del módulo RRHH.
 * Proporciona navegación visual coherente entre sub-secciones sin
 * necesidad de cambiar la ruta raíz del menú lateral.
 *
 * Props:
 *   tabs     — Array<{ key, label, path, badge?, badgeColor? }>
 *   current  — key activo (string)
 *
 * Emits:
 *   change(key, path) — cuando el usuario cambia de tab
 */
import { useRouter } from 'vue-router'

const props = defineProps({
  tabs:    { type: Array,  required: true },
  current: { type: String, required: true },
})

const router = useRouter()

function go(tab) {
  if (tab.key !== props.current) {
    router.push(tab.path)
  }
}
</script>

<template>
  <div class="rrhh-section-tabs">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      class="rst-tab"
      :class="{ active: tab.key === current }"
      @click="go(tab)"
    >
      <i v-if="tab.icon" :class="tab.icon" class="rst-icon"></i>
      {{ tab.label }}
      <span
        v-if="tab.badge"
        class="rst-badge"
        :class="`rst-badge--${tab.badgeColor || 'gray'}`"
      >{{ tab.badge }}</span>
    </button>
  </div>
</template>

<style scoped>
.rrhh-section-tabs {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 24px;
  background: #1a2a38;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  flex-shrink: 0;
  overflow-x: auto;
}
.rrhh-section-tabs::-webkit-scrollbar { display: none; }

.rst-tab {
  display: flex; align-items: center; gap: 6px;
  padding: 0 16px; height: 42px;
  background: none; border: none;
  border-bottom: 2px solid transparent;
  font-family: inherit; font-size: 13px; font-weight: 600;
  color: #6b7280; cursor: pointer;
  white-space: nowrap;
  transition: color .15s, border-color .15s;
  position: relative;
}
.rst-tab:hover { color: #f3f4f6; }
.rst-tab.active {
  color: #3ac7a5;
  border-bottom-color: #3ac7a5;
}

.rst-icon { font-size: 14px; }

.rst-badge {
  font-size: 9.5px; font-weight: 800;
  padding: 2px 7px; border-radius: 20px;
}
.rst-badge--orange {
  background: rgba(244,162,97,0.15); color: #f4a261;
  border: 1px solid rgba(244,162,97,0.25);
}
.rst-badge--red {
  background: rgba(239,68,68,0.1); color: #f87171;
  border: 1px solid rgba(239,68,68,0.2);
}
.rst-badge--teal {
  background: rgba(58,199,165,0.1); color: #3ac7a5;
  border: 1px solid rgba(58,199,165,0.2);
}
.rst-badge--gray {
  background: rgba(107,114,128,0.12); color: #9ca3af;
  border: 1px solid rgba(107,114,128,0.2);
}
</style>
