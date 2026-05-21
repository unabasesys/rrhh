<template>
  <div class="login-root">

    <!-- ── DESKTOP: Left form panel ──────────────────────────────── -->
    <div class="form-panel">
      <div class="form-inner">

        <!-- Logo -->
        <div class="brand-row">
          <img src="/img/logo-dark.svg" alt="unabase" class="brand-logo" />
        </div>

        <!-- Kicker + Headline -->
        <div class="kicker">Módulo de Personas · RRHH</div>
        <h1 class="headline">
          Tu equipo creativo,<br>
          <span class="headline-accent">en una sola base.</span>
        </h1>
        <p class="lede">
          Contratos, liquidaciones, finiquitos y horarios para estudios,
          agencias y productoras.
        </p>

        <!-- Form -->
        <form class="form" @submit.prevent="handleLogin">
          <div class="field" :class="{ 'field--error': errors.email }">
            <span class="field-label">Correo corporativo</span>
            <input
              v-model="form.email"
              type="email"
              placeholder="ana@estudio.cl"
              autocomplete="email"
              autofocus
              @input="errors.email = ''"
            />
            <span v-if="errors.email" class="error-msg">{{ errors.email }}</span>
          </div>

          <div class="field" :class="{ 'field--error': errors.password }">
            <span class="field-label">Contraseña</span>
            <div class="input-wrap">
              <input
                v-model="form.password"
                :type="showPass ? 'text' : 'password'"
                placeholder="••••••••••••"
                autocomplete="current-password"
                @input="errors.password = ''"
              />
              <button type="button" class="eye-btn" @click="showPass = !showPass">
                {{ showPass ? 'Ocultar' : 'Ver' }}
              </button>
            </div>
            <span v-if="errors.password" class="error-msg">{{ errors.password }}</span>
          </div>

          <div class="options-row">
            <label class="check-label">
              <span class="checkbox" :class="{ 'checkbox--checked': form.remember }" @click="form.remember = !form.remember">
                <svg v-if="form.remember" width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4 L4 7 L9 1" stroke="#062D3A" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              Mantener sesión 30 días
            </label>
          </div>

          <!-- Error global -->
          <div v-if="errors.global" class="alert-error">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke="#f87171" stroke-width="1.5"/>
              <path d="M7 4v3M7 9.5v.5" stroke="#f87171" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            {{ errors.global }}
          </div>

          <button type="submit" class="primary-btn" :disabled="loading">
            <span v-if="loading" class="btn-spinner"></span>
            <template v-else>
              Entrar al módulo
              <svg width="16" height="12" viewBox="0 0 16 12" fill="none" style="margin-left:8px">
                <path d="M1 6 L13 6 M9 1 L14 6 L9 11" stroke="#062D3A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </template>
          </button>
        </form>

        <!-- Footer -->
        <div class="footer">
          <span>unabase · Personas v1.2</span>
          <span class="footer-dot">·</span>
          <span class="footer-status">
            <span class="status-dot"></span>
            operativo
          </span>
        </div>
      </div>
    </div>

    <!-- ── DESKTOP: Right illustration panel ─────────────────────── -->
    <div class="illus-panel">
      <!-- Desk illustration SVG -->
      <svg class="illus-svg" viewBox="0 0 640 600" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="wall-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#F2EBDB"/>
            <stop offset="1" stop-color="#E8DFC9"/>
          </linearGradient>
          <pattern id="wall-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M20 0H0V20" fill="none" stroke="#062D3A" stroke-opacity="0.05" stroke-width="0.5"/>
          </pattern>
        </defs>

        <!-- Wall -->
        <rect width="640" height="600" fill="url(#wall-grad)"/>
        <rect width="640" height="600" fill="url(#wall-grid)"/>

        <!-- Window -->
        <g opacity="0.5">
          <rect x="40" y="60" width="140" height="100" rx="2" fill="#fff" stroke="#062D3A" stroke-width="1.5"/>
          <line x1="110" y1="60" x2="110" y2="160" stroke="#062D3A" stroke-width="1.5"/>
          <line x1="40" y1="110" x2="180" y2="110" stroke="#062D3A" stroke-width="1.5"/>
        </g>

        <!-- Shelf + books -->
        <g>
          <rect x="430" y="100" width="170" height="6" fill="#062D3A"/>
          <rect x="450" y="60" width="55" height="40" rx="2" fill="#fff" stroke="#062D3A" stroke-width="2"/>
          <circle cx="468" cy="78" r="5" fill="#0DCFA8"/>
          <path d="M450 100 L468 85 L482 95 L505 80 L505 100Z" fill="#062D3A"/>
          <rect x="520" y="70" width="10" height="30" fill="#0DCFA8"/>
          <rect x="532" y="62" width="10" height="38" fill="#E07856"/>
          <rect x="544" y="74" width="10" height="26" fill="#062D3A"/>
          <rect x="556" y="68" width="10" height="32" fill="#F0B040"/>
        </g>

        <!-- Desk surface -->
        <rect x="0" y="380" width="640" height="14" fill="#062D3A"/>
        <rect x="0" y="394" width="640" height="206" fill="#0B3744"/>
        <rect x="60" y="394" width="6" height="180" fill="#041B22"/>
        <rect x="574" y="394" width="6" height="180" fill="#041B22"/>

        <!-- Laptop -->
        <g transform="translate(230 220)">
          <path d="M-10 160 L190 160 L200 175 L-20 175 Z" fill="#062D3A"/>
          <rect x="0" y="0" width="180" height="160" rx="6" fill="#062D3A"/>
          <rect x="8" y="8" width="164" height="144" rx="3" fill="#F5F0E6"/>
          <rect x="8" y="8" width="164" height="18" fill="#062D3A"/>
          <!-- isotipo en pantalla -->
          <circle cx="18" cy="17" r="5" fill="#0DCFA8" opacity="0.9"/>
          <rect x="28" y="14" width="40" height="6" rx="1" fill="#fff" opacity="0.6"/>
          <!-- días -->
          <text x="26" y="36" font-size="6" fill="#062D3A" text-anchor="middle" font-family="Space Grotesk, sans-serif" opacity="0.6">L</text>
          <text x="56" y="36" font-size="6" fill="#062D3A" text-anchor="middle" font-family="Space Grotesk, sans-serif" opacity="0.6">M</text>
          <text x="86" y="36" font-size="6" fill="#062D3A" text-anchor="middle" font-family="Space Grotesk, sans-serif" opacity="0.6">M</text>
          <text x="116" y="36" font-size="6" fill="#062D3A" text-anchor="middle" font-family="Space Grotesk, sans-serif" opacity="0.6">J</text>
          <text x="146" y="36" font-size="6" fill="#062D3A" text-anchor="middle" font-family="Space Grotesk, sans-serif" opacity="0.6">V</text>
          <!-- grid turnos -->
          <rect x="14" y="42" width="26" height="12" rx="2" fill="#0DCFA8"/>
          <rect x="44" y="42" width="26" height="12" rx="2" fill="#062D3A" opacity="0.1"/>
          <rect x="74" y="42" width="26" height="12" rx="2" fill="#E07856"/>
          <rect x="104" y="42" width="26" height="12" rx="2" fill="#062D3A" opacity="0.1"/>
          <rect x="134" y="42" width="26" height="12" rx="2" fill="#0DCFA8"/>
          <rect x="14" y="58" width="26" height="12" rx="2" fill="#062D3A" opacity="0.1"/>
          <rect x="44" y="58" width="26" height="12" rx="2" fill="#E07856"/>
          <rect x="74" y="58" width="26" height="12" rx="2" fill="#062D3A" opacity="0.1"/>
          <rect x="104" y="58" width="26" height="12" rx="2" fill="#0DCFA8"/>
          <rect x="134" y="58" width="26" height="12" rx="2" fill="#062D3A" opacity="0.1"/>
          <rect x="14" y="74" width="26" height="12" rx="2" fill="#E07856"/>
          <rect x="44" y="74" width="26" height="12" rx="2" fill="#062D3A" opacity="0.1"/>
          <rect x="74" y="74" width="26" height="12" rx="2" fill="#0DCFA8"/>
          <rect x="104" y="74" width="26" height="12" rx="2" fill="#062D3A" opacity="0.1"/>
          <rect x="134" y="74" width="26" height="12" rx="2" fill="#E07856"/>
          <rect x="14" y="90" width="26" height="12" rx="2" fill="#062D3A" opacity="0.1"/>
          <rect x="44" y="90" width="26" height="12" rx="2" fill="#0DCFA8"/>
          <rect x="74" y="90" width="26" height="12" rx="2" fill="#062D3A" opacity="0.1"/>
          <rect x="104" y="90" width="26" height="12" rx="2" fill="#E07856"/>
          <rect x="134" y="90" width="26" height="12" rx="2" fill="#0DCFA8"/>
          <rect x="14" y="106" width="26" height="12" rx="2" fill="#0DCFA8"/>
          <rect x="44" y="106" width="26" height="12" rx="2" fill="#062D3A" opacity="0.1"/>
          <rect x="74" y="106" width="26" height="12" rx="2" fill="#E07856"/>
          <rect x="104" y="106" width="26" height="12" rx="2" fill="#0DCFA8"/>
          <rect x="134" y="106" width="26" height="12" rx="2" fill="#062D3A" opacity="0.1"/>
          <rect x="14" y="122" width="26" height="12" rx="2" fill="#062D3A" opacity="0.1"/>
          <rect x="44" y="122" width="26" height="12" rx="2" fill="#E07856"/>
          <rect x="74" y="122" width="26" height="12" rx="2" fill="#0DCFA8"/>
          <rect x="104" y="122" width="26" height="12" rx="2" fill="#062D3A" opacity="0.1"/>
          <rect x="134" y="122" width="26" height="12" rx="2" fill="#E07856"/>
        </g>

        <!-- Plant -->
        <g transform="translate(60 280)">
          <path d="M-5 70 L45 70 L40 110 L0 110 Z" fill="#E07856"/>
          <rect x="-5" y="66" width="50" height="8" rx="2" fill="#C95F38"/>
          <g fill="#0DCFA8">
            <ellipse cx="20" cy="20" rx="6" ry="22" transform="rotate(-15 20 20)"/>
            <ellipse cx="32" cy="30" rx="6" ry="20" transform="rotate(20 32 30)"/>
            <ellipse cx="8" cy="38" rx="6" ry="18" transform="rotate(-30 8 38)"/>
            <ellipse cx="24" cy="48" rx="6" ry="16" transform="rotate(5 24 48)"/>
          </g>
          <g fill="#062D3A" opacity="0.25">
            <ellipse cx="16" cy="26" rx="3" ry="10" transform="rotate(-15 16 26)"/>
            <ellipse cx="28" cy="36" rx="3" ry="9" transform="rotate(20 28 36)"/>
          </g>
        </g>

        <!-- Coffee -->
        <g transform="translate(470 320)">
          <rect x="0" y="0" width="46" height="58" rx="4" fill="#062D3A"/>
          <rect x="4" y="4" width="38" height="8" rx="1" fill="#0DCFA8"/>
          <path d="M46 14 Q60 16 60 30 Q60 44 46 46" stroke="#062D3A" stroke-width="4" fill="none"/>
          <path d="M14 -8 Q10 -16 16 -22 Q22 -28 18 -36" stroke="#062D3A" stroke-width="2" fill="none" opacity="0.4" stroke-linecap="round"/>
          <path d="M28 -8 Q24 -16 30 -22 Q36 -28 32 -36" stroke="#062D3A" stroke-width="2" fill="none" opacity="0.4" stroke-linecap="round"/>
        </g>

        <!-- Papers -->
        <g transform="translate(140 340)">
          <rect x="0" y="0" width="80" height="46" rx="2" fill="#fff" stroke="#062D3A" stroke-width="1.5" transform="rotate(-8 40 23)"/>
          <rect x="8" y="6" width="76" height="42" rx="2" fill="#fff" stroke="#062D3A" stroke-width="1.5"/>
          <rect x="14" y="14" width="40" height="3" fill="#062D3A"/>
          <rect x="14" y="22" width="60" height="2" fill="#062D3A" opacity="0.3"/>
          <rect x="14" y="28" width="50" height="2" fill="#062D3A" opacity="0.3"/>
          <rect x="14" y="34" width="56" height="2" fill="#062D3A" opacity="0.3"/>
          <circle cx="68" cy="40" r="4" fill="#0DCFA8"/>
        </g>

        <!-- Lamp -->
        <g transform="translate(440 180)">
          <line x1="0" y1="200" x2="0" y2="80" stroke="#062D3A" stroke-width="3"/>
          <line x1="0" y1="80" x2="40" y2="60" stroke="#062D3A" stroke-width="3"/>
          <path d="M30 50 L60 40 L52 70 L38 70 Z" fill="#0DCFA8" stroke="#062D3A" stroke-width="2"/>
          <circle cx="0" cy="200" r="6" fill="#062D3A"/>
          <path d="M40 70 L120 200 L-10 200 Z" fill="#FFF7DE" opacity="0.4"/>
        </g>

        <!-- Sticky note -->
        <g transform="translate(540 240) rotate(8)">
          <rect width="60" height="56" fill="#FFEC8E" stroke="#062D3A" stroke-width="1"/>
          <line x1="8" y1="14" x2="48" y2="14" stroke="#062D3A" stroke-width="1" opacity="0.5"/>
          <line x1="8" y1="22" x2="40" y2="22" stroke="#062D3A" stroke-width="1" opacity="0.5"/>
          <line x1="8" y1="30" x2="48" y2="30" stroke="#062D3A" stroke-width="1" opacity="0.5"/>
          <path d="M8 42 L14 48 L24 38" stroke="#0DCFA8" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </g>

        <!-- Clock -->
        <g transform="translate(110 180)">
          <circle cx="0" cy="0" r="22" fill="#fff" stroke="#062D3A" stroke-width="2"/>
          <line x1="0" y1="0" x2="0" y2="-14" stroke="#062D3A" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="0" y1="0" x2="10" y2="4" stroke="#0DCFA8" stroke-width="2.5" stroke-linecap="round"/>
          <circle cx="0" cy="0" r="2" fill="#062D3A"/>
        </g>
      </svg>

      <!-- Chip 1: horarios -->
      <div class="chip chip--top-right">
        <div class="chip-icon chip-icon--teal">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1.5" y="2.5" width="11" height="10" rx="1.5" stroke="#062D3A" stroke-width="1.5"/>
            <path d="M4 1v3M10 1v3M1.5 5.5h11" stroke="#062D3A" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </div>
        <div>
          <div class="chip-title">Horarios sincronizados</div>
          <div class="chip-sub">42 turnos · Mayo</div>
        </div>
      </div>

      <!-- Chip 2: liquidación -->
      <div class="chip chip--bottom-left">
        <div class="chip-icon chip-icon--coral">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 4 H12 M2 7 H9 M2 10 H10" stroke="#062D3A" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </div>
        <div>
          <div class="chip-title">Liquidación lista</div>
          <div class="chip-sub">14 colaboradores</div>
        </div>
      </div>

      <!-- Testimonial -->
      <div class="testimonial">
        <svg width="20" height="16" viewBox="0 0 20 16" fill="none" style="margin-bottom:8px;display:block">
          <path d="M0 16V10C0 4.5 3 1 8 0v3C5 4 4 6 4 9h4v7H0zM12 16V10c0-5.5 3-9 8-10v3c-3 1-4 3-4 6h4v7h-8z" fill="#0DCFA8"/>
        </svg>
        <p class="testimonial-text">
          Pasamos de planillas en Excel a tener todo el equipo
          de producción en un solo lugar. Cero pelusa.
        </p>
        <div class="testimonial-author">
          <div class="testimonial-avatar">VC</div>
          <div>
            <div class="testimonial-name">Valentina Cofré</div>
            <div class="testimonial-role">Productora · Estudio Beyond</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── MOBILE: illustration band (visible solo en móvil) ──────── -->
    <div class="mobile-illus">
      <svg viewBox="0 0 402 260" preserveAspectRatio="xMidYMid slice" style="width:100%;height:100%;display:block">
        <defs>
          <linearGradient id="m1bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#F2EBDB"/>
            <stop offset="1" stop-color="#E8DFC9"/>
          </linearGradient>
          <pattern id="m1grid" width="16" height="16" patternUnits="userSpaceOnUse">
            <path d="M16 0H0V16" fill="none" stroke="#062D3A" stroke-opacity="0.05" stroke-width="0.5"/>
          </pattern>
        </defs>
        <rect width="402" height="260" fill="url(#m1bg)"/>
        <rect width="402" height="260" fill="url(#m1grid)"/>
        <!-- Desk -->
        <rect x="0" y="205" width="402" height="5" fill="#062D3A"/>
        <rect x="0" y="210" width="402" height="50" fill="#0B3744"/>
        <!-- Laptop -->
        <g transform="translate(120 70)">
          <path d="M-14 130 L176 130 L186 140 L-24 140 Z" fill="#041B22"/>
          <path d="M-14 130 L176 130 L184 138 L-22 138 Z" fill="#062D3A"/>
          <rect x="-2" y="126" width="166" height="4" fill="#041B22"/>
          <rect x="0" y="0" width="162" height="126" rx="6" fill="#062D3A"/>
          <rect x="6" y="6" width="150" height="114" rx="3" fill="#F5F0E6"/>
          <rect x="6" y="6" width="150" height="16" fill="#062D3A"/>
          <circle cx="15" cy="14" r="4" fill="#0DCFA8" opacity="0.9"/>
          <rect x="26" y="11" width="42" height="5" rx="1" fill="#fff" opacity="0.55"/>
          <circle cx="148" cy="14" r="1.6" fill="#0DCFA8"/>
          <g font-family="Space Grotesk" font-size="6" fill="#062D3A" opacity="0.55" text-anchor="middle">
            <text x="18" y="32">L</text><text x="46" y="32">M</text><text x="74" y="32">M</text><text x="102" y="32">J</text><text x="130" y="32">V</text>
          </g>
          <g transform="translate(10 36)">
            <rect x="0" y="0" width="24" height="11" rx="2" fill="#0DCFA8"/>
            <rect x="28" y="0" width="24" height="11" rx="2" fill="#062D3A" opacity="0.1"/>
            <rect x="56" y="0" width="24" height="11" rx="2" fill="#E07856"/>
            <rect x="84" y="0" width="24" height="11" rx="2" fill="#062D3A" opacity="0.1"/>
            <rect x="112" y="0" width="24" height="11" rx="2" fill="#0DCFA8"/>
            <rect x="0" y="15" width="24" height="11" rx="2" fill="#062D3A" opacity="0.1"/>
            <rect x="28" y="15" width="24" height="11" rx="2" fill="#E07856"/>
            <rect x="56" y="15" width="24" height="11" rx="2" fill="#0DCFA8"/>
            <rect x="84" y="15" width="24" height="11" rx="2" fill="#062D3A" opacity="0.1"/>
            <rect x="112" y="15" width="24" height="11" rx="2" fill="#E07856"/>
            <rect x="0" y="30" width="24" height="11" rx="2" fill="#E07856"/>
            <rect x="28" y="30" width="24" height="11" rx="2" fill="#0DCFA8"/>
            <rect x="56" y="30" width="24" height="11" rx="2" fill="#062D3A" opacity="0.1"/>
            <rect x="84" y="30" width="24" height="11" rx="2" fill="#E07856"/>
            <rect x="112" y="30" width="24" height="11" rx="2" fill="#0DCFA8"/>
            <rect x="0" y="45" width="24" height="11" rx="2" fill="#0DCFA8"/>
            <rect x="28" y="45" width="24" height="11" rx="2" fill="#062D3A" opacity="0.1"/>
            <rect x="56" y="45" width="24" height="11" rx="2" fill="#E07856"/>
            <rect x="84" y="45" width="24" height="11" rx="2" fill="#0DCFA8"/>
            <rect x="112" y="45" width="24" height="11" rx="2" fill="#062D3A" opacity="0.1"/>
            <rect x="0" y="60" width="24" height="11" rx="2" fill="#062D3A" opacity="0.1"/>
            <rect x="28" y="60" width="24" height="11" rx="2" fill="#E07856"/>
            <rect x="56" y="60" width="24" height="11" rx="2" fill="#0DCFA8"/>
            <rect x="84" y="60" width="24" height="11" rx="2" fill="#062D3A" opacity="0.1"/>
            <rect x="112" y="60" width="24" height="11" rx="2" fill="#E07856"/>
          </g>
        </g>
        <!-- Plant -->
        <g transform="translate(28 138)">
          <path d="M-3 50 L37 50 L33 84 L1 84 Z" fill="#E07856"/>
          <rect x="-3" y="46" width="40" height="6" rx="1.5" fill="#C95F38"/>
          <g fill="#0DCFA8">
            <ellipse cx="16" cy="14" rx="5" ry="18" transform="rotate(-12 16 14)"/>
            <ellipse cx="26" cy="22" rx="5" ry="16" transform="rotate(22 26 22)"/>
            <ellipse cx="6" cy="30" rx="5" ry="14" transform="rotate(-32 6 30)"/>
            <ellipse cx="20" cy="38" rx="5" ry="11" transform="rotate(5 20 38)"/>
          </g>
        </g>
        <!-- Coffee -->
        <g transform="translate(320 168)">
          <rect x="0" y="0" width="34" height="42" rx="3" fill="#062D3A"/>
          <rect x="3" y="3" width="28" height="5" rx="1" fill="#0DCFA8"/>
          <path d="M34 10 Q46 12 46 22 Q46 32 34 32" stroke="#062D3A" stroke-width="3" fill="none"/>
          <g stroke="#062D3A" stroke-width="1.6" fill="none" opacity="0.35" stroke-linecap="round">
            <path d="M10 -6 Q6 -12 12 -18 Q18 -24 14 -30"/>
            <path d="M20 -6 Q16 -12 22 -18 Q28 -24 24 -30"/>
          </g>
        </g>
        <!-- Lamp -->
        <line x1="360" y1="0" x2="360" y2="50" stroke="#062D3A" stroke-width="2.5"/>
        <line x1="360" y1="50" x2="330" y2="66" stroke="#062D3A" stroke-width="2.5"/>
        <path d="M315 58 L342 50 L336 76 L322 76 Z" fill="#0DCFA8" stroke="#062D3A" stroke-width="2" stroke-linejoin="round"/>
        <!-- Clock -->
        <g transform="translate(54 50)">
          <circle r="15" fill="#fff" stroke="#062D3A" stroke-width="1.5"/>
          <line y2="-9" stroke="#062D3A" stroke-width="2" stroke-linecap="round"/>
          <line x2="7" y2="3" stroke="#0DCFA8" stroke-width="2" stroke-linecap="round"/>
          <circle r="1.5" fill="#062D3A"/>
        </g>
        <!-- Sticky note -->
        <g transform="translate(40 92) rotate(-6)">
          <rect width="44" height="40" fill="#FFEC8E" stroke="#062D3A" stroke-width="0.8"/>
          <line x1="5" y1="11" x2="38" y2="11" stroke="#062D3A" stroke-width="0.6" opacity="0.5"/>
          <line x1="5" y1="18" x2="30" y2="18" stroke="#062D3A" stroke-width="0.6" opacity="0.5"/>
          <line x1="5" y1="25" x2="34" y2="25" stroke="#062D3A" stroke-width="0.6" opacity="0.5"/>
          <path d="M5 33 L9 37 L17 29" stroke="#0DCFA8" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </g>
      </svg>
    </div>

  </div>
</template>

<script setup>
definePageMeta({ layout: false, middleware: 'no-auth' })

const router = useRouter()
const route  = useRoute()

const form   = reactive({ email: '', password: '', remember: false })
const errors = reactive({ email: '', password: '', global: '' })
const loading  = ref(false)
const showPass = ref(false)

const { useAuthStore } = await import('@/stores/auth')
const authStore = useAuthStore()

onMounted(async () => {
  await authStore.init()
  if (authStore.isAuthenticated) {
    router.replace(route.query.redirect || '/rrhh/trabajadores')
  }
})

async function handleLogin() {
  errors.email   = ''
  errors.password = ''
  errors.global  = ''

  if (!form.email.trim())    { errors.email    = 'Ingresa tu correo'; return }
  if (!form.password.trim()) { errors.password = 'Ingresa tu contraseña'; return }

  loading.value = true
  try {
    const result = await authStore.login(form.email.trim().toLowerCase(), form.password, form.remember)
    if (result.ok) {
      router.replace(route.query.redirect || '/rrhh/trabajadores')
    } else {
      errors.global = result.message || 'Credenciales incorrectas'
    }
  } catch {
    errors.global = 'Error inesperado. Intenta de nuevo.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
* { box-sizing: border-box; margin: 0; padding: 0; }

/* ── Root: split layout desktop, column en móvil ───────────────── */
.login-root {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr;
  font-family: 'Inter Tight', 'Nunito', system-ui, sans-serif;
  background: #062D3A;
  overflow: hidden;
}

/* ── Form panel ─────────────────────────────────────────────────── */
.form-panel {
  background: linear-gradient(180deg, #062D3A 0%, #0A3845 100%);
  display: flex;
  align-items: center;
  padding: 64px 80px;
  color: #F5F0E6;
  position: relative;
  z-index: 2;
}

.form-inner {
  width: 100%;
  max-width: 440px;
}

/* Brand */
.brand-row { margin-bottom: 52px; }
.brand-logo { height: 34px; width: auto; display: block; }

/* Kicker */
.kicker {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #0DCFA8;
  margin-bottom: 14px;
}

/* Headline */
.headline {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 40px;
  line-height: 1.05;
  letter-spacing: -0.025em;
  font-weight: 600;
  color: #F5F0E6;
  margin: 0 0 14px;
}
.headline-accent {
  font-style: italic;
  font-weight: 400;
  color: #0DCFA8;
}

/* Lede */
.lede {
  font-size: 14px;
  line-height: 1.6;
  color: rgba(245,240,230,0.65);
  margin: 0 0 32px;
  max-width: 380px;
}

/* Form */
.form { display: flex; flex-direction: column; gap: 14px; }

.field { display: flex; flex-direction: column; gap: 6px; }
.field-label {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(245,240,230,0.5);
}
.field input {
  width: 100%;
  height: 50px;
  padding: 0 16px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(245,240,230,0.12);
  border-radius: 10px;
  color: #F5F0E6;
  font-size: 15px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s;
}
.field input:focus { border-color: rgba(13,207,168,0.5); }
.field--error input { border-color: rgba(248,113,113,0.5); }
.error-msg { font-size: 11px; color: #f87171; }

.input-wrap { position: relative; }
.input-wrap input { padding-right: 68px; }
.eye-btn {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  height: 32px;
  padding: 0 10px;
  background: rgba(13,207,168,0.12);
  color: #0DCFA8;
  border: none;
  border-radius: 6px;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.15s;
}
.eye-btn:hover { background: rgba(13,207,168,0.2); }

/* Options row */
.options-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 2px 0 6px;
}
.check-label {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: rgba(245,240,230,0.7);
  cursor: pointer;
  user-select: none;
}
.checkbox {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 1.5px solid rgba(245,240,230,0.2);
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s, border-color 0.15s;
  cursor: pointer;
}
.checkbox--checked {
  background: #0DCFA8;
  border-color: #0DCFA8;
}

/* Alert */
.alert-error {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(239,68,68,0.08);
  border: 1px solid rgba(239,68,68,0.25);
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 13px;
  color: #fca5a5;
}

/* Primary button */
.primary-btn {
  height: 54px;
  background: #0DCFA8;
  color: #062D3A;
  border: none;
  border-radius: 10px;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.01em;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px rgba(13,207,168,0.25);
  transition: background 0.2s, transform 0.1s;
}
.primary-btn:hover:not(:disabled) { background: #0bbfa0; }
.primary-btn:active:not(:disabled) { transform: scale(0.98); }
.primary-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-spinner {
  width: 18px; height: 18px;
  border: 2px solid rgba(6,45,58,0.3);
  border-top-color: #062D3A;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Footer */
.footer {
  margin-top: 36px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: rgba(245,240,230,0.35);
  flex-wrap: wrap;
}
.footer-dot { opacity: 0.5; }
.footer-status {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
}
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #0DCFA8;
  box-shadow: 0 0 0 3px rgba(13,207,168,0.2);
}

/* ── Illustration panel ─────────────────────────────────────────── */
.illus-panel {
  background: #F0EAE0;
  position: relative;
  overflow: hidden;
}
.illus-svg {
  width: 100%;
  height: 100%;
  display: block;
}

/* Chips */
.chip {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px 10px 10px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(6,45,58,0.12);
  border: 1px solid rgba(6,45,58,0.06);
}
.chip--top-right { top: 72px; right: 72px; }
.chip--bottom-left { bottom: 120px; left: 48px; }
.chip-icon {
  width: 32px; height: 32px;
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.chip-icon--teal { background: #CFF7EB; }
.chip-icon--coral { background: #FFE2D4; }
.chip-title {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 13px;
  font-weight: 600;
  color: #062D3A;
  white-space: nowrap;
}
.chip-sub { font-size: 11px; color: rgba(6,45,58,0.55); margin-top: 1px; }

/* Testimonial */
.testimonial {
  position: absolute;
  bottom: 44px;
  right: 48px;
  width: 280px;
  padding: 20px 22px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 16px 40px rgba(6,45,58,0.12);
  border: 1px solid rgba(6,45,58,0.05);
}
.testimonial-text {
  font-size: 13px;
  line-height: 1.55;
  color: #062D3A;
  margin: 0 0 14px;
  font-style: italic;
}
.testimonial-author { display: flex; align-items: center; gap: 10px; }
.testimonial-avatar {
  width: 32px; height: 32px;
  border-radius: 50%;
  background: #0DCFA8;
  color: #062D3A;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  font-size: 11px;
  flex-shrink: 0;
}
.testimonial-name {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 12px;
  font-weight: 600;
  color: #062D3A;
}
.testimonial-role { font-size: 10px; color: rgba(6,45,58,0.55); margin-top: 1px; }

/* ── Mobile illustration band (hidden on desktop) ──────────────── */
.mobile-illus {
  display: none;
  height: 240px;
  overflow: hidden;
  flex-shrink: 0;
}

/* ── Responsive ─────────────────────────────────────────────────── */
@media (max-width: 900px) {
  .login-root {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }

  /* Mostrar band ilustración arriba */
  .mobile-illus {
    display: block;
    grid-row: 1;
    grid-column: 1;
    order: -1;
  }

  /* Ocultar panel derecho de escritorio */
  .illus-panel { display: none; }

  /* Form panel ocupa toda la pantalla restante */
  .form-panel {
    grid-row: 2;
    grid-column: 1;
    padding: 24px 28px 48px;
    align-items: flex-start;
    min-height: 0;
  }

  .form-inner { max-width: 100%; }
  .brand-row { margin-bottom: 20px; }
  .brand-logo { height: 22px; }
  .headline { font-size: 26px; }
  .kicker { font-size: 10px; margin-bottom: 10px; }
  .lede { font-size: 13px; margin-bottom: 20px; display: none; }
  .footer { margin-top: 24px; }
  .primary-btn { height: 48px; font-size: 14px; }
  .field input { height: 44px; font-size: 14px; }
}

@media (max-width: 480px) {
  .form-panel { padding: 20px 22px 40px; }
  .headline { font-size: 22px; }
}
</style>
