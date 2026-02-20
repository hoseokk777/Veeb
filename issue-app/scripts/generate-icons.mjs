// 최종 아이콘 원본(PNG)에서 모든 사이즈 생성
import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pub = (name) => resolve(__dirname, '../public', name)

// 원본: 첨부된 최종 디자인 PNG
const source = pub('icon-source-final.png')

// 일반 아이콘 (정사각형으로 크롭 후 리사이즈)
const normalSizes = [72, 96, 128, 144, 192, 384, 512]
for (const size of normalSizes) {
  await sharp(source)
    .resize(size, size, { fit: 'cover', position: 'centre' })
    .png()
    .toFile(pub(`icon-final-${size}.png`))
  console.log(`icon-final-${size}.png (${size}x${size})`)
}

// iOS apple-touch-icon
const iosSizes = [120, 152, 167, 180]
for (const size of iosSizes) {
  await sharp(source)
    .resize(size, size, { fit: 'cover', position: 'centre' })
    .png()
    .toFile(pub(`apple-touch-icon-final-${size}.png`))
  console.log(`apple-touch-icon-final-${size}.png`)
}
await sharp(source)
  .resize(180, 180, { fit: 'cover', position: 'centre' })
  .png()
  .toFile(pub('apple-touch-icon-final.png'))
console.log('apple-touch-icon-final.png')

// maskable 아이콘 (Android 적응형 — 패딩 포함)
for (const size of [192, 512]) {
  // maskable: 안전 영역 확보 (10% 패딩)
  const innerSize = Math.round(size * 0.8)
  const padding = Math.round(size * 0.1)
  const resized = await sharp(source)
    .resize(innerSize, innerSize, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer()
  await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
  })
    .composite([{ input: resized, left: padding, top: padding }])
    .png()
    .toFile(pub(`icon-final-maskable-${size}.png`))
  console.log(`icon-final-maskable-${size}.png`)
}

// favicon.ico
const png32 = await sharp(source)
  .resize(32, 32, { fit: 'cover', position: 'centre' })
  .png()
  .toBuffer()
const ico = await pngToIco([png32])
writeFileSync(pub('favicon-final.ico'), ico)
console.log('favicon-final.ico')

console.log('\n모든 final 아이콘 생성 완료')
