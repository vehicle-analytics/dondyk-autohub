import { CONSTANTS } from '../config/appConfig.js';
import { Formatters } from '../utils/formatters.js';

export class DataProcessor {
  /**
   * Обробляє дані з аркушів
   */
  static processData(
    scheduleData,
    historyData,
    regulationsData,
    photoAssessmentData,
    parseNumber = Formatters.parseNumber,
    parseDate = Formatters.parseDate,
    formatDate = Formatters.formatDate,
  ) {
    // Processing data...
    // ...

    if (!scheduleData || !historyData) {
      throw new Error("Немає даних для обробки");
    }

    const maintenanceRegulations = DataProcessor.processRegulations(
      regulationsData,
      parseNumber,
    );

    // Обробка даних з листа "Оцінка авто фото"
    // Стовпець E (індекс 4) - номер авто
    // Стовпець H (індекс 7) - стан
    const photoAssessmentStatuses = {};
    if (photoAssessmentData && photoAssessmentData.length > 1) {
      for (let i = 1; i < photoAssessmentData.length; i++) {
        const row = photoAssessmentData[i];
        if (row.length < 8) continue;

        const license = String(row[4] || "").trim(); // Стовпець E - номер авто
        if (license) {
          const status = String(row[7] || "").trim(); // Стовпець H - стан
          if (status) {
            photoAssessmentStatuses[license] = status;
          }
        }
      }
      // Photo assessment statuses loaded
    }

    const carsInfo = {};
    const carCities = {};

    console.log(`Processing scheduleData: ${scheduleData?.length || 0} rows`);

    // Рядок 1 (індекс 0): заголовки
    // Рядок 2 (індекс 1): пропускаємо
    // Рядок 3 (індекс 2): початок даних авто
    for (let i = 2; i < scheduleData.length; i++) {
      const row = scheduleData[i];
      if (!row || row.length < 3) continue;

      const license = String(row[CONSTANTS.SCHEDULE_COL_LICENSE] || "").trim();
      
      // Skip empty or summary rows
      if (license && license.length >= 7 && !license.includes('Всього')) {
        const city = String(row[CONSTANTS.SCHEDULE_COL_CITY] || "").trim();
        const vin = String(row[CONSTANTS.SCHEDULE_COL_VIN] || "").trim();
        const engineVolume = String(row[CONSTANTS.SCHEDULE_COL_ENGINE_VOLUME] || "").trim();
        const bodyType = String(row[CONSTANTS.SCHEDULE_COL_BODY_TYPE] || "").trim();
        const wheelsCount = String(row[CONSTANTS.SCHEDULE_COL_WHEELS] || "").trim();

        // Debug logging for the problematic vehicle
        if (license === 'AA 1049 OO' || license.replace(/\s+/g, '') === 'AA1049OO') {
          console.log(`[DEBUG] Extraction for ${license}:`, {
            rowIndex: i + 1,
            vin: vin,
            engineVolume: engineVolume,
            bodyType: bodyType,
            wheelsCount: wheelsCount,
            rowLength: row.length,
            rawRow: row
          });
        }

        carsInfo[license] = {
          city: city,
          license: license,
          model: String(row[CONSTANTS.SCHEDULE_COL_MODEL] || "").trim(),
          year: String(row[CONSTANTS.SCHEDULE_COL_YEAR] || "").trim(),
          vin: vin,
          engineVolume: engineVolume,
          bodyType: bodyType,
          wheelsCount: wheelsCount,
        };
        carCities[license] = city;
      }
    }

    const allowedCars = Object.keys(carsInfo);
    console.log(`Identified ${allowedCars.length} cars from scheduleData`);
    if (allowedCars.length === 0) {
      console.warn("⚠️ No cars identified! Check column indices and data format.");
      console.log("Sample row (index 2):", scheduleData[2]);
    }

    const records = [];
    const currentMileages = {};
    const allowedCarsSet = new Set(allowedCars);
    
    // Cache constants to avoid lookup in loop
    const COL_CAR = CONSTANTS.COL_CAR;
    const COL_MILEAGE = CONSTANTS.COL_MILEAGE;
    const COL_STATUS = CONSTANTS.COL_STATUS;
    const COL_DATE_NEEDED = CONSTANTS.COL_DATE_NEEDED;
    const COL_DATE = CONSTANTS.COL_DATE;
    const COL_QUANTITY = CONSTANTS.COL_QUANTITY;
    const COL_PRICE = CONSTANTS.COL_PRICE;
    const COL_TOTAL_WITH_VAT = CONSTANTS.COL_TOTAL_WITH_VAT;
    const COL_DESCRIPTION = CONSTANTS.COL_DESCRIPTION;
    const COL_PART_CODE = CONSTANTS.COL_PART_CODE;
    const COL_UNIT = CONSTANTS.COL_UNIT;

    for (let i = 1; i < historyData.length; i++) {
      const row = historyData[i];
      if (!row || row.length < 8) continue;

      const car = String(row[COL_CAR] || "").trim();
      if (!car) continue;

      const mileageStr = String(row[COL_MILEAGE] || "").trim();
      let mileage = 0;

      if (mileageStr) {
        // Optimized number cleaning
        const cleanStr = mileageStr.replace(/[\s,]/g, "");
        mileage = parseFloat(cleanStr) || 0;
      }

      // Перевірка статусу запиту
      const statusRaw = row.length > COL_STATUS ? row[COL_STATUS] : "";
      const requestStatus = statusRaw ? String(statusRaw).trim().toLowerCase() : "";
      const isRejected = requestStatus === "відмова";

      // Використовуємо дату зі стовпчика J (COL_DATE_NEEDED) якщо вона є, інакше з COL_DATE
      const dateRaw = (row.length > COL_DATE_NEEDED && row[COL_DATE_NEEDED])
        ? row[COL_DATE_NEEDED]
        : row[COL_DATE];
      
      let dateFormatted = "";
      let isoDate = "";
      
      if (dateRaw) {
        const dateObj = parseDate(String(dateRaw).trim());
        if (dateObj && !isNaN(dateObj.getTime())) {
          dateFormatted = formatDate(dateObj); // Use external utility
          isoDate = dateObj.toISOString();
        }
      }

      const city = carCities[car] || "";

      const quantity = row.length > COL_QUANTITY ? parseNumber(row[COL_QUANTITY]) : 0;
      const price = row.length > COL_PRICE ? parseNumber(row[COL_PRICE]) : 0;
      
      // В сумі витрат НЕ враховувати заявки зі статусом "відмова"
      let totalWithVAT = 0;
      if (!isRejected) {
        totalWithVAT = row.length > COL_TOTAL_WITH_VAT ? parseNumber(row[COL_TOTAL_WITH_VAT]) : 0;
      }

      records.push({
        date: dateFormatted,
        isoDate: isoDate,
        city: city,
        car: car,
        mileage: mileage,
        description: row[COL_DESCRIPTION] ? String(row[COL_DESCRIPTION]) : "",
        partCode: row.length > COL_PART_CODE ? String(row[COL_PART_CODE] || "").trim() : "",
        unit: row.length > COL_UNIT ? String(row[COL_UNIT] || "").trim() : "",
        quantity: quantity,
        price: price,
        totalWithVAT: totalWithVAT,
        status: requestStatus,
      });

      // Оновлюємо пробіг тільки для записів без статусу "відмова" та з валідним пробігом
      if (!isRejected && mileage > 0) {
        const current = currentMileages[car] || 0;
        if (mileage > current) {
          currentMileages[car] = mileage;
        }
      }
    }

    console.log(`✅ Оброблено записів історії: ${records.length}`);
    const totalExp = records.reduce((sum, r) => sum + r.totalWithVAT, 0);
    console.log(`💰 Загальна сума витрат (без відмов): ${totalExp.toFixed(2)}`);

    // Compile part keywords into regexes for O(1) matching later
    const compiledPartKeywords = {};
    for (const partName in CONSTANTS.PARTS_CONFIG) {
      const keywords = CONSTANTS.PARTS_CONFIG[partName];
      compiledPartKeywords[partName] = {
        simple: keywords.map(kw => kw.toLowerCase()),
        complex: keywords.map(kw => {
          const words = kw.toLowerCase().trim().split(/\s+/).filter(w => w.length > 0);
          return words.length > 1 ? words : null;
        }).filter(Boolean)
      };
    }

    const appData = {
      records: records,
      currentMileages: currentMileages,
      carsInfo: carsInfo,
      partKeywords: CONSTANTS.PARTS_CONFIG,
      compiledPartKeywords: compiledPartKeywords,
      partsOrder: CONSTANTS.PARTS_ORDER,
      regulations: maintenanceRegulations,
      photoAssessmentStatuses: photoAssessmentStatuses,
      currentDate: new Date().toISOString().split("T")[0],
      lastUpdated: new Date().toISOString(),
      _meta: {
        totalCars: allowedCars.length,
        totalRecords: records.length,
        processingTime: Date.now(),
      },
    };

    if (typeof document !== 'undefined') {
      const carsCountElement = document.getElementById("cars-count");
      if (carsCountElement) {
        carsCountElement.textContent = allowedCars.length;
      }
    }

    return { appData, maintenanceRegulations };
  }

  /**
   * Обробляє регламенти обслуговування
   */
  static processRegulations(regulationsData, parseNumber = Formatters.parseNumber) {
    if (!regulationsData || regulationsData.length <= 1) {
      // Regulations not found, using default rules
      return [];
    }

    const regulations = [];

    // Функція для нормалізації номерів (для порівняння)
    const normalizeLicenseForComparison = (licenseStr) => {
      if (!licenseStr || licenseStr === "*" || licenseStr === ".*") return licenseStr;
      // Замінюємо кирилицю на латиницю для порівняння
      const cyrillicToLatin = {
        А: "A", В: "B", Е: "E", К: "K", М: "M", Н: "H", О: "O", Р: "P", С: "C", Т: "T", У: "Y", Х: "X", І: "I",
      };
      let normalized = licenseStr.replace(/\s+/g, "").toUpperCase();
      for (const [cyr, lat] of Object.entries(cyrillicToLatin)) {
        normalized = normalized.replace(new RegExp(cyr, "g"), lat);
      }
      return normalized;
    };

    const removeEmoji = (str) => {
      if (!str) return "";
      return str.replace(/[\u{1F300}-\u{1F9FF}]/gu, "").replace(/\s+/g, " ").trim();
    };

    for (let i = 1; i < regulationsData.length; i++) {
      const row = regulationsData[i];
      if (row.length < 5) continue;

      // Нормалізуємо паттерни: якщо порожнє або "*", то означає "для всіх"
      const normalizePattern = (value) => {
        const trimmed = (value || "").trim();
        return trimmed === "" || trimmed === "*" ? "*" : trimmed;
      };

      // Парсимо пріоритет: якщо порожнє або не число, встановлюємо 2 (загальний)
      let priority = parseNumber(row[12]);
      if (priority === null || priority === undefined || isNaN(priority)) {
        priority = 2; // За замовчуванням - загальний регламент
      }

      // Перевіряємо наявність стовпця N (індекс 13) для особливостей
      const specialNote =
        row.length > 13 && row[13] !== undefined && row[13] !== null
          ? String(row[13]).trim()
          : "";

      // Process regulation row

      const regulation = {
        licensePattern: normalizePattern(row[0]),
        brandPattern: normalizePattern(row[1]),
        modelPattern: normalizePattern(row[2]),
        yearFrom: parseNumber(row[3]) || 0,
        yearTo: parseNumber(row[4]) || 2100,
        partName: (row[5] || "").trim(),
        periodType: (row[6] || "").trim() || "пробіг",
        regulationValue: parseNumber(row[7]), // Стовпець H (Регламент) = 110000
        normalValue: parseNumber(row[8]), // Стовпець I (У нормі) = 108000
        warningValue: parseNumber(row[9]), // Стовпець J (Увага)
        criticalValue: parseNumber(row[10]), // Стовпець K (Критично)
        unit: (row[11] || "").trim() || "км",
        priority: priority,
        specialNote: specialNote, // Стовпець N (Особливість)
      };

      regulation.normalizedPartName = removeEmoji(regulation.partName);
      regulation.normalizedLicensePattern = normalizeLicenseForComparison(regulation.licensePattern);
      
      if (regulation.brandPattern !== "*" && regulation.brandPattern !== ".*") {
        try { regulation.brandRegex = new RegExp(regulation.brandPattern, "i"); } catch(e) {}
      }
      if (regulation.modelPattern !== "*" && regulation.modelPattern !== ".*") {
        try {
          let pattern = regulation.modelPattern;
          if (pattern.startsWith(".")) pattern = pattern.replace(/^\./, "(?:^|[\\s\\-\\/])");
          if (pattern.endsWith(".")) pattern = pattern.replace(/\.$/, "(?:[\\s\\-\\/]|$)");
          regulation.modelRegex = new RegExp(pattern, "i");
        } catch(e) {}
      }

      regulations.push(regulation);
    }

    // Сортуємо за пріоритетом (менший пріоритет = вищий пріоритет)
    regulations.sort((a, b) => {
      const priorityA =
        a.priority !== undefined && a.priority !== null ? a.priority : 2;
      const priorityB =
        b.priority !== undefined && b.priority !== null ? b.priority : 2;
      return priorityA - priorityB;
    });

    // Regulations processed successfully

    return regulations;
  }
}
