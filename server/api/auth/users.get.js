/**
 * GET /api/auth/users
 * Lista de usuarios.
 *   - admin   → ve todos los usuarios.
 *   - manager → ve solo usuarios de sus orgs (orgIds), excluyendo a otros admins.
 *   - viewer  → 403.
 */
import { requireDb } from '../../utils/db.js'
import { requireManager } from '../../utils/requireAuth.js'
import User from '../../models/User.js'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const me = await requireManager(event)   // admin o manager

  const projection = { passwordHash: 0, token: 0, tokenExpires: 0 }
  let filter = {}

  if (me.rol !== 'admin') {
    // Manager: solo usuarios cuyo orgIds intersecte con las suyas, y no admins.
    const myOrgs = Array.isArray(me.orgIds) ? me.orgIds : (me.orgId ? [me.orgId] : [])
    if (!myOrgs.length) return []
    filter = {
      rol: { $ne: 'admin' },
      $or: [
        { orgIds: { $in: myOrgs } },
        { orgId:  { $in: myOrgs } },   // compat con docs viejos sin orgIds
      ],
    }
  }

  const users = await User.find(filter, projection).sort({ createdAt: 1 }).lean()
  return users
})
