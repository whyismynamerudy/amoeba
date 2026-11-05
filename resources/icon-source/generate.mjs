// Render Amoeba's icons from the amoeba.sh organism shader (amoeba-icon.html), then package
// them: resources/build/icon.{png,icns,ico}, resources/icon*.png, alternates and the tray icon.
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const sourceDir = import.meta.dirname
const resources = dirname(sourceDir)
const tmp = mkdtempSync(join(tmpdir(), 'amoeba-icons-'))
for (const dir of ['build', 'app-icons', 'tray']) {
  mkdirSync(join(resources, dir), { recursive: true })
}

// Needs Playwright's Chromium (`pnpm exec playwright install chromium`) or an explicit binary.
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined
})
try {
  const page = await browser.newPage()
  await page.goto(pathToFileURL(join(sourceDir, 'amoeba-icon.html')).href)
  await page.waitForFunction(() => window.out)
  const out = await page.evaluate(() => window.out)
  const write = (path, dataUrl) => writeFileSync(path, Buffer.from(dataUrl.split(',')[1], 'base64'))
  write(join(resources, 'build', 'icon.png'), out.classic)
  write(join(resources, 'app-icons', 'amoeba-moss.png'), out.moss)
  write(join(resources, 'app-icons', 'amoeba-sage.png'), out.sage)
  write(join(resources, 'tray', 'amoeba-menu-barTemplate.png'), out.tray)
  write(join(resources, 'tray', 'amoeba-menu-barTemplate@2x.png'), out.tray2x)
  write(join(tmp, 'sage.png'), out.sage)
} finally {
  await browser.close()
}

const sips = (...args) => execFileSync('sips', [...args], { stdio: 'ignore' })
const icon = join(resources, 'build', 'icon.png')
sips('-z', '256', '256', icon, '--out', join(resources, 'icon.png'))
sips('-z', '256', '256', join(tmp, 'sage.png'), '--out', join(resources, 'icon-dev.png'))

// macOS list views use the small slots directly, so those drop the 100px safe-area inset.
const iconset = join(tmp, 'icon.iconset')
mkdirSync(iconset)
const cropped = join(tmp, 'cropped.png')
sips('-c', '824', '824', icon, '--out', cropped)
for (const [name, size, small] of [
  ['icon_16x16.png', 16, true],
  ['icon_16x16@2x.png', 32, true],
  ['icon_32x32.png', 32, true],
  ['icon_32x32@2x.png', 64, true],
  ['icon_128x128.png', 128, false],
  ['icon_128x128@2x.png', 256, false],
  ['icon_256x256.png', 256, false],
  ['icon_256x256@2x.png', 512, false],
  ['icon_512x512.png', 512, false],
  ['icon_512x512@2x.png', 1024, false]
]) {
  sips('-z', String(size), String(size), small ? cropped : icon, '--out', join(iconset, name))
}
execFileSync('iconutil', ['-c', 'icns', iconset, '-o', join(resources, 'build', 'icon.icns')])
rmSync(tmp, { recursive: true, force: true })

execFileSync('node', [join(resources, '..', 'config', 'scripts', 'trim-windows-icon-source.mjs')], {
  stdio: 'inherit'
})
console.log('Amoeba icons written to resources/build, resources/app-icons and resources/tray.')
