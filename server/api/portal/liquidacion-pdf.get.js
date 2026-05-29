/**
 * GET /api/portal/liquidacion-pdf?id=<liquidacion_id>
 * Genera el PDF de una liquidación específica del trabajador autenticado.
 * Solo accesible si la liquidación pertenece al viewer logueado.
 */
import { requireDb } from '../../utils/db.js'
import { requireAuth } from '../../utils/requireAuth.js'
import Liquidacion  from '../../models/Liquidacion.js'
import Trabajador   from '../../models/Trabajador.js'
import Organization from '../../models/Organization.js'

const MESES = ['','enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

export default defineEventHandler(async (event) => {
  requireDb(event)
  const me = await requireAuth(event)
  if (!me.trabajador_id) {
    throw createError({ statusCode: 403, message: 'Tu cuenta no está vinculada a un trabajador' })
  }

  const q = getQuery(event)
  const liqId = q.id
  if (!liqId) throw createError({ statusCode: 400, message: 'Falta parámetro id' })

  const liq = await Liquidacion.findById(liqId).lean()
  if (!liq) throw createError({ statusCode: 404, message: 'Liquidación no encontrada' })
  if (liq.trabajador_id !== me.trabajador_id) {
    throw createError({ statusCode: 403, message: 'Esta liquidación no te pertenece' })
  }

  const [trab, org] = await Promise.all([
    Trabajador.findById(liq.trabajador_id).lean(),
    liq.orgId ? Organization.findById(liq.orgId).lean() : null,
  ])

  // Re-emitir vía el endpoint POST existente — llamada interna usando $fetch
  // del nitro context. Más simple: redirigir el handler reutilizando el POST.
  const payload = {
    organizacion: org ? {
      nombre:    org.nombre,
      rut:       org.rut,
      direccion: org.direccion,
      logo_base64: org.logo || null,
    } : {},
    trabajador: trab ? {
      nombre:        [trab.nombre, trab.apellido_paterno || trab.apellido].filter(Boolean).join(' '),
      rut:           trab.rut,
      cargo:         trab.cargo,
      fecha_ingreso: trab.fecha_ingreso,
      centro_costo:  trab.centro_costo || '',
    } : {},
    liquidacion: {
      periodo:           `${MESES[liq.mes] || ''} de ${liq.anio}`,
      mes:               liq.mes,
      anio:              liq.anio,
      dias_trabajados:   liq.dias_trabajados,
      dias_licencia:     liq.dias_licencia || 0,
      dias_ausencia:     liq.dias_ausencia || 0,
      horas_base:        liq.horas_base || '45,0',
      haberes: [
        { concepto: 'Sueldo Base', monto: liq.sueldo_base || 0 },
        ...(liq.gratificacion ? [{ concepto: 'Gratificación', monto: liq.gratificacion }] : []),
        ...(Array.isArray(liq.bonos) ? liq.bonos.map(b => ({ concepto: b.nombre || b.concepto || 'Bono', monto: Number(b.monto || b.valor || 0) })) : []),
      ],
      descuentos_legales: [
        ...(liq.afp_descuento     ? [{ concepto: 'AFP',     monto: liq.afp_descuento     }] : []),
        ...(liq.salud_descuento   ? [{ concepto: 'Salud',   monto: liq.salud_descuento   }] : []),
        ...(liq.cesantia_trabajador ? [{ concepto: 'Cesantía trabajador', monto: liq.cesantia_trabajador }] : []),
        ...(liq.impuesto          ? [{ concepto: 'Impuesto Único', monto: liq.impuesto } ] : []),
      ],
      otros_descuentos: Array.isArray(liq.descuentos) ? liq.descuentos.map(d => ({ concepto: d.nombre || d.concepto, monto: Number(d.monto || d.valor || 0) })) : [],
      totales: { haberes: liq.total_haberes, descuentos: liq.total_descuentos },
      liquido_a_pagar: liq.liquido_a_pagar,
      renta_imponible: liq.renta_imponible,
    },
    // Pasamos la firma para que el PDF la dibuje en lugar del sello "PENDIENTE"
    firma: liq.firma_data ? {
      estado: 'firmada',
      tipo:   liq.firma_tipo || 'digital',
      fecha:  liq.firma_fecha,
      data:   liq.firma_data,
    } : { estado: 'pendiente' },
  }

  // Llamamos al endpoint POST internamente vía $fetch
  const buffer = await $fetch('/api/rrhh/liquidacion-pdf', {
    method: 'POST',
    body: payload,
    responseType: 'arrayBuffer',
  })

  const filename = `liquidacion_${liq.anio}_${String(liq.mes).padStart(2, '0')}.pdf`
  setResponseHeader(event, 'content-type', 'application/pdf')
  setResponseHeader(event, 'content-disposition', `attachment; filename="${filename}"`)
  return Buffer.from(buffer)
})
