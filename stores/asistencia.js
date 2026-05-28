/**
 * stores/asistencia.js
 * ─────────────────────────────────────────────────────────────────
 * Store Pinia para el módulo de Asistencia RRHH.
 * Persistencia: localStorage (temporal → MongoDB)
 * ─────────────────────────────────────────────────────────────────
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  useRrhhStorage,
  STORAGE_KEYS,
  genId,
  seedTurnos,
  seedProyectos,
  seedTokens,
  seedMarcaciones,
} from '@/composables/useRrhhStorage'

// ─── Helpers de tiempo ────────────────────────────────────────────────────────
export function horaToMin(hhmm) {
  if (!hhmm) return 0
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function minToHora(min) {
  const h = Math.floor(min / 60)
  const m = Math.abs(min % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function diffHoras(entrada, salida) {
  if (!entrada || !salida) return 0
  const diff = horaToMin(salida) - horaToMin(entrada)
  return Math.round((diff / 60) * 100) / 100
}

export function fechaHoy() {
  return new Date().toISOString().split('T')[0]
}

export function horaAhora() {
  const now = new Date()
  return `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
}

// ─── Días de la semana ────────────────────────────────────────────────────────
export const DIAS_SEMANA = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
]

export const TIPOS_TURNO = [
  { value: 'completa',  label: 'Jornada Completa (40 hrs)' },
  { value: 'part_time', label: 'Part Time (20 hrs)' },
  { value: 'especial',  label: 'Turno Especial (Rodaje)' },
  { value: 'flexible',  label: 'Horario Flexible' },
]

// ─── Store ────────────────────────────────────────────────────────────────────
export const useAsistenciaStore = defineStore('asistencia', () => {

  // Lee el orgId actual desde la sesión persistida (sin acoplar al rrhh store)
  function getOrgId() {
    if (typeof window === 'undefined') return null
    try {
      const raw = localStorage.getItem('rrhh_session')
      if (!raw) return null
      const ses = JSON.parse(raw)
      return ses?.currentOrgId || null
    } catch { return null }
  }

  // ── Colecciones reactivas ─────────────────────────────────────────────────
  const turnos      = ref([])
  const marcaciones = ref([])
  const proyectos   = ref([])
  const tokens      = ref([])

  // ── Storage instances ─────────────────────────────────────────────────────
  const turnosSt      = useRrhhStorage(STORAGE_KEYS.turnos)
  const marcacionesSt = useRrhhStorage(STORAGE_KEYS.marcaciones)
  const proyectosSt   = useRrhhStorage(STORAGE_KEYS.proyectos)
  const tokensSt      = useRrhhStorage(STORAGE_KEYS.tokens)

  // ── Helper para llamadas autenticadas al backend ──────────────────────────
  function getAuthToken() {
    if (typeof window === 'undefined') return null
    try {
      return JSON.parse(localStorage.getItem('rrhh_session') || '{}')?.token || null
    } catch { return null }
  }
  function authHeaders() {
    const t = getAuthToken()
    return t ? { Authorization: `Bearer ${t}` } : {}
  }

  // ── Inicializar: trae turnos+marcaciones+proyectos desde el backend; tokens
  //    quedan en localStorage por ahora (su migración va con el portal).
  async function init() {
    seedTokens()
    tokens.value = tokensSt.getAll()
    await Promise.all([fetchTurnos(), fetchMarcaciones(), fetchProyectos()])
  }

  function reload() {
    return Promise.all([fetchTurnos(), fetchMarcaciones(), fetchProyectos()])
  }

  async function fetchProyectos() {
    const oid = getOrgId()
    try {
      const url = oid ? `/api/rrhh/proyectos?orgId=${oid}` : '/api/rrhh/proyectos'
      const data = await $fetch(url, { headers: authHeaders() })
      // Normaliza: el backend usa _id, el código viejo usa id
      proyectos.value = (data || []).map(p => ({
        ...p,
        id: p._id || p.id,
        // Las líneas también pueden venir con _id
        lineas: (p.lineas || []).map(l => ({ ...l, id: l._id || l.id })),
      }))
    } catch (e) {
      proyectos.value = proyectosSt.getAll()
    }
  }

  // ══════════════════════════════════════════════════════════════════
  //  TURNOS — backend (MongoDB)
  // ══════════════════════════════════════════════════════════════════

  async function fetchTurnos() {
    const oid = getOrgId()
    try {
      const url = oid ? `/api/rrhh/turnos?orgId=${oid}` : '/api/rrhh/turnos'
      const data = await $fetch(url, { headers: authHeaders() })
      // Normaliza: el backend devuelve _id, el código viejo usa id
      turnos.value = (data || []).map(t => ({ ...t, id: t._id || t.id }))
    } catch (e) {
      // Fallback resiliente al localStorage si el backend no está disponible
      turnos.value = turnosSt.getAll()
    }
  }

  async function saveTurno(turno) {
    const oid = getOrgId()
    const isUpdate = !!(turno._id || (turno.id && turnos.value.some(t => (t._id || t.id) === turno.id)))
    try {
      let saved
      if (isUpdate) {
        const id = turno._id || turno.id
        saved = await $fetch(`/api/rrhh/turnos/${id}`, {
          method: 'PUT',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: turno,
        })
      } else {
        saved = await $fetch('/api/rrhh/turnos', {
          method: 'POST',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: { ...turno, orgId: turno.orgId || oid },
        })
      }
      await fetchTurnos()
      return saved
    } catch (e) {
      // Fallback localStorage si backend falla
      const withOrg = { ...turno, orgId: turno.orgId ?? oid }
      turnosSt.save(withOrg)
      turnos.value = turnosSt.getAll()
      throw e
    }
  }

  async function deleteTurno(id) {
    try {
      await $fetch(`/api/rrhh/turnos/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      await fetchTurnos()
    } catch (e) {
      turnosSt.remove(id)
      turnos.value = turnosSt.getAll()
      throw e
    }
  }

  function getTurno(id) {
    return turnos.value.find(t => (t._id || t.id) === id) || null
  }

  // ══════════════════════════════════════════════════════════════════
  //  MARCACIONES — backend (MongoDB)
  // ══════════════════════════════════════════════════════════════════

  async function fetchMarcaciones({ trabajador_id, fecha_desde, fecha_hasta } = {}) {
    const oid = getOrgId()
    const params = new URLSearchParams()
    if (oid)           params.set('orgId', oid)
    if (trabajador_id) params.set('trabajador_id', trabajador_id)
    if (fecha_desde)   params.set('fecha_desde', fecha_desde)
    if (fecha_hasta)   params.set('fecha_hasta', fecha_hasta)
    try {
      const data = await $fetch('/api/rrhh/marcaciones?' + params.toString(), { headers: authHeaders() })
      // Normaliza: id legible para código viejo
      marcaciones.value = (data || []).map(m => ({ ...m, id: m._id || m.id }))
    } catch (e) {
      marcaciones.value = marcacionesSt.getAll()
    }
  }

  // ══════════════════════════════════════════════════════════════════
  //  PROYECTOS + LÍNEAS PRESUPUESTALES
  // ══════════════════════════════════════════════════════════════════

  function saveProyecto(proyecto) {
    proyectosSt.save(proyecto)
    proyectos.value = proyectosSt.getAll()
  }

  function deleteProyecto(id) {
    proyectosSt.remove(id)
    proyectos.value = proyectosSt.getAll()
  }

  function getProyecto(id) {
    if (!id) return null
    return proyectos.value.find(p => (p._id || p.id) === id) || null
  }

  function getLinea(proyectoId, lineaId) {
    const p = getProyecto(proyectoId)
    if (!p || !lineaId) return null
    return p.lineas?.find(l => (l._id || l.id) === lineaId) || null
  }

  // Todas las líneas flattened con referencia al proyecto
  const todasLineas = computed(() => {
    return proyectos.value.flatMap(p =>
      (p.lineas || []).map(l => ({
        ...l,
        proyecto_id: p.id,
        proyecto_nombre: p.nombre,
        proyecto_codigo: p.codigo,
        proyecto_color: p.color,
        display: `${p.nombre} / ${l.nombre} [${l.codigo}]`,
      }))
    )
  })

  // ══════════════════════════════════════════════════════════════════
  //  PORTAL TOKENS
  // ══════════════════════════════════════════════════════════════════

  function getTokenByTrabajador(trabajadorId) {
    return tokens.value.find(t => t.trabajador_id === trabajadorId && t.activo) || null
  }

  function getTokenByValue(tokenStr) {
    return tokens.value.find(t => t.token === tokenStr && t.activo) || null
  }

  function generarToken(trabajadorId) {
    // Desactivar token anterior
    const existing = getTokenByTrabajador(trabajadorId)
    if (existing) {
      tokensSt.save({ ...existing, activo: false })
    }

    const newToken = {
      id: genId('token'),
      token: `${trabajadorId}_${Math.random().toString(36).slice(2, 14)}`,
      trabajador_id: trabajadorId,
      activo: true,
    }
    tokensSt.save(newToken)
    tokens.value = tokensSt.getAll()
    return newToken.token
  }

  function getPortalUrl(trabajadorId) {
    const tok = getTokenByTrabajador(trabajadorId)
    if (!tok) return null
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
    return `${base}/portal/trabajador/${tok.token}`
  }

  // ══════════════════════════════════════════════════════════════════
  //  MARCACIONES
  // ══════════════════════════════════════════════════════════════════

  /**
   * Registrar entrada desde el portal del trabajador.
   */
  async function marcarEntrada({ trabajador_id, turno_id, proyecto_id, linea_id, ubicacion = null }) {
    const hoy = fechaHoy()
    const hora = horaAhora()

    // Asegura que marcaciones esté sincronizada con backend para detectar duplicados
    await fetchMarcaciones({ trabajador_id, fecha_desde: hoy, fecha_hasta: hoy })
    const existente = marcaciones.value.find(
      m => m.trabajador_id === trabajador_id && m.fecha === hoy
    )
    if (existente && existente.entrada) {
      return { ok: false, error: 'Ya registraste tu entrada hoy', marcacion: existente }
    }

    const turno = getTurno(turno_id)
    const atraso = turno
      ? Math.max(0, horaToMin(hora) - horaToMin(turno.hora_entrada) - (turno.tolerancia_atraso_min || 0))
      : 0

    const payload = {
      trabajador_id,
      turno_id,
      proyecto_id,
      linea_id,
      fecha: hoy,
      entrada: hora,
      salida: null,
      horas_trabajadas: 0,
      horas_extra: 0,
      atraso_minutos: atraso,
      tipo: atraso > 0 ? 'tardanza' : 'normal',
      estado: 'pendiente',
      observaciones: '',
      modificado_por_supervisor: false,
      ubicacion,
      orgId: getOrgId(),
    }
    try {
      const saved = await $fetch('/api/rrhh/marcaciones', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: payload,
      })
      await fetchMarcaciones()
      return { ok: true, marcacion: { ...saved, id: saved._id } }
    } catch (e) {
      return { ok: false, error: e?.data?.message || e?.message || 'Error al marcar entrada' }
    }
  }

  /**
   * Registrar salida desde el portal del trabajador.
   */
  async function marcarSalida({ trabajador_id, ubicacion = null }) {
    const hoy = fechaHoy()
    const hora = horaAhora()

    await fetchMarcaciones({ trabajador_id, fecha_desde: hoy, fecha_hasta: hoy })
    const existente = marcaciones.value.find(
      m => m.trabajador_id === trabajador_id && m.fecha === hoy && m.entrada
    )
    if (!existente) {
      return { ok: false, error: 'No encontramos tu marcación de entrada de hoy' }
    }
    if (existente.salida) {
      return { ok: false, error: 'Ya registraste tu salida hoy', marcacion: existente }
    }

    const turno = getTurno(existente.turno_id)
    const horas = diffHoras(existente.entrada, hora)
    const colacion = turno ? (turno.colacion_min || 0) / 60 : 1
    const horasEfectivas = Math.max(0, horas - colacion)
    const horasContrato = turno ? turno.horas_diarias : 8
    const horasExtra = Math.max(0, horasEfectivas - horasContrato)

    const id = existente._id || existente.id
    const cambios = {
      salida: hora,
      horas_trabajadas: Math.round(horasEfectivas * 100) / 100,
      horas_extra: Math.round(horasExtra * 100) / 100,
      tipo: horasExtra > 0 ? 'extra' : existente.tipo,
      ubicacion_salida: ubicacion,
    }
    try {
      const saved = await $fetch(`/api/rrhh/marcaciones/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: cambios,
      })
      await fetchMarcaciones()
      return { ok: true, marcacion: { ...saved, id: saved._id } }
    } catch (e) {
      return { ok: false, error: e?.data?.message || e?.message || 'Error al marcar salida' }
    }
  }

  /**
   * Corrección manual del supervisor.
   */
  async function corregirMarcacion(id, cambios) {
    const marc = marcaciones.value.find(m => (m._id || m.id) === id)
    if (!marc) return

    // Recalcular horas si cambian entrada/salida
    let extra = {}
    if (cambios.entrada || cambios.salida) {
      const entrada = cambios.entrada || marc.entrada
      const salida  = cambios.salida  || marc.salida
      if (entrada && salida) {
        const turno = getTurno(marc.turno_id)
        const horas = diffHoras(entrada, salida)
        const colacion = turno ? (turno.colacion_min || 0) / 60 : 1
        const horasEfectivas = Math.max(0, horas - colacion)
        const horasContrato  = turno ? turno.horas_diarias : 8
        extra = {
          horas_trabajadas: Math.round(horasEfectivas * 100) / 100,
          horas_extra: Math.max(0, Math.round((horasEfectivas - horasContrato) * 100) / 100),
        }
      }
    }
    try {
      await $fetch(`/api/rrhh/marcaciones/${marc._id || marc.id}`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: { ...cambios, ...extra, modificado_por_supervisor: true },
      })
      await fetchMarcaciones()
    } catch (e) {
      console.error('Error corrigiendo marcación:', e)
      throw e
    }
  }

  async function aprobarMarcacion(id) {
    const marc = marcaciones.value.find(m => (m._id || m.id) === id)
    if (!marc) return
    try {
      await $fetch(`/api/rrhh/marcaciones/${marc._id || marc.id}`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: { estado: 'aprobado' },
      })
      await fetchMarcaciones()
    } catch (e) { console.error(e) }
  }

  async function rechazarMarcacion(id, motivo = '') {
    const marc = marcaciones.value.find(m => (m._id || m.id) === id)
    if (!marc) return
    try {
      await $fetch(`/api/rrhh/marcaciones/${marc._id || marc.id}`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: { estado: 'rechazado', observaciones: motivo },
      })
      await fetchMarcaciones()
    } catch (e) { console.error(e) }
  }

  async function deleteMarcacion(id) {
    const marc = marcaciones.value.find(m => (m._id || m.id) === id)
    const realId = marc?._id || marc?.id || id
    try {
      await $fetch(`/api/rrhh/marcaciones/${realId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      await fetchMarcaciones()
    } catch (e) { console.error(e) }
  }

  // ══════════════════════════════════════════════════════════════════
  //  COMPUTEDS / REPORTES
  // ══════════════════════════════════════════════════════════════════

  /**
   * Marcaciones del día de hoy.
   */
  const marcacionesHoy = computed(() => {
    const hoy = fechaHoy()
    return marcaciones.value.filter(m => m.fecha === hoy)
  })

  /**
   * Marcaciones por rango de fechas.
   */
  function getMarcacionesPorRango(desde, hasta, trabajadorId = null) {
    return marcaciones.value.filter(m => {
      if (m.fecha < desde || m.fecha > hasta) return false
      if (trabajadorId && m.trabajador_id !== trabajadorId) return false
      return true
    })
  }

  /**
   * Resumen de asistencia de un trabajador en un rango.
   */
  function getResumenTrabajador(trabajadorId, desde, hasta) {
    const recs = getMarcacionesPorRango(desde, hasta, trabajadorId)
    const diasTrabajados  = recs.filter(m => m.entrada).length
    const diasAusente     = recs.filter(m => !m.entrada).length
    const diasAtraso      = recs.filter(m => m.atraso_minutos > 0).length
    const totalHoras      = recs.reduce((s, m) => s + (m.horas_trabajadas || 0), 0)
    const totalHorasExtra = recs.reduce((s, m) => s + (m.horas_extra || 0), 0)
    const totalAtrasoMin  = recs.reduce((s, m) => s + (m.atraso_minutos || 0), 0)

    return {
      trabajador_id: trabajadorId,
      desde, hasta,
      diasTrabajados,
      diasAusente,
      diasAtraso,
      totalHoras: Math.round(totalHoras * 100) / 100,
      totalHorasExtra: Math.round(totalHorasExtra * 100) / 100,
      totalAtrasoMin,
      marcaciones: recs,
    }
  }

  /**
   * Resumen por proyecto: horas imputadas por línea presupuestal.
   */
  function getResumenProyecto(proyectoId, desde, hasta) {
    const recs = marcaciones.value.filter(m => {
      if (m.proyecto_id !== proyectoId) return false
      if (m.fecha < desde || m.fecha > hasta) return false
      return true
    })

    const porLinea = {}
    for (const m of recs) {
      const k = m.linea_id || 'sin_linea'
      if (!porLinea[k]) porLinea[k] = { linea_id: k, horas: 0, trabajadores: new Set() }
      porLinea[k].horas += m.horas_trabajadas || 0
      porLinea[k].trabajadores.add(m.trabajador_id)
    }

    return {
      proyecto_id: proyectoId,
      desde, hasta,
      total_horas: recs.reduce((s, m) => s + (m.horas_trabajadas || 0), 0),
      lineas: Object.values(porLinea).map(l => ({
        ...l,
        horas: Math.round(l.horas * 100) / 100,
        trabajadores: [...l.trabajadores],
      })),
    }
  }

  // ══════════════════════════════════════════════════════════════════
  //  Estado del portal de un trabajador hoy
  // ══════════════════════════════════════════════════════════════════
  function getEstadoHoy(trabajadorId) {
    const hoy = fechaHoy()
    const marc = marcaciones.value.find(
      m => m.trabajador_id === trabajadorId && m.fecha === hoy
    )
    if (!marc || !marc.entrada) return 'sin_marcar'
    if (marc.entrada && !marc.salida) return 'dentro'
    if (marc.entrada && marc.salida) return 'fuera'
    return 'sin_marcar'
  }

  return {
    // State
    turnos,
    marcaciones,
    proyectos,
    tokens,
    // Init
    init,
    reload,
    // Turnos
    saveTurno,
    deleteTurno,
    getTurno,
    // Proyectos
    saveProyecto,
    deleteProyecto,
    getProyecto,
    getLinea,
    todasLineas,
    // Tokens / Portal
    getTokenByTrabajador,
    getTokenByValue,
    generarToken,
    getPortalUrl,
    // Marcaciones
    marcarEntrada,
    marcarSalida,
    corregirMarcacion,
    aprobarMarcacion,
    rechazarMarcacion,
    deleteMarcacion,
    // Computeds / Reports
    marcacionesHoy,
    getMarcacionesPorRango,
    getResumenTrabajador,
    getResumenProyecto,
    getEstadoHoy,
    // Helpers expuestos
    fechaHoy,
    horaAhora,
    diffHoras,
  }
})
