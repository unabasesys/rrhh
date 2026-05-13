// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: false },

  runtimeConfig: {
    public: {},
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
    port: 3005,
  },

  modules: ['@pinia/nuxt'],

  plugins: ['~/plugins/translate.js'],

  compatibilityDate: '2026-05-05',

  future: {},
});
