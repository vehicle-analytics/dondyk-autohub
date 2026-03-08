const fs = require('fs');
const path = require('path');

try {
    const dataPath = path.join(__dirname, 'data', 'cached-data.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    // The data object has 'cars' array. Let's find 6104 in it.
    let car = null;
    if (data.cars && Array.isArray(data.cars)) {
        car = data.cars.find(c => c.license && c.license.includes('6104'));
    } else if (data.processedCars) {
        car = data.processedCars.find(c => c.license && c.license.includes('6104'));
    }

    if (!car) {
        console.log("Car 6104 not found in data.cars:", data.cars ? data.cars.length : 'no cars array');
        // try to find it somewhere else
        console.log(Object.keys(data));
        process.exit(1);
    }

    global.window = {};
    const carProcessorContent = fs.readFileSync(path.join(__dirname, 'processing', 'carProcessor.js'), 'utf8');
    eval(carProcessorContent);
    const CarProcessor = global.window.CarProcessor;

    const statsCalculatorContent = fs.readFileSync(path.join(__dirname, 'analytics', 'statsCalculator.js'), 'utf8');
    eval(statsCalculatorContent);
    const StatsCalculator = global.window.StatsCalculator;

    console.log("--- CAR AA 6104 XK FOUND ---");
    console.log("Photo status:", car.photoAssessmentStatus);

    // Calculate Score
    const score = StatsCalculator.calculateHealthScore(
        car,
        data.regulations || [],
        CarProcessor.findRegulationForCar
    );
    console.log(">>> CALCULATED SCORE:", score, "%");

    const details = StatsCalculator.calculateHealthScoreDetailed(
        car,
        data.regulations || [],
        CarProcessor.findRegulationForCar
    );
    console.log("\\nDETAILS:");
    console.log(JSON.stringify(details, null, 2));

} catch (e) {
    console.error(e);
}
