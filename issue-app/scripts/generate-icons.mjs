// SVG → PNG 아이콘 생성 스크립트 (sharp 사용)
import sharp from 'sharp'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pub = (name) => resolve(__dirname, '../public', name)

// 일반 아이콘 (둥근 모서리 포함)
const svg = readFileSync(pub('icon.svg'))
const normalSizes = [72, 96, 128, 144, 192, 384, 512]

for (const size of normalSizes) {
  await sharp(svg).resize(size, size).png().toFile(pub(`icon-${size}.png`))
  console.log(`icon-${size}.png`)
}

// iOS apple-touch-icon (180×180 필수)
const iosSizes = [120, 152, 167, 180]
for (const size of iosSizes) {
  await sharp(svg).resize(size, size).png().toFile(pub(`apple-touch-icon-${size}.png`))
  console.log(`apple-touch-icon-${size}.png`)
}
// 기본 apple-touch-icon (180)
await sharp(svg).resize(180, 180).png().toFile(pub('apple-touch-icon.png'))
console.log('apple-touch-icon.png')

// maskable 아이콘 (Android 적응형 — 안전 영역 내 콘텐츠)
const maskSvg = readFileSync(pub('icon-maskable.svg'))
const maskSizes = [192, 512]
for (const size of maskSizes) {
  await sharp(maskSvg).resize(size, size).png().toFile(pub(`icon-maskable-${size}.png`))
  console.log(`icon-maskable-${size}.png`)
}

console.log('\n모든 아이콘 생성 완료')
