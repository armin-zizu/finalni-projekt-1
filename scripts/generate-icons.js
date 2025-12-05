// Skript za generisanje PWA ikona
// Ovo je placeholder - u produkciji bi trebalo koristiti prave ikone
// Za sada ćemo kreirati jednostavne placeholder ikone

const fs = require('fs');
const path = require('path');

// Veličine ikona koje trebamo
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Kreiraj jednostavnu SVG ikonu
function createIconSVG(size) {
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#3b82f6" rx="${size * 0.2}"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${size * 0.4}" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">OA</text>
</svg>`;
}

// Kreiraj ikone
const publicDir = path.join(__dirname, '..', 'public');

sizes.forEach(size => {
  const svg = createIconSVG(size);
  const filename = `icon-${size}x${size}.png`;
  // Za sada ćemo kreirati SVG fajlove, ali u produkciji bi trebalo konvertovati u PNG
  // Koristimo SVG jer je jednostavnije i radi dobro
  fs.writeFileSync(
    path.join(publicDir, `icon-${size}x${size}.svg`),
    svg
  );
  console.log(`Kreirana ikona: icon-${size}x${size}.svg`);
});

console.log('Ikone su kreirane!');
console.log('NAPOMENA: Za produkciju, konvertuj SVG u PNG koristeći ImageMagick ili sličan alat.');

