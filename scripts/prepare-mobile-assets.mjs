/**
 * Build Capacitor source assets from public/nasta-logo.png
 * (1024 icon + 2732 splash on brand leaf/dark backgrounds).
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const root = path.resolve(import.meta.dirname, '..')
const logoPath = path.join(root, 'public', 'nasta-logo.png')
const outDir = path.join(root, 'assets')

const LEAF = { r: 47, g: 122, b: 69, alpha: 1 }
const DARK = { r: 15, g: 20, b: 16, alpha: 1 }
const CREAM = { r: 244, g: 245, b: 247, alpha: 1 }

async function paddedLogo(size, padRatio, bg) {
  const inner = Math.round(size * (1 - padRatio * 2))
  const logo = await sharp(logoPath)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  return sharp({
    create: { width: size, height: size, channels: 4, background: bg },
  })
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toBuffer()
}

async function main() {
  if (!fs.existsSync(logoPath)) {
    throw new Error(`Missing logo: ${logoPath}`)
  }
  fs.mkdirSync(outDir, { recursive: true })

  // Easy-mode sources for @capacitor/assets
  await sharp(await paddedLogo(1024, 0.12, CREAM))
    .toFile(path.join(outDir, 'logo.png'))
  await sharp(await paddedLogo(1024, 0.12, DARK))
    .toFile(path.join(outDir, 'logo-dark.png'))

  // Full-control extras (adaptive icon layers + splash)
  await sharp(await paddedLogo(1024, 0.18, { r: 0, g: 0, b: 0, alpha: 0 }))
    .toFile(path.join(outDir, 'icon-foreground.png'))
  await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: LEAF },
  })
    .png()
    .toFile(path.join(outDir, 'icon-background.png'))
  await sharp(await paddedLogo(1024, 0.1, CREAM))
    .toFile(path.join(outDir, 'icon-only.png'))

  await sharp(await paddedLogo(2732, 0.28, CREAM))
    .toFile(path.join(outDir, 'splash.png'))
  await sharp(await paddedLogo(2732, 0.28, DARK))
    .toFile(path.join(outDir, 'splash-dark.png'))

  console.log('Prepared assets/ for @capacitor/assets')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
