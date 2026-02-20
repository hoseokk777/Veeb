// SVG → PNG 아이콘 생성 스크립트 (sharp 사용)
import sharp from 'sharp'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const svgPath = resolve(__dirname, '../public/icon.svg')
const svg = readFileSync(svgPath)

const sizes = [192, 512]

for (const size of sizes) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(resolve(__dirname, `../public/icon-${size}.png`))
  console.log(`icon-${size}.png 생성 완료`)
}
