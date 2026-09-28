/**
 * server/utils/reglasAcceso.js
 * Quién puede entrar a People y a qué parte.
 *
 *   1. Una persona que no existe en el sistema se registra (clave o Google) y
 *      entra como manager de la Empresa DEMO: ve la bienvenida y datos de
 *      ejemplo.
 *   2. Un trabajador de una empresa real entra SOLO si la empresa le dio
 *      acceso (usuario viewer vinculado a su ficha). Si no, no entra: no
 *      puede auto-registrarse y terminar como manager de la demo con el
 *      mismo correo que su empleador ya tiene cargado.
 *   3. El viewer ve solo su portal (liquidaciones, vacaciones, marcaciones);
 *      el guard global le cierra /api/rrhh/*.
 */
import Trabajador from '../models/Trabajador.js'
import Organization from '../models/Organization.js'

const MSG_SIN_ACCESO =
  'Tu correo está registrado como trabajador de una empresa que usa People. ' +
  'Pídele a tu empleador que te dé acceso al portal.'

const escaparRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** ¿El correo es de un trabajador cargado en una empresa real (no la demo)? */
export async function esTrabajadorDeEmpresa(email) {
  if (!email) return false
  const demo = await Organization.findOne({ nombre: /^Empresa DEMO SPA$/i }, { _id: 1 }).lean()
  const fuera = [null, ...(demo ? [demo._id] : [])]
  const t = await Trabajador.findOne(
    { email: new RegExp(`^${escaparRegex(email.trim())}$`, 'i'), orgId: { $nin: fuera } },
    { _id: 1 }
  ).lean()
  return !!t
}

/** Regla 2 para una cuenta NUEVA: un trabajador sin acceso no se registra. */
export async function exigirQueNoSeaTrabajador(email) {
  if (await esTrabajadorDeEmpresa(email)) {
    throw createError({ statusCode: 403, message: MSG_SIN_ACCESO })
  }
}

/** Regla 2 para una cuenta EXISTENTE: un viewer sin ficha vinculada no entra. */
export function exigirAccesoViewer(user) {
  if (user?.rol === 'viewer' && !user.trabajador_id) {
    throw createError({ statusCode: 403, message: MSG_SIN_ACCESO })
  }
}
