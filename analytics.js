import { CacheManager } from './cache/cacheManager.js';
import { DataProcessor } from './data/dataProcessor.js';
import { Formatters } from './utils/formatters.js';
import { CarProcessor } from './processing/carProcessor.js';
import { StatsCalculator } from './analytics/statsCalculator.js';
import { CONFIG, CONSTANTS } from './config/appConfig.js';
import { EXPENSE_CATEGORIES_UTILS, EXPENSE_CATEGORIES } from './expense-categories.js';

class AnalyticsApp {
  constructor() {
    this.appData = null;
    this.processedCars = null;
    this.maintenanceRegulations = [];
    this.charts = {};
    this.filters = {
      period: "year",
      city: "all",
      vehicle: "all",
      brand: "all",
      selectedYear: null,
    };
    this.filteredData = null;
    this.init();
  }

  async init() {
    console.log("📊 Ініціалізація Analytics App...");
    this.updateLoadingProgress(10);
    this.setupEventListeners();

    await this.waitForModules();
    await this.loadData();
  }

  async waitForModules() {
    // В ESM модулі завантажуються гарантовано, якщо імпортовані
    return;
  }

  setupEventListeners() {
    // Period filters
    document.querySelectorAll(".filter-period").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        document.querySelectorAll(".filter-period").forEach((b) => {
          b.classList.remove("bg-blue-100", "text-blue-700");
          b.classList.add("bg-gray-100", "text-gray-700");
        });
        e.target.classList.remove("bg-gray-100", "text-gray-700");
        e.target.classList.add("bg-blue-100", "text-blue-700");
        this.filters.period = e.target.dataset.period;

        // Кнопка "Рік" працює як інші періоди - показує дані за останній рік
        // Фільтр "Рік:" завжди видимий і працює незалежно
        this.applyFilters();
      });
    });

    // Year filter - працює незалежно від вибраного періоду
    document.getElementById("filter-year")?.addEventListener("change", (e) => {
      if (e.target.value === "all") {
        this.filters.selectedYear = null;
      } else {
        this.filters.selectedYear = e.target.value
          ? parseInt(e.target.value)
          : null;
      }
      this.applyFilters();
    });

    // City filter
    document.getElementById("filter-city")?.addEventListener("change", (e) => {
      this.filters.city = e.target.value;
      this.applyFilters();
    });

    // Vehicle filter
    document
      .getElementById("filter-vehicle")
      ?.addEventListener("change", (e) => {
        this.filters.vehicle = e.target.value;
        this.applyFilters();
      });

    // Brand filter
    document.getElementById("filter-brand")?.addEventListener("change", (e) => {
      this.filters.brand = e.target.value;
      this.applyFilters();
    });

    // Refresh button
    document
      .getElementById("refresh-analytics")
      ?.addEventListener("click", () => {
        this.loadData(true);
      });

    // Export buttons
    document.getElementById("export-pdf")?.addEventListener("click", () => {
      this.exportToPDF();
    });

    document.getElementById("export-excel")?.addEventListener("click", () => {
      this.exportToExcel();
    });
  }

  updateLoadingProgress(percent) {
    const bar = document.getElementById("loading-bar");
    if (bar) bar.style.width = percent + "%";
  }

  async loadData(forceRefresh = false) {
    try {
      this.updateLoadingProgress(20);

      const cached = this.getCachedData();
      const needsDataRefresh = cached && cached.records && cached.records.length > 0 && !cached.records[0].isoDate;

      if (
        cached &&
        !forceRefresh &&
        !needsDataRefresh &&
        cached.carsInfo &&
        Object.keys(cached.carsInfo).length > 0
      ) {
        console.log("✅ Використано кешовані дані");
        this.appData = cached;
        this.maintenanceRegulations = cached.regulations || [];
        this.updateLoadingProgress(60);
      } else {
        if (needsDataRefresh) {
          console.log("🔄 Кеш застарілий (відсутня isoDate). Примусове оновлення...");
        } else {
          console.log("📥 Завантаження даних з Google Sheets...");
        }
        this.updateLoadingProgress(40);
        await this.fetchDataFromSheets();
      }

      this.updateLoadingProgress(70);
      await this.processCars();

      this.updateLoadingProgress(80);
      this.populateFilters();
      this.applyFilters();

      this.updateLoadingProgress(100);

      document.getElementById("loading-screen").classList.add("hidden");
      document.getElementById("main-interface").classList.remove("hidden");
    } catch (error) {
      console.error("❌ Помилка завантаження даних:", error);
      this.showErrorMessage("Помилка завантаження даних: " + error.message);
    }
  }

  getCachedData() {
    return CacheManager.getCachedData();
  }

  async fetchDataFromSheets() {
    const config = CONFIG;
    const { SPREADSHEET_ID, SHEETS, API_KEY } = config;

    const [scheduleData, historyData, regulationsData, photoAssessmentData] =
      await Promise.all([
        this.fetchSheetData(SPREADSHEET_ID, SHEETS.SCHEDULE, API_KEY),
        this.fetchSheetData(SPREADSHEET_ID, SHEETS.HISTORY, API_KEY),
        this.fetchSheetData(SPREADSHEET_ID, SHEETS.REGULATIONS, API_KEY),
        this.fetchSheetData(SPREADSHEET_ID, SHEETS.PHOTO_ASSESSMENT, API_KEY),
      ]);

    this.processData(
      scheduleData,
      historyData,
      regulationsData,
      photoAssessmentData,
    );

    if (
      !this.appData ||
      !this.appData.carsInfo ||
      Object.keys(this.appData.carsInfo).length === 0
    ) {
      throw new Error(
        'Дані не містять інформації про автомобілі. Перевірте аркуш "ГРАФІК ОБСЛУГОВУВАННЯ"',
      );
    }

    this.cacheData(this.appData);
  }

  async fetchSheetData(spreadsheetId, sheetName, apiKey) {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}?key=${apiKey}&t=${Date.now()}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      return data.values || [];
    } catch (error) {
      console.error(`❌ Помилка завантаження аркуша ${sheetName}:`, error);
      return null;
    }
  }

  processData(scheduleData, historyData, regulationsData, photoAssessmentData) {
    const result = DataProcessor.processData(
      scheduleData,
      historyData,
      regulationsData,
      photoAssessmentData,
      (value) => Formatters.parseNumber(value),
      (dateString) => Formatters.parseDate(dateString),
      (dateString) => Formatters.formatDate(dateString),
    );

    this.appData = result.appData;
    this.maintenanceRegulations = result.maintenanceRegulations;
  }

  cacheData(data) {
    CacheManager.cacheData(data);
  }

  async processCars() {
    if (!this.appData) {
      this.processedCars = [];
      return;
    }

    this.processedCars = CarProcessor.processCarData(
      this.appData,
      (partName, mileageDiff, daysDiff, carYear, carModel, license) =>
        this.getPartStatus(
          partName,
          mileageDiff,
          daysDiff,
          carYear,
          carModel,
          license,
        ),
      (license, model, year, partName) =>
        this.findRegulationForCar(license, model, year, partName),
    );
  }

  findRegulationForCar(license, model, year, partName) {
    return CarProcessor.findRegulationForCar(
      license,
      model,
      year,
      partName,
      this.maintenanceRegulations,
    );
  }

  getPartStatus(partName, mileageDiff, daysDiff, carYear, carModel, license) {
    return CarProcessor.getPartStatus(
      partName,
      mileageDiff,
      daysDiff,
      carYear,
      carModel,
      license,
      this.maintenanceRegulations,
      (license, model, year, partName, maintenanceRegulations) =>
        CarProcessor.findRegulationForCar(
          license,
          model,
          year,
          partName,
          maintenanceRegulations,
        ),
    );
  }

  populateFilters() {
    if (!this.appData) return;

    // Populate cities
    const cities = new Set();
    Object.values(this.appData.carsInfo || {}).forEach((car) => {
      if (car.city) cities.add(car.city);
    });
    const citySelect = document.getElementById("filter-city");
    if (citySelect) {
      citySelect.innerHTML = '<option value="all">Всі міста</option>';
      Array.from(cities)
        .sort()
        .forEach((city) => {
          const option = document.createElement("option");
          option.value = city;
          option.textContent = city;
          citySelect.appendChild(option);
        });
    }

    // Populate vehicles
    const vehicleSelect = document.getElementById("filter-vehicle");
    if (vehicleSelect) {
      vehicleSelect.innerHTML = '<option value="all">Всі авто</option>';
      Object.keys(this.appData.carsInfo || {})
        .sort()
        .forEach((license) => {
          const option = document.createElement("option");
          option.value = license;
          option.textContent = license;
          vehicleSelect.appendChild(option);
        });
    }

    // Populate brands - витягуємо марку з моделі
    const brands = new Set();
    // Використовуємо processedCars, якщо вони є, інакше carsInfo
    const carsToProcess =
      this.processedCars && this.processedCars.length > 0
        ? this.processedCars
        : Object.values(this.appData.carsInfo || {});

    carsToProcess.forEach((car) => {
      const model = car.model || "";
      if (model) {
        // Витягуємо марку як перше слово з моделі
        const brand = model.split(" ")[0].trim();
        if (brand) {
          brands.add(brand);
        }
      }
    });

    const brandSelect = document.getElementById("filter-brand");
    if (brandSelect) {
      brandSelect.innerHTML = '<option value="all">Всі марки</option>';
      Array.from(brands)
        .sort()
        .forEach((brand) => {
          const option = document.createElement("option");
          option.value = brand;
          option.textContent = brand;
          brandSelect.appendChild(option);
        });
    }

    // Populate years from records
    const years = new Set();
    (this.appData.records || []).forEach((record) => {
      if (record.date) {
        try {
          const recordDate = new Date(record.date);
          if (!isNaN(recordDate.getTime())) {
            years.add(recordDate.getFullYear());
          }
        } catch (e) {
          // Ignore invalid dates
        }
      }
    });
    const yearSelect = document.getElementById("filter-year");
    if (yearSelect) {
      yearSelect.innerHTML = '<option value="all">Всі роки</option>';
      Array.from(years)
        .sort((a, b) => b - a)
        .forEach((year) => {
          const option = document.createElement("option");
          option.value = year;
          option.textContent = year;
          yearSelect.appendChild(option);
        });
    }
  }

  applyFilters() {
    if (!this.appData || !this.processedCars) return;

    // Filter records
    let filteredRecords = this.appData.records || [];

    const periodRange = this.getPeriodRange(this.filters.period);
    if (periodRange) {
      filteredRecords = filteredRecords.filter((r) => {
        if (!r.isoDate) return false;
        const recordDate = new Date(r.isoDate);
        return recordDate >= periodRange.start && recordDate <= periodRange.end;
      });
    }
    // Якщо periodRange === null, використовуємо всі записи (для "Всі роки")

    if (this.filters.city !== "all") {
      filteredRecords = filteredRecords.filter(
        (r) => r.city === this.filters.city,
      );
    }

    if (this.filters.vehicle !== "all") {
      filteredRecords = filteredRecords.filter(
        (r) => r.car === this.filters.vehicle,
      );
    }

    // Filter cars
    let filteredCars = this.processedCars;
    if (this.filters.city !== "all") {
      filteredCars = filteredCars.filter((c) => c.city === this.filters.city);
    }
    if (this.filters.vehicle !== "all") {
      filteredCars = filteredCars.filter(
        (c) => c.license === this.filters.vehicle,
      );
    }
    if (this.filters.brand !== "all") {
      filteredCars = filteredCars.filter((c) => {
        const model = c.model || "";
        const brand = model.split(" ")[0].trim();
        return brand === this.filters.brand;
      });
    }

    this.filteredData = {
      records: filteredRecords,
      cars: filteredCars,
      periodRange: periodRange,
    };

    this.updateDateRange();
    this.renderAll();
  }

  getPeriodRange(period) {
    const now = new Date();
    const start = new Date();

    // Якщо вибрано конкретний рік у фільтрі, використовуємо його з урахуванням періоду
    if (this.filters.selectedYear) {
      const selectedYear = this.filters.selectedYear;

      // Для періодів День/Тиждень/Місяць/Квартал/Півроку при виборі конкретного року
      // повертаємо весь рік, щоб обчислити середні значення за період
      if (
        period === "day" ||
        period === "week" ||
        period === "month" ||
        period === "quarter" ||
        period === "halfyear"
      ) {
        start.setFullYear(selectedYear, 0, 1);
        start.setHours(0, 0, 0, 0);
        const end = new Date(selectedYear, 11, 31, 23, 59, 59, 999);
        return { start, end };
      }

      // Для періоду "Рік" - весь вибраний рік
      if (period === "year") {
        start.setFullYear(selectedYear, 0, 1);
        start.setHours(0, 0, 0, 0);
        const endYear = new Date(selectedYear, 11, 31, 23, 59, 59, 999);
        return { start, end: endYear };
      }

      // Для інших випадків
      start.setFullYear(selectedYear, 0, 1);
      start.setHours(0, 0, 0, 0);
      const endDefault = new Date(selectedYear, 11, 31, 23, 59, 59, 999);
      return { start, end: endDefault };
    }

    // Якщо вибрано "Всі роки" і період "Рік" - повертаємо null (всі дані для суми)
    if (period === "year") {
      return null;
    }

    // Якщо вибрано "Всі роки" і період День/Тиждень/Місяць/Квартал/Півроку - повертаємо null (всі дані для середніх)
    if (
      !this.filters.selectedYear &&
      (period === "day" ||
        period === "week" ||
        period === "month" ||
        period === "quarter" ||
        period === "halfyear")
    ) {
      return null;
    }

    // Якщо період "all", повертаємо null (всі дані)
    if (period === "all") {
      return null;
    }

    // Для інших випадків (не повинно досягатися, але на всяк випадок)
    start.setMonth(now.getMonth() - 1);
    start.setHours(0, 0, 0, 0);
    now.setHours(23, 59, 59, 999);

    return { start, end: now };
  }

  updateDateRange() {
    const dateRangeEl = document.getElementById("date-range");
    if (!dateRangeEl) return;

    const isAllYears = !this.filters.selectedYear;
    const isYearPeriod = this.filters.period === "year";
    const isAveragePeriod =
      isAllYears &&
      !isYearPeriod &&
      (this.filters.period === "day" ||
        this.filters.period === "week" ||
        this.filters.period === "month" ||
        this.filters.period === "quarter" ||
        this.filters.period === "halfyear");

    // Якщо вибрано конкретний рік у фільтрі
    if (this.filters.selectedYear) {
      const periodNames = {
        day: "День",
        week: "Тиждень",
        month: "Місяць",
        quarter: "Квартал",
        halfyear: "Півроку",
        year: "Рік",
      };
      const periodName = periodNames[this.filters.period] || "Період";
      dateRangeEl.textContent = `Період: ${periodName} ${this.filters.selectedYear}`;
    } else if (isAveragePeriod) {
      // Середні значення за всі роки
      const periodNames = {
        day: "День",
        week: "Тиждень",
        month: "Місяць",
        quarter: "Квартал",
        halfyear: "Півроку",
      };
      const periodName = periodNames[this.filters.period] || "Період";
      dateRangeEl.textContent = `Період: ${periodName} (середнє за всі роки)`;
    } else if (isAllYears && isYearPeriod) {
      // Сума за всі роки
      dateRangeEl.textContent = "Період: Рік (сума за всі роки)";
    } else if (this.filteredData?.periodRange) {
      const { start, end } = this.filteredData.periodRange;
      const formatDate = (d) =>
        d.toLocaleDateString("uk-UA", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
      dateRangeEl.textContent = `Період: ${formatDate(start)} - ${formatDate(end)}`;
    } else {
      dateRangeEl.textContent = "Період: Всі роки";
    }
  }

  renderAll() {
    this.renderMetrics();
    this.renderExpenses();
    this.renderMileage();
    this.renderRatings();
    this.renderBreakdown();
    this.renderRequests();
    this.renderForecast();
  }

  // ========== METRICS DASHBOARD ==========
  renderMetrics() {
    if (!this.filteredData) return;

    const records = this.filteredData.records;
    const previousPeriod = this.getPreviousPeriodData();

    // Визначаємо, чи потрібно обчислювати середні значення
    const isAllYears = !this.filters.selectedYear;
    const isYearPeriod = this.filters.period === "year";
    const isAveragePeriodAllYears =
      isAllYears &&
      !isYearPeriod &&
      (this.filters.period === "day" ||
        this.filters.period === "week" ||
        this.filters.period === "month" ||
        this.filters.period === "quarter" ||
        this.filters.period === "halfyear");
    const isAveragePeriodSelectedYear =
      !isAllYears &&
      !isYearPeriod &&
      (this.filters.period === "day" ||
        this.filters.period === "week" ||
        this.filters.period === "month" ||
        this.filters.period === "quarter" ||
        this.filters.period === "halfyear");

    let totalExpenses, repairCount, avgMileage, requestCount;

    if (isAveragePeriodAllYears) {
      // Для "Всі роки" і періодів День/Тиждень/Місяць/Квартал/Півроку:
      // ВSUMMARY CARDS ми показуємо ЗАГАЛЬНУ СУМУ за весь час (records вже відфільтровані applyFilters)
      // А для трендів/графіків за потреби можна використовувати середні.
      
      // Сума з ПДВ (без відмов вже враховано в DataProcessor при заповненні totalWithVAT)
      totalExpenses = records.reduce((sum, r) => sum + (r.totalWithVAT || 0), 0);
      
      // Кількість заявок (всі записи, включаючи відмови - як просив юзер)
      requestCount = records.length;
      
      // Ремонти - унікальні події ремонту за весь час
      repairCount = this.countUniqueRepairs(records);
      
      // Пробіг - розраховуємо через FleetStats (включає selectedYear)
      const fleetStats = this.calculateFleetMileageStats(this.filteredData.cars, this.filters.selectedYear);
      
      // Вибираємо значення пробігу залежно від періоду
      if (this.filters.period === "day") avgMileage = fleetStats.daily;
      else if (this.filters.period === "week") avgMileage = fleetStats.daily * 7;
      else if (this.filters.period === "month") avgMileage = fleetStats.monthly;
      else if (this.filters.period === "quarter") avgMileage = fleetStats.monthly * 3;
      else if (this.filters.period === "halfyear") avgMileage = fleetStats.monthly * 6;
      else if (this.filters.period === "year") avgMileage = fleetStats.yearly;
      else avgMileage = fleetStats.monthly;

      // Виводимо лог для перевірки
      console.log(`📊 Analytics Dashboard Stats:
        Records: ${requestCount}
        Total Exp: ${totalExpenses.toFixed(2)}
        Repair Count: ${repairCount}
        Avg Mileage: ${avgMileage}
      `);

    } else if (isAveragePeriodSelectedYear) {
      // Для конкретного року і періодів День/Тиждень/Місяць/Квартал/Півроку:
      // Витрати - СЕРЕДНЄ за період у вибраному році (наприклад, середнє за день)
      // Ремонти, Заявки - СЕРЕДНЄ за період у вибраному році (наприклад, середнє за день)
      // Пробіг - СЕРЕДНЄ за період у вибраному році (наприклад, середнє за день)
      // Використовуємо всі записи за вибраний рік (records вже відфільтровані)

      const selectedYear = this.filters.selectedYear;

      // Витрати - СЕРЕДНЄ за період
      totalExpenses = this.calculateAverageByPeriodForYear(
        records,
        this.filters.period,
        "expenses",
        selectedYear,
      );

      // Ремонти - СЕРЕДНЄ за період (унікальні ремонти)
      const avgRepairs = this.calculateAverageByPeriodForYearUniqueRepairs(
        records,
        this.filters.period,
        selectedYear,
      );
      repairCount = Math.round(avgRepairs);

      // Заявки - СЕРЕДНЄ за період (звичайно, кожен запис = одна заявка)
      const avgRequests = this.calculateAverageByPeriodForYear(
        records,
        this.filters.period,
        "count",
        selectedYear,
      );
      requestCount = Math.round(avgRequests);

      // Пробіг - розраховуємо через FleetStats (включає selectedYear)
      const fleetStats = this.calculateFleetMileageStats(this.filteredData.cars, this.filters.selectedYear);
      
      if (this.filters.period === "day") avgMileage = fleetStats.daily;
      else if (this.filters.period === "week") avgMileage = fleetStats.daily * 7;
      else if (this.filters.period === "month") avgMileage = fleetStats.monthly;
      else if (this.filters.period === "quarter") avgMileage = fleetStats.monthly * 3;
      else if (this.filters.period === "halfyear") avgMileage = fleetStats.monthly * 6;
      else if (this.filters.period === "year") avgMileage = fleetStats.yearly;
      else avgMileage = fleetStats.monthly;
    } else if (isAllYears && isYearPeriod) {
      // Сума за всі роки при виборі періоду "Рік"
      totalExpenses = records.reduce(
        (sum, r) => sum + (r.totalWithVAT || 0),
        0,
      );
      repairCount = this.countUniqueRepairs(records); // Унікальні ремонти
      // Пробіг - розраховуємо через FleetStats (включає selectedYear)
      const fleetStats = this.calculateFleetMileageStats(this.filteredData.cars, this.filters.selectedYear);
      avgMileage = fleetStats.yearly;
      requestCount = records.length; // Звичайна кількість записів
    } else {
      // Конкретні значення за вибраний рік (період "Рік")
      // Витрати - СУМА за весь рік
      // Ремонти - КІЛЬКІСТЬ унікальних ремонтів за весь рік
      // Заявки - КІЛЬКІСТЬ записів за весь рік
      // Пробіг - СЕРЕДНЄ за весь рік
      totalExpenses = records.reduce(
        (sum, r) => sum + (r.totalWithVAT || 0),
        0,
      );
      repairCount = this.countUniqueRepairs(records); // Унікальні ремонти
      // Пробіг - розраховуємо через FleetStats (включає selectedYear)
      const fleetStats = this.calculateFleetMileageStats(this.filteredData.cars, this.filters.selectedYear);
      avgMileage = fleetStats.yearly;
      requestCount = records.length; // Звичайна кількість записів
    }

    // avgMileage вже розраховано вище в кожному блоці з урахуванням року

    const previousExpenses = previousPeriod.reduce(
      (sum, r) => sum + (r.totalWithVAT || 0),
      0,
    );
    const expenseTrend = // Renamed from expensesTrend
      previousExpenses > 0
        ? (
          ((totalExpenses - previousExpenses) / previousExpenses) *
          100
        ).toFixed(1)
        : 0;

    const previousRepairCount = this.countUniqueRepairs(previousPeriod);
    const repairTrend =
      previousRepairCount > 0
        ? (
          ((repairCount - previousRepairCount) / previousRepairCount) *
          100
        ).toFixed(1)
        : 0;

    // Тренд пробігу розрахувати складніше з новим алгоритмом, але можна залишити старий метод розрахунку для тренду
    const previousAvgMileage = this.calculateAvgMileage(previousPeriod);
    let mileageTrend = 0;
    // ...
    
    // Щоб не ускладнювати, залишимо trend = 0 для нового пробігу, 
    // або використаємо старий this.calculateAvgMileage(records) тільки для обчислення тренду.
    const oldAvgMileage = this.calculateAvgMileage(records);
    mileageTrend =
      previousAvgMileage > 0
        ? (
          ((oldAvgMileage - previousAvgMileage) / previousAvgMileage) *
          100
        ).toFixed(1)
        : 0;

    const previousRequestCount = previousPeriod.length; // Заявки рахуються звичайно
    const requestTrend =
      previousRequestCount > 0
        ? (
          ((requestCount - previousRequestCount) / previousRequestCount) *
          100
        ).toFixed(1)
        : 0;

    const carCount = new Set(records.map(r => r.car)).size;

    const html = `
            <div class="metric-card card-green">
                <div class="flex items-center gap-2 mb-2">
                    <span class="text-xl">💰</span>
                    <h3 class="text-sm font-semibold text-gray-600">Витрати</h3>
                </div>
                <div class="text-2xl font-bold text-gray-800 mb-1">${this.formatCurrency(totalExpenses)}</div>
                <div class="flex items-center gap-1 text-xs ${expenseTrend >= 0 ? "text-red-600" : "text-green-600"}">
                    <span>${expenseTrend >= 0 ? "↑" : "↓"} ${Math.abs(expenseTrend)}% vs мин.</span>
                </div>
            </div>
            <div class="metric-card card-blue">
                <div class="flex items-center gap-2 mb-2">
                    <span class="text-xl">🔧</span>
                    <h3 class="text-sm font-semibold text-gray-600">Ремонтів</h3>
                </div>
                <div class="text-2xl font-bold text-gray-800 mb-1">${repairCount}</div>
                <div class="flex items-center gap-1 text-xs ${repairTrend >= 0 ? "text-red-600" : "text-green-600"}">
                    <span>${repairTrend >= 0 ? "↑" : "↓"} ${Math.abs(repairTrend)}% vs мин.</span>
                </div>
            </div>
            <div class="metric-card card-purple">
                <div class="flex items-center gap-2 mb-2">
                    <span class="text-xl">📏</span>
                    <h3 class="text-sm font-semibold text-gray-600">Середній пробіг</h3>
                </div>
                <div class="text-2xl font-bold text-gray-800 mb-1">${this.formatMileage(avgMileage)}/${this.filters.period === "day" ? "день" : this.filters.period === "week" ? "тиждень" : this.filters.period === "month" ? "міс" : this.filters.period === "quarter" ? "кварт" : this.filters.period === "halfyear" ? "півріч" : "рік"}</div>
                <div class="flex items-center gap-1 text-xs ${mileageTrend >= 0 ? "text-green-600" : "text-red-600"}">
                    <span>${mileageTrend >= 0 ? "↑" : "↓"} ${Math.abs(mileageTrend)}% vs серед.</span>
                </div>
            </div>
            <div class="metric-card card-orange">
                <div class="flex items-center gap-2 mb-2">
                    <span class="text-xl">📋</span>
                    <h3 class="text-sm font-semibold text-gray-600">Заявок</h3>
                </div>
                <div class="text-2xl font-bold text-gray-800 mb-1">${requestCount}</div>
                <div class="flex items-center gap-1 text-xs ${requestTrend >= 0 ? "text-red-600" : "text-green-600"}">
                    <span>${requestTrend >= 0 ? "↑" : "↓"} ${Math.abs(requestTrend)}% vs мин.</span>
                </div>
            </div>
            <div class="metric-card card-teal">
                <div class="flex items-center gap-2 mb-2">
                    <span class="text-xl">🚗</span>
                    <h3 class="text-sm font-semibold text-gray-600">Кількість авто</h3>
                </div>
                <div class="text-2xl font-bold text-gray-800 mb-1">${carCount}</div>
                <div class="flex items-center gap-1 text-xs text-gray-500">
                    <span>Активний флот</span>
                </div>
            </div>
        `;

    document.getElementById("metrics-dashboard").innerHTML = html;
  }

  getPreviousPeriodData() {
    if (!this.appData) return [];

    // Якщо periodRange === null (всі роки), не показуємо попередній період
    if (!this.filteredData?.periodRange) return [];

    const { start, end } = this.filteredData.periodRange;
    const periodLength = end.getTime() - start.getTime();
    const previousStart = new Date(start.getTime() - periodLength);
    const previousEnd = new Date(start.getTime() - 1);

    return (this.appData.records || []).filter((r) => {
      if (!r.date) return false;
      const recordDate = new Date(r.date);
      return recordDate >= previousStart && recordDate <= previousEnd;
    });
  }

  calculateAvgMileage(records) {
    // Вже не використовується напряму, але залишаємо для сумісності з іншими функціями, 
    // якщо вони його використовують (напр. у calculateAverageByPeriod)
    return this.calcMileageForRecords(records);
  }

  // --- НОВІ ФУНКЦІЇ ДЛЯ ПРОБІГУ ---

  countWorkingDays(startDate, endDate) {
    if (!startDate || !endDate) return 0;

    let workingDays = 0;
    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    while (currentDate <= end) {
      const dayOfWeek = currentDate.getDay(); // 0 = неділя, 1 = понеділок, ..., 6 = субота
      // Враховуємо тільки дні з понеділка (1) по суботу (6)
      if (dayOfWeek >= 1 && dayOfWeek <= 6) {
        workingDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return workingDays;
  }

  getAverageMonthlyMileage(car, selectedYear) {
    if (!car || !car.history || car.history.length < 2) return 1000; // За замовчуванням

    const parseDateFunc = Formatters && Formatters.parseDate ? Formatters.parseDate : (d) => new Date(d);
    const now = new Date();
    
    // Якщо вибрано конкретний рік (і це не поточний рік)
    if (selectedYear && selectedYear !== now.getFullYear()) {
      // Фільтруємо історію за вибраний рік
      const yearHistory = car.history.filter((record) => {
        const recordDate = parseDateFunc(record.date);
        return recordDate && !isNaN(recordDate.getTime()) && recordDate.getFullYear() === selectedYear;
      }).sort((a, b) => {
        const dateA = parseDateFunc(a.date) || new Date(0);
        const dateB = parseDateFunc(b.date) || new Date(0);
        return dateA - dateB;
      });

      if (yearHistory.length < 2) return 0; // Немає даних за цей рік

      const firstRecord = yearHistory[0];
      const lastRecord = yearHistory[yearHistory.length - 1];
      const firstDate = parseDateFunc(firstRecord.date);
      const lastDate = parseDateFunc(lastRecord.date);

      if (!firstDate || !lastDate) return 0;

      const workingDays = this.countWorkingDays(firstDate, lastDate);
      if (workingDays <= 0) return 0;

      const mileageDiff = lastRecord.mileage - firstRecord.mileage;
      if (mileageDiff <= 0) return 0;

      const avgMileagePerWorkingDay = mileageDiff / workingDays;
      return avgMileagePerWorkingDay * 26; // ~26 робочих днів на місяць
    }

    // Для поточного року або коли рік не вибрано, використовуємо 5.5 місяців
    const fiveAndHalfMonthsAgo = new Date(
      now.getFullYear(),
      now.getMonth() - 5,
      now.getDate() - 15,
    );

    // Фільтруємо історію за останні 5-6 місяців
    const recentHistory = car.history.filter((record) => {
      const recordDate = parseDateFunc(record.date);
      if (!recordDate || isNaN(recordDate.getTime())) return false;
      return recordDate >= fiveAndHalfMonthsAgo;
    });

    if (recentHistory.length < 2) {
      // Якщо немає достатньо даних за останні 5-6 місяців, використовуємо всі дані
      const sortedHistory = [...car.history].sort((a, b) => {
        const dateA = parseDateFunc(a.date) || new Date(0);
        const dateB = parseDateFunc(b.date) || new Date(0);
        return dateA - dateB;
      });

      if (sortedHistory.length < 2) return 1000;

      const firstRecord = sortedHistory[0];
      const lastRecord = sortedHistory[sortedHistory.length - 1];
      const firstDate = parseDateFunc(firstRecord.date);
      const lastDate = parseDateFunc(lastRecord.date);

      if (!firstDate || !lastDate) return 1000;

      const workingDays = this.countWorkingDays(firstDate, lastDate);
      if (workingDays <= 0) return 1000;

      const mileageDiff = lastRecord.mileage - firstRecord.mileage;
      if (mileageDiff <= 0) return 1000;

      const avgMileagePerWorkingDay = mileageDiff / workingDays;
      return avgMileagePerWorkingDay * 26;
    }

    // Сортуємо записи за датою
    const sortedRecentHistory = [...recentHistory].sort((a, b) => {
      const dateA = parseDateFunc(a.date) || new Date(0);
      const dateB = parseDateFunc(b.date) || new Date(0);
      return dateA - dateB;
    });

    const firstRecord = sortedRecentHistory[0];
    const lastRecord = sortedRecentHistory[sortedRecentHistory.length - 1];
    const firstDate = parseDateFunc(firstRecord.date);
    const lastDate = parseDateFunc(lastRecord.date);
    const endDate = lastDate > now ? now : lastDate;

    if (!firstDate || !endDate) return 1000;

    const workingDays = this.countWorkingDays(firstDate, endDate);
    if (workingDays <= 0) return 1000;

    const mileageDiff = lastRecord.mileage - firstRecord.mileage;
    if (mileageDiff <= 0) return 1000;

    const avgMileagePerWorkingDay = mileageDiff / workingDays;
    return avgMileagePerWorkingDay * 26;
  }

  calculateCarAgeMonths(car) {
    if (!car || !car.year) return 0;
    const now = new Date();
    const carDate = new Date(parseInt(car.year), 0, 1);
    const monthsDiff =
      (now.getFullYear() - carDate.getFullYear()) * 12 +
      (now.getMonth() - carDate.getMonth());
    return Math.max(0, monthsDiff);
  }

  formatCarAge(months) {
    if (!months || months === 0) return "-";
    const years = Math.floor(months / 12);
    const remainingMonths = Math.floor(months % 12);
    
    // Функція для визначення схиляння слова "рік"
    const getAgeLabel = (y) => {
      const lastDigit = y % 10;
      const lastTwoDigits = y % 100;
      if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return "років";
      if (lastDigit === 1) return "рік";
      if (lastDigit >= 2 && lastDigit <= 4) return "роки";
      return "років";
    };

    if (years === 0) {
      return `${remainingMonths} міс`;
    } else if (remainingMonths === 0) {
      return `${years} ${getAgeLabel(years)}`;
    } else {
      return `${years} ${getAgeLabel(years)} ${remainingMonths} міс`;
    }
  }

  calculateFleetMileageStats(cars, selectedYear) {
    if (!cars || cars.length === 0) {
      return { daily: 0, monthly: 0, yearly: 0, total: 0, avgAgeMonths: 0, avgHealthScore: 0 };
    }

    let sumDaily = 0;
    let sumMonthly = 0;
    let sumYearly = 0;
    let sumTotal = 0;
    let sumAgeMonths = 0;
    let sumHealthScore = 0;
    let carsWithAge = 0;

    cars.forEach(car => {
      const monthly = this.getAverageMonthlyMileage(car, selectedYear);
      sumMonthly += monthly;
      sumDaily += (monthly / 26);
      sumYearly += (monthly * 12);
      sumTotal += (car.currentMileage || 0);

      const ageMonths = this.calculateCarAgeMonths(car);
      if (ageMonths > 0) {
        sumAgeMonths += ageMonths;
        carsWithAge++;
      }

      // Обчислюємо health score для кожного авто
      const score = StatsCalculator.calculateHealthScore(
        car, 
        this.maintenanceRegulations, 
        (l, m, y, p) => CarProcessor.findRegulationForCar(l, m, y, p, this.maintenanceRegulations)
      );
      sumHealthScore += score;
    });

    return {
      daily: Math.round(sumDaily),
      monthly: Math.round(sumMonthly),
      yearly: Math.round(sumYearly),
      total: sumTotal,
      avgAgeMonths: carsWithAge > 0 ? sumAgeMonths / carsWithAge : 0,
      avgHealthScore: Math.round(sumHealthScore / cars.length)
    };
  }

  // --- КІНЕЦЬ НОВИХ ФУНКЦІЙ ДЛЯ ПРОБІГУ ---

  /**
   * Рахує кількість унікальних ремонтів (одне авто в один день = один ремонт)

   * @param {Array} records - Масив записів
   * @returns {number} Кількість унікальних ремонтів
   */
  countUniqueRepairs(records) {
    if (!records || records.length === 0) return 0;

    const uniqueRepairs = new Set();
    records.forEach((r) => {
      if (!r.isoDate || !r.car) return;
      const recordDate = new Date(r.isoDate);
      if (isNaN(recordDate.getTime())) return;

      // Створюємо ключ: дата + авто (формат: YYYY-MM-DD_license)
      const dateKey = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, "0")}-${String(recordDate.getDate()).padStart(2, "0")}`;
      const repairKey = `${dateKey}_${r.car}`;
      uniqueRepairs.add(repairKey);
    });

    return uniqueRepairs.size;
  }

  /**
   * Обчислює середнє значення унікальних ремонтів за всі роки для конкретного періоду
   * @param {Array} allRecords - Всі записи
   * @param {string} period - Період (day, week, month, quarter, halfyear)
   * @returns {number} Середнє значення
   */
  calculateAverageByPeriodUniqueRepairs(allRecords, period) {
    if (!allRecords || allRecords.length === 0) return 0;

    // Отримуємо всі унікальні роки
    const years = new Set();
    allRecords.forEach((r) => {
      if (r.isoDate) {
        const date = new Date(r.isoDate);
        if (!isNaN(date.getTime())) {
          years.add(date.getFullYear());
        }
      }
    });

    if (years.size === 0) return 0;

    const yearValues = [];

    // Для кожного року обчислюємо кількість унікальних ремонтів за відповідний період
    years.forEach((year) => {
      const yearRecords = allRecords.filter((r) => {
        if (!r.isoDate) return false;
        const recordDate = new Date(r.isoDate);
        return recordDate.getFullYear() === year;
      });

      let value = 0;

      if (period === "day") {
        // Групуємо записи по днях і рахуємо унікальні ремонти за день
        const dailyRepairs = {};
        yearRecords.forEach((r) => {
          if (!r.isoDate || !r.car) return;
          const recordDate = new Date(r.isoDate);
          const dayKey = `${year}-${String(recordDate.getMonth() + 1).padStart(2, "0")}-${String(recordDate.getDate()).padStart(2, "0")}`;
          if (!dailyRepairs[dayKey]) {
            dailyRepairs[dayKey] = new Set();
          }
          dailyRepairs[dayKey].add(`${dayKey}_${r.car}`);
        });
        const dayCounts = Object.values(dailyRepairs).map(
          (daySet) => daySet.size,
        );
        value =
          dayCounts.length > 0
            ? dayCounts.reduce((sum, count) => sum + count, 0) /
            dayCounts.length
            : 0;
      } else if (period === "week") {
        // Групуємо записи по тижнях і рахуємо унікальні ремонти за тиждень
        const weeklyRepairs = {};
        yearRecords.forEach((r) => {
          if (!r.isoDate || !r.car) return;
          const recordDate = new Date(r.isoDate);
          const weekNumber = this.getWeekNumber(recordDate);
          const weekKey = `${year}-W${String(weekNumber).padStart(2, "0")}`;
          if (!weeklyRepairs[weekKey]) {
            weeklyRepairs[weekKey] = new Set();
          }
          const dateKey = `${year}-${String(recordDate.getMonth() + 1).padStart(2, "0")}-${String(recordDate.getDate()).padStart(2, "0")}`;
          weeklyRepairs[weekKey].add(`${dateKey}_${r.car}`);
        });
        const weekCounts = Object.values(weeklyRepairs).map(
          (weekSet) => weekSet.size,
        );
        value =
          weekCounts.length > 0
            ? weekCounts.reduce((sum, count) => sum + count, 0) /
            weekCounts.length
            : 0;
      } else if (period === "month") {
        // Групуємо записи по місяцях і рахуємо унікальні ремонти за місяць
        const monthlyRepairs = {};
        yearRecords.forEach((r) => {
          if (!r.isoDate || !r.car) return;
          const recordDate = new Date(r.isoDate);
          const monthKey = `${year}-${String(recordDate.getMonth() + 1).padStart(2, "0")}`;
          if (!monthlyRepairs[monthKey]) {
            monthlyRepairs[monthKey] = new Set();
          }
          const dateKey = `${year}-${String(recordDate.getMonth() + 1).padStart(2, "0")}-${String(recordDate.getDate()).padStart(2, "0")}`;
          monthlyRepairs[monthKey].add(`${dateKey}_${r.car}`);
        });
        const monthCounts = Object.values(monthlyRepairs).map(
          (monthSet) => monthSet.size,
        );
        value =
          monthCounts.length > 0
            ? monthCounts.reduce((sum, count) => sum + count, 0) /
            monthCounts.length
            : 0;
      } else if (period === "quarter") {
        // Групуємо записи по кварталах і рахуємо унікальні ремонти за квартал
        const quarterlyRepairs = {};
        yearRecords.forEach((r) => {
          if (!r.isoDate || !r.car) return;
          const recordDate = new Date(r.isoDate);
          const quarter = Math.floor(recordDate.getMonth() / 3) + 1;
          const quarterKey = `${year}-Q${quarter}`;
          if (!quarterlyRepairs[quarterKey]) {
            quarterlyRepairs[quarterKey] = new Set();
          }
          const dateKey = `${year}-${String(recordDate.getMonth() + 1).padStart(2, "0")}-${String(recordDate.getDate()).padStart(2, "0")}`;
          quarterlyRepairs[quarterKey].add(`${dateKey}_${r.car}`);
        });
        const quarterCounts = Object.values(quarterlyRepairs).map(
          (quarterSet) => quarterSet.size,
        );
        value =
          quarterCounts.length > 0
            ? quarterCounts.reduce((sum, count) => sum + count, 0) /
            quarterCounts.length
            : 0;
      } else if (period === "halfyear") {
        // Групуємо записи по півріччях і рахуємо унікальні ремонти за півроку
        const halfYearRepairs = {};
        yearRecords.forEach((r) => {
          if (!r.isoDate || !r.car) return;
          const recordDate = new Date(r.isoDate);
          const halfYear = recordDate.getMonth() < 6 ? 1 : 2;
          const halfYearKey = `${year}-H${halfYear}`;
          if (!halfYearRepairs[halfYearKey]) {
            halfYearRepairs[halfYearKey] = new Set();
          }
          const dateKey = `${year}-${String(recordDate.getMonth() + 1).padStart(2, "0")}-${String(recordDate.getDate()).padStart(2, "0")}`;
          halfYearRepairs[halfYearKey].add(`${dateKey}_${r.car}`);
        });
        const halfYearCounts = Object.values(halfYearRepairs).map(
          (halfYearSet) => halfYearSet.size,
        );
        value =
          halfYearCounts.length > 0
            ? halfYearCounts.reduce((sum, count) => sum + count, 0) /
            halfYearCounts.length
            : 0;
      }

      yearValues.push(value);
    });

    // Повертаємо середнє значення по всіх роках
    if (yearValues.length === 0) return 0;
    const sum = yearValues.reduce((a, b) => a + b, 0);
    return sum / yearValues.length;
  }

  /**
   * Обчислює середнє значення унікальних ремонтів за період у конкретному році
   * @param {Array} yearRecords - Записи за конкретний рік
   * @param {string} period - Період (day, week, month, quarter, halfyear)
   * @param {number} year - Рік
   * @returns {number} Середнє значення
   */
  calculateAverageByPeriodForYearUniqueRepairs(yearRecords, period, year) {
    if (!yearRecords || yearRecords.length === 0) return 0;

    let value = 0;

    if (period === "day") {
      // Групуємо записи по днях і рахуємо унікальні ремонти за день
      const dailyRepairs = {};
      yearRecords.forEach((r) => {
        if (!r.isoDate || !r.car) return;
        const recordDate = new Date(r.isoDate);
        const dayKey = `${year}-${String(recordDate.getMonth() + 1).padStart(2, "0")}-${String(recordDate.getDate()).padStart(2, "0")}`;
        if (!dailyRepairs[dayKey]) {
          dailyRepairs[dayKey] = new Set();
        }
        dailyRepairs[dayKey].add(`${dayKey}_${r.car}`);
      });
      const dayCounts = Object.values(dailyRepairs).map(
        (daySet) => daySet.size,
      );
      value =
        dayCounts.length > 0
          ? dayCounts.reduce((sum, count) => sum + count, 0) / dayCounts.length
          : 0;
    } else if (period === "week") {
      // Групуємо записи по тижнях і рахуємо унікальні ремонти за тиждень
      const weeklyRepairs = {};
      yearRecords.forEach((r) => {
        if (!r.isoDate || !r.car) return;
        const recordDate = new Date(r.isoDate);
        const weekNumber = this.getWeekNumber(recordDate);
        const weekKey = `${year}-W${String(weekNumber).padStart(2, "0")}`;
        if (!weeklyRepairs[weekKey]) {
          weeklyRepairs[weekKey] = new Set();
        }
        const dateKey = `${year}-${String(recordDate.getMonth() + 1).padStart(2, "0")}-${String(recordDate.getDate()).padStart(2, "0")}`;
        weeklyRepairs[weekKey].add(`${dateKey}_${r.car}`);
      });
      const weekCounts = Object.values(weeklyRepairs).map(
        (weekSet) => weekSet.size,
      );
      value =
        weekCounts.length > 0
          ? weekCounts.reduce((sum, count) => sum + count, 0) /
          weekCounts.length
          : 0;
    } else if (period === "month") {
      // Групуємо записи по місяцях і рахуємо унікальні ремонти за місяць
      const monthlyRepairs = {};
      yearRecords.forEach((r) => {
        if (!r.isoDate || !r.car) return;
        const recordDate = new Date(r.isoDate);
        const monthKey = `${year}-${String(recordDate.getMonth() + 1).padStart(2, "0")}`;
        if (!monthlyRepairs[monthKey]) {
          monthlyRepairs[monthKey] = new Set();
        }
        const dateKey = `${year}-${String(recordDate.getMonth() + 1).padStart(2, "0")}-${String(recordDate.getDate()).padStart(2, "0")}`;
        monthlyRepairs[monthKey].add(`${dateKey}_${r.car}`);
      });
      const monthCounts = Object.values(monthlyRepairs).map(
        (monthSet) => monthSet.size,
      );
      value =
        monthCounts.length > 0
          ? monthCounts.reduce((sum, count) => sum + count, 0) /
          monthCounts.length
          : 0;
    } else if (period === "quarter") {
      // Групуємо записи по кварталах і рахуємо унікальні ремонти за квартал
      const quarterlyRepairs = {};
      yearRecords.forEach((r) => {
        if (!r.isoDate || !r.car) return;
        const recordDate = new Date(r.isoDate);
        const quarter = Math.floor(recordDate.getMonth() / 3) + 1;
        const quarterKey = `${year}-Q${quarter}`;
        if (!quarterlyRepairs[quarterKey]) {
          quarterlyRepairs[quarterKey] = new Set();
        }
        const dateKey = `${year}-${String(recordDate.getMonth() + 1).padStart(2, "0")}-${String(recordDate.getDate()).padStart(2, "0")}`;
        quarterlyRepairs[quarterKey].add(`${dateKey}_${r.car}`);
      });
      const quarterCounts = Object.values(quarterlyRepairs).map(
        (quarterSet) => quarterSet.size,
      );
      value =
        quarterCounts.length > 0
          ? quarterCounts.reduce((sum, count) => sum + count, 0) /
          quarterCounts.length
          : 0;
    } else if (period === "halfyear") {
      // Групуємо записи по півріччях і рахуємо унікальні ремонти за півроку
      const halfYearRepairs = {};
      yearRecords.forEach((r) => {
        if (!r.isoDate || !r.car) return;
        const recordDate = new Date(r.isoDate);
        const halfYear = recordDate.getMonth() < 6 ? 1 : 2;
        const halfYearKey = `${year}-H${halfYear}`;
        if (!halfYearRepairs[halfYearKey]) {
          halfYearRepairs[halfYearKey] = new Set();
        }
        const dateKey = `${year}-${String(recordDate.getMonth() + 1).padStart(2, "0")}-${String(recordDate.getDate()).padStart(2, "0")}`;
        halfYearRepairs[halfYearKey].add(`${dateKey}_${r.car}`);
      });
      const halfYearCounts = Object.values(halfYearRepairs).map(
        (halfYearSet) => halfYearSet.size,
      );
      value =
        halfYearCounts.length > 0
          ? halfYearCounts.reduce((sum, count) => sum + count, 0) /
          halfYearCounts.length
          : 0;
    }

    return value;
  }

  /**
   * Обчислює середні значення за всі роки для конкретного періоду
   * @param {Array} allRecords - Всі записи
   * @param {string} period - Період (day, week, month, quarter, halfyear)
   * @param {string} type - Тип обчислення ('expenses', 'count', 'mileage')
   * @returns {number} Середнє значення
   */
  calculateAverageByPeriod(allRecords, period, type) {
    if (!allRecords || allRecords.length === 0) return 0;

    // Отримуємо всі унікальні роки
    const years = new Set();
    allRecords.forEach((r) => {
      if (r.isoDate) {
        const date = new Date(r.isoDate);
        if (!isNaN(date.getTime())) {
          years.add(date.getFullYear());
        }
      }
    });

    if (years.size === 0) return 0;

    const yearValues = [];

    // Для кожного року обчислюємо значення за відповідний період
    years.forEach((year) => {
      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

      let value = 0;

      if (period === "day") {
        // Для дня: обчислюємо середнє значення за всі дні року
        // Групуємо записи по днях і обчислюємо середнє значення за день
        const dailyValues = {};
        allRecords.forEach((r) => {
          if (!r.isoDate) return;
          const recordDate = new Date(r.isoDate);
          if (recordDate.getFullYear() === year) {
            const dayKey = `${year}-${String(recordDate.getMonth() + 1).padStart(2, "0")}-${String(recordDate.getDate()).padStart(2, "0")}`;
            if (!dailyValues[dayKey]) {
              dailyValues[dayKey] = {
                expenses: 0,
                count: 0,
                recs: [],
              };
            }
            dailyValues[dayKey].expenses += r.totalWithVAT || 0;
            dailyValues[dayKey].count += 1;
            dailyValues[dayKey].recs.push(r);
          }
        });

        const dayValues = Object.values(dailyValues);
        if (dayValues.length > 0) {
          if (type === "expenses") {
            value =
              dayValues.reduce((sum, d) => sum + d.expenses, 0) /
              dayValues.length;
          } else if (type === "count") {
            value =
              dayValues.reduce((sum, d) => sum + d.count, 0) / dayValues.length;
          } else if (type === "mileage") {
            const vals = dayValues.map(d => this.calcMileageForRecords(d.recs)).filter(v => v > 0);
            value = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
          }
        }
      } else if (period === "week") {
        // Для тижня: обчислюємо середнє значення за всі тижні року
        // Групуємо записи по тижнях (ISO week number)
        const weeklyValues = {};
        allRecords.forEach((r) => {
          if (!r.isoDate) return;
          const recordDate = new Date(r.isoDate);
          if (recordDate.getFullYear() === year) {
            // Отримуємо номер тижня
            const weekNumber = this.getWeekNumber(recordDate);
            const weekKey = `${year}-W${String(weekNumber).padStart(2, "0")}`;
            if (!weeklyValues[weekKey]) {
              weeklyValues[weekKey] = {
                expenses: 0,
                count: 0,
                recs: [],
              };
            }
            weeklyValues[weekKey].expenses += r.totalWithVAT || 0;
            weeklyValues[weekKey].count += 1;
            weeklyValues[weekKey].recs.push(r);
          }
        });

        const weekValues = Object.values(weeklyValues);
        if (weekValues.length > 0) {
          if (type === "expenses") {
            value =
              weekValues.reduce((sum, w) => sum + w.expenses, 0) /
              weekValues.length;
          } else if (type === "count") {
            value =
              weekValues.reduce((sum, w) => sum + w.count, 0) /
              weekValues.length;
          } else if (type === "mileage") {
            const vals = weekValues.map(w => this.calcMileageForRecords(w.recs)).filter(v => v > 0);
            value = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
          }
        }
      } else {
        // Для місяця, кварталу, півроку, року - використовуємо попередню логіку
        let periodStart, periodEnd;
        switch (period) {
          case "month":
            periodStart = new Date(year, 11, 1);
            periodEnd = new Date(year, 11, 31, 23, 59, 59, 999);
            break;
          case "quarter":
            periodStart = new Date(year, 9, 1);
            periodEnd = new Date(year, 11, 31, 23, 59, 59, 999);
            break;
          case "halfyear":
            periodStart = new Date(year, 6, 1);
            periodEnd = new Date(year, 11, 31, 23, 59, 59, 999);
            break;
          case "year":
            periodStart = yearStart;
            periodEnd = yearEnd;
            break;
          default:
            periodStart = yearStart;
            periodEnd = yearEnd;
        }

        // Фільтруємо записи за періодом у межах року
        const periodRecords = allRecords.filter((r) => {
          if (!r.isoDate) return false;
          const recordDate = new Date(r.isoDate);
          return recordDate >= periodStart && recordDate <= periodEnd;
        });

        // Обчислюємо значення для цього року
        if (type === "expenses") {
          value = periodRecords.reduce(
            (sum, r) => sum + (r.totalWithVAT || 0),
            0,
          );
        } else if (type === "count") {
          value = periodRecords.length;
        } else if (type === "mileage") {
          value = this.calculateAvgMileage(periodRecords);
        }
      }

      yearValues.push(value);
    });

    // Повертаємо середнє значення по всіх роках
    if (yearValues.length === 0) return 0;
    const sum = yearValues.reduce((a, b) => a + b, 0);
    return sum / yearValues.length;
  }

  /**
   * Обчислює середні значення за період у конкретному році
   * @param {Array} yearRecords - Записи за конкретний рік
   * @param {string} period - Період (day, week, month, quarter, halfyear)
   * @param {string} type - Тип обчислення ('expenses', 'count', 'mileage')
   * @param {number} year - Рік
   * @returns {number} Середнє значення
   */
  calculateAverageByPeriodForYear(yearRecords, period, type, year) {
    if (!yearRecords || yearRecords.length === 0) return 0;

    let value = 0;

    if (period === "day") {
      const dailyValues = {};
      yearRecords.forEach((r) => {
        if (!r.isoDate) return;
        const recordDate = new Date(r.isoDate);
        if (recordDate.getFullYear() === year) {
          const dayKey = `${year}-${String(recordDate.getMonth() + 1).padStart(2, "0")}-${String(recordDate.getDate()).padStart(2, "0")}`;
          if (!dailyValues[dayKey]) {
            dailyValues[dayKey] = {
              expenses: 0,
              count: 0,
              recs: [],
            };
          }
          dailyValues[dayKey].expenses += r.totalWithVAT || 0;
          dailyValues[dayKey].count += 1;
          dailyValues[dayKey].recs.push(r);
        }
      });

      const dayValues = Object.values(dailyValues);
      if (dayValues.length > 0) {
        if (type === "expenses") {
          value =
            dayValues.reduce((sum, d) => sum + d.expenses, 0) /
            dayValues.length;
        } else if (type === "count") {
          value =
            dayValues.reduce((sum, d) => sum + d.count, 0) / dayValues.length;
        } else if (type === "mileage") {
          const vals = dayValues.map(d => this.calcMileageForRecords(d.recs)).filter(v => v > 0);
          value = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        }
      }
    } else if (period === "week") {
      // Обчислюємо середнє значення за всі тижні року
      const weeklyValues = {};
      yearRecords.forEach((r) => {
        if (!r.isoDate) return;
        const recordDate = new Date(r.isoDate);
        if (recordDate.getFullYear() === year) {
          const weekNumber = this.getWeekNumber(recordDate);
          const weekKey = `${year}-W${String(weekNumber).padStart(2, "0")}`;
          if (!weeklyValues[weekKey]) {
            weeklyValues[weekKey] = {
              expenses: 0,
              count: 0,
              mileage: 0,
              mileageCount: 0,
            };
          }
          weeklyValues[weekKey].expenses += r.totalWithVAT || 0;
          weeklyValues[weekKey].count += 1;
          if (r.mileage) {
            weeklyValues[weekKey].mileage += r.mileage;
            weeklyValues[weekKey].mileageCount += 1;
          }
        }
      });

      const weekValues = Object.values(weeklyValues);
      if (weekValues.length > 0) {
        if (type === "expenses") {
          value =
            weekValues.reduce((sum, w) => sum + w.expenses, 0) /
            weekValues.length;
        } else if (type === "count") {
          value =
            weekValues.reduce((sum, w) => sum + w.count, 0) / weekValues.length;
        } else if (type === "mileage") {
          const totalMileage = weekValues.reduce(
            (sum, w) =>
              sum + (w.mileageCount > 0 ? w.mileage / w.mileageCount : 0),
            0,
          );
          value = totalMileage / weekValues.length;
        }
      }
    } else if (period === "month") {
      const monthlyValues = {};
      yearRecords.forEach((r) => {
        if (!r.isoDate) return;
        const recordDate = new Date(r.isoDate);
        if (recordDate.getFullYear() === year) {
          const monthKey = `${year}-${String(recordDate.getMonth() + 1).padStart(2, "0")}`;
          if (!monthlyValues[monthKey]) {
            monthlyValues[monthKey] = {
              expenses: 0,
              count: 0,
              recs: [],
            };
          }
          monthlyValues[monthKey].expenses += r.totalWithVAT || 0;
          monthlyValues[monthKey].count += 1;
          monthlyValues[monthKey].recs.push(r);
        }
      });

      const monthValues = Object.values(monthlyValues);
      if (monthValues.length > 0) {
        if (type === "expenses") {
          value =
            monthValues.reduce((sum, m) => sum + m.expenses, 0) /
            monthValues.length;
        } else if (type === "count") {
          value =
            monthValues.reduce((sum, m) => sum + m.count, 0) /
            monthValues.length;
        } else if (type === "mileage") {
          const vals = monthValues.map(m => this.calcMileageForRecords(m.recs)).filter(v => v > 0);
          value = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        }
      }
    } else if (period === "quarter") {
      const quarterlyValues = {};
      yearRecords.forEach((r) => {
        if (!r.isoDate) return;
        const recordDate = new Date(r.isoDate);
        if (recordDate.getFullYear() === year) {
          const quarter = Math.floor(recordDate.getMonth() / 3) + 1;
          const quarterKey = `${year}-Q${quarter}`;
          if (!quarterlyValues[quarterKey]) {
            quarterlyValues[quarterKey] = {
              expenses: 0,
              count: 0,
              recs: [],
            };
          }
          quarterlyValues[quarterKey].expenses += r.totalWithVAT || 0;
          quarterlyValues[quarterKey].count += 1;
          quarterlyValues[quarterKey].recs.push(r);
        }
      });

      const quarterValues = Object.values(quarterlyValues);
      if (quarterValues.length > 0) {
        if (type === "expenses") {
          value =
            quarterValues.reduce((sum, q) => sum + q.expenses, 0) /
            quarterValues.length;
        } else if (type === "count") {
          value =
            quarterValues.reduce((sum, q) => sum + q.count, 0) /
            quarterValues.length;
        } else if (type === "mileage") {
          const vals = quarterValues.map(q => this.calcMileageForRecords(q.recs)).filter(v => v > 0);
          value = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        }
      }
    } else if (period === "halfyear") {
      const halfYearValues = {};
      yearRecords.forEach((r) => {
        if (!r.isoDate) return;
        const recordDate = new Date(r.isoDate);
        if (recordDate.getFullYear() === year) {
          const halfYear = recordDate.getMonth() < 6 ? 1 : 2;
          const halfYearKey = `${year}-H${halfYear}`;
          if (!halfYearValues[halfYearKey]) {
            halfYearValues[halfYearKey] = {
              expenses: 0,
              count: 0,
              recs: [],
            };
          }
          halfYearValues[halfYearKey].expenses += r.totalWithVAT || 0;
          halfYearValues[halfYearKey].count += 1;
          halfYearValues[halfYearKey].recs.push(r);
        }
      });

      const halfYearValuesArray = Object.values(halfYearValues);
      if (halfYearValuesArray.length > 0) {
        if (type === "expenses") {
          value =
            halfYearValuesArray.reduce((sum, h) => sum + h.expenses, 0) /
            halfYearValuesArray.length;
        } else if (type === "count") {
          value =
            halfYearValuesArray.reduce((sum, h) => sum + h.count, 0) /
            halfYearValuesArray.length;
        } else if (type === "mileage") {
          const vals = halfYearValuesArray.map(h => this.calcMileageForRecords(h.recs)).filter(v => v > 0);
          value = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        }
      }
    } else if (period === "year") {
      // Для року - просто середнє значення за весь рік
      if (type === "expenses") {
        value = yearRecords.reduce((sum, r) => sum + (r.totalWithVAT || 0), 0);
      } else if (type === "count") {
        value = yearRecords.length;
      } else if (type === "mileage") {
        value = this.calculateAvgMileage(yearRecords);
      }
    }

    return value;
  }

  /**
   * Correct mileage: average monthly km per vehicle, using odometer delta (max - min per car).
   */
  calcMileageForRecords(records) {
    if (!records || records.length === 0) return 0;
    const carOdo = {};
    records.forEach(r => {
      if (!r.car || !r.mileage || r.mileage <= 0 || !r.date) return;
      const d = new Date(r.date).getTime();
      if (isNaN(d)) return;
      if (!carOdo[r.car]) {
        carOdo[r.car] = { minM: r.mileage, maxM: r.mileage, minD: d, maxD: d };
      } else {
        if (r.mileage < carOdo[r.car].minM) { 
          carOdo[r.car].minM = r.mileage; 
          carOdo[r.car].minD = d; 
        }
        if (r.mileage > carOdo[r.car].maxM) { 
          carOdo[r.car].maxM = r.mileage; 
          carOdo[r.car].maxD = d; 
        }
      }
    });

    let sumMonthly = 0;
    let validCars = 0;

    for (const car in carOdo) {
      const s = carOdo[car];
      const delta = s.maxM - s.minM;
      if (delta <= 0) continue;

      const diffMs = Math.abs(s.maxD - s.minD);
      const days = Math.max(1, diffMs / (1000 * 60 * 60 * 24));
      
      // Calculate monthly average (30 days)
      const monthlyRate = (delta / days) * 30;
      sumMonthly += monthlyRate;
      validCars++;
    }

    return validCars > 0 ? sumMonthly / validCars : 0;
  }

  /**
   * Отримує номер тижня в році (ISO week number)
   * @param {Date} date - Дата
   * @returns {number} Номер тижня
   */
  getWeekNumber(date) {
    const d = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
    );
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  }

  // ========== EXPENSES SECTION ==========
  renderExpenses() {
    if (!this.filteredData) return;

    const records = this.filteredData.records;

    // Group by year/month
    const byPeriod = {};
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    records.forEach((r) => {
      if (!r.isoDate || !r.totalWithVAT) return;
      const date = new Date(r.isoDate);
      const isYearFilter = this.filters.selectedYear === null;
      
      const key = isYearFilter
          ? date.getFullYear().toString()
          : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      
      // Для режиму "по місяцях" (коли вибрано конкретний рік) 
      // ігноруємо майбутні місяці з нульовими або неактуальними даними для "Фактичних витрат"
      if (!isYearFilter) {
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
          if (monthKey > currentMonthKey) return; 
      }
      
      if (!byPeriod[key]) byPeriod[key] = 0;
      byPeriod[key] += r.totalWithVAT;
    });

    // Окреме групування суто по місяцях для прогнозу
    const monthlyForForecast = {};
    records.forEach((r) => {
      if (!r.isoDate || !r.totalWithVAT) return;
      const date = new Date(r.isoDate);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyForForecast[key]) monthlyForForecast[key] = 0;
      monthlyForForecast[key] += r.totalWithVAT;
    });

    const periods = Object.keys(byPeriod).sort();
    const actualExpenses = periods.map((p) => byPeriod[p]);

    // Розрахунок прогнозу для графіка
    const forecastVal = this.getForecastValue(monthlyForForecast);
    let forecastData = [];
    let forecastLabels = [...periods];

    if (forecastVal > 0 && periods.length > 0) {
        const lastActualKey = periods[periods.length - 1];
        const lastDate = new Date(lastActualKey + "-01");
        lastDate.setMonth(lastDate.getMonth() + 1);
        const nextMonthKey = `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, "0")}`;
        
        forecastLabels.push(nextMonthKey);
        
        // Другий датасет для пунктирної лінії (починається з останньої реальної точки)
        forecastData = periods.map(() => null);
        forecastData[periods.length - 1] = actualExpenses[periods.length - 1]; // З'єднуємо з останньою точкою
        forecastData.push(forecastVal);
    }

    // Group by category
    const byCategory = this.groupExpensesByCategory(records);

    const html = `
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div>
                    <h3 class="text-lg font-semibold text-gray-700 mb-3">Витрати по ${this.filters.selectedYear === null ? "роках" : "місяцях"}</h3>
                    <div class="chart-container">
                        <canvas id="expenses-timeline-chart"></canvas>
                    </div>
                </div>
                <div>
                    <h3 class="text-lg font-semibold text-gray-700 mb-3">Розподіл по категоріях</h3>
                    <div class="chart-container">
                        <canvas id="expenses-category-chart"></canvas>
                    </div>
                </div>
            </div>
            
            <div class="mb-8 overflow-hidden">
                <h3 class="text-lg font-semibold text-gray-700 mb-3">Детально по категоріях</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    ${this.getDetailedCategoryBreakdownHtml(byCategory)}
                </div>
            </div>

            <div>
                <h3 class="text-lg font-semibold text-gray-700 mb-3">Прогноз витрат</h3>
                <div class="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p class="text-gray-700">${this.calculateExpenseForecast(monthlyForForecast)}</p>
                </div>
            </div>
        `;

    document.getElementById("expenses-content").innerHTML = html;

    this.createExpensesTimelineChart(forecastLabels, actualExpenses, forecastData);
    this.createExpensesCategoryChart(byCategory);
  }

  groupExpensesByCategory(records) {
    const categories = {};
    Object.keys(EXPENSE_CATEGORIES).forEach(cat => {
      categories[cat] = 0;
    });

    records.forEach((r) => {
      if (!r.description || !r.totalWithVAT) return;
      const category = EXPENSE_CATEGORIES_UTILS.findCategory(r.description);
      
      if (categories.hasOwnProperty(category)) {
        categories[category] += r.totalWithVAT;
      } else {
        categories["Інші витрати"] += r.totalWithVAT;
      }
    });

    return categories;
  }

  getDetailedCategoryBreakdownHtml(byCategory) {
    const total = Object.values(byCategory).reduce((sum, val) => sum + val, 0);
    if (total === 0) return '<div class="col-span-full py-4 text-center text-gray-400">Немає даних за цей період</div>';

    return Object.entries(byCategory)
        .filter(([_, value]) => value > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([category, value]) => {
            const percentage = Math.round((value / total) * 100);
            const colorClass = this.getCategoryColorClass(category);
            return `
                <div class="bg-gray-50 rounded-xl p-4 border border-gray-100 flex flex-col justify-between">
                    <div>
                        <div class="flex justify-between items-start mb-2">
                            <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">${category}</span>
                            <span class="text-xs font-black text-gray-400">${percentage}%</span>
                        </div>
                        <div class="text-xl font-bold ${colorClass.text}">${this.formatCurrency(value)}</div>
                    </div>
                    <div class="mt-4">
                        <div class="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                            <div class="${colorClass.bg} h-full rounded-full transition-all duration-1000" style="width: ${percentage}%"></div>
                        </div>
                    </div>
                </div>
            `;
        })
        .join('');
  }

  getCategoryColorClass(category) {
    const map = {
        "ТО та обслуговування": { text: "text-blue-600", bg: "bg-blue-600" },
        "Ходова частина": { text: "text-orange-600", bg: "bg-orange-600" },
        "Електрика": { text: "text-yellow-600", bg: "bg-yellow-600" },
        "Гальмівна система": { text: "text-red-600", bg: "bg-red-600" },
        "Трансмісія": { text: "text-purple-600", bg: "bg-purple-600" },
        "Двигун": { text: "text-rose-600", bg: "bg-rose-600" },
        "Кузов та салон": { text: "text-pink-600", bg: "bg-pink-600" },
        "Система вихлопу": { text: "text-indigo-600", bg: "bg-indigo-600" },
        "Витратні матеріали": { text: "text-teal-600", bg: "bg-teal-600" },
        "Мийка авто": { text: "text-cyan-600", bg: "bg-cyan-600" },
        "Інші витрати": { text: "text-slate-600", bg: "bg-slate-600" }
    };
    return map[category] || { text: "text-blue-600", bg: "bg-blue-600" };
  }



  createExpensesTimelineChart(labels, actualData, forecastData) {
    const ctx = document.getElementById("expenses-timeline-chart");
    if (!ctx) return;

    if (this.charts.expensesTimeline) {
      this.charts.expensesTimeline.destroy();
    }

    const datasets = [
      {
        label: "Фактичні витрати",
        data: actualData,
        borderColor: "rgba(59, 130, 246, 1)",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
      }
    ];

    if (forecastData && forecastData.length > 0) {
        datasets.push({
            label: "Прогноз",
            data: forecastData,
            borderColor: "rgba(16, 185, 129, 0.8)",
            backgroundColor: "transparent",
            borderWidth: 2,
            borderDash: [5, 5],
            fill: false,
            tension: 0.4,
            pointRadius: 4,
            pointStyle: 'rectRot',
            pointBackgroundColor: "rgba(16, 185, 129, 1)",
        });
    }

    this.charts.expensesTimeline = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { 
              display: true,
              position: 'top',
              labels: {
                  boxWidth: 12,
                  usePointStyle: true,
                  padding: 15,
                  font: { size: 11 }
              }
          },
          tooltip: {
              mode: 'index',
              intersect: false,
              callbacks: {
                  label: (context) => {
                      let label = context.dataset.label || '';
                      if (label) label += ': ';
                      if (context.parsed.y !== null) {
                          label += new Intl.NumberFormat("uk-UA").format(context.parsed.y) + " грн";
                      }
                      return label;
                  }
              }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) =>
                new Intl.NumberFormat("uk-UA").format(value) + " грн",
            },
          },
        },
      },
    });
  }

  createExpensesCategoryChart(byCategory) {
    const ctx = document.getElementById("expenses-category-chart");
    if (!ctx) return;

    if (this.charts.expensesCategory) {
      this.charts.expensesCategory.destroy();
    }

    const categories = Object.keys(byCategory).filter((k) => byCategory[k] > 0);
    const values = categories.map((c) => byCategory[c]);
    const colors = this.generateColors(categories.length);

    this.charts.expensesCategory = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: categories,
        datasets: [
          {
            data: values,
            backgroundColor: colors,
            borderWidth: 2,
            borderColor: "#fff",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "right" },
        },
      },
    });
  }

  calculateExpenseForecast(byMonth) {
    if (!byMonth) return "Немає даних для прогнозу";
    const periods = Object.keys(byMonth).sort();
    if (periods.length < 2) {
      return "Недостатньо даних для прогнозу";
    }

    const recentPeriods = periods.slice(-3);
    const recentExpenses = recentPeriods.map((p) => byMonth[p]);
    const avgExpense =
      recentExpenses.reduce((a, b) => a + b, 0) / recentExpenses.length;

    let monthLabel = "місяці";
    if (recentPeriods.length === 2) monthLabel = "місяці";
    else if (recentPeriods.length === 1) monthLabel = "місяць";

    return `На основі середніх витрат за останні ${recentPeriods.length} ${monthLabel}, прогнозовані витрати на наступний місяць: ${new Intl.NumberFormat("uk-UA").format(Math.round(avgExpense))} грн`;
  }

  getForecastValue(byMonth) {
    if (!byMonth) return 0;
    const periods = Object.keys(byMonth).sort();
    if (periods.length === 0) return 0;

    const recentPeriods = periods.slice(-3);
    const recentExpenses = recentPeriods.map((p) => byMonth[p]);
    const avgExpense =
      recentExpenses.reduce((a, b) => a + b, 0) / recentExpenses.length;

    return Math.round(avgExpense);
  }

  // ========== MILEAGE SECTION ==========
  renderMileage() {
    if (!this.filteredData) return;

    const fleetStats = this.calculateFleetMileageStats(this.filteredData.cars, this.filters.selectedYear);
    
    // Загальні показники автопарку (горизонтальна панель як у карточці авто)
    const healthClass = fleetStats.avgHealthScore < 35 ? "bg-red-500" : fleetStats.avgHealthScore < 60 ? "bg-yellow-500" : "bg-green-500";
    const healthTextClass = fleetStats.avgHealthScore < 35 ? "text-red-700" : fleetStats.avgHealthScore < 60 ? "text-yellow-700" : "text-green-700";
    const statusText = fleetStats.avgHealthScore < 35 ? "Критично" : fleetStats.avgHealthScore < 60 ? "Потребує уваги" : "У нормі";

    const html = `
            <div class="mb-6">
                <div class="bg-blue-600 rounded-xl shadow-xl overflow-hidden text-white relative">
                    <div class="px-4 py-4 sm:px-6">
                        <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div class="flex items-center gap-3">
                                <div class="bg-white/20 p-2 rounded-lg flex items-center justify-center h-12 w-12 text-2xl">
                                    🚗
                                </div>
                                <div>
                                    <div class="text-xl font-bold">Зведені показники автопарку</div>
                                </div>
                            </div>
                            
                            <div class="flex flex-wrap md:flex-nowrap gap-x-6 gap-y-3 w-full md:w-auto">
                                <div class="flex flex-col whitespace-nowrap">
                                    <div class="text-blue-200 text-xs mb-0.5 uppercase tracking-wider font-semibold">Стан парку</div>
                                    <div class="text-lg font-bold flex items-center gap-2">
                                        ${fleetStats.avgHealthScore}% 
                                        <span class="w-16 h-1.5 rounded-full bg-blue-800 overflow-hidden inline-block ml-1">
                                            <span class="block h-full ${healthClass}" style="width: ${fleetStats.avgHealthScore}%"></span>
                                        </span>
                                    </div>
                                </div>
                                <div class="flex flex-col whitespace-nowrap">
                                    <div class="text-blue-200 text-xs mb-0.5 uppercase tracking-wider font-semibold">Середній пробіг</div>
                                    <div class="text-lg font-bold">${this.formatMileage(fleetStats.daily)} км/день</div>
                                </div>
                                <div class="flex flex-col whitespace-nowrap">
                                    <div class="text-blue-200 text-xs mb-0.5 uppercase tracking-wider font-semibold">Середній пробіг</div>
                                    <div class="text-lg font-bold">${this.formatMileage(fleetStats.monthly)} км/місяць</div>
                                </div>
                                <div class="flex flex-col whitespace-nowrap">
                                    <div class="text-blue-200 text-xs mb-0.5 uppercase tracking-wider font-semibold">Середній пробіг</div>
                                    <div class="text-lg font-bold">${this.formatMileage(fleetStats.yearly)} км/рік</div>
                                </div>
                                <div class="flex flex-col whitespace-nowrap">
                                    <div class="text-blue-200 text-xs mb-0.5 uppercase tracking-wider font-semibold">Загальний пробіг</div>
                                    <div class="text-lg font-bold">${this.formatMileage(fleetStats.total)} км</div>
                                </div>
                                <div class="flex flex-col whitespace-nowrap">
                                    <div class="text-blue-200 text-xs mb-0.5 uppercase tracking-wider font-semibold">Середній вік</div>
                                    <div class="text-lg font-bold">${this.formatCarAge(fleetStats.avgAgeMonths)}</div>
                                </div>
                            </div>
                            
                            <div class="hidden md:flex ml-4 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 items-center gap-2 whitespace-nowrap">
                                <span class="w-2.5 h-2.5 rounded-full ${healthClass}"></span>
                                <span class="text-sm font-semibold">${statusText}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

    document.getElementById("mileage-content").innerHTML = html;
  }

  calculateMileageForPeriod(records, periodRange, days) {
    if (!periodRange) {
      // Якщо periodRange === null (всі роки), використовуємо всі записи
      const avgMileage = this.calculateAvgMileage(records);
      return avgMileage * days;
    }
    const periodStart = new Date(
      periodRange.end.getTime() - days * 24 * 60 * 60 * 1000,
    );
    const periodRecords = records.filter((r) => {
      if (!r.date) return false;
      const recordDate = new Date(r.date);
      return recordDate >= periodStart && recordDate <= periodRange.end;
    });
    return this.calculateAvgMileage(periodRecords) * days;
  }

  // ========== RATINGS SECTION ==========
  renderRatings() {
    if (!this.filteredData) return;

    const records = this.filteredData.records;
    const cars = this.filteredData.cars;
    const currentMileages = this.appData.currentMileages || {};

    // Top 10 by cost per km
    const costPerKm = cars
      .map((car) => {
        const carRecords = records.filter((r) => r.car === car.license);
        const totalCost = carRecords.reduce(
          (sum, r) => sum + (r.totalWithVAT || 0),
          0,
        );
        const totalMileage = currentMileages[car.license] || 0;
        const costPerKm = totalMileage > 0 ? totalCost / totalMileage : 0;
        return { ...car, totalCost, totalMileage, costPerKm };
      })
      .sort((a, b) => b.costPerKm - a.costPerKm)
      .slice(0, 10);

    // Top 10 problematic - рахуємо унікальні ремонти (одне авто в один день = один ремонт)
    const breakdownsByCar = {};
    const repairsByCar = {};

    records.forEach((r) => {
      if (!r.car || !r.date) return;
      const recordDate = new Date(r.date);
      if (isNaN(recordDate.getTime())) return;

      if (!breakdownsByCar[r.car]) {
        breakdownsByCar[r.car] = { count: 0, totalCost: 0 };
        repairsByCar[r.car] = new Set();
      }

      // Створюємо ключ: дата + авто
      const dateKey = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, "0")}-${String(recordDate.getDate()).padStart(2, "0")}`;
      const repairKey = `${dateKey}_${r.car}`;

      // Рахуємо унікальні ремонти
      if (!repairsByCar[r.car].has(repairKey)) {
        breakdownsByCar[r.car].count++;
        repairsByCar[r.car].add(repairKey);
      }

      breakdownsByCar[r.car].totalCost += r.totalWithVAT || 0;
    });

    const topProblematic = Object.entries(breakdownsByCar)
      .map(([license, data]) => ({
        license,
        count: data.count,
        totalCost: data.totalCost,
        carInfo: this.appData.carsInfo[license],
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Top 10 expensive cars (grouped by car)
    const expensiveByCar = {};
    records.forEach(r => {
      if (!r.car || !r.totalWithVAT || r.totalWithVAT <= 0) return;
      expensiveByCar[r.car] = (expensiveByCar[r.car] || 0) + (r.totalWithVAT || 0);
    });

    const topExpensive = Object.entries(expensiveByCar)
      .map(([car, total]) => ({ car, totalWithVAT: total }))
      .sort((a, b) => b.totalWithVAT - a.totalWithVAT)
      .slice(0, 10);

    const html = `
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div>
                    <h3 class="text-lg font-semibold text-gray-700 mb-3">Топ-10 за ₴/км</h3>
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead class="bg-gray-100">
                                <tr>
                                    <th class="px-2 py-2 text-left w-10">#</th>
                                    <th class="px-2 py-2 text-left">Номер</th>
                                    <th class="px-2 py-2 text-right">₴/км</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${costPerKm
        .map(
          (car, idx) => `
                                    <tr class="border-b hover:bg-gray-50">
                                        <td class="px-2 py-2">${idx + 1}</td>
                                        <td class="px-2 py-2 font-medium">${car.license}</td>
                                        <td class="px-2 py-2 text-right font-bold ${car.costPerKm > 5 ? "text-red-600" : car.costPerKm > 3 ? "text-orange-600" : "text-green-600"}">
                                            ${this.formatCurrency(car.costPerKm)}
                                        </td>
                                    </tr>
                                `,
        )
        .join("")}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div>
                    <h3 class="text-lg font-semibold text-gray-700 mb-3">Топ-10 проблемних</h3>
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead class="bg-gray-100">
                                <tr>
                                    <th class="px-2 py-2 text-left w-10">#</th>
                                    <th class="px-2 py-2 text-left">Номер</th>
                                    <th class="px-2 py-2 text-right">Ремонтів</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${topProblematic
        .map(
          (car, idx) => `
                                    <tr class="border-b hover:bg-gray-50">
                                        <td class="px-2 py-2">${idx + 1}</td>
                                        <td class="px-2 py-2 font-medium">${car.license}</td>
                                        <td class="px-2 py-2 text-right font-bold text-red-600">${car.count}</td>
                                    </tr>
                                `,
        )
        .join("")}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div>
                    <h3 class="text-lg font-semibold text-gray-700 mb-3">Топ-10 найдорожчих</h3>
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead class="bg-gray-100">
                                <tr>
                                    <th class="px-2 py-2 text-left w-10">#</th>
                                    <th class="px-2 py-2 text-left">Авто</th>
                                    <th class="px-2 py-2 text-right">Сума</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${topExpensive
        .map(
          (record, idx) => `
                                    <tr class="border-b hover:bg-gray-50">
                                        <td class="px-2 py-2">${idx + 1}</td>
                                        <td class="px-2 py-2 font-medium text-xs">${record.car || "Невідомо"}</td>
                                        <td class="px-2 py-2 text-right font-bold text-orange-600">${this.formatCurrency(record.totalWithVAT || 0)}</td>
                                    </tr>
                                `,
        )
        .join("")}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

    document.getElementById("ratings-content").innerHTML = html;
  }

  // ========== BREAKDOWN SECTION ==========
  renderBreakdown() {
    if (!this.filteredData) return;

    const records = this.filteredData.records;
    const totalRepairs = this.countUniqueRepairs(records);
    const totalCost = records.reduce(
      (sum, r) => sum + (r.totalWithVAT || 0),
      0,
    );
    const avgCost = totalRepairs > 0 ? totalCost / totalRepairs : 0;

    const html = `
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div class="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <div class="text-sm text-gray-600 mb-1">Загальна кількість</div>
                    <div class="text-2xl font-bold text-blue-600">${totalRepairs}</div>
                </div>
                <div class="bg-green-50 rounded-lg p-4 border border-green-200">
                    <div class="text-sm text-gray-600 mb-1">Сумарні витрати</div>
                    <div class="text-2xl font-bold text-green-600">${this.formatCurrency(totalCost)}</div>
                </div>
                <div class="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                    <div class="text-sm text-gray-600 mb-1">Середня вартість</div>
                    <div class="text-2xl font-bold text-yellow-600">${this.formatCurrency(avgCost)}</div>
                </div>
                <div class="bg-purple-50 rounded-lg p-4 border border-purple-200">
                    <div class="text-sm text-gray-600 mb-1">Категорій</div>
                    <div class="text-2xl font-bold text-purple-600">${Object.keys(this.groupExpensesByCategory(records)).filter((k) => this.groupExpensesByCategory(records)[k] > 0).length}</div>
                </div>
            </div>
        `;

    document.getElementById("breakdown-content").innerHTML = html;
  }

  // ========== REQUESTS SECTION ==========
  renderRequests() {
    if (!this.filteredData) return;

    const records = this.filteredData.records;

    // Group by month/year
    const byPeriod = {};
    records.forEach((r) => {
      if (!r.date) return;
      const date = new Date(r.date);
      const key =
        this.filters.period === "all"
          ? date.getFullYear().toString()
          : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!byPeriod[key]) byPeriod[key] = 0;
      byPeriod[key]++;
    });

    const periods = Object.keys(byPeriod).sort();
    const counts = periods.map((p) => byPeriod[p]);

    // Calculate avg per day
    const workingDays = this.calculateWorkingDays(
      this.filteredData.periodRange,
    );
    const avgPerDay =
      workingDays > 0 ? (records.length / workingDays).toFixed(2) : 0;

    const html = `
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div>
                    <h3 class="text-lg font-semibold text-gray-700 mb-3">Заявки по ${this.filters.period === "all" ? "роках" : "місяцях"}</h3>
                    <div class="chart-container">
                        <canvas id="requests-chart"></canvas>
                    </div>
                </div>
                <div>
                    <h3 class="text-lg font-semibold text-gray-700 mb-3">Середня кількість на день</h3>
                    <div class="bg-blue-50 rounded-lg p-6 border border-blue-200">
                        <div class="text-4xl font-bold text-blue-600 mb-2">${avgPerDay}</div>
                        <p class="text-sm text-gray-600">Розрахунок: ${records.length} заявок / ${workingDays} роб.днів</p>
                    </div>
                </div>
            </div>
        `;

    document.getElementById("requests-content").innerHTML = html;

    this.createRequestsChart(periods, counts);
  }

  calculateWorkingDays(periodRange) {
    if (!periodRange) return 1;
    let days = 0;
    const current = new Date(periodRange.start);
    while (current <= periodRange.end) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        // Not Sunday or Saturday
        days++;
      }
      current.setDate(current.getDate() + 1);
    }
    return days || 1;
  }

  createRequestsChart(labels, data) {
    const ctx = document.getElementById("requests-chart");
    if (!ctx) return;

    if (this.charts.requests) {
      this.charts.requests.destroy();
    }

    this.charts.requests = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Кількість заявок",
            data: data,
            backgroundColor: "rgba(139, 92, 246, 0.5)",
            borderColor: "rgba(139, 92, 246, 1)",
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1 },
          },
        },
      },
    });
  }

  // ========== FORECAST SECTION ==========
  renderForecast() {
    if (!this.filteredData || !this.processedCars) return;

    const html = `
            <div class="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 class="text-lg font-semibold text-gray-700 mb-2">💡 Рекомендований бюджет</h3>
                <p class="text-gray-600 text-sm mb-4">На основі історичних даних та прогнозу робіт для автопарку</p>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="bg-white rounded-lg p-4">
                        <div class="text-sm text-gray-600 mb-1">На наступний місяць</div>
                        <div class="text-2xl font-bold text-blue-600">${this.formatCurrency(this.calculateForecastBudget(1))}</div>
                    </div>
                    <div class="bg-white rounded-lg p-4">
                        <div class="text-sm text-gray-600 mb-1">На наступний квартал</div>
                        <div class="text-2xl font-bold text-green-600">${this.formatCurrency(this.calculateForecastBudget(3))}</div>
                    </div>
                    <div class="bg-white rounded-lg p-4">
                        <div class="text-sm text-gray-600 mb-1">На наступний рік</div>
                        <div class="text-2xl font-bold text-purple-600">${this.formatCurrency(this.calculateForecastBudget(12))}</div>
                    </div>
                </div>
            </div>
        `;

    document.getElementById("forecast-content").innerHTML = html;
  }

  calculateForecastBudget(months) {
    if (!this.filteredData) return 0;
    const records = this.filteredData.records;
    const avgMonthlyExpense =
      records.length > 0
        ? records.reduce((sum, r) => sum + (r.totalWithVAT || 0), 0) /
        (this.filteredData.periodRange
          ? (this.filteredData.periodRange.end.getTime() -
            this.filteredData.periodRange.start.getTime()) /
          (30 * 24 * 60 * 60 * 1000)
          : 1)
        : 0;
    return Math.round(avgMonthlyExpense * months);
  }

  // ========== UTILITY METHODS ==========
  formatCurrency(amount) {
    return new Intl.NumberFormat("uk-UA", {
      style: "currency",
      currency: "UAH",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  }

  formatMileage(km) {
    return new Intl.NumberFormat("uk-UA").format(Math.round(km || 0));
  }

  generateColors(count) {
    const colors = [
      "rgba(59, 130, 246, 0.7)",
      "rgba(16, 185, 129, 0.7)",
      "rgba(245, 158, 11, 0.7)",
      "rgba(239, 68, 68, 0.7)",
      "rgba(139, 92, 246, 0.7)",
      "rgba(236, 72, 153, 0.7)",
      "rgba(14, 165, 233, 0.7)",
      "rgba(34, 197, 94, 0.7)",
      "rgba(251, 146, 60, 0.7)",
      "rgba(168, 85, 247, 0.7)",
    ];
    const result = [];
    for (let i = 0; i < count; i++) {
      result.push(colors[i % colors.length]);
    }
    return result;
  }

  exportToPDF() {
    alert("Експорт в PDF буде реалізовано найближчим часом");
  }

  exportToExcel() {
    alert("Експорт в Excel буде реалізовано найближчим часом");
  }

  showErrorMessage(message) {
    const mainInterface = document.getElementById("main-interface");
    if (mainInterface) {
      mainInterface.innerHTML = `
                <div class="min-h-screen flex items-center justify-center bg-gray-50">
                    <div class="text-center max-w-md p-8">
                        <div class="text-6xl mb-4">❌</div>
                        <h2 class="text-2xl font-bold text-red-600 mb-2">Помилка</h2>
                        <p class="text-gray-600 mb-6">${message}</p>
                        <button onclick="location.reload()" class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                            🔄 Спробувати знову
                        </button>
                        <div class="mt-4">
                            <a href="index.html" class="text-blue-600 hover:text-blue-800 text-sm">
                                ← Повернутися на головну
                            </a>
                        </div>
                    </div>
                </div>
            `;
      mainInterface.classList.remove("hidden");
      document.getElementById("loading-screen").classList.add("hidden");
    }
  }
}

// Ініціалізація при завантаженні сторінки
document.addEventListener("DOMContentLoaded", () => {
  window.analyticsApp = new AnalyticsApp();
  window.app = window.analyticsApp;
});
