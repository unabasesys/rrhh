/**
 * GET /api/portal/contrato-pdf?id=<contrato_id>
 * Genera el PDF de un contrato específico del trabajador autenticado.
 * Solo accesible si el contrato pertenece al viewer logueado.
 */
import { requireDb } from '../../utils/db.js'
import { requireAuth } from '../../utils/requireAuth.js'
import Contrato     from '../../models/Contrato.js'
import Trabajador   from '../../models/Trabajador.js'
import Organization from '../../models/Organization.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const me = await requireAuth(event)
  if (!me.trabajador_id) {
    throw createError({ statusCode: 403, message: 'Tu cuenta no está vinculada a un trabajador' })
  }

  const q = getQuery(event)
  const contId = q.id
  if (!contId) throw createError({ statusCode: 400, message: 'Falta parámetro id' })

  const contrato = await Contrato.findById(contId).lean()
  if (!contrato) throw createError({ statusCode: 404, message: 'Contrato no encontrado' })
  if (contrato.trabajador_id !== me.trabajador_id) {
    throw createError({ statusCode: 403, message: 'Este contrato no te pertenece' })
  }

  const [trab, org] = await Promise.all([
    Trabajador.findById(contrato.trabajador_id).lean(),
    contrato.orgId ? Organization.findById(contrato.orgId).lean() : null,
  ])

  // Payload para el endpoint de generación PDF de contratos
  const payload = {
    organizacion: org ? {
      nombre:      org.nombre,
      rut:         org.rut,
      direccion:   org.direccion,
      ciudad:      org.ciudad || 'Santiago',
      logo_base64: org.logo || null,
    } : {},
    trabajador: trab ? {
      nombre:      `${trab.nombre || ''} ${trab.apellido || ''}`.trim(),
      rut:         trab.rut,
      direccion:   trab.direccion,
      nacionalidad: trab.nacionalidad,
      profesion:   trab.profesion,
      afp:         trab.afp,
      sistema_salud: trab.sistema_salud,
    } : {},
    contrato,
    tipo_contrato:    contrato.tipo_contrato,
    cargo:            contrato.cargo,
    sueldo_base:      contrato.sueldo_base,
    fecha_inicio:     contrato.fecha_inicio,
    fecha_termino:    contrato.fecha_termino,
    nombre_proyecto:  contrato.nombre_proyecto,
    descripcion_rol:  contrato.descripcion_rol,
    jornada_semanal:  contrato.jornada_semanal,
    horas_semana:     contrato.horas_semana,
    lugar_trabajo:    contrato.lugar_trabajo,
    direccion_trabajo: contrato.direccion_trabajo,
    modalidad:        contrato.modalidad,
    gratificacion:    contrato.gratificacion,
    movilizacion:     contrato.movilizacion,
    colacion:         contrato.colacion,
    clausulas:        contrato.clausulas || [],
    valor_dia:        contrato.valor_dia,
    dias_contratados: contrato.dias_contratados,
    valor_hora_extra: contrato.valor_hora_extra,
  }

  const buffer = await $fetch('/api/rrhh/contrato-pdf', {
    method: 'POST',
    body: payload,
    responseType: 'arrayBuffer',
  })

  const rut = (trab?.rut || 'doc').replace(/[^0-9kK]/g, '')
  const filename = `contrato_${contrato.tipo_contrato || 'doc'}_${rut}.pdf`
  setResponseHeader(event, 'content-type', 'application/pdf')
  setResponseHeader(event, 'content-disposition', `attachment; filename="${filename}"`)
  return Buffer.from(buffer)
})
