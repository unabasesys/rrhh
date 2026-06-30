/**
 * Mailer básico — usa Brevo (ex-Sendinblue) si BREVO_API_KEY está configurada
 * en env; en dev/sin key, loguea el contenido a consola para que el flujo
 * siga funcionando sin romper.
 *
 * Para activar en prod:
 *   1. Cuenta en https://brevo.com (free tier: 300 emails/día)
 *   2. Verificar sender/dominio en Senders & IP → Senders
 *   3. Generar API key en SMTP & API → API Keys
 *   4. Setear BREVO_API_KEY y MAIL_FROM en Vercel envs
 *      MAIL_FROM acepta dos formatos:
 *        - "no-reply@unabase.com"
 *        - "unabase Personas <no-reply@unabase.com>"
 */
const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email'

/**
 * Parsea "Nombre <email@x.com>" → { name, email }, o solo el email si no
 * trae nombre. Brevo necesita objeto separado, no string.
 */
function parseSender(raw) {
  if (!raw) return { email: 'no-reply@unabase.com', name: 'unabase Personas' }
  const m = String(raw).match(/^\s*(.+?)\s*<\s*(.+?)\s*>\s*$/)
  if (m) return { name: m[1], email: m[2] }
  return { email: String(raw).trim() }
}

/**
 * Normaliza destinatarios. Acepta string, array de strings o array de
 * objetos { email, name }.
 */
function normalizeRecipients(to) {
  const arr = Array.isArray(to) ? to : [to]
  return arr
    .filter(Boolean)
    .map(r => typeof r === 'string' ? { email: r } : r)
}

/**
 * Envía un email. No falla si no hay credenciales — loguea y sigue.
 * @returns {Promise<{ok: boolean, mode: 'sent'|'logged'|'failed', error?: string}>}
 */
export async function enviarEmail({ to, subject, html, from }) {
  const apiKey = process.env.BREVO_API_KEY
  const sender = parseSender(from || process.env.MAIL_FROM)

  if (!apiKey) {
    console.log('[mailer] (sin BREVO_API_KEY — solo log)')
    console.log(`  → To:      ${Array.isArray(to) ? to.join(', ') : to}`)
    console.log(`  → Subject: ${subject}`)
    console.log(`  → From:    ${sender.name ? `${sender.name} <${sender.email}>` : sender.email}`)
    return { ok: true, mode: 'logged' }
  }

  try {
    const res = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'accept':       'application/json',
        'api-key':      apiKey,
      },
      body: JSON.stringify({
        sender,
        to:          normalizeRecipients(to),
        subject,
        htmlContent: html,
      }),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('[mailer] Brevo respondió', res.status, errText)
      return { ok: false, mode: 'failed', error: `HTTP ${res.status}` }
    }
    return { ok: true, mode: 'sent' }
  } catch (e) {
    console.error('[mailer] Error enviando email:', e.message)
    return { ok: false, mode: 'failed', error: e.message }
  }
}
