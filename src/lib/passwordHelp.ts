/** Admin inbox for password-reset help requests. */
export const PASSWORD_HELP_EMAIL = 'jeevajeyaraam@gmail.com'

/**
 * Sends a forgot-password request to Jeeva’s Gmail (FormSubmit).
 * First use may require confirming the address once via FormSubmit’s email.
 */
export async function sendForgotPasswordRequest(opts: {
  accountName: string
  accountEmail: string
}): Promise<void> {
  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://nasta-dashboard.vercel.app'
  const when = new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })

  const res = await fetch(`https://formsubmit.co/ajax/${PASSWORD_HELP_EMAIL}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      name: 'Nasta Zentrum Tracker',
      email: opts.accountEmail,
      _subject: `Nasta password reset — ${opts.accountName}`,
      _template: 'table',
      _captcha: 'false',
      message: [
        `${opts.accountName} (${opts.accountEmail}) forgot their password and needs a reset.`,
        '',
        'What to do:',
        '1) Supabase → Authentication → Users → open this email → Send password recovery',
        '   (or set a temporary password), then tell them to sign in and change it under Account.',
        `2) App link: ${appUrl}/account`,
        '',
        `Requested at: ${when} (Europe/Berlin)`,
      ].join('\n'),
    }),
  })

  const data = (await res.json().catch(() => null)) as
    | { success?: boolean | string; message?: string }
    | null

  if (!res.ok) {
    throw new Error(data?.message || 'Could not send the reset request email.')
  }
  if (data && (data.success === false || data.success === 'false')) {
    throw new Error(data.message || 'Could not send the reset request email.')
  }
}
