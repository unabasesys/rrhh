import Proyecto from '../../../models/Proyecto.js'
import Linea from '../../../models/Linea.js'
import { requireDb, newId } from '../../../utils/db.js'
import { requireAuth } from '../../../utils/requireAuth.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  await requireAuth(event, 'admin')
  const body  = await readBody(event)
  const orgId = body?.orgId || null

  const seed = [
    {
      proyecto: { nombre: 'Producción de ejemplo', codigo: 'PROD-2026', tipo: 'venta', orgId },
      lineas: [
        { nombre: 'Camarógrafo / Camera Assistant', codigo: '1403-0001', categoria: 'Camera' },
      ],
    },
    {
      proyecto: { nombre: 'Gastos generales mayo', codigo: 'GGM-2026', tipo: 'gasto', orgId },
      lineas: [
        { nombre: 'Ejecutivo de ventas', codigo: 'COM-0001', categoria: 'Comercial' },
      ],
    },
  ]

  let creados = 0

  for (const item of seed) {
    const exists = await Proyecto.findOne({ nombre: item.proyecto.nombre, orgId }).lean()
    if (exists) continue

    const proyId = newId('proy')
    const proy = new Proyecto({ _id: proyId, ...item.proyecto, activo: true })
    await proy.save()

    for (const l of item.lineas) {
      const linea = new Linea({ _id: newId('lin'), proyectoId: proyId, orgId, activo: true, ...l })
      await linea.save()
    }

    creados++
  }

  return { ok: true, creados }
})
