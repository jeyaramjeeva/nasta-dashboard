/** Best-effort OCR for business-card photos (optional tesseract.js). */

function parseCardFields(text: string): {
  name?: string
  company?: string
  phone?: string
  email?: string
  role?: string
} {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const email =
    text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || undefined
  const phone =
    text.match(
      /(?:\+?\d{1,3}[\s./-]?)?(?:\(?\d{2,5}\)?[\s./-]?)?\d{3,4}[\s./-]?\d{3,5}/,
    )?.[0]?.trim() || undefined

  let name: string | undefined
  let company: string | undefined
  let role: string | undefined
  for (const line of lines.slice(0, 8)) {
    if (email && line.includes(email)) continue
    if (phone && line.replace(/\s/g, '').includes(phone.replace(/\s/g, ''))) continue
    if (!name && /^[A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+){1,3}$/.test(line)) {
      name = line
      continue
    }
    if (!role && /(manager|director|chef|owner|gmbh|ug|e\.?v\.?|founder)/i.test(line)) {
      role = line
      continue
    }
    if (!company && line.length > 2 && line.length < 60) {
      company = line
    }
  }
  return { name, company, phone, email, role }
}

export async function extractTextFromImageDataUrl(dataUrl: string): Promise<{
  text: string
  fields: ReturnType<typeof parseCardFields>
}> {
  try {
    const Tesseract = await import('tesseract.js')
    const result = await Tesseract.recognize(dataUrl, 'eng+deu', {
      logger: () => undefined,
    })
    const text = (result.data.text || '').trim()
    return { text, fields: parseCardFields(text) }
  } catch {
    return {
      text: '',
      fields: {},
    }
  }
}
