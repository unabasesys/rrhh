// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: false },

  runtimeConfig: {
    // Variables privadas (solo servidor)
    mongodbUri: process.env.MONGODB_URI || '',
    mongodbDb:  process.env.MONGODB_DB  || 'rrhh',
    jwtSecret:  process.env.NUXT_JWT_SECRET || 'dev-secret',
    public: {
      appVersion: '1.1',
    },
  },

  app: {
    head: {
      link: [
        { rel: 'stylesheet', href: '/css/styles.css' },
        { rel: 'stylesheet', href: '/css/styleguide.css' },
        { rel: 'stylesheet', href: '/css/colors.css' },
        { rel: 'stylesheet', href: '/css/icons.css' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css?family=Nunito:400,500,600,700,800' },
      ],
    },
  },

  components: [
    { path: '~/components/rrhh' },
  ],

  devServer: {
    host: '0.0.0.0',
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
