<script setup>
// Candado de emergencia: pantalla fija de mantenimiento, sin layout (no usa
// layouts/rrhh.vue ni layouts/default.vue a propósito — es una pantalla de
// sistema). Misma identidad visual que login.vue/register.vue (navy #0f1624,
// acento teal #0DCFA8, Space Grotesk/Inter Tight), no la capa de Calendar/
// Relations — People tiene su propia marca (CLAUDE.md "Branding").
definePageMeta({ layout: false })

useHead({ title: 'People — en mantenimiento' })
</script>

<template>
  <div class="maint-page">
    <main>
      <div class="card">
        <div class="brand">
          <img src="/img/unabase-personas-logo.png" alt="unabase personas" />
        </div>

        <div class="icon-wrap">
          <svg class="pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="9" cy="8" r="3" />
            <circle cx="17" cy="6.5" r="2.2" />
            <path d="M4 20c0-3.3 2.2-5.6 5-5.6s5 2.3 5 5.6" />
            <path d="M14.5 14.8c2.3.2 3.9 2.1 3.9 4.6" />
          </svg>
        </div>

        <h1>People está en mantenimiento</h1>
        <p class="lead">Estamos haciendo mejoras para darte un mejor servicio. Trabajadores, contratos y liquidaciones siguen intactos y vuelven a estar disponibles en breve.</p>
        <p class="app-name">people.unabase.com</p>

        <div class="progress"><div /></div>

        <div class="meta">
          <span class="dot" />
          <span>En progreso — vuelve a intentarlo en unos minutos</span>
        </div>
      </div>
    </main>

    <footer>
      ¿Urgente? Escribe a <a href="mailto:soporte@unabase.com">soporte@unabase.com</a>
    </footer>
  </div>
</template>

<style scoped>
.maint-page {
  --bg: #0f1624;
  --surface: #111d2e;
  --border: rgba(255, 255, 255, .08);
  --text: #f5f0e6;
  --text-muted: #9aa7bb;
  --text-caption: #6b7890;
  --accent: #0dcfa8;
  --accent-dark: #0ba888;
  --accent-soft: rgba(13, 207, 168, .12);
  --ring: 13, 207, 168;

  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--bg);
  color: var(--text);
  font-family: 'Inter Tight', system-ui, sans-serif;
  padding-inline: max(16px, env(safe-area-inset-left, 0px)) max(16px, env(safe-area-inset-right, 0px));
}

main {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-block: 32px;
}

.card {
  width: 100%;
  max-width: 460px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 40px 36px 34px;
  text-align: center;
  box-shadow: 0 24px 60px rgba(0, 0, 0, .45);
}

.brand {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 28px;
}
.brand img { height: 26px; width: auto; }

.icon-wrap {
  width: 84px;
  height: 84px;
  margin: 0 auto 22px;
  border-radius: 50%;
  background: var(--accent-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.icon-wrap::after {
  content: '';
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  border: 1.5px dashed rgba(var(--ring), .35);
}
.icon-wrap svg { width: 38px; height: 38px; color: var(--accent); }

.pulse { animation: pulse 2.2s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .pulse { animation: none; } }
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: .55; }
}

h1 {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 10px;
  letter-spacing: -.01em;
  text-wrap: balance;
  color: var(--text);
}
.lead { margin: 0 0 6px; color: var(--text-muted); font-size: 15px; line-height: 1.55; text-wrap: balance; }
.app-name { margin: 0 0 24px; font-size: 13.5px; color: var(--text-caption); font-weight: 600; }

.progress { height: 6px; border-radius: 99px; background: var(--border); overflow: hidden; margin: 0 0 22px; }
.progress > div {
  height: 100%;
  width: 42%;
  border-radius: 99px;
  background: linear-gradient(90deg, var(--accent-dark), var(--accent));
  animation: slide 2.4s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) { .progress > div { animation: none; width: 55%; } }
@keyframes slide {
  0% { transform: translateX(-60%); }
  50% { transform: translateX(70%); }
  100% { transform: translateX(-60%); }
}

.meta { display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 12.5px; color: var(--text-caption); font-variant-numeric: tabular-nums; }
.dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); flex: none; }

footer { padding: 10px 0 max(22px, env(safe-area-inset-bottom, 0px)); font-size: 12px; color: var(--text-caption); text-align: center; }
footer a { color: var(--text-muted); }
</style>
