// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: false },

  // Client-only a propósito: la sesión vive en localStorage (middleware/auth.js
  // solo corre en el cliente), así que con SSR el servidor renderizaba la
  // pantalla protegida completa y recién en la hidratación el middleware
  // redirigía a /login — un flash del contenido interno antes del login,
  // más visible en mobile por la hidratación más lenta. Mismo motivo que
  // Calendar y Relations, que ya corren client-only.
  ssr: false,

  runtimeConfig: {
    // Variables privadas (solo servidor)
    mongodbUri: process.env.MONGODB_URI || '',
    mongodbDb:  process.env.MONGODB_DB  || 'rrhh',
    jwtSecret:  process.env.NUXT_JWT_SECRET || 'dev-secret',
    public: {
      appVersion:     '1.1',
      // Google Sign-In: client ID público (sin secret, expuesto al frontend
      // según el flujo de Google Identity Services).
      googleClientId: process.env.GOOGLE_CLIENT_ID || '',
      // Intercom: el app_id es público (viaja al cliente). Configurable por
      // env para no hardcodearlo; con fallback al workspace actual.
      intercomAppId:  process.env.INTERCOM_APP_ID || 'a1lqqu05',
      // Candado de emergencia: bloquea TODA la app (incluso con sesión activa) y
      // muestra /mantenimiento (middleware/maintenance.global.js). Estuvo
      // ENCENDIDO por defecto mientras se migraba la base de datos a
      // producción (completado); ahora default APAGADO — se prende seteando
      // MAINTENANCE_MODE=true en el hosting si hace falta otra ventana de
      // mantenimiento más adelante. Mismo mecanismo que Calendar y Relations.
      maintenanceMode: process.env.MAINTENANCE_MODE === 'true',
    },
  },

  app: {
    head: {
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
      link: [
        { rel: 'stylesheet', href: '/css/styles.css' },
        { rel: 'stylesheet', href: '/css/styleguide.css' },
        { rel: 'stylesheet', href: '/css/colors.css' },
        { rel: 'stylesheet', href: '/css/icons.css' },
        { rel: 'stylesheet', href: '/css/responsive.css' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css?family=Nunito:400,500,600,700,800' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&display=swap' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter+Tight:wght@300;400;500;600;700&display=swap' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Permanent+Marker&display=swap' },
      ],
    },
  },

  components: [
    { path: '~/components/rrhh' },
  ],

  devServer: {
    port: Number(process.env.PORT) || 3005,
  },

  nitro: {
    // Para producción en Railway (Node standalone)
    preset: 'node-server',
  },

  modules: ['@pinia/nuxt'],

  plugins: ['~/plugins/translate.js'],

  compatibilityDate: '2026-05-05',

  future: {},
});
