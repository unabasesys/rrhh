/**
 * Mailer básico — usa Resend si RESEND_API_KEY está configurada en env;
 * en dev/sin key, loguea el contenido a consola para que el flujo siga
 * funcionando sin romper.
 *
 * Para activar en prod:
 *   1. Crear cuenta en https://resend.com (free tier: 3000 emails/mes)
 *   2. Verificar el dominio "unabase.com" (o el que uses)
 *   3. Setear RESEND_API_KEY y MAIL_FROM en Vercel envs
 */
const RESEND_ENDPOINT = 'https://api.resend.com/emails'

/**
 * Envía un email. No falla si no hay credenciales — loguea y sigue.
 * @returns {Promise<{ok: boolean, mode: 'sent'|'logged'|'failed', error?: string}>}
 */
export async function enviarEmail({ to, subject, html, from }) {
  const apiKey = process.env.RESEND_API_KEY
  const sender = from || process.env.MAIL_FROM || 'unabase Personas <no-reply@unabase.com>'

  if (!apiKey) {
    console.log('[mailer] (sin RESEND_API_KEY — solo log)')
    console.log(`  → To:      ${Array.isArray(to) ? to.join(', ') : to}`)
    console.log(`  → Subject: ${subject}`)
    console.log(`  → From:    ${sender}`)
    return { ok: true, mode: 'logged' }
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from:    sender,
        to:      Array.isArray(to) ? to : [to],
        subject,
        html,
      }),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('[mailer] Resend respondió', res.status, errText)
      return { ok: false, mode: 'failed', error: `HTTP ${res.status}` }
    }
    return { ok: true, mode: 'sent' }
  } catch (e) {
    console.error('[mailer] Error enviando email:', e.message)
    return { ok: false, mode: 'failed', error: e.message }
  }
}
