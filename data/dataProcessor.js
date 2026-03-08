import { CONSTANTS } from '../config/appConfig.js';

export class DataProcessor {
  /**
   * Обробляє дані з аркушів
   */
  static processData(
    scheduleData,
    historyData,
    regulationsData,
    photoAssessmentData,
    parseNumber,
    parseDate,
    formatDate,
  ) {
    // Processing data...
    // ...

    if (!scheduleData || !historyData) {
      throw new Error("Немає даних для обробки");
    }

    const maintenanceRegulations = this.processRegulations(
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

    // Рядок 1 (індекс 0): заголовки
    // Рядок 2 (індекс 1): пропускаємо
    // Рядок 3 (індекс 2): початок даних авто
    for (let i = 2; i < scheduleData.length; i++) {
      const row = scheduleData[i];
      if (row.length < 5) continue;

      const license = String(row[CONSTANTS.SCHEDULE_COL_LICENSE] || "").trim();
      if (license) {
        const city = String(row[CONSTANTS.SCHEDULE_COL_CITY] || "").trim();
        carsInfo[license] = {
          city: city,
          license: license,
          model: String(row[CONSTANTS.SCHEDULE_COL_MODEL] || "").trim(),
          year: String(row[CONSTANTS.SCHEDULE_COL_YEAR] || "").trim(),
          vin: String(row[CONSTANTS.SCHEDULE_COL_VIN] || "").trim(),
        };
        carCities[license] = city;
      }
    }

    const allowedCars = Object.keys(carsInfo);
    const records = [];
    const currentMileages = {};
    const allowedCarsSet = new Set(allowedCars);

    for (let i = 1; i < historyData.length; i++) {
      const row = historyData[i];
      if (row.length < 8) continue;

      const car = String(row[CONSTANTS.COL_CAR] || "").trim();
      if (!car || !allowedCarsSet.has(car)) continue;

      const mileageStr = String(row[CONSTANTS.COL_MILEAGE] || "").trim();
      let mileage = 0;

      if (mileageStr) {
        const cleanStr = mileageStr.replace(/[\s,]/g, "");
        mileage = parseFloat(cleanStr);
        if (isNaN(mileage)) continue;
        // Конвертація в тисячі (якщо потрібно)
        mileage = mileage;
      }

      if (mileage === 0) continue;

      // Перевірка статусу запиту
      const requestStatus =
        row.length > CONSTANTS.COL_STATUS
          ? String(row[CONSTANTS.COL_STATUS] || "")
            .trim()
            .toLowerCase()
          : "";
      const isRejected = requestStatus === "відмова";

      // Використовуємо дату зі стовпчика J (COL_DATE_NEEDED) якщо вона є, інакше з COL_DATE
      let date =
        row.length > CONSTANTS.COL_DATE_NEEDED && row[CONSTANTS.COL_DATE_NEEDED]
          ? row[CONSTANTS.COL_DATE_NEEDED]
          : row[CONSTANTS.COL_DATE];
      if (date) {
        const originalDate = String(date).trim();

        if (originalDate.includes(".")) {
          const parts = originalDate.split(".");
          if (parts.length === 3 && parts[2] && parts[2].length === 4) {
            date = originalDate;
          } else {
            const dateObj = parseDate(originalDate);
            if (dateObj) {
              const day = String(dateObj.getDate()).padStart(2, "0");
              const month = String(dateObj.getMonth() + 1).padStart(2, "0");
              const year = dateObj.getFullYear();
              date = `${day}.${month}.${year}`;
            } else {
              date = originalDate;
            }
          }
        } else {
          const dateObj = parseDate(originalDate);
          if (dateObj) {
            const day = String(dateObj.getDate()).padStart(2, "0");
            const month = String(dateObj.getMonth() + 1).padStart(2, "0");
            const year = dateObj.getFullYear();
            date = `${day}.${month}.${year}`;
          } else {
            date = originalDate;
          }
        }
      }

      const city = carCities[car] || "";

      const quantity =
        row.length > CONSTANTS.COL_QUANTITY
          ? parseNumber(row[CONSTANTS.COL_QUANTITY])
          : 0;
      const price =
        row.length > CONSTANTS.COL_PRICE
          ? parseNumber(row[CONSTANTS.COL_PRICE])
          : 0;
      const totalWithVAT =
        row.length > CONSTANTS.COL_TOTAL_WITH_VAT
          ? parseNumber(row[CONSTANTS.COL_TOTAL_WITH_VAT])
          : 0;

      records.push({
        date: date || "",
        city: city,
        car: car,
        mileage: mileage,
        originalMileage: mileageStr,
        description: String(row[CONSTANTS.COL_DESCRIPTION] || ""),
        partCode:
          row.length > CONSTANTS.COL_PART_CODE
            ? String(row[CONSTANTS.COL_PART_CODE] || "").trim()
            : "",
        unit:
          row.length > CONSTANTS.COL_UNIT
            ? String(row[CONSTANTS.COL_UNIT] || "").trim()
            : "",
        quantity: quantity,
        price: price,
        totalWithVAT: totalWithVAT,
        status:
          row.length > CONSTANTS.COL_STATUS
            ? String(row[CONSTANTS.COL_STATUS] || "").trim()
            : "",
      });

      // Оновлюємо пробіг тільки для записів без статусу "відмова"
      if (!isRejected && mileage > (currentMileages[car] || 0)) {
        currentMileages[car] = mileage;
      }
    }

    const appData = {
      records: records,
      currentMileages: currentMileages,
      carsInfo: carsInfo,
      partKeywords: CONSTANTS.PARTS_CONFIG,
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

    const carsCountElement = document.getElementById("cars-count");
    if (carsCountElement) {
      carsCountElement.textContent = allowedCars.length;
    }

    return { appData, maintenanceRegulations };
  }

  /**
   * Обробляє регламенти обслуговування
   */
  static processRegulations(regulationsData, parseNumber) {
    if (!regulationsData || regulationsData.length <= 1) {
      // Regulations not found, using default rules
      return [];
    }

    const regulations = [];

    // Функція для нормалізації номерів (для порівняння)
    const normalizeLicenseForComparison = (licenseStr) => {
      if (!licenseStr) return "";
      // Замінюємо кирилицю на латиницю для порівняння
      const cyrillicToLatin = {
        А: "A",
        В: "B",
        Е: "E",
        К: "K",
        М: "M",
        Н: "H",
        О: "O",
        Р: "P",
        С: "C",
        Т: "T",
        У: "Y",
        Х: "X",
        І: "I",
      };
      let normalized = licenseStr.replace(/\s+/g, "").toUpperCase();
      for (const [cyr, lat] of Object.entries(cyrillicToLatin)) {
        normalized = normalized.replace(new RegExp(cyr, "g"), lat);
      }
      return normalized;
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

      // Debug logging removed for performance

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
