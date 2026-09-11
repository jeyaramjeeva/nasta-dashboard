/** PayPal.me fallback link when no uploaded QR image is set. */

export function getPaypalMeUrl(): string {
  const fromEnv = (import.meta.env.VITE_PAYPAL_ME_URL as string | undefined)?.trim()
  return fromEnv || 'https://paypal.me/nastazentrum'
}

/** Prefer Jeeva’s uploaded QR; otherwise generate from PayPal.me URL. */
export function resolvePaypalQrSrc(uploadedDataUrl?: string | null, size = 220): string {
  const uploaded = (uploadedDataUrl || '').trim()
  if (uploaded.startsWith('data:image/')) return uploaded
  const data = encodeURIComponent(getPaypalMeUrl())
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${data}`
}

export function paypalQrImageUrl(size = 220): string {
  return resolvePaypalQrSrc(null, size)
}
