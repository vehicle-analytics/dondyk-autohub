import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DataProcessor } from '../data/dataProcessor.js';
import { Formatters } from '../utils/formatters.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock CONFIG for Node environment if needed, or use environment variables
const SPREADSHEET_ID = process.env.VITE_SPREADSHEET_ID || '12-Z-tmRcjNLv7m8eFP_9rwCCERqPHCV9iVIdtL2vDck';
const API_KEY = process.env.VITE_GOOGLE_API_KEY || 'AIzaSyCcJ4qsKeLtMBAFp8jXDIAiyb3Cpp4OrCQ';

const SHEETS = {
    SCHEDULE: 'ГРАФІК ОБСЛУГОВУВАННЯ',
    HISTORY: 'Ответы на форму (1)',
    REGULATIONS: 'Регламент ТО',
    PHOTO_ASSESSMENT: 'Оцінка авто фото'
};

async function fetchSheetData(sheetName) {
    try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetName)}?key=${API_KEY}`;
        console.log(`🔍 Fetching sheet: ${sheetName}`);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        const data = await response.json();
        return data.values || [];
    } catch (error) {
        console.error(`❌ Error fetching ${sheetName}:`, error);
        return [];
    }
}

async function generateCache() {
    console.log("🚀 Starting cache generation...");
    
    const [scheduleData, historyData, regulationsData, photoAssessmentData] = await Promise.all([
        fetchSheetData(SHEETS.SCHEDULE),
        fetchSheetData(SHEETS.HISTORY),
        fetchSheetData(SHEETS.REGULATIONS),
        fetchSheetData(SHEETS.PHOTO_ASSESSMENT),
    ]);

    if (!scheduleData.length || !historyData.length) {
        console.error("❌ Critical data missing. Aborting.");
        process.exit(1);
    }

    console.log("📊 Processing data...");
    
    const { appData } = DataProcessor.processData(
        scheduleData,
        historyData,
        regulationsData,
        photoAssessmentData,
        (val) => Formatters.parseNumber(val),
        (str) => Formatters.parseDate(str),
        (str) => Formatters.formatDate(str)
    );

    // Save processed data
    const cachePath = path.join(__dirname, '../data/cached-data.json');
    fs.writeFileSync(cachePath, JSON.stringify(appData, null, 2));
    
    console.log(`✅ Cache generated successfully at ${cachePath}`);
    console.log(`📈 Stats: ${appData._meta.totalCars} cars, ${appData._meta.totalRecords} records`);
}

generateCache().catch(err => {
    console.error("💥 Fatal error:", err);
    process.exit(1);
});
