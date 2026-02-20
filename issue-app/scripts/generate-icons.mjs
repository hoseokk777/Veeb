// 최종 SVG → 모든 사이즈 PNG + ICO 생성
import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pub = (name) => resolve(__dirname, '../public', name)

const svg = readFileSync(pub('icon-source.svg'))

// === iOS 아이콘 (모서리 둥글게 하지 않음 — 시스템이 자동 처리) ===
const iosSizes = [
  { size: 1024, name: 'apple-icon-1024.png' },   // App Store
  { size: 180,  name: 'apple-icon-180.png' },     // iPhone @3x
  { size: 120,  name: 'apple-icon-120.png' },     // iPhone @2x
  { size: 60,   name: 'apple-icon-60.png' },      // iPhone @1x
]

for (const { size, name } of iosSizes) {
  // rx=0 SVG로 정사각형 생성 (둥근 모서리 없음)
  const squareSvg = svg.toString()
    .replace('rx="100"', 'rx="0"')
  await sharp(Buffer.from(squareSvg), { density: 300 })
    .resize(size, size)
    .png()
    .toFile(pub(name))
  console.log(`${name} (${size}x${size}) — iOS`)
}

// === Android 아이콘 (일반) ===
const androidSizes = [
  { size: 512, name: 'android-icon-512.png' },    // Play Store
  { size: 192, name: 'android-icon-192.png' },    // xxxhdpi
  { size: 144, name: 'android-icon-144.png' },    // xxhdpi
  { size: 96,  name: 'android-icon-96.png' },     // xhdpi
  { size: 48,  name: 'android-icon-48.png' },     // mdpi
]

for (const { size, name } of androidSizes) {
  await sharp(svg, { density: 300 })
    .resize(size, size)
    .png()
    .toFile(pub(name))
  console.log(`${name} (${size}x${size}) — Android`)
}

// === Android Adaptive Icon (maskable) — 흰 배경 + 80% 내부 영역 ===
for (const size of [512, 192]) {
  const innerSize = Math.round(size * 0.72)
  const offset = Math.round((size - innerSize) / 2)
  const inner = await sharp(svg, { density: 300 })
    .resize(innerSize, innerSize)
    .png()
    .toBuffer()
  await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
  })
    .composite([{ input: inner, left: offset, top: offset }])
    .png()
    .toFile(pub(`android-icon-maskable-${size}.png`))
  console.log(`android-icon-maskable-${size}.png — Adaptive`)
}

// === PWA 범용 아이콘 (72, 128, 384) ===
for (const size of [72, 128, 384]) {
  await sharp(svg, { density: 300 })
    .resize(size, size)
    .png()
    .toFile(pub(`icon-${size}.png`))
  console.log(`icon-${size}.png (${size}x${size}) — PWA`)
}

// === favicon.ico ===
const png32 = await sharp(svg, { density: 300 }).resize(32, 32).png().toBuffer()
const ico = await pngToIco([png32])
writeFileSync(pub('favicon.ico'), ico)
console.log('favicon.ico — Favicon')

console.log('\n모든 아이콘 생성 완료')
