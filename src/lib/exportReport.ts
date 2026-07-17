import { toPng } from 'html-to-image'
import { jsPDF } from 'jspdf'

export async function exportElementPng(el: HTMLElement, filename: string) {
  const dataUrl = await toPng(el, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#0a0a0a',
  })
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename.endsWith('.png') ? filename : `${filename}.png`
  a.click()
}

export async function exportElementPdf(el: HTMLElement, filename: string) {
  const dataUrl = await toPng(el, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#ffffff',
  })
  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Could not render export image'))
    img.src = dataUrl
  })

  const pdf = new jsPDF({
    orientation: img.width >= img.height ? 'landscape' : 'portrait',
    unit: 'pt',
    format: 'a4',
  })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 24
  const maxW = pageW - margin * 2
  const maxH = pageH - margin * 2
  const scale = Math.min(maxW / img.width, maxH / img.height)
  const w = img.width * scale
  const h = img.height * scale
  pdf.addImage(dataUrl, 'PNG', (pageW - w) / 2, margin, w, h)
  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`)
}
