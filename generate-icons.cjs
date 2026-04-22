const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function run() {
  try {
      const input = 'public/Logo.png';
      const bgColor = { r: 15, g: 23, b: 42, alpha: 1 }; // #0f172a
    
      console.log('--- Icon Generation Started ---');

      // 1. Load and trim the logo
      const source = sharp(input);
      const metadata = await source.metadata();
      
      // Trim to get the actual content bounds
      const trimmed = await source.trim().toBuffer({ resolveWithObject: true });
      const { width, height } = trimmed.info;
      console.log(`Trimmed logo size: ${width}x${height}`);

      // 2. Use the entire logo content
      const iconBuffer = trimmed.data;


      // 3. Generate standard icons (Any)
      // We want the logo to be large, filling about 90% of the square
      const generateIcon = async (size, outputPath) => {
          await sharp({
              create: {
                  width: size,
                  height: size,
                  channels: 4,
                  background: bgColor
              }
          })
          .composite([{
              input: await sharp(iconBuffer)
                  .resize(Math.round(size * 0.85), Math.round(size * 0.85), {
                      fit: 'contain',
                      background: { r: 0, g: 0, b: 0, alpha: 0 }
                  })
                  .toBuffer(),
              gravity: 'center'
          }])
          .toFile(outputPath);
          console.log(`Generated: ${outputPath}`);
      };

      await generateIcon(192, 'public/icon-192.png');
      await generateIcon(512, 'public/icon-512.png');

      // 4. Generate Maskable icon
      // Maskable icons need the content to be within the 80% safe zone (center 60-70% is best)
      await sharp({
          create: {
              width: 192,
              height: 192,
              channels: 4,
              background: bgColor
          }
      })
      .composite([{
          input: await sharp(iconBuffer)
              .resize(Math.round(192 * 0.65), Math.round(192 * 0.65), {
                  fit: 'contain',
                  background: { r: 0, g: 0, b: 0, alpha: 0 }
              })
              .toBuffer(),
          gravity: 'center'
      }])
      .toFile('public/icon-192-maskable.png');
      console.log('Generated: public/icon-192-maskable.png');

      console.log('--- Icon Generation Finished Successfully ---');
  } catch (err) {
      console.error('Error generating icons:', err);
  }
}

run();
