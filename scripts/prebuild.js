import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG } from '../config/appConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fetchSheetData(spreadsheetId, sheetName, apiKey) {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}?key=${apiKey}`;
    console.log(`📡 Fetching sheet: ${sheetName}...`);

    const response = await fetch(url);
    if (!response.ok) {
      console.error(`❌ Failed to fetch ${sheetName}: ${response.status} ${response.statusText}`);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Received ${data.values?.length || 0} rows from ${sheetName}`);
    return data.values || [];
  } catch (error) {
    console.error(`❌ Error fetching sheet ${sheetName}:`, error);
    return [];
  }
}

async function runPrebuild() {
  console.log("🚀 Starting Prebuild Data Fetching...");

  const { SPREADSHEET_ID, SHEETS, API_KEY } = CONFIG;

  if (!SPREADSHEET_ID || !SHEETS || !API_KEY) {
    console.error("❌ Missing Google Sheets configuration variables. Skipping prebuild.");
    return;
  }

  try {
    const [scheduleData, historyData, regulationsData, photoAssessmentData] = await Promise.all([
      fetchSheetData(SPREADSHEET_ID, SHEETS.SCHEDULE, API_KEY),
      fetchSheetData(SPREADSHEET_ID, SHEETS.HISTORY, API_KEY),
      fetchSheetData(SPREADSHEET_ID, SHEETS.REGULATIONS, API_KEY),
      fetchSheetData(SPREADSHEET_ID, SHEETS.PHOTO_ASSESSMENT, API_KEY),
    ]);

    const seedData = {
      scheduleData,
      historyData,
      regulationsData,
      photoAssessmentData,
      fetchedAt: new Date().toISOString()
    };

    const publicDir = path.join(__dirname, '..', 'public');
    await fs.mkdir(publicDir, { recursive: true });

    const outPath = path.join(publicDir, 'seed-data.json');
    await fs.writeFile(outPath, JSON.stringify(seedData), 'utf-8');

    const stats = await fs.stat(outPath);
    console.log(`📦 Successfully saved seed data to seed-data.json (${Math.round(stats.size/1024)} KB)`);

  } catch (error) {
    console.error("💥 Critical error during prebuild data gathering:", error);
    process.exit(1);
  }
}

runPrebuild();
