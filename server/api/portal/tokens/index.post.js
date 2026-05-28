/**
 * POST /api/portal/tokens
 * Genera un token público para que un trabajador acceda al portal.
 * Si ya existe uno activo para ese trabajador, lo devuelve (idempotente).
 *
 * Requiere rol manager o admin.
 * Body: { trabajador_id }
 */
import { requireDb, newId } from '../../../utils/db.js'
import { requireAuth, requireOrgAccess } from '../../../utils/requireAuth.js'
import PortalToken from '../../../models/PortalToken.js'
import Trabajador  from '../../../models/Trabajador.js'

function randomToken() {
  return [...crypto.getRandomValues(new Uint8Array(16))]
    .map(b => b.toString(16).padStart(2, '0')).join('')
}

export default defineEventHandler(async (event) => {
  requireDb(event)
  const user = await requireAuth(event, 'manager')
  const body = await readBody(event)
  const trabId = body?.trabajador_id
  if (!trabId) throw createError({ statusCode: 400, message: 'trabajador_id requerido' })

  const trab = await Trabajador.findById(trabId).lean()
  if (!trab) throw createError({ statusCode: 404, message: 'Trabajador no encontrado' })
  requireOrgAccess(user, trab.orgId)

  // Reusar token activo si existe
  let tok = await PortalToken.findOne({ trabajador_id: trabId, activo: true }).lean()
  if (!tok) {
    const created = new PortalToken({
      _id:           newId('ptok'),
      token:         randomToken(),
      trabajador_id: trabId,
      orgId:         trab.orgId,
      activo:        true,
      creado:        new Date(),
    })
    await created.save()
    tok = created.toObject()
  }
  return tok
})
