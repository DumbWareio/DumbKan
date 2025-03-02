const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

const ICON_SIZES = [192, 512];

async function generateIcons() {
    // Create icons directory if it doesn't exist
    const iconsDir = path.join(__dirname, '..', 'public', 'icons');
    try {
        await fs.mkdir(iconsDir, { recursive: true });
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }

    const logoPath = path.join(__dirname, '..', 'public', 'logo.png');

    // Check if logo exists
    try {
        await fs.access(logoPath);
    } catch (err) {
        console.error('logo.png not found in public directory. Please add your logo file first.');
        process.exit(1);
    }

    // Generate icons from logo
    for (const size of ICON_SIZES) {
        await sharp(logoPath)
            .resize(size, size, {
                fit: 'contain',
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            })
            .png()
            .toFile(path.join(iconsDir, `icon-${size}x${size}.png`));
        
        console.log(`Generated ${size}x${size} icon from logo`);
    }
}

generateIcons().catch(console.error); 