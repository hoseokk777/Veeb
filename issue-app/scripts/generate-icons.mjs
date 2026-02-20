// SVG → PWA 아이콘 PNG 생성
import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const icons = (name) => resolve(__dirname, '../public/icons', name)

const svg = readFileSync(icons('icon.svg'))

// PWA 필수: 192, 512
// apple-touch-icon: 180
// 추가: favicon용 32, manifest 보조 48, 96, 144
const sizes = [32, 48, 96, 144, 180, 192, 512]

for (const size of sizes) {
  await sharp(svg, { density: 300 })
    .resize(size, size)
    .png()
    .toFile(icons(`icon-${size}.png`))
  console.log(`icon-${size}.png`)
}

// favicon.ico
const png32 = await sharp(svg, { density: 300 }).resize(32, 32).png().toBuffer()
const ico = await pngToIco([png32])
writeFileSync(icons('favicon.ico'), ico)
console.log('favicon.ico')

console.log('\n아이콘 생성 완료')
