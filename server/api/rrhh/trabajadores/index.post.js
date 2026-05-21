import Trabajador from '../../../models/Trabajador.js'
import { requireDb } from '../../../utils/db.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const body = await readBody(event)

  if (!body.nombre?.trim() || !body.apellido?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'nombre y apellido son requeridos' })
  }

  // Organización requerida — no se puede crear un trabajador sin org
  if (!body.orgId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Se requiere una organización activa para crear un trabajador',
    })
  }

  // Generar _id único si no viene en el body
  const _id = body._id || `w_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

  const trabajador = new Trabajador({
    _id,
    nombre:        body.nombre?.trim(),
    apellido:      body.apellido?.trim(),
    rut:           body.rut?.trim()    || undefined,
    email:         body.email?.trim()  || undefined,
    telefono:      body.telefono?.trim() || undefined,
    cargo:         body.cargo?.trim()  || undefined,
    departamento:  body.departamento?.trim() || undefined,
    profesion:     body.profesion?.trim() || undefined,
    sexo:          body.sexo          || undefined,
    fecha_nacimiento: body.fecha_nacimiento || undefined,
    nacionalidad:  body.nacionalidad  || 'Chilena',
    direccion:     body.direccion?.trim() || undefined,
    afp:           body.afp           || 'AFP Capital',
    sistema_salud: body.sistema_salud || 'FONASA',
    banco:         body.banco?.trim() || undefined,
    tipo_cuenta:   body.tipo_cuenta   || undefined,
    numero_cuenta: body.numero_cuenta?.trim() || undefined,
    estado:        body.estado        || 'activo',
    fecha_ingreso: body.fecha_ingreso  || undefined,
    orgId:         body.orgId         || null,
    creado:        new Date(),
    actualizado:   new Date(),
  })

  await trabajador.save()
  return trabajador.toObject()
})
