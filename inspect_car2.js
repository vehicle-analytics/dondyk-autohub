const fs = require('fs');
const path = require('path');

try {
    const dataPath = path.join(__dirname, 'data', 'cached-data.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    // The data object might have data.data etc. Check what has records
    let appData = data;
    if (data.data && data.data.records) {
        appData = data.data;
    }

    global.window = {};
    const carProcessorContent = fs.readFileSync(path.join(__dirname, 'processing', 'carProcessor.js'), 'utf8');
    eval(carProcessorContent);
    const CarProcessor = global.window.CarProcessor;

    const statsCalculatorContent = fs.readFileSync(path.join(__dirname, 'analytics', 'statsCalculator.js'), 'utf8');
    eval(statsCalculatorContent);
    const StatsCalculator = global.window.StatsCalculator;

    if (!appData.records) {
        console.log("No records found in appData", Object.keys(appData));
        process.exit(1);
    }

    const processedCars = CarProcessor.processCarData(
        appData,
        null,
        CarProcessor.findRegulationForCar
    );

    const car = processedCars.find(c => c.license.includes('6104'));

    if (car) {
        console.log("--- CAR AA 6104 XK FOUND ---");

        const score = StatsCalculator.calculateHealthScore(
            car,
            appData.regulations || [],
            CarProcessor.findRegulationForCar
        );
        console.log(">>> CALCULATED SCORE:", score, "%");

        const details = StatsCalculator.calculateHealthScoreDetailed(
            car,
            appData.regulations || [],
            CarProcessor.findRegulationForCar
        );
        console.log("\\nDETAILS:");
        console.log(JSON.stringify(details, null, 2));

    } else {
        console.log("Car 6104 not found in processed data.");
    }

} catch (e) {
    console.error(e);
}
