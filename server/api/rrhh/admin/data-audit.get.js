/**
 * GET /api/rrhh/admin/data-audit?orgId=...
 *
 * Audita la base de datos buscando data sucia que afecta los reportes y
 * cálculos. NO elimina nada — solo devuelve un reporte estructurado.
 *
 * Útil antes de correr cleanup-data (DELETE) para que el usuario revise
 * qué se va a eliminar.
 *
 * Detecta:
 *   - Trabajadores duplicados (mismo nombre+apellido o mismo rut limpio)
 *   - Trabajadores sin orgId
 *   - Contratos duplicados (mismo trabajador + tipo + fecha_inicio + sueldo)
 *   - Contratos huérfanos (trabajador_id sin Trabajador)
 *   - Liquidaciones duplicadas (mismo trabajador + mes + año + sueldo)
 *   - Liquidaciones huérfanas (trabajador no existe o está inactivo)
 *   - Marcaciones huérfanas (trabajador no existe)
 *   - Turnos sin orgId
 *
 * Requiere rol admin.
 */
import { requireDb } from '../../../utils/db.js'
import { requireAuth } from '../../../utils/requireAuth.js'
import Trabajador   from '../../../models/Trabajador.js'
import Contrato     from '../../../models/Contrato.js'
import Liquidacion  from '../../../models/Liquidacion.js'
import Marcacion    from '../../../models/Marcacion.js'
import Turno        from '../../../models/Turno.js'

function cleanRut(rut) {
  return String(rut || '').replace(/[^0-9kK]/g, '').toUpperCase()
}
function fullName(t) {
  return `${(t.nombre || '').trim()} ${(t.apellido || '').trim()}`.replace(/\s+/g, ' ').trim().toLowerCase()
}

export default defineEventHandler(async (event) => {
  requireDb(event)
  await requireAuth(event, 'admin')
  const { orgId } = getQuery(event)
  const baseFilter = orgId ? { orgId } : {}

  const [trabs, contratos, liqs, marcs, turnos] = await Promise.all([
    Trabajador.find(baseFilter).lean(),
    Contrato.find(baseFilter).lean(),
    Liquidacion.find(baseFilter).lean(),
    Marcacion.find(baseFilter).lean(),
    Turno.find(baseFilter).lean(),
  ])

  const trabsById = new Map(trabs.map(t => [t._id, t]))
  const issues = {
    trabajadores_duplicados:   [],
    trabajadores_sin_org:      [],
    contratos_duplicados:      [],
    contratos_huerfanos:       [],
    liquidaciones_duplicadas:  [],
    liquidaciones_huerfanas:   [],
    liquidaciones_inactivas:   [],
    marcaciones_huerfanas:     [],
    turnos_sin_org:            [],
  }

  // ── Trabajadores duplicados (por rut o por nombre completo) ───────────────
  const porRut = new Map()
  const porNombre = new Map()
  for (const t of trabs) {
    if (!t.orgId) issues.trabajadores_sin_org.push({ id: t._id, nombre: `${t.nombre} ${t.apellido}` })
    const rut = cleanRut(t.rut)
    if (rut) {
      if (!porRut.has(rut)) porRut.set(rut, [])
      porRut.get(rut).push(t)
    }
    const nom = fullName(t)
    if (nom) {
      if (!porNombre.has(nom)) porNombre.set(nom, [])
      porNombre.get(nom).push(t)
    }
  }
  for (const [rut, list] of porRut) {
    if (list.length > 1) {
      issues.trabajadores_duplicados.push({
        criterio: 'rut',
        rut,
        cantidad: list.length,
        registros: list.map(t => ({ id: t._id, nombre: `${t.nombre} ${t.apellido}`, estado: t.estado, orgId: t.orgId })),
      })
    }
  }
  for (const [nom, list] of porNombre) {
    if (list.length > 1) {
      const ruts = new Set(list.map(t => cleanRut(t.rut)).filter(Boolean))
      // Solo cuenta como duplicado por nombre si los ruts son distintos (no recapturado arriba)
      if (ruts.size <= 1) continue
      issues.trabajadores_duplicados.push({
        criterio: 'nombre',
        nombre: nom,
        cantidad: list.length,
        registros: list.map(t => ({ id: t._id, rut: t.rut, estado: t.estado, orgId: t.orgId })),
      })
    }
  }

  // ── Contratos duplicados (mismo trabajador + tipo + fecha_inicio + sueldo) ─
  const cKey = new Map()
  for (const c of contratos) {
    if (!trabsById.has(c.trabajador_id)) {
      issues.contratos_huerfanos.push({ id: c._id, trabajador_id: c.trabajador_id, tipo: c.tipo_contrato, sueldo: c.sueldo_base })
      continue
    }
    const k = `${c.trabajador_id}|${c.tipo_contrato}|${c.fecha_inicio}|${c.sueldo_base}`
    if (!cKey.has(k)) cKey.set(k, [])
    cKey.get(k).push(c)
  }
  for (const [k, list] of cKey) {
    if (list.length > 1) {
      const t = trabsById.get(list[0].trabajador_id)
      issues.contratos_duplicados.push({
        trabajador: t ? `${t.nombre} ${t.apellido}` : '?',
        clave: k,
        cantidad: list.length,
        registros: list.map(c => ({ id: c._id, creado: c.creado, estado: c.estado })),
      })
    }
  }

  // ── Liquidaciones (duplicadas + huérfanas + inactivos) ────────────────────
  const lKey = new Map()
  for (const l of liqs) {
    const t = trabsById.get(l.trabajador_id)
    if (!t) {
      issues.liquidaciones_huerfanas.push({ id: l._id, trabajador_id: l.trabajador_id, mes: l.mes, anio: l.anio, sueldo: l.sueldo_base, liquido: l.liquido_a_pagar })
      continue
    }
    if (t.estado === 'inactivo') {
      issues.liquidaciones_inactivas.push({ id: l._id, trabajador: `${t.nombre} ${t.apellido}`, mes: l.mes, anio: l.anio, sueldo: l.sueldo_base })
    }
    const k = `${l.trabajador_id}|${l.contrato_id || ''}|${l.anio}|${l.mes}|${l.sueldo_base}|${l.liquido_a_pagar}`
    if (!lKey.has(k)) lKey.set(k, [])
    lKey.get(k).push(l)
  }
  for (const [k, list] of lKey) {
    if (list.length > 1) {
      const t = trabsById.get(list[0].trabajador_id)
      issues.liquidaciones_duplicadas.push({
        trabajador: t ? `${t.nombre} ${t.apellido}` : '?',
        periodo: `${list[0].mes}/${list[0].anio}`,
        sueldo: list[0].sueldo_base,
        cantidad: list.length,
        registros: list.map(l => ({ id: l._id, creado: l.creado, creado_por: l.creado_por_nombre })),
      })
    }
  }

  // ── Marcaciones huérfanas ─────────────────────────────────────────────────
  for (const m of marcs) {
    if (!trabsById.has(m.trabajador_id)) {
      issues.marcaciones_huerfanas.push({ id: m._id, trabajador_id: m.trabajador_id, fecha: m.fecha })
    }
  }

  // ── Turnos sin orgId ──────────────────────────────────────────────────────
  for (const tu of turnos) {
    if (!tu.orgId) issues.turnos_sin_org.push({ id: tu._id, nombre: tu.nombre })
  }

  // ── Resumen ───────────────────────────────────────────────────────────────
  const resumen = {
    org: orgId || 'todas',
    totales_db: {
      trabajadores: trabs.length,
      contratos:    contratos.length,
      liquidaciones: liqs.length,
      marcaciones:  marcs.length,
      turnos:       turnos.length,
    },
    issues_count: Object.fromEntries(
      Object.entries(issues).map(([k, v]) => [k, v.length])
    ),
  }

  return { resumen, issues }
})
