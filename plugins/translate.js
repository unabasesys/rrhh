// plugins/translate.js — stub standalone sin i18n
// Al integrar con Unabase OS se conectará al sistema de traducciones central
export default defineNuxtPlugin((nuxtApp) => {
  // Provee t() como función de traducción simple (español por defecto)
  const translations = {
    loading: 'Cargando',
    save: 'Guardar',
    cancel: 'Cancelar',
    delete: 'Eliminar',
    edit: 'Editar',
    create: 'Crear',
    search: 'Buscar',
  }

  const t = (key) => translations[key] || key

  nuxtApp.provide('t', t)
})
