import { CacheManager } from './cache/cacheManager.js';
import { DataProcessor } from './data/dataProcessor.js';
import { Formatters } from './utils/formatters.js';
import { CarProcessor } from './processing/carProcessor.js';
import { StatsCalculator } from './analytics/statsCalculator.js';
import { CONFIG, CONSTANTS } from './config/appConfig.js';

class AnalyticsApp {
  constructor() {
    this.appData = null;
    this.processedCars = null;
    this.maintenanceRegulations = [];
    this.charts = {};
    this.filters = {
      period: "month",
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
      if (
        cached &&
        !forceRefresh &&
        cached.carsInfo &&
        Object.keys(cached.carsInfo).length > 0
      ) {
        console.log("✅ Використано кешовані дані");
        this.appData = cached;
        this.maintenanceRegulations = cached.regulations || [];
        this.updateLoadingProgress(60);
      } else {
        console.log("📥 Завантаження даних з Google Sheets...");
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
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}?key=${apiKey}`;
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
        if (!r.date) return false;
        const recordDate = new Date(r.date);
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
      // Витрати, Ремонти, Заявки - середнє за період по всіх роках
      // Пробіг - середнє за період по всіх роках
      // Застосовуємо фільтри за містом, авто та маркою до всіх записів
      let allRecords = this.appData.records || [];

      if (this.filters.city !== "all") {
        allRecords = allRecords.filter((r) => r.city === this.filters.city);
      }
      if (this.filters.vehicle !== "all") {
        allRecords = allRecords.filter((r) => r.car === this.filters.vehicle);
      }
      if (this.filters.brand !== "all") {
        allRecords = allRecords.filter((r) => {
          const carInfo = this.appData.carsInfo[r.car];
          if (!carInfo || !carInfo.model) return false;
          const model = carInfo.model || "";
          const brand = model.split(" ")[0].trim();
          return brand === this.filters.brand;
        });
      }

      const expensesByYear = this.calculateAverageByPeriod(
        allRecords,
        this.filters.period,
        "expenses",
      );
      // Для ремонтів рахуємо унікальні ремонти (одне авто в один день = один ремонт)
      const repairsByYear = this.calculateAverageByPeriodUniqueRepairs(
        allRecords,
        this.filters.period,
      );
      // Для заявок рахуємо звичайно (кожен запис = одна заявка)
      const requestsByYear = this.calculateAverageByPeriod(
        allRecords,
        this.filters.period,
        "count",
      );
      const mileageByYear = this.calculateAverageByPeriod(
        allRecords,
        this.filters.period,
        "mileage",
      );

      totalExpenses = expensesByYear;
      repairCount = Math.round(repairsByYear);
      avgMileage = mileageByYear;
      requestCount = Math.round(requestsByYear);
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

      // Пробіг - СЕРЕДНЄ за період
      avgMileage = this.calculateAverageByPeriodForYear(
        records,
        this.filters.period,
        "mileage",
        selectedYear,
      );
    } else if (isAllYears && isYearPeriod) {
      // Сума за всі роки при виборі періоду "Рік"
      totalExpenses = records.reduce(
        (sum, r) => sum + (r.totalWithVAT || 0),
        0,
      );
      repairCount = this.countUniqueRepairs(records); // Унікальні ремонти
      avgMileage = this.calculateAvgMileage(records);
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
      avgMileage = this.calculateAvgMileage(records);
      requestCount = records.length; // Звичайна кількість записів
    }

    const previousExpenses = previousPeriod.reduce(
      (sum, r) => sum + (r.totalWithVAT || 0),
      0,
    );
    const expensesTrend =
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

    const previousAvgMileage = this.calculateAvgMileage(previousPeriod);
    const mileageTrend =
      previousAvgMileage > 0
        ? (
          ((avgMileage - previousAvgMileage) / previousAvgMileage) *
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

    const html = `
            <div class="metric-card bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
                <div class="flex items-center gap-2 mb-2">
                    <span class="text-2xl">💰</span>
                    <h3 class="text-sm font-semibold text-gray-700">Витрати</h3>
                </div>
                <div class="text-3xl font-bold text-gray-800 mb-1">${this.formatCurrency(totalExpenses)}</div>
                <div class="flex items-center gap-1 text-sm ${expensesTrend >= 0 ? "text-red-600" : "text-green-600"}">
                    <span>${expensesTrend >= 0 ? "↑" : "↓"}</span>
                    <span>${Math.abs(expensesTrend)}% vs мин.</span>
                </div>
            </div>
            <div class="metric-card bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
                <div class="flex items-center gap-2 mb-2">
                    <span class="text-2xl">🔧</span>
                    <h3 class="text-sm font-semibold text-gray-700">Ремонтів</h3>
                </div>
                <div class="text-3xl font-bold text-gray-800 mb-1">${repairCount}</div>
                <div class="flex items-center gap-1 text-sm ${repairTrend >= 0 ? "text-red-600" : "text-green-600"}">
                    <span>${repairTrend >= 0 ? "↑" : "↓"}</span>
                    <span>${Math.abs(repairTrend)}% vs мин.</span>
                </div>
            </div>
            <div class="metric-card bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
                <div class="flex items-center gap-2 mb-2">
                    <span class="text-2xl">📏</span>
                    <h3 class="text-sm font-semibold text-gray-700">Середній пробіг</h3>
                </div>
                <div class="text-3xl font-bold text-gray-800 mb-1">${this.formatMileage(avgMileage)}/міс</div>
                <div class="flex items-center gap-1 text-sm ${mileageTrend >= 0 ? "text-green-600" : "text-red-600"}">
                    <span>${mileageTrend >= 0 ? "↑" : "↓"}</span>
                    <span>${Math.abs(mileageTrend)}% vs серед.</span>
                </div>
            </div>
            <div class="metric-card bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-6 border border-orange-200">
                <div class="flex items-center gap-2 mb-2">
                    <span class="text-2xl">📋</span>
                    <h3 class="text-sm font-semibold text-gray-700">Заявок</h3>
                </div>
                <div class="text-3xl font-bold text-gray-800 mb-1">${requestCount}</div>
                <div class="flex items-center gap-1 text-sm ${requestTrend >= 0 ? "text-green-600" : "text-red-600"}">
                    <span>${requestTrend >= 0 ? "↑" : "↓"}</span>
                    <span>${Math.abs(requestTrend)}% vs мин.</span>
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
    if (!records || records.length === 0) return 0;
    const totalMileage = records.reduce((sum, r) => sum + (r.mileage || 0), 0);
    return totalMileage / records.length;
  }

  /**
   * Рахує кількість унікальних ремонтів (одне авто в один день = один ремонт)
   * @param {Array} records - Масив записів
   * @returns {number} Кількість унікальних ремонтів
   */
  countUniqueRepairs(records) {
    if (!records || records.length === 0) return 0;

    const uniqueRepairs = new Set();
    records.forEach((r) => {
      if (!r.date || !r.car) return;
      const recordDate = new Date(r.date);
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
      if (r.date) {
        const date = new Date(r.date);
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
        if (!r.date) return false;
        const recordDate = new Date(r.date);
        return recordDate.getFullYear() === year;
      });

      let value = 0;

      if (period === "day") {
        // Групуємо записи по днях і рахуємо унікальні ремонти за день
        const dailyRepairs = {};
        yearRecords.forEach((r) => {
          if (!r.date || !r.car) return;
          const recordDate = new Date(r.date);
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
          if (!r.date || !r.car) return;
          const recordDate = new Date(r.date);
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
          if (!r.date || !r.car) return;
          const recordDate = new Date(r.date);
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
          if (!r.date || !r.car) return;
          const recordDate = new Date(r.date);
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
          if (!r.date || !r.car) return;
          const recordDate = new Date(r.date);
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
        if (!r.date || !r.car) return;
        const recordDate = new Date(r.date);
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
        if (!r.date || !r.car) return;
        const recordDate = new Date(r.date);
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
        if (!r.date || !r.car) return;
        const recordDate = new Date(r.date);
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
        if (!r.date || !r.car) return;
        const recordDate = new Date(r.date);
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
        if (!r.date || !r.car) return;
        const recordDate = new Date(r.date);
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
      if (r.date) {
        const date = new Date(r.date);
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
          if (!r.date) return;
          const recordDate = new Date(r.date);
          if (recordDate.getFullYear() === year) {
            const dayKey = `${year}-${String(recordDate.getMonth() + 1).padStart(2, "0")}-${String(recordDate.getDate()).padStart(2, "0")}`;
            if (!dailyValues[dayKey]) {
              dailyValues[dayKey] = {
                expenses: 0,
                count: 0,
                mileage: 0,
                mileageCount: 0,
              };
            }
            dailyValues[dayKey].expenses += r.totalWithVAT || 0;
            dailyValues[dayKey].count += 1;
            if (r.mileage) {
              dailyValues[dayKey].mileage += r.mileage;
              dailyValues[dayKey].mileageCount += 1;
            }
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
            const totalMileage = dayValues.reduce(
              (sum, d) =>
                sum + (d.mileageCount > 0 ? d.mileage / d.mileageCount : 0),
              0,
            );
            value = totalMileage / dayValues.length;
          }
        }
      } else if (period === "week") {
        // Для тижня: обчислюємо середнє значення за всі тижні року
        // Групуємо записи по тижнях (ISO week number)
        const weeklyValues = {};
        allRecords.forEach((r) => {
          if (!r.date) return;
          const recordDate = new Date(r.date);
          if (recordDate.getFullYear() === year) {
            // Отримуємо номер тижня
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
              weekValues.reduce((sum, w) => sum + w.count, 0) /
              weekValues.length;
          } else if (type === "mileage") {
            const totalMileage = weekValues.reduce(
              (sum, w) =>
                sum + (w.mileageCount > 0 ? w.mileage / w.mileageCount : 0),
              0,
            );
            value = totalMileage / weekValues.length;
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
          if (!r.date) return false;
          const recordDate = new Date(r.date);
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
      // Обчислюємо середнє значення за всі дні року
      const dailyValues = {};
      yearRecords.forEach((r) => {
        if (!r.date) return;
        const recordDate = new Date(r.date);
        if (recordDate.getFullYear() === year) {
          const dayKey = `${year}-${String(recordDate.getMonth() + 1).padStart(2, "0")}-${String(recordDate.getDate()).padStart(2, "0")}`;
          if (!dailyValues[dayKey]) {
            dailyValues[dayKey] = {
              expenses: 0,
              count: 0,
              mileage: 0,
              mileageCount: 0,
            };
          }
          dailyValues[dayKey].expenses += r.totalWithVAT || 0;
          dailyValues[dayKey].count += 1;
          if (r.mileage) {
            dailyValues[dayKey].mileage += r.mileage;
            dailyValues[dayKey].mileageCount += 1;
          }
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
          const totalMileage = dayValues.reduce(
            (sum, d) =>
              sum + (d.mileageCount > 0 ? d.mileage / d.mileageCount : 0),
            0,
          );
          value = totalMileage / dayValues.length;
        }
      }
    } else if (period === "week") {
      // Обчислюємо середнє значення за всі тижні року
      const weeklyValues = {};
      yearRecords.forEach((r) => {
        if (!r.date) return;
        const recordDate = new Date(r.date);
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
      // Обчислюємо середнє значення за всі місяці року
      const monthlyValues = {};
      yearRecords.forEach((r) => {
        if (!r.date) return;
        const recordDate = new Date(r.date);
        if (recordDate.getFullYear() === year) {
          const monthKey = `${year}-${String(recordDate.getMonth() + 1).padStart(2, "0")}`;
          if (!monthlyValues[monthKey]) {
            monthlyValues[monthKey] = {
              expenses: 0,
              count: 0,
              mileage: 0,
              mileageCount: 0,
            };
          }
          monthlyValues[monthKey].expenses += r.totalWithVAT || 0;
          monthlyValues[monthKey].count += 1;
          if (r.mileage) {
            monthlyValues[monthKey].mileage += r.mileage;
            monthlyValues[monthKey].mileageCount += 1;
          }
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
          const totalMileage = monthValues.reduce(
            (sum, m) =>
              sum + (m.mileageCount > 0 ? m.mileage / m.mileageCount : 0),
            0,
          );
          value = totalMileage / monthValues.length;
        }
      }
    } else if (period === "quarter") {
      // Обчислюємо середнє значення за всі квартали року
      const quarterlyValues = {};
      yearRecords.forEach((r) => {
        if (!r.date) return;
        const recordDate = new Date(r.date);
        if (recordDate.getFullYear() === year) {
          const quarter = Math.floor(recordDate.getMonth() / 3) + 1;
          const quarterKey = `${year}-Q${quarter}`;
          if (!quarterlyValues[quarterKey]) {
            quarterlyValues[quarterKey] = {
              expenses: 0,
              count: 0,
              mileage: 0,
              mileageCount: 0,
            };
          }
          quarterlyValues[quarterKey].expenses += r.totalWithVAT || 0;
          quarterlyValues[quarterKey].count += 1;
          if (r.mileage) {
            quarterlyValues[quarterKey].mileage += r.mileage;
            quarterlyValues[quarterKey].mileageCount += 1;
          }
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
          const totalMileage = quarterValues.reduce(
            (sum, q) =>
              sum + (q.mileageCount > 0 ? q.mileage / q.mileageCount : 0),
            0,
          );
          value = totalMileage / quarterValues.length;
        }
      }
    } else if (period === "halfyear") {
      // Обчислюємо середнє значення за обидві половини року
      const halfYearValues = {};
      yearRecords.forEach((r) => {
        if (!r.date) return;
        const recordDate = new Date(r.date);
        if (recordDate.getFullYear() === year) {
          const halfYear = recordDate.getMonth() < 6 ? 1 : 2;
          const halfYearKey = `${year}-H${halfYear}`;
          if (!halfYearValues[halfYearKey]) {
            halfYearValues[halfYearKey] = {
              expenses: 0,
              count: 0,
              mileage: 0,
              mileageCount: 0,
            };
          }
          halfYearValues[halfYearKey].expenses += r.totalWithVAT || 0;
          halfYearValues[halfYearKey].count += 1;
          if (r.mileage) {
            halfYearValues[halfYearKey].mileage += r.mileage;
            halfYearValues[halfYearKey].mileageCount += 1;
          }
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
          const totalMileage = halfYearValuesArray.reduce(
            (sum, h) =>
              sum + (h.mileageCount > 0 ? h.mileage / h.mileageCount : 0),
            0,
          );
          value = totalMileage / halfYearValuesArray.length;
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
    records.forEach((r) => {
      if (!r.date || !r.totalWithVAT) return;
      const date = new Date(r.date);
      const key =
        this.filters.period === "all"
          ? date.getFullYear().toString()
          : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!byPeriod[key]) byPeriod[key] = 0;
      byPeriod[key] += r.totalWithVAT;
    });

    const periods = Object.keys(byPeriod).sort();
    const expenses = periods.map((p) => byPeriod[p]);

    // Group by category
    const byCategory = this.groupExpensesByCategory(records);

    const html = `
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div>
                    <h3 class="text-lg font-semibold text-gray-700 mb-3">Витрати по ${this.filters.period === "all" ? "роках" : "місяцях"}</h3>
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
            <div>
                <h3 class="text-lg font-semibold text-gray-700 mb-3">Прогноз витрат</h3>
                <div class="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p class="text-gray-700">${this.calculateExpenseForecast(byPeriod)}</p>
                </div>
            </div>
        `;

    document.getElementById("expenses-content").innerHTML = html;

    this.createExpensesTimelineChart(periods, expenses);
    this.createExpensesCategoryChart(byCategory);
  }

  groupExpensesByCategory(records) {
    const categories = {
      "ТО та обслуговування": 0,
      "Ходова частина": 0,
      Електрика: 0,
      "Гальмівна система": 0,
      Трансмісія: 0,
      "Мийка авто": 0,
      "Інші витрати": 0,
    };

    const expenseCategories = window.EXPENSE_CATEGORIES_CONFIG || {};

    records.forEach((r) => {
      if (!r.description || !r.totalWithVAT) return;
      const category = this.getExpenseCategory(
        r.description,
        expenseCategories,
      );
      if (categories.hasOwnProperty(category)) {
        categories[category] += r.totalWithVAT;
      } else {
        categories["Інші витрати"] += r.totalWithVAT;
      }
    });

    return categories;
  }

  getExpenseCategory(description, categories) {
    if (!description || !categories) return "Інші витрати";
    const descUpper = description.toUpperCase();

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords && Array.isArray(keywords)) {
        for (const keyword of keywords) {
          if (descUpper.includes(keyword.toUpperCase())) {
            return category;
          }
        }
      }
    }
    return "Інші витрати";
  }

  createExpensesTimelineChart(labels, data) {
    const ctx = document.getElementById("expenses-timeline-chart");
    if (!ctx) return;

    if (this.charts.expensesTimeline) {
      this.charts.expensesTimeline.destroy();
    }

    this.charts.expensesTimeline = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Витрати (грн)",
            data: data,
            borderColor: "rgba(59, 130, 246, 1)",
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            borderWidth: 2,
            fill: true,
            tension: 0.4,
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

  calculateExpenseForecast(byPeriod) {
    const periods = Object.keys(byPeriod).map(Number).sort();
    if (periods.length < 2) {
      return "Недостатньо даних для прогнозу";
    }

    const recentPeriods = periods.slice(-3);
    const recentExpenses = recentPeriods.map((p) => byPeriod[p.toString()]);
    const avgExpense =
      recentExpenses.reduce((a, b) => a + b, 0) / recentExpenses.length;
    const nextPeriod = periods[periods.length - 1] + 1;

    return `На основі середніх витрат за останні ${recentPeriods.length} періоди, прогнозовані витрати на наступний період: ${new Intl.NumberFormat("uk-UA").format(Math.round(avgExpense))} грн`;
  }

  // ========== MILEAGE SECTION ==========
  renderMileage() {
    if (!this.filteredData) return;

    const records = this.filteredData.records;
    const periodRange = this.filteredData.periodRange;

    // Визначаємо, чи потрібно обчислювати середні значення
    const isAllYears = !this.filters.selectedYear;
    const isYearPeriod = this.filters.period === "year";
    const isAveragePeriodAllYears = isAllYears && !isYearPeriod;
    const isAveragePeriodSelectedYear =
      !isAllYears &&
      !isYearPeriod &&
      (this.filters.period === "day" ||
        this.filters.period === "week" ||
        this.filters.period === "month" ||
        this.filters.period === "quarter" ||
        this.filters.period === "halfyear");

    let mileageByPeriod, avgMileage;

    if (isAveragePeriodAllYears) {
      // Середні значення за всі роки
      // Застосовуємо фільтри за містом, авто та маркою до всіх записів
      let allRecords = this.appData.records || [];

      if (this.filters.city !== "all") {
        allRecords = allRecords.filter((r) => r.city === this.filters.city);
      }
      if (this.filters.vehicle !== "all") {
        allRecords = allRecords.filter((r) => r.car === this.filters.vehicle);
      }
      if (this.filters.brand !== "all") {
        allRecords = allRecords.filter((r) => {
          const carInfo = this.appData.carsInfo[r.car];
          if (!carInfo || !carInfo.model) return false;
          const model = carInfo.model || "";
          const brand = model.split(" ")[0].trim();
          return brand === this.filters.brand;
        });
      }

      mileageByPeriod = {
        day: this.calculateAverageByPeriod(allRecords, "day", "mileage") * 1,
        week: this.calculateAverageByPeriod(allRecords, "week", "mileage") * 7,
        month:
          this.calculateAverageByPeriod(allRecords, "month", "mileage") * 30,
        year:
          this.calculateAverageByPeriod(allRecords, "year", "mileage") * 365,
      };
      avgMileage = this.calculateAverageByPeriod(
        allRecords,
        this.filters.period,
        "mileage",
      );
    } else if (isAveragePeriodSelectedYear) {
      // Середні значення за період у вибраному році
      const selectedYear = this.filters.selectedYear;
      const yearRecords = records.filter((r) => {
        if (!r.date) return false;
        const recordDate = new Date(r.date);
        return recordDate.getFullYear() === selectedYear;
      });

      const dayAvg = this.calculateAverageByPeriodForYear(
        yearRecords,
        "day",
        "mileage",
        selectedYear,
      );
      const weekAvg = this.calculateAverageByPeriodForYear(
        yearRecords,
        "week",
        "mileage",
        selectedYear,
      );
      const monthAvg = this.calculateAverageByPeriodForYear(
        yearRecords,
        "month",
        "mileage",
        selectedYear,
      );
      const yearAvg = this.calculateAvgMileage(yearRecords);

      mileageByPeriod = {
        day: dayAvg * 1,
        week: weekAvg * 7,
        month: monthAvg * 30,
        year: yearAvg * 365,
      };

      if (this.filters.period === "year") {
        avgMileage = yearAvg;
      } else {
        avgMileage = this.calculateAverageByPeriodForYear(
          yearRecords,
          this.filters.period,
          "mileage",
          selectedYear,
        );
      }
    } else if (isAllYears && isYearPeriod) {
      // Сума за всі роки при виборі періоду "Рік"
      mileageByPeriod = {
        day: this.calculateMileageForPeriod(records, periodRange, 1),
        week: this.calculateMileageForPeriod(records, periodRange, 7),
        month: this.calculateMileageForPeriod(records, periodRange, 30),
        year: this.calculateMileageForPeriod(records, periodRange, 365),
      };
      avgMileage = this.calculateAvgMileage(records);
    } else {
      // Конкретні значення за вибраний рік (період "Рік")
      mileageByPeriod = {
        day: this.calculateMileageForPeriod(records, periodRange, 1),
        week: this.calculateMileageForPeriod(records, periodRange, 7),
        month: this.calculateMileageForPeriod(records, periodRange, 30),
        year: this.calculateMileageForPeriod(records, periodRange, 365),
      };
      avgMileage = this.calculateAvgMileage(records);
    }

    const html = `
            <div class="mb-6">
                <h3 class="text-lg font-semibold text-gray-700 mb-3">Середній пробіг автопарку</h3>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div class="bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <div class="text-sm text-gray-600 mb-1">День</div>
                        <div class="text-2xl font-bold text-blue-600">${this.formatMileage(mileageByPeriod.day)}</div>
                    </div>
                    <div class="bg-green-50 rounded-lg p-4 border border-green-200">
                        <div class="text-sm text-gray-600 mb-1">Тиждень</div>
                        <div class="text-2xl font-bold text-green-600">${this.formatMileage(mileageByPeriod.week)}</div>
                    </div>
                    <div class="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                        <div class="text-sm text-gray-600 mb-1">Місяць</div>
                        <div class="text-2xl font-bold text-yellow-600">${this.formatMileage(mileageByPeriod.month)}</div>
                    </div>
                    <div class="bg-purple-50 rounded-lg p-4 border border-purple-200">
                        <div class="text-sm text-gray-600 mb-1">Рік</div>
                        <div class="text-2xl font-bold text-purple-600">${this.formatMileage(mileageByPeriod.year)}</div>
                    </div>
                </div>
            </div>
            <div class="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div class="text-sm text-gray-600 mb-1">Середній пробіг автопарку</div>
                <div class="text-3xl font-bold text-gray-800">${this.formatMileage(avgMileage)}</div>
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
      .sort((a, b) => a.costPerKm - b.costPerKm)
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

    // Top 10 expensive repairs
    const topExpensive = records
      .filter((r) => r.totalWithVAT && r.totalWithVAT > 0)
      .sort((a, b) => (b.totalWithVAT || 0) - (a.totalWithVAT || 0))
      .slice(0, 10);

    const html = `
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div>
                    <h3 class="text-lg font-semibold text-gray-700 mb-3">Топ-10 за ₴/км</h3>
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead class="bg-gray-100">
                                <tr>
                                    <th class="px-2 py-2 text-left">#</th>
                                    <th class="px-2 py-2 text-left">Номер</th>
                                    <th class="px-2 py-2 text-right">₴/км</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${costPerKm
        .map(
          (car, idx) => `
                                    <tr class="border-b hover:bg-gray-50 cursor-pointer" onclick="window.location.href='index.html?car=${car.license}'">
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
                                    <th class="px-2 py-2 text-left">#</th>
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
                                    <th class="px-2 py-2 text-left">#</th>
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
