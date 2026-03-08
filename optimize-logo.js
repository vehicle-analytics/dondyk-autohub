const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const inputPath = path.join('c:\\Users\\user\\OneDrive\\Desktop\\21', 'Logo.png');
const outputPath = path.join('c:\\Users\\user\\OneDrive\\Desktop\\21', 'Logo_optimized.png');

sharp(inputPath)
    .png({ compressionLevel: 9, adaptiveFiltering: true, force: true })
    .toFile(outputPath)
    .then(info => {
        console.log('Optimized successfully:', info);
        fs.renameSync(outputPath, inputPath);
        console.log('Original overwritten.');
    })
    .catch(err => {
        console.error('Optimization failed:', err);
    });
