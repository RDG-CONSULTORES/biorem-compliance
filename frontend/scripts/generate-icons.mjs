/**
 * Script para generar iconos de Biorem en múltiples tamaños
 * Usa sharp (ya instalado con Next.js)
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const appDir = join(__dirname, '..', 'src', 'app');

// Leer el SVG del ícono
const svgPath = join(publicDir, 'biorem-icon.svg');
const svgBuffer = readFileSync(svgPath);

// Tamaños a generar
const sizes = [
  { name: 'favicon-16x16.png', size: 16, dir: publicDir },
  { name: 'favicon-32x32.png', size: 32, dir: publicDir },
  { name: 'apple-touch-icon.png', size: 180, dir: publicDir },
  { name: 'icon-192.png', size: 192, dir: publicDir },
  { name: 'icon-512.png', size: 512, dir: publicDir },
];

async function generateIcons() {
  console.log('Generando iconos de Biorem...\n');

  for (const { name, size, dir } of sizes) {
    const outputPath = join(dir, name);

    await sharp(svgBuffer)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .png()
      .toFile(outputPath);

    console.log(`✅ ${name} (${size}x${size})`);
  }

  // Generar favicon.ico (combinación de 16x16 y 32x32)
  // Sharp no genera .ico directamente, pero podemos crear un PNG que Next.js convertirá
  const favicon16 = await sharp(svgBuffer)
    .resize(32, 32, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    })
    .png()
    .toBuffer();

  // Guardar como favicon.ico en src/app (Next.js lo usa automáticamente)
  const faviconPath = join(appDir, 'icon.png');
  writeFileSync(faviconPath, favicon16);
  console.log(`✅ icon.png (32x32) - para Next.js App Router`);

  console.log('\n🎉 Todos los iconos generados exitosamente!');
}

generateIcons().catch(console.error);
