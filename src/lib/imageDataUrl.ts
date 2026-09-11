/** Compress an image file to a JPEG data URL (PayPal QR / menu photos). */

export async function fileToCompressedDataUrl(
  file: File,
  maxEdge = 480,
  quality = 0.85,
  maxDataUrlChars = 900_000,
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file (PNG, JPG, or WebP).')
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error('Image is too large (max 8 MB).')
  }

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('Could not process image.')
  }
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  if (dataUrl.length > maxDataUrlChars) {
    throw new Error('Image is still too large after compress. Try a smaller photo.')
  }
  return dataUrl
}

/** Menu dish photos — keep small so cloud stall_ops sync stays under size limits. */
export async function fileToMenuImageDataUrl(file: File): Promise<string> {
  return fileToCompressedDataUrl(file, 360, 0.68, 120_000)
}
