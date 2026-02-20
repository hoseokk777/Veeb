// SVG → PNG/ICO 아이콘 생성 스크립트 (v3 파일명)
import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pub = (name) => resolve(__dirname, '../public', name)

// 일반 아이콘
const svg = readFileSync(pub('icon.svg'))
const normalSizes = [72, 96, 128, 144, 192, 384, 512]

for (const size of normalSizes) {
  await sharp(svg, { density: 300 }).resize(size, size).png().toFile(pub(`icon-v3-${size}.png`))
  console.log(`icon-v3-${size}.png`)
}

// iOS apple-touch-icon
const iosSizes = [120, 152, 167, 180]
for (const size of iosSizes) {
  await sharp(svg, { density: 300 }).resize(size, size).png().toFile(pub(`apple-touch-icon-v3-${size}.png`))
  console.log(`apple-touch-icon-v3-${size}.png`)
}
await sharp(svg, { density: 300 }).resize(180, 180).png().toFile(pub('apple-touch-icon-v3.png'))
console.log('apple-touch-icon-v3.png')

// maskable 아이콘 (Android 적응형)
const maskSvg = readFileSync(pub('icon-maskable.svg'))
for (const size of [192, 512]) {
  await sharp(maskSvg, { density: 300 }).resize(size, size).png().toFile(pub(`icon-v3-maskable-${size}.png`))
  console.log(`icon-v3-maskable-${size}.png`)
}

// favicon.ico (32x32 + 16x16 멀티사이즈)
const png32 = await sharp(svg, { density: 300 }).resize(32, 32).png().toBuffer()
const ico = await pngToIco([png32])
writeFileSync(pub('favicon-v3.ico'), ico)
console.log('favicon-v3.ico')

console.log('\n모든 v3 아이콘 생성 완료')
