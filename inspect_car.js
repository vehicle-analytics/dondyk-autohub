const fs = require('fs');
const path = require('path');

try {
    const dataPath = path.join(__dirname, 'data', 'cached-data.json');
    if (fs.existsSync(dataPath)) {
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

        let targetCar = null;
        if (data.processedCars) {
            targetCar = data.processedCars.find(c => c.license && c.license.includes('6104'));
        }

        if (targetCar) {
            console.log("CAR FOUND IN CACHE:");
            console.log("License:", targetCar.license);
            console.log("photoAssessmentStatus:", targetCar.photoAssessmentStatus);
            console.log("currentMileage:", targetCar.currentMileage);
            console.log("healthScore (cached):", targetCar.healthScore);

            // Extract parts with their statuses
            console.log("\\nPARTS:");
            for (const partName in targetCar.parts) {
                const p = targetCar.parts[partName];
                if (p && p.status !== 'ok') {
                    console.log(`- ${partName}: ${p.status} (daysDiff: ${p.daysDiff}, mileageDiff: ${p.mileageDiff})`);
                }
            }

            console.log("\\nHISTORY ENTRIES COUNT:", targetCar.history ? targetCar.history.length : 0);
        } else {
            console.log("Car 6104 not found in processedCars.");

            if (data.carsInfo) {
                const keys = Object.keys(data.carsInfo);
                const match = keys.find(k => k.includes('6104'));
                if (match) {
                    console.log("Car found in carsInfo:", match, data.carsInfo[match]);
                }
            }
        }
    } else {
        console.log("cached-data.json not found.");
    }
} catch (e) {
    console.error(e);
}
