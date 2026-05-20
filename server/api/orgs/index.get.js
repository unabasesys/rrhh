import { requireDb } from '@/server/utils/db'
import Organization from '@/server/models/Organization'

export default defineEventHandler(async (event) => {
  requireDb(event)
  const orgs = await Organization.find({}).sort({ createdAt: 1 }).lean()
  return orgs
})
