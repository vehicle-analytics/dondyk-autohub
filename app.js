import { DataProcessor } from './data/dataProcessor.js';
import { Formatters } from './utils/formatters.js';
import { CacheManager } from './cache/cacheManager.js';
import { BreakdownFrequencyAnalysis } from './breakdown-frequency-analysis.js';
import { CarWashRecommendations } from './car-wash-recommendations.js';
import { PartsPurchaseForecast } from './parts-purchase-forecast.js';
import { CarRecommendations } from './car-recommendations.js';
import { MaintenanceForecast } from './maintenance-forecast.js';
import { CarFilters } from './filters/carFilters.js';
import { CarProcessor } from './processing/carProcessor.js';
import { CONFIG, CONSTANTS } from './config/appConfig.js';

class CarAnalyticsApp {
  constructor() {
    this.appData = null;
    this.cachedData = null;
    this.processedCars = null;
    this.filteredCars = null;
    this.maintenanceRegulations = [];

    // === ІНІЦІАЛІЗУЄМО МОДУЛІ ===
    this.breakdownAnalysis = new BreakdownFrequencyAnalysis();
    this.carWashChecker = new CarWashRecommendations();
    this.partsForecast = new PartsPurchaseForecast();
    this.carRecommendations = new CarRecommendations();
    this.maintenanceForecastModule = new MaintenanceForecast();

    this.state = {
      searchTerm: "",
      selectedCity: "Всі міста",
      selectedCar: null,
      selectedStatus: "all",
      selectedPartFilter: null,
      selectedHistoryPartFilter: null,
      historySearchTerm: "",
      currentView: "list",
      selectedYear: null,
      selectedHealthStatus: null,
      selectedModel: null,
      partsFilter: "all",
    };

    this.focusInfo = null;
    this.renderScheduled = false;
    this.isTyping = false;

    // Кеш для результатів пошуку
    this.searchCache = new Map();
    this.historySearchCache = new Map();

    // Debounce таймери
    this.searchDebounceTimer = null;
    this.historySearchDebounceTimer = null;

    this.init();
  }

  async init() {
    this.updateLoadingProgress(10);
    this.setupEventListeners();
    this.updateLoadingProgress(20);

    const cached = this.getCachedData();
    if (cached && cached.carsInfo && Object.keys(cached.carsInfo).length > 0) {
      this.appData = cached;
      this.maintenanceRegulations = cached.regulations || [];
      if (
        cached.processedCars &&
        Array.isArray(cached.processedCars) &&
        cached.processedCars.length > 0
      ) {
        this.processedCars = cached.processedCars;
      }
      requestAnimationFrame(() => {
        this.render();
        this.updateLoadingProgress(100);
      });
    }

    this.loadData().catch((error) => {
      console.error("Помилка оновлення даних:", error);
    });

    if (
      !cached ||
      !cached.carsInfo ||
      Object.keys(cached.carsInfo).length === 0
    ) {
      // Чекаємо на завантаження даних
      this.loadData()
        .then(() => {
          this.updateLoadingProgress(100);
          setTimeout(() => {
            this.render();

            // Прокручуємо до верху після рендерингу для повного відображення
            setTimeout(() => {
              window.scrollTo({ top: 0, behavior: "instant" });
              requestAnimationFrame(() => {
                const header = document.getElementById("main-page-header");
                if (header) {
                  header.scrollIntoView({
                    behavior: "instant",
                    block: "start",
                  });
                }
              });
            }, 100);
          }, 100);
        })
        .catch((error) => {
          console.error("❌ Помилка завантаження даних:", error);
          this.updateLoadingProgress(100);
          const loadingScreen = document.getElementById("loading-screen");
          if (loadingScreen) {
            loadingScreen.classList.add("hidden");
          }
          const mainInterface = document.getElementById("main-interface");
          if (mainInterface) {
            mainInterface.classList.remove("hidden");
          }
          this.showError(
            `Помилка завантаження: ${error.message || "Невідома помилка"}`,
          );
        });
    } else {
      // Якщо був кеш, оновлюємо даних не потрібно тут нічого робити, обробляється в loadData/init
    }

    this.startAutoRefresh();
  }

  // === БАЗОВІ МЕТОДИ ПАРСИНГУ ===
  // Використовуємо модуль Formatters
  parseNumber(value) {
    return Formatters.parseNumber(value);
  }

  convertToThousands(value) {
    return Formatters.convertToThousands(value);
  }

  formatNumber(number) {
    return Formatters.formatNumber(number);
  }

  formatMileage(mileage) {
    return Formatters.formatMileage(mileage);
  }

  getOriginalMileage(mileage) {
    return Formatters.getOriginalMileage(mileage);
  }

  formatMileageDiff(mileageDiff) {
    return Formatters.formatMileageDiff(mileageDiff);
  }

  formatPrice(price) {
    return Formatters.formatPrice(price);
  }

  // === ОБРОБКА ДАТИ ===
  formatDate(dateString) {
    return Formatters.formatDate(dateString);
  }

  parseDate(dateString) {
    return Formatters.parseDate(dateString);
  }

  // === ПІДПИСКА НА ПОДІЇ ===
  setupEventListeners() {
    document.getElementById("refresh-data")?.addEventListener("click", () => {
      this.refreshData(true);
    });

    document.getElementById("clear-cache")?.addEventListener("click", () => {
      this.clearCache();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.state.selectedCar) {
        this.state.selectedCar = null;
        this.state.selectedHistoryPartFilter = null;
        this.state.historySearchTerm = "";
        this.render();
      }

      if (e.ctrlKey && e.key === "r") {
        e.preventDefault();
        this.refreshData(true);
      }
    });
  }

  // === ЗАВАНТАЖЕННЯ ДАНИХ ===
  updateLoadingProgress(percent) {
    const bar = document.getElementById("loading-bar");
    if (bar) {
      bar.style.width = `${percent}%`;
    }
  }

  async loadData() {
    try {
      const cached = this.getCachedData();
      let hasCache = false;

      if (
        cached &&
        cached.carsInfo &&
        Object.keys(cached.carsInfo).length > 0
      ) {
        this.appData = cached;
        this.maintenanceRegulations = cached.regulations || [];
        if (cached.processedCars && Array.isArray(cached.processedCars)) {
          this.processedCars = cached.processedCars;
        }
        this.updateCacheInfo();
        hasCache = true;

        this.render();

        // Додаємо бейдж 'КЕШ' в статусі оновлення
        const lastUpdatedEl = document.getElementById("last-updated");
        if (lastUpdatedEl && !lastUpdatedEl.innerHTML.includes("КЕШ")) {
          lastUpdatedEl.innerHTML += ' <span style="background:var(--warning-color,#fbbf24);color:#000;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:bold;margin-left:8px;">КЕШ</span>';
        }
      }

      if (hasCache) {
        // Завжди оновлюємо дані у фоні
        setTimeout(async () => {
          try {
            const isChanged = await this.fetchDataFromAPI();
            // Оновлюємо відображення, якщо дані змінилися і користувач не відкрив модалку конкретного авто
            if (isChanged && this.state.selectedCar === null) {
              this.render();
              // Змінюємо бейдж на ОНОВЛЕНО
              const lastUpdatedEl = document.getElementById("last-updated");
              if (lastUpdatedEl) {
                lastUpdatedEl.innerHTML = this.appData.lastUpdated ? this.formatDate(this.appData.lastUpdated.split("T")[0]) : 'Щойно';
                lastUpdatedEl.innerHTML += ' <span style="background:var(--success-color,#10b981);color:#fff;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:bold;margin-left:8px;">ОНОВЛЕНО</span>';
              }
            } else if (!isChanged) {
              console.log("Фонові дані ідентичні кешу, пропускаємо рендер");
            }
          } catch (error) {
            console.warn("Фонова помилка оновлення:", error);
          }
        }, 50);
      } else {
        // Немає кешу - завантажуємо синхронно
        await this.fetchDataFromAPI();
      }

    } catch (error) {
      console.error("❌ Помилка завантаження даних:", error);
      this.showError(`Помилка завантаження: ${error.message}`);
    }
  }

  /**
   * Завантажує дані з backend API
   */
  async fetchDataFromAPI() {
    // Статичний Vercel-деплой не має backend API — одразу йдемо в Google Sheets
    return await this.fetchDataFromSheets();
  }

  /**
   * Fallback метод - завантажує дані напряму з Google Sheets (якщо API недоступний)
   */
  async fetchDataFromSheets() {
    const { SPREADSHEET_ID, SHEETS, API_KEY } = CONFIG;

    if (!SPREADSHEET_ID || !SHEETS || !API_KEY) {
      throw new Error("Не визначено конфігурацію для Google Sheets");
    }

    this.updateLoadingProgress(30);
    this.updateLoadingProgress(40);
    const [scheduleData, historyData, regulationsData, photoAssessmentData] =
      await Promise.all([
        this.fetchSheetData(SPREADSHEET_ID, SHEETS.SCHEDULE, API_KEY),
        this.fetchSheetData(SPREADSHEET_ID, SHEETS.HISTORY, API_KEY),
        this.fetchSheetData(SPREADSHEET_ID, SHEETS.REGULATIONS, API_KEY),
        this.fetchSheetData(SPREADSHEET_ID, SHEETS.PHOTO_ASSESSMENT, API_KEY),
      ]);

    if (!scheduleData || !historyData) {
      throw new Error("Не вдалося завантажити основні дані з Google Sheets");
    }

    const getComparableData = (data) => JSON.stringify({
      carsInfo: data?.carsInfo || {},
      records: data?.records || [],
      regulations: data?.regulations || []
    });
    const oldDataStr = getComparableData(this.appData);

    this.updateLoadingProgress(60);
    this.updateLoadingProgress(70);
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

    const newDataStr = getComparableData(this.appData);
    const isDataChanged = oldDataStr !== newDataStr;

    this.updateLoadingProgress(80);
    this.cacheData(this.appData);
    this.updateCacheInfo();

    return isDataChanged;
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

  // === ОБРОБКА ДАНИХ ===
  // Використовуємо модуль DataProcessor
  processData(scheduleData, historyData, regulationsData, photoAssessmentData) {
    const result = DataProcessor.processData(
      scheduleData,
      historyData,
      regulationsData,
      photoAssessmentData,
      (value) => this.parseNumber(value),
      (dateString) => this.parseDate(dateString),
      (dateString) => this.formatDate(dateString),
    );

    this.appData = result.appData;
    this.maintenanceRegulations = result.maintenanceRegulations;

    this.processedCars = null;
    this.filteredCars = null;
  }

  processRegulations(regulationsData) {
    this.maintenanceRegulations = DataProcessor.processRegulations(
      regulationsData,
      (value) => this.parseNumber(value),
    );
  }

  // === КЕШУВАННЯ ===
  // Використовуємо модуль CacheManager
  getCachedData() {
    return CacheManager.getCachedData();
  }

  cacheData(data) {
    CacheManager.cacheData(data);
  }

  clearCache() {
    const success = CacheManager.clearCache();
    this.processedCars = null;
    this.filteredCars = null;
    if (success) {
      this.showNotification("Кеш успішно очищено", "success");
    } else {
      this.showNotification("Помилка очищення кешу", "error");
    }
    this.updateCacheInfo();
  }

  updateCacheInfo() {
    CacheManager.updateCacheInfo();
  }

  // === АВТООНОВЛЕННЯ ===
  startAutoRefresh() {
    const calculateTimeUntilRefresh = () => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const refreshTime = new Date(today);
      const [hours, minutes] =
        CONFIG.REFRESH_TIME.split(":").map(Number);
      refreshTime.setHours(hours, minutes, 0, 0);

      if (now >= refreshTime) {
        refreshTime.setDate(refreshTime.getDate() + 1);
      }

      return refreshTime - now;
    };

    const firstRefreshDelay = calculateTimeUntilRefresh();
    setTimeout(() => {
      this.refreshData();
      setInterval(() => this.refreshData(), 24 * 60 * 60 * 1000);
    }, firstRefreshDelay);
  }

  // === ОСНОВНІ МЕТОДИ РЕНДЕРУ ===
  render() {
    if (!this.appData) {
      this.showError("Дані не завантажено");
      return;
    }

    if (!this.appData._meta || this.appData._meta.totalCars === 0) {
      this.renderNoData();
      return;
    }

    if (this.state.selectedCar) {
      this.renderCarDetail();
    } else {
      this.renderCarList();
    }
  }

  renderNoData() {
    const html = `
            <div class="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-900">
                <div class="text-center max-w-md">
                    <div class="text-4xl mb-4">🚫</div>
                    <h1 class="text-2xl font-bold text-white mb-2">Немає даних</h1>
                    <p class="text-blue-200 text-sm mb-6">Не знайдено автомобілів для відображення</p>
                    <div class="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                        <div class="text-white text-sm mb-3">
                            Можливі причини:
                            <ul class="text-left mt-2 text-blue-200">
                                <li>• Аркуш "ГРАФІК ОБСЛУГОВУВАННЯ" порожній</li>
                                <li>• Неправильні назви аркушів</li>
                                <li>• Проблеми з API ключем</li>
                            </ul>
                        </div>
                        <button onclick="app.refreshData(true)"
                                class="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors w-full">
                            🔄 Спробувати знову
                        </button>
                    </div>
                </div>
            </div>
        `;

    document.getElementById("main-interface").innerHTML = html;

    // Ховаємо екран завантаження
    const loadingScreen = document.getElementById("loading-screen");
    if (loadingScreen) loadingScreen.classList.add("hidden");
    const mainInterface = document.getElementById("main-interface");
    if (mainInterface) mainInterface.classList.remove("hidden");
  }

  renderCarList() {
    // Очищаємо обробники компактного режиму, якщо вони є
    this.cleanupCompactHeader();
    // Очищаємо обробники закріплення фільтрів, якщо вони є
    this.cleanupStickyFilters();

    // Якщо processedCars вже є - рендеримо одразу без затримок
    if (
      this.processedCars &&
      Array.isArray(this.processedCars) &&
      this.processedCars.length > 0
    ) {
      const data = this.processedCars;
      const filteredData = CarFilters.filterCars(data);
      const cities = this.getCities(data);
      const stats = this.calculateStats(data);

      const html = this.generateCarListHTML(data, filteredData, cities, stats);
      const mainInterface = document.getElementById("main-interface");
      if (mainInterface) {
        mainInterface.innerHTML = html;

        // Ховаємо екран завантаження
        const loadingScreen = document.getElementById("loading-screen");
        if (loadingScreen) loadingScreen.classList.add("hidden");
        mainInterface.classList.remove("hidden");

        this.setupEventHandlersAfterRender(mainInterface);
      }
      return;
    }

    // Якщо processedCars немає - обробляємо асинхронно
    requestAnimationFrame(async () => {
      if (!this.processedCars) {
        this.updateLoadingProgress(60);
        await new Promise((resolve) => {
          setTimeout(() => {
            this.processedCars = CarProcessor.processCarData();
            try {
              if (this.appData) {
                this.cacheData({
                  ...this.appData,
                  processedCars: this.processedCars,
                });
              }
            } catch (e) {
              console.warn("⚠️ Не вдалося закешувати processedCars:", e);
            }
            resolve();
          }, 0);
        });
        this.updateLoadingProgress(80);
      }

      const data = this.processedCars;
      const filteredData = CarFilters.filterCars(data);
      const cities = this.getCities(data);
      // Розраховуємо статистику на основі всіх даних, використовуючи ту саму логіку, що і фільтр
      const stats = this.calculateStats(data);

      // Використовуємо DocumentFragment для швидшого рендерингу
      this.updateLoadingProgress(90);
      const html = this.generateCarListHTML(data, filteredData, cities, stats);
      const mainInterface = document.getElementById("main-interface");
      if (mainInterface) {
        mainInterface.innerHTML = html;
        // Забезпечуємо, що контент видимий
        const loadingScreen = document.getElementById("loading-screen");
        if (loadingScreen) loadingScreen.classList.add("hidden");

        mainInterface.style.display = "block";
        mainInterface.style.visibility = "visible";
        mainInterface.style.opacity = "1";
        mainInterface.classList.remove("hidden");

        // Прокручуємо до верху сторінки для повного відображення
        requestAnimationFrame(() => {
          window.scrollTo({ top: 0, behavior: "instant" });
          // Додатково перевіряємо, чи всі елементи завантажені
          setTimeout(() => {
            const header = document.getElementById("main-page-header");
            if (header) {
              header.scrollIntoView({ behavior: "instant", block: "start" });
            }
          }, 50);
        });

        this.setupEventHandlersAfterRender(mainInterface);
      }
    });
  }

  setupEventHandlersAfterRender(mainInterface) {
    const appInstance = this;
    this.updateLoadingProgress(100);
    // Налаштовуємо закріплення фільтрів та заголовка таблиці
    this.initStickyFiltersAndTable();

    // Обробник фільтра по місту
    const cityFilter = document.getElementById("city-filter-select");
    if (cityFilter && !cityFilter.dataset.handlerAdded) {
      cityFilter.dataset.handlerAdded = "true";
      cityFilter.addEventListener("change", function (e) {
        appInstance.setState({ selectedCity: e.target.value });
      });
    }

    // Обробник фільтра по стану авто
    const healthStatusFilter = document.getElementById(
      "health-status-filter-select",
    );
    if (healthStatusFilter && !healthStatusFilter.dataset.handlerAdded) {
      healthStatusFilter.dataset.handlerAdded = "true";
      healthStatusFilter.addEventListener("change", function (e) {
        appInstance.setState({
          selectedHealthStatus: e.target.value === "" ? null : e.target.value,
        });
      });
    }

    // Обробник фільтра по марці
    const modelFilter = document.getElementById("model-filter-select");
    if (modelFilter && !modelFilter.dataset.handlerAdded) {
      modelFilter.dataset.handlerAdded = "true";
      modelFilter.addEventListener("change", function (e) {
        appInstance.setState({
          selectedModel: e.target.value === "" ? null : e.target.value,
        });
      });
    }

    // Обробник кліків на картки статусів
    const statusCards = mainInterface.querySelectorAll("[data-status-card]");
    statusCards.forEach((card) => {
      if (!card.dataset.handlerAdded) {
        card.dataset.handlerAdded = "true";
        card.addEventListener("click", function () {
          const status = this.getAttribute("data-status-card");
          appInstance.setState({ selectedStatus: status });
        });
      }
    });

    // Обробник кнопки скидання фільтра
    const clearFilterBtn = document.getElementById("clear-part-filter-btn");
    if (clearFilterBtn && !clearFilterBtn.dataset.handlerAdded) {
      clearFilterBtn.dataset.handlerAdded = "true";
      clearFilterBtn.addEventListener("click", function () {
        appInstance.clearPartFilter();
      });
    }

    // Оновлюємо футер з інформацією про оновлення
    if (this.processedCars && this.processedCars.length > 0) {
      this.updateFooter(this.processedCars.length);
    }
  }

  /**
   * Оновлює футер з інформацією про оновлення
   */
  updateFooter(allCarsCount) {
    if (!this.appData) return;

    // Форматуємо дату в формат DD.MM.YYYY
    const formatDateForFooter = (dateString) => {
      if (!dateString) return "";

      // Якщо дата в форматі YYYY-MM-DD (ISO)
      if (typeof dateString === "string" && dateString.includes("-")) {
        const parts = dateString.split("-");
        if (parts.length === 3) {
          const [year, month, day] = parts;
          return `${day.padStart(2, "0")}.${month.padStart(2, "0")}.${year}`;
        }
      }

      // Якщо дата в форматі DD.MM.YYYY
      if (typeof dateString === "string" && dateString.includes(".")) {
        const parts = dateString.split(".");
        if (parts.length === 3) {
          const [day, month, year] = parts;
          return `${day.padStart(2, "0")}.${month.padStart(2, "0")}.${year}`;
        }
      }

      // Спробуємо розпарсити як Date об'єкт
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
      }

      return String(dateString);
    };

    // Розраховуємо час до наступного оновлення
    const now = new Date();
    const refreshTime = new Date();
    const [hours, minutes] = (CONFIG.REFRESH_TIME || "06:00")
      .split(":")
      .map(Number);
    refreshTime.setHours(hours, minutes, 0, 0);

    if (now >= refreshTime) {
      refreshTime.setDate(refreshTime.getDate() + 1);
    }

    const hoursUntil = Math.floor((refreshTime - now) / (1000 * 60 * 60));
    const minutesUntil = Math.floor(
      ((refreshTime - now) % (1000 * 60 * 60)) / (1000 * 60),
    );
    const nextRefreshInfo = `Наступне оновлення: ${CONFIG.REFRESH_TIME} (через ${hoursUntil}г ${minutesUntil}хв)`;

    const formattedDate = formatDateForFooter(this.appData.currentDate);
    const totalRecords = this.appData._meta?.totalRecords || 0;

    // Оновлюємо футер
    const footerInfo = document.getElementById("footer-update-info");
    if (footerInfo) {
      footerInfo.innerHTML = `
                <p class="mt-0.5 text-xs opacity-70">© 2026 • Версія 6.0 • Оновлення щодня о 06:00</p>
                <p class="mt-1 text-xs opacity-60">Дата оновлення: ${formattedDate} • ${allCarsCount} авто • ${totalRecords} записів • ${nextRefreshInfo}</p>
            `;
    }
  }

  renderCarDetail() {
    // Використовуємо requestAnimationFrame для асинхронного рендерингу
    requestAnimationFrame(() => {
      if (!this.processedCars) {
        this.processedCars = CarProcessor.processCarData();
        // При першому розрахунку також оновлюємо кеш processedCars
        try {
          if (this.appData) {
            const dataToCache = {
              ...this.appData,
              processedCars: this.processedCars,
            };
            this.cacheData(dataToCache);
          }
        } catch (e) {
          console.warn("⚠️ Не вдалося закешувати processedCars (detail):", e);
        }
      }

      const data = this.processedCars;
      const car = data.find((c) => c.car === this.state.selectedCar);

      if (!car) {
        this.state.selectedCar = null;
        this.render();
        return;
      }

      const html = this.generateCarDetailHTML(car);
      const mainInterface = document.getElementById("main-interface");
      if (mainInterface) {
        mainInterface.innerHTML = html;

        const loadingScreen = document.getElementById("loading-screen");
        if (loadingScreen) loadingScreen.classList.add("hidden");
        mainInterface.classList.remove("hidden");


        // Ініціалізуємо компактний режим шапки при прокрутці
        this.initCompactHeader();

        // Відновлюємо фокус тільки якщо не відбувається введення тексту
        if (!this.isTyping) {
          this.restoreFocus();
        }
      }
    });
  }

  // === ФОКУС У ПОШУКУ ===
  saveFocus() {
    const activeElement = document.activeElement;
    if (
      activeElement &&
      (activeElement.id === "mainSearchInput" ||
        activeElement.id === "historySearchInput")
    ) {
      this.focusInfo = {
        id: activeElement.id,
        value: activeElement.value,
        selectionStart: activeElement.selectionStart,
        selectionEnd: activeElement.selectionEnd,
      };
    } else {
      this.focusInfo = null;
    }
  }

  restoreFocus() {
    if (this.focusInfo) {
      setTimeout(() => {
        const element = document.getElementById(this.focusInfo.id);
        if (element) {
          if (
            this.focusInfo.id === "mainSearchInput" &&
            element.value !== this.state.searchTerm
          ) {
            element.value = this.state.searchTerm;
          } else if (
            this.focusInfo.id === "historySearchInput" &&
            element.value !== this.state.historySearchTerm
          ) {
            element.value = this.state.historySearchTerm;
          }

          element.focus();
          element.setSelectionRange(
            this.focusInfo.selectionStart,
            this.focusInfo.selectionEnd,
          );
        }
        this.focusInfo = null;
      }, 10);
    }
  }

  // === ОБРОБКА ВВОДУ ===
  handleSearchInput(event) {
    // Оновлюємо значення в полі вводу одразу (без рендерингу)
    const searchValue = event.target.value;
    this.state.searchTerm = searchValue;

    // Зберігаємо фокус, оскільки при рендерінгу перемальовується весь список
    this.isTyping = true;
    this.saveFocus();

    // Очищаємо попередній таймер
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }

    // Використовуємо debounce для рендерингу (300ms)
    this.searchDebounceTimer = setTimeout(() => {
      this.filteredCars = null;
      this.renderCarList();
      this.restoreFocus();
      setTimeout(() => this.isTyping = false, 50);
    }, 300);
  }

  // Обробка натискання Enter в пошуку
  handleSearchKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      // Очищаємо таймер і рендеримо одразу
      if (this.searchDebounceTimer) {
        clearTimeout(this.searchDebounceTimer);
      }
      this.filteredCars = null;
      this.renderCarList();
    }
  }

  handleHistorySearchInput(event) {
    // Оновлюємо значення в полі вводу одразу (без рендерингу)
    const searchValue = event.target.value;
    this.state.historySearchTerm = searchValue;

    // Зберігаємо фокус
    this.isTyping = true;
    this.saveFocus();

    // Очищаємо попередній таймер
    if (this.historySearchDebounceTimer) {
      clearTimeout(this.historySearchDebounceTimer);
    }

    // Використовуємо debounce для рендерингу (300ms)
    this.historySearchDebounceTimer = setTimeout(() => {
      this.renderCarDetail();
      this.restoreFocus();
      setTimeout(() => this.isTyping = false, 50);
    }, 300);
  }

  // Обробка натискання Enter в пошуку історії
  handleHistorySearchKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      // Очищаємо таймер і рендеримо одразу
      if (this.historySearchDebounceTimer) {
        clearTimeout(this.historySearchDebounceTimer);
      }
      this.renderCarDetail();
    }
  }

  handleSelectChange(event) {
    this.setState({ selectedCity: event.target.value });
  }

  // === ОБРОБКА АВТОМОБІЛІВ ===
  // Використовуємо модуль CarProcessor (fallback, якщо processedCars не завантажені з API)
  processCarData() {
    // Якщо processedCars вже є (з API або кешу), повертаємо їх
    if (
      this.processedCars &&
      Array.isArray(this.processedCars) &&
      this.processedCars.length > 0
    ) {
      return this.processedCars;
    }

    // Інакше обробляємо локально (fallback)
    return CarProcessor.processCarData(
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

  // === СТАН ЗАПЧАСТИН ===
  // Використовуємо модуль CarProcessor
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

  getPartStatusLegacy(partName, mileageDiff, daysDiff, carYear, carModel) {
    return CarProcessor.getPartStatusLegacy(
      partName,
      mileageDiff,
      daysDiff,
      carYear,
      carModel,
    );
  }

  // === ФІЛЬТРАЦІЯ ===
  // Використовуємо модуль CarFilters
  filterCars(cars) {
    return CarFilters.filterCars(
      cars,
      this.state,
      (car) => this.calculateHealthScore(car),
      (score, car) => this.getHealthScoreLabel(score, car),
    );
  }

  filterCarHistory(history, partFilter, searchTerm) {
    return CarFilters.filterCarHistory(history, partFilter, searchTerm);
  }

  // === ГЕНЕРАЦІЯ HTML ДЛЯ СПИСКУ АВТО ===
  generateCarListHTML(allCars, filteredCars, cities, stats) {
    const importantParts = CONSTANTS.PARTS_ORDER.slice(0, 7);

    // Розрахунок середнього Fleet Health, пробігу та віку
    let totalHealthScore = 0;
    let healthCount = 0;
    let totalMileage = 0;
    let mileageCount = 0;
    let totalAge = 0;
    let ageCount = 0;
    const currentYear = new Date().getFullYear();

    // Знаходимо останній пробіг для кожного авто з історії записів
    // Для кожного авто беремо пробіг з останнього запису (найпізніша дата)
    const records = this.appData.records || [];
    const lastMileageByCar = {};

    records.forEach((record) => {
      if (!record.car || !record.mileage || !record.date) return;

      const carLicense = record.car;
      // Використовуємо parseDate для правильного парсингу дати
      const recordDate = this.parseDate(record.date);

      // Пропускаємо, якщо дата невалідна
      if (!recordDate || isNaN(recordDate.getTime())) {
        return;
      }

      // Якщо для цього авто ще немає запису, або цей запис пізніший
      if (
        !lastMileageByCar[carLicense] ||
        recordDate > lastMileageByCar[carLicense].date
      ) {
        lastMileageByCar[carLicense] = {
          mileage: record.mileage,
          date: recordDate,
        };
      }
    });

    allCars.forEach((car) => {
      const healthScore = this.calculateHealthScore(car);
      totalHealthScore += healthScore;
      healthCount++;

      // Розрахунок середнього пробігу по одометру
      // Алгоритм: для кожного авто беремо пробіг з останнього запису
      // Потім сума всіх пробігів поділена на кількість авто
      // Наприклад: авто1=150000, авто2=100000, авто3=250000
      // Сума: 500000, Середнє: 500000/3 = 166666 км

      // Беремо пробіг з останнього запису для цього авто
      const lastMileage = lastMileageByCar[car.license];
      if (lastMileage && lastMileage.mileage > 0) {
        totalMileage += lastMileage.mileage;
        mileageCount++;
      }

      // Розрахунок середнього віку
      if (car.year && car.year > 0) {
        const carAge = currentYear - parseInt(car.year);
        if (carAge > 0) {
          totalAge += carAge;
          ageCount++;
        }
      }
    });

    const averageFleetHealth =
      healthCount > 0 ? Math.round(totalHealthScore / healthCount) : 0;
    const fleetHealthColor = this.getHealthScoreTextColor(averageFleetHealth);
    const fleetHealthLabel =
      StatsCalculator.getHealthScoreLabel(averageFleetHealth);

    // Середній пробіг: сума всіх пробігів поділена на кількість авто
    // Наприклад: (150000 + 100000 + 250000) / 3 = 166666 км
    const averageMileage =
      mileageCount > 0 ? Math.round(totalMileage / mileageCount) : 0;

    // Average mileage calculation complete

    const averageAge = ageCount > 0 ? Math.round(totalAge / ageCount) : 0;

    // Функції для визначення кольорів фону карток
    const getMileageCardColor = (mileage) => {
      if (mileage <= 200000) return "#3b82f6"; // синій
      if (mileage <= 399999) return "#fb923c"; // помаранчевий
      return "#ef4444"; // червоний
    };

    const getAgeCardColor = (age) => {
      if (age <= 7) return "#10b981"; // зелений
      if (age <= 14) return "#8b5cf6"; // фіолетовий
      return "#991b1b"; // бордовий
    };

    return `
            <div class="min-h-screen bg-gray-50">
                <div class="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-b-xl shadow-xl" id="main-page-header" style="padding-top: 0.7rem; padding-bottom: 0.7rem; margin-bottom: 0.5rem;">
                    <div class="w-full px-3 sm:px-4 md:px-5">
                        <div class="flex flex-col lg:flex-row items-center lg:items-start lg:items-center gap-3 lg:gap-3">
                            <!-- Логотип та назва -->
                            <div class="flex flex-col items-center lg:items-start flex-shrink-0 w-full lg:w-auto" style="min-width: 0;">
                                <style>
                                    .logo-header { 
                                        height: 36px; 
                                        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1)); 
                                        width: auto; 
                                    }
                                    @media (min-width: 640px) {
                                        .logo-header { height: 40px !important; }
                                    }
                                    @media (min-width: 768px) {
                                        .logo-header { height: 48px !important; }
                                    }
                                    @media (min-width: 1024px) {
                                        .logo-header { height: 52px !important; }
                                    }
                                </style>
                                <img src="Logo.png" alt="Dondyk AutoHub" class="logo-header mb-0.5" onerror="this.style.display='none';">
                                <p class="text-blue-100 text-[10px] sm:text-xs whitespace-nowrap font-semibold text-center lg:text-left" style="line-height: 1.2;">AI-панель по обслуговуванню авто</p>
                            </div>
                            
                            <!-- Картки метрик -->
                            <div class="flex flex-wrap lg:flex-nowrap items-center flex-1 justify-center gap-2 sm:gap-3 lg:gap-2 xl:gap-3 w-full lg:w-auto">
                                <div class="bg-blue-400 rounded-xl shadow-lg flex-shrink-0 flex flex-col justify-between stats-card" style="min-width: 140px; width: calc(33.333% - 0.5rem); max-width: 200px; height: 65px; padding-left: 0.75rem; padding-right: 0.75rem; padding-top: 0.3rem; padding-bottom: 0.3rem;">
                                    <div class="text-white text-[9px] xs:text-[10px] sm:text-xs mb-0.5 text-left font-medium leading-tight">💓 Середній стан автопарку</div>
                                    <div class="text-white text-lg sm:text-xl md:text-2xl font-bold text-center mb-0.5">
                                        ${averageFleetHealth}%
                            </div>
                                    <div class="text-white text-[8px] xs:text-[9px] sm:text-[10px] text-center">${fleetHealthLabel}</div>
                        </div>
                                <div class="rounded-xl shadow-lg flex-shrink-0 flex flex-col justify-between stats-card-mileage" style="background-color: ${getMileageCardColor(averageMileage)}; min-width: 140px; width: calc(33.333% - 0.5rem); max-width: 220px; height: 65px; padding-left: 0.75rem; padding-right: 0.75rem; padding-top: 0.3rem; padding-bottom: 0.3rem;">
                                    <div class="text-white text-[9px] xs:text-[10px] sm:text-xs mb-0.5 text-left font-medium leading-tight">🚗💨 Середній пробіг автопарку</div>
                                    <div class="text-white text-lg sm:text-xl md:text-2xl font-bold text-center mb-0.5">
                                        ${this.formatMileage(averageMileage)}
                    </div>
                                    <div class="text-white text-[8px] xs:text-[9px] sm:text-[10px] text-center" style="visibility: hidden;">&nbsp;</div>
                                </div>
                                <div class="rounded-xl shadow-lg flex-shrink-0 flex flex-col justify-between stats-card" style="background-color: ${getAgeCardColor(averageAge)}; min-width: 140px; width: calc(33.333% - 0.5rem); max-width: 200px; height: 65px; padding-left: 0.75rem; padding-right: 0.75rem; padding-top: 0.3rem; padding-bottom: 0.3rem;">
                                    <div class="text-white text-[9px] xs:text-[10px] sm:text-xs mb-0.5 text-left font-medium leading-tight">🎂 Середній вік авто</div>
                                    <div class="text-white text-lg sm:text-xl md:text-2xl font-bold text-center mb-0.5">
                                        ${averageAge}
                                    </div>
                                    <div class="text-white text-[8px] xs:text-[9px] sm:text-[10px] text-center">${this.getAgeLabel(averageAge)}</div>
                                </div>
                            </div>
                            <style>
                                @media (min-width: 1024px) {
                                    .stats-card {
                                        width: 200px !important;
                                        height: 75px !important;
                                    }
                                    .stats-card-mileage {
                                        width: 220px !important;
                                        height: 75px !important;
                                    }
                                }
                                @media (max-width: 640px) {
                                    .stats-card {
                                        width: calc(33.333% - 0.33rem) !important;
                                        min-width: 110px !important;
                                        height: 60px !important;
                                    }
                                    .stats-card-mileage {
                                        width: calc(33.333% - 0.33rem) !important;
                                        min-width: 110px !important;
                                        height: 60px !important;
                                    }
                                }
                                @media (max-width: 480px) {
                                    .stats-card, .stats-card-mileage {
                                        min-width: 100px !important;
                                        padding-left: 0.5rem !important;
                                        padding-right: 0.5rem !important;
                                    }
                                }
                                @media (max-width: 360px) {
                                    .stats-card, .stats-card-mileage {
                                        min-width: 90px !important;
                                        padding-left: 0.4rem !important;
                                        padding-right: 0.4rem !important;
                                    }
                                }
                            </style>
                            
                            <!-- Кнопки Аналітика та Звіти -->
                            <div class="flex-shrink-0 w-full lg:w-auto flex justify-center lg:justify-end gap-2">
                                <a href="analytics.html" class="magic-analytics-button-compact">
                                    Аналітика та звіти
                                </a>
                                <a href="reports.html" class="magic-analytics-button-compact" style="background: linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%);">
                                    📊 Звіти по ТО
                                </a>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="w-full px-3 sm:px-4">
                    <div class="grid grid-cols-2 sm:grid-cols-4" id="main-stats-cards" style="gap: 1rem; margin-bottom: 0.75rem;">
                        ${this.generateStatsCards(stats)}
                    </div>

                    <!-- Заповнювач для fixed фільтрів -->
                    <div id="main-filters-spacer" style="height: 0;"></div>
                    
                    <!-- Фільтри (закріплені вгорі) -->
                    <div class="bg-white rounded-t-xl shadow-lg border border-gray-200 border-b-0" id="main-filters-container" style="padding: 0.6rem 1rem; margin-bottom: 0;">
                        ${this.generateFiltersHTML(cities, allCars)}
                    </div>

                    <!-- Заповнювач для fixed шапки таблиці -->
                    <div id="main-table-header-spacer" style="height: 0;"></div>
                    
                    <!-- Шапка таблиці (закріплена під фільтрами) -->
                    <div id="main-table-header-container" class="bg-white rounded-b-xl shadow-lg border border-gray-200 border-t-0 overflow-hidden">
                        ${this.generateTableHeaderHTML(importantParts)}
                    </div>

                    <div class="bg-white rounded-xl shadow-xl overflow-hidden border border-gray-200" id="main-table-container">
                        ${this.generateCarsTableBody(filteredCars, importantParts)}
                    </div>

                    <div class="mt-4 bg-white rounded-xl shadow-lg p-4 border border-gray-200">
                        <h3 class="font-bold text-gray-800 mb-2 text-sm">📊 Легенда</h3>
                        <div class="flex flex-wrap gap-4 text-xs">
                            <div class="flex items-center gap-2"><div class="w-4 h-4 bg-green-500 rounded-full"></div><span>Норма</span></div>
                            <div class="flex items-center gap-2"><div class="w-4 h-4 bg-orange-500 rounded-full"></div><span>Увага</span></div>
                            <div class="flex items-center gap-2"><div class="w-4 h-4 bg-red-500 rounded-full"></div><span>Критично</span></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
  }

  generateStatsCards(stats) {
    const {
      totalCars,
      carsWithGood,
      carsWithWarning,
      carsWithCritical,
      carsExcellent,
      carsGood,
      carsSatisfactory,
      carsBad,
      carsCritical,
    } = stats;
    const { selectedStatus } = this.state;

    const cards = [
      {
        count: totalCars,
        label: "Всього авто",
        status: "all",
        color: "from-blue-500 to-blue-600",
        icon: "🚗",
        details: "",
      },
      {
        count: carsWithGood,
        label: "У нормі",
        status: "good",
        color: "from-green-500 to-green-600",
        icon: "✅",
        details: `Відмінний: ${carsExcellent || 0}, Добрий: ${carsGood || 0}`,
      },
      {
        count: carsWithWarning,
        label: "Увага",
        status: "warning",
        color: "from-orange-500 to-orange-600",
        icon: "⚠️",
        details: `Задовільний: ${carsSatisfactory || 0}`,
      },
      {
        count: carsWithCritical,
        label: "Критично",
        status: "critical",
        color: "from-red-500 to-red-600",
        icon: "⛔",
        details: `Критичний: ${carsCritical || 0}`,
      },
    ];

    return cards
      .map(
        (card) => `
            <div class="bg-gradient-to-br ${card.color} rounded-lg shadow-lg text-white cursor-pointer hover:shadow-xl transition-all ${selectedStatus === card.status ? "ring-2 ring-blue-300" : ""}" style="padding: 0.39rem;" data-status-card="${card.status}">
                <div class="flex items-center justify-between">
                    <div class="flex-1">
                        <div class="text-base sm:text-lg font-bold mb-0.5">${card.count}</div>
                        <div class="text-white/90 text-[11px] sm:text-[12px] font-medium mb-0.5">${card.label}</div>
                        ${card.details ? `<div class="text-white/80 text-[8px] sm:text-[9px] mt-0.5 leading-tight">${card.details}</div>` : ""}
                    </div>
                    <div class="text-lg sm:text-xl ml-2">${card.icon}</div>
                </div>
                ${selectedStatus === card.status ? '<div class="text-[9px] text-white/70 mt-0.5 sm:mt-1">● Активний</div>' : ""}
            </div>
        `,
      )
      .join("");
  }

  generateFiltersHTML(cities, allCars = []) {
    const {
      selectedPartFilter,
      searchTerm,
      selectedCity,
      selectedHealthStatus,
      selectedModel,
    } = this.state;

    const hasAnyFilter =
      selectedPartFilter ||
      selectedHealthStatus ||
      selectedModel ||
      (selectedCity && selectedCity !== "Всі міста");

    // Отримуємо список унікальних марок
    let models = [];
    const modelsSet = new Set();
    for (const car of allCars) {
      if (car.model) {
        const brand = car.model.split(" ")[0];
        if (brand) modelsSet.add(brand);
      }
    }
    models = Array.from(modelsSet).sort((a, b) => a.localeCompare(b, "uk"));

    const healthStatuses = [
      { value: null, label: "Всі стани" },
      { value: "Відмінний", label: "Відмінний" },
      { value: "Добрий", label: "Добрий" },
      { value: "Задовільний", label: "Задовільний" },
      { value: "Критичний", label: "Критичний" },
    ];

    return `
            <div class="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                <!-- Поле пошуку - гнучке, розтягується -->
                <div class="flex items-center gap-2 flex-1 min-w-[200px]">
                    <span class="text-gray-700 text-sm flex-shrink-0">🔍</span>
                    <label class="text-xs font-medium text-gray-700 whitespace-nowrap hidden sm:inline flex-shrink-0">Пошук авто:</label>
                    <input
                        type="text"
                        value="${searchTerm}"
                        oninput="app.handleSearchInput(event)"
                        onkeydown="app.handleSearchKeyDown(event)"
                        placeholder="Номер, модель, місто... (Enter для пошуку)"
                        class="px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-800 text-xs flex-1 min-w-0"
                        style="padding-top: 0.35rem; padding-bottom: 0.35rem;"
                        id="mainSearchInput"
                        autocomplete="off"
                        autocorrect="off"
                        spellcheck="false"
                    >
                </div>
                
                <!-- Dropdown Стан авто - фіксована ширина -->
                <div class="flex items-center gap-1.5 flex-shrink-0" style="width: 180px;">
                    <label class="text-xs font-medium text-gray-700 whitespace-nowrap hidden sm:inline">Стан авто:</label>
                    <select id="health-status-filter-select"
                            class="px-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-800 text-xs w-full"
                            style="padding-top: 0.35rem; padding-bottom: 0.35rem;">
                        ${healthStatuses
        .map((status) => {
          const isSelected =
            selectedHealthStatus === status.value ||
            (status.value === null &&
              selectedHealthStatus === null) ||
            (status.value === "" &&
              (selectedHealthStatus === null ||
                selectedHealthStatus === ""));
          return `<option value="${status.value === null ? "" : status.value}" ${isSelected ? "selected" : ""} class="text-gray-800 bg-white">${status.label}</option>`;
        })
        .join("")}
                    </select>
                </div>
                
                <!-- Dropdown Марка - фіксована ширина -->
                <div class="flex items-center gap-1.5 flex-shrink-0" style="width: 180px;">
                    <label class="text-xs font-medium text-gray-700 whitespace-nowrap hidden sm:inline">Марка:</label>
                    <select id="model-filter-select"
                            class="px-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-800 text-xs w-full"
                            style="padding-top: 0.35rem; padding-bottom: 0.35rem;">
                        <option value="" ${selectedModel === null ? "selected" : ""} class="text-gray-800 bg-white">Всі марки</option>
                        ${models
        .map(
          (model) => `
                            <option value="${model}" ${selectedModel === model ? "selected" : ""} class="text-gray-800 bg-white">${model}</option>
                        `,
        )
        .join("")}
                    </select>
                </div>
                
                <!-- Dropdown Місто - фіксована ширина -->
                <div class="flex items-center gap-1.5 flex-shrink-0" style="width: 180px;">
                    <label class="text-xs font-medium text-gray-700 whitespace-nowrap hidden sm:inline">Місто:</label>
                    <select id="city-filter-select"
                            class="px-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-800 text-xs w-full"
                            style="padding-top: 0.35rem; padding-bottom: 0.35rem;">
                        ${cities
        .map(
          (city) => `
                            <option value="${city}" ${city === selectedCity ? "selected" : ""} class="text-gray-800 bg-white">${city}</option>
                        `,
        )
        .join("")}
                    </select>
                </div>
                
                ${hasAnyFilter
        ? `
                    <button onclick="app.clearAllFilters();"
                            class="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors flex-shrink-0 whitespace-nowrap">
                        ✕ Скинути
                    </button>
                `
        : ""
      }
            </div>
            ${selectedPartFilter ||
        selectedHealthStatus ||
        selectedModel ||
        (selectedCity && selectedCity !== "Всі міста")
        ? `
                <div class="mt-3 space-y-2">
            ${selectedPartFilter
          ? `
                        <div class="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div class="text-sm font-semibold text-blue-800 flex items-center gap-2">
                        <span>📌</span>
                        <span>Активний фільтр: ${selectedPartFilter.partName} -
                        ${selectedPartFilter.status === "all"
            ? "Всі записи"
            : selectedPartFilter.status === "good"
              ? "✅ У нормі"
              : selectedPartFilter.status === "warning"
                ? "⚠️ Увага"
                : "⛔ Критично"
          }</span>
                    </div>
                        </div>
                    `
          : ""
        }
                    ${selectedHealthStatus
          ? `
                        <div class="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div class="text-sm font-semibold text-blue-800 flex items-center gap-2">
                                <span>📌</span>
                                <span>Активний фільтр: Стан авто - ${selectedHealthStatus}</span>
                            </div>
                        </div>
                    `
          : ""
        }
                    ${selectedModel
          ? `
                        <div class="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div class="text-sm font-semibold text-blue-800 flex items-center gap-2">
                                <span>📌</span>
                                <span>Активний фільтр: Марка - ${selectedModel}</span>
                            </div>
                        </div>
                    `
          : ""
        }
                    ${selectedCity && selectedCity !== "Всі міста"
          ? `
                        <div class="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div class="text-sm font-semibold text-blue-800 flex items-center gap-2">
                                <span>📌</span>
                                <span>Активний фільтр: Місто - ${selectedCity}</span>
                            </div>
                        </div>
                    `
          : ""
        }
                </div>
            `
        : ""
      }
        `;
  }

  generateTableHeaderHTML(importantParts) {
    const tableHeaders = this.generateTableHeaders(importantParts);
    return `
            <div class="overflow-x-auto w-full">
                <table id="cars-table-header-table" class="w-full min-w-[1100px]" style="table-layout: fixed; border-collapse: separate; border-spacing: 0;">
                    <thead id="cars-table-header" class="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                        <tr>
                            <th class="text-center font-bold uppercase w-[100px]" style="padding-left: 0.7rem; padding-right: 0.7rem; padding-top: 0.5rem; padding-bottom: 0.5rem; font-size: 0.625rem;">
                                <div class="cursor-pointer hover:bg-white/10 p-1 rounded transition-colors flex items-center justify-center"
                                     onclick="event.stopPropagation(); app.showHealthStatusFilterMenu(event);">
                                    Стан авто
                                </div>
                            </th>
                            <th class="text-center font-bold uppercase w-[90px]" style="padding-left: 0.7rem; padding-right: 0.7rem; padding-top: 0.5rem; padding-bottom: 0.5rem; font-size: 0.625rem;">Номер</th>
                            <th class="text-center font-bold uppercase mobile-hidden w-[120px]" style="padding-left: 0.7rem; padding-right: 0.7rem; padding-top: 0.5rem; padding-bottom: 0.5rem; font-size: 0.625rem;">
                                <div class="cursor-pointer hover:bg-white/10 p-1 rounded transition-colors flex items-center justify-center"
                                     onclick="event.stopPropagation(); app.showModelFilterMenu(event);">
                                    Марка
                                </div>
                            </th>
                            <th class="text-center font-bold uppercase mobile-hidden w-[50px]" style="padding-left: 0.7rem; padding-right: 0.7rem; padding-top: 0.5rem; padding-bottom: 0.5rem; font-size: 0.625rem;">Рік</th>
                            <th class="text-center font-bold uppercase w-[80px]" style="padding-left: 0.7rem; padding-right: 0.7rem; padding-top: 0.5rem; padding-bottom: 0.5rem; font-size: 0.625rem;">Місто</th>
                            <th class="text-center font-bold uppercase w-[80px]" style="padding-left: 0.7rem; padding-right: 0.7rem; padding-top: 0.5rem; padding-bottom: 0.5rem; font-size: 0.625rem;">Пробіг</th>
                            ${tableHeaders}
                            <th class="text-center font-bold uppercase mobile-hidden w-[50px]" style="padding-left: 0.35rem; padding-right: 0.35rem; padding-top: 0.5rem; padding-bottom: 0.5rem; font-size: 0.625rem;">✅</th>
                            <th class="text-center font-bold uppercase mobile-hidden w-[50px]" style="padding-left: 0.35rem; padding-right: 0.35rem; padding-top: 0.5rem; padding-bottom: 0.5rem; font-size: 0.625rem;">⚠️</th>
                            <th class="text-center font-bold uppercase mobile-hidden w-[50px]" style="padding-left: 0.35rem; padding-right: 0.35rem; padding-top: 0.5rem; padding-bottom: 0.5rem; font-size: 0.625rem;">⛔</th>
                            <th class="text-center font-bold uppercase w-[50px]" style="padding-left: 0.35rem; padding-right: 0.35rem; padding-top: 0.5rem; padding-bottom: 0.5rem; font-size: 0.625rem;">📋</th>
                        </tr>
                    </thead>
                </table>
            </div>
        `;
  }

  generateCarsTableBody(cars, importantParts) {
    if (cars.length === 0) {
      return `
                <div class="px-4 py-12 text-center">
                    <div class="text-gray-400 text-lg mb-2">🚫</div>
                    <div class="text-gray-600 font-medium">Автомобілів не знайдено</div>
                    <div class="text-gray-400 text-sm mt-1">Спробуйте змінити параметри пошуку</div>
                </div>
            `;
    }

    const tableRows = cars
      .map((car, idx) => this.generateCarRow(car, idx, importantParts))
      .join("");

    return `
            <div class="scroll-hint-container">
                <div class="overflow-x-auto w-full">
                    <table id="cars-table" class="w-full min-w-[1100px]" style="table-layout: fixed; border-collapse: separate; border-spacing: 0;">
                        <tbody class="divide-y divide-gray-200">
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
                <div class="mt-2 pt-2 text-center">
                    <div class="inline-flex items-center gap-2 text-xs text-gray-500">
                        <span>↔️</span>
                        <span>Гортай таблицю вправо</span>
                        <span>→</span>
                    </div>
                </div>
            </div>
        `;
  }

  generateCarsTable(cars, importantParts) {
    if (cars.length === 0) {
      return `
                <div class="px-4 py-12 text-center">
                    <div class="text-gray-400 text-lg mb-2">🚫</div>
                    <div class="text-gray-600 font-medium">Автомобілів не знайдено</div>
                    <div class="text-gray-400 text-sm mt-1">Спробуйте змінити параметри пошуку</div>
                </div>
            `;
    }

    const tableHeaders = this.generateTableHeaders(importantParts);
    const tableRows = cars
      .map((car, idx) => this.generateCarRow(car, idx, importantParts))
      .join("");

    return `
            <div class="scroll-hint-container">
                <div class="overflow-x-auto w-full">
                    <table id="cars-table" class="w-full min-w-[1100px]">
                        <thead id="cars-table-header" class="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                            <tr>
                                <th class="text-center font-bold uppercase w-[100px]" style="padding-left: 0.7rem; padding-right: 0.7rem; padding-top: 0.5rem; padding-bottom: 0.5rem; font-size: 0.625rem;">
                                    <div class="cursor-pointer hover:bg-white/10 p-1 rounded transition-colors flex items-center justify-center"
                                         onclick="event.stopPropagation(); app.showHealthStatusFilterMenu(event);">
                                        Стан авто
                                    </div>
                                </th>
                                <th class="text-center font-bold uppercase w-[90px]" style="padding-left: 0.7rem; padding-right: 0.7rem; padding-top: 0.5rem; padding-bottom: 0.5rem; font-size: 0.625rem;">Номер</th>
                                <th class="text-center font-bold uppercase mobile-hidden w-[120px]" style="padding-left: 0.7rem; padding-right: 0.7rem; padding-top: 0.5rem; padding-bottom: 0.5rem; font-size: 0.625rem;">
                                    <div class="cursor-pointer hover:bg-white/10 p-1 rounded transition-colors flex items-center justify-center"
                                         onclick="event.stopPropagation(); app.showModelFilterMenu(event);">
                                        Марка
                                    </div>
                                </th>
                                <th class="text-center font-bold uppercase mobile-hidden w-[50px]" style="padding-left: 0.7rem; padding-right: 0.7rem; padding-top: 0.5rem; padding-bottom: 0.5rem; font-size: 0.625rem;">Рік</th>
                                <th class="text-center font-bold uppercase w-[80px]" style="padding-left: 0.7rem; padding-right: 0.7rem; padding-top: 0.5rem; padding-bottom: 0.5rem; font-size: 0.625rem;">Місто</th>
                                <th class="text-center font-bold uppercase w-[80px]" style="padding-left: 0.7rem; padding-right: 0.7rem; padding-top: 0.5rem; padding-bottom: 0.5rem; font-size: 0.625rem;">Пробіг</th>
                                ${tableHeaders}
                                <th class="text-center font-bold uppercase mobile-hidden w-[50px]" style="padding-left: 0.35rem; padding-right: 0.35rem; padding-top: 0.5rem; padding-bottom: 0.5rem; font-size: 0.625rem;">✅</th>
                                <th class="text-center font-bold uppercase mobile-hidden w-[50px]" style="padding-left: 0.35rem; padding-right: 0.35rem; padding-top: 0.5rem; padding-bottom: 0.5rem; font-size: 0.625rem;">⚠️</th>
                                <th class="text-center font-bold uppercase mobile-hidden w-[50px]" style="padding-left: 0.35rem; padding-right: 0.35rem; padding-top: 0.5rem; padding-bottom: 0.5rem; font-size: 0.625rem;">⛔</th>
                                <th class="text-center font-bold uppercase w-[50px]" style="padding-left: 0.35rem; padding-right: 0.35rem; padding-top: 0.5rem; padding-bottom: 0.5rem; font-size: 0.625rem;">📋</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200">
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
                <div class="mt-2 pt-2 text-center">
                    <div class="inline-flex items-center gap-2 text-xs text-gray-500">
                        <span>↔️</span>
                        <span>Гортай таблицю вправо</span>
                        <span>→</span>
                    </div>
                </div>
            </div>
        `;
  }

  generateTableHeaders(importantParts) {
    // Описи для tooltip
    const partTooltips = {
      ТО: "Технічне обслуговування: заміна масла та фільтрів",
      ГРМ: "Газорозподільний механізм: ремінь ГРМ та натяжний ролик",
      Помпа: "Помпа системи охолодження: водяний насос",
      "Обвідний ремінь": "Обвідний ремінь: привод допоміжних агрегатів",
      "Діагностика ходової": "Діагностика ходової частини: перевірка підвіски",
      "Розвал-сходження": "Розвал-сходження: регулювання кутів установки коліс",
      "Профілактика супортів":
        "Профілактика супортів: обслуговування гальмівних механізмів",
    };

    return importantParts
      .map((partName) => {
        let shortName, emoji, tooltip;

        if (partName.includes("ТО")) {
          shortName = "ТО";
          emoji = "🛢️";
          tooltip = partTooltips["ТО"];
        } else if (partName.includes("ГРМ")) {
          shortName = "ГРМ";
          emoji = "⚙️";
          tooltip = partTooltips["ГРМ"];
        } else if (partName.includes("Помпа")) {
          shortName = "Помпа";
          emoji = "💧";
          tooltip = partTooltips["Помпа"];
        } else if (partName.includes("Обвід")) {
          shortName = "Обвідний ремінь";
          emoji = "🔧";
          tooltip = partTooltips["Обвідний ремінь"];
        } else if (partName.includes("Діагн")) {
          shortName = "Діагностика ходової";
          emoji = "🔍";
          tooltip = partTooltips["Діагностика ходової"];
        } else if (partName.includes("Розвал")) {
          shortName = "Розвал-сходження";
          emoji = "📐";
          tooltip = partTooltips["Розвал-сходження"];
        } else if (
          partName.includes("Профілактика") ||
          partName.includes("Супорт")
        ) {
          shortName = "Профілактика супортів";
          emoji = "🛠️";
          tooltip = partTooltips["Профілактика супортів"];
        } else {
          shortName = partName.split(" ")[0];
          emoji = "🔧";
          tooltip = partName;
        }

        return `
                <th class="text-center font-bold uppercase ${shortName.length > 10 ? "w-[90px]" : "w-[65px]"}" style="padding-left: 0.35rem; padding-right: 0.35rem; padding-top: 0.5rem; padding-bottom: 0.5rem; font-size: ${shortName.length > 10 ? "0.5625rem" : "0.625rem"};">
                    <div class="cursor-pointer hover:bg-white/10 p-0.5 rounded transition-colors relative group flex flex-col items-center justify-center"
                         onclick="event.stopPropagation(); app.showPartFilterMenu(event, '${partName}')"
                         title="${tooltip}">
                        <div class="font-bold leading-tight text-center">${shortName}</div>
                        <div class="opacity-70 text-center">${emoji}</div>
                    </div>
                </th>
            `;
      })
      .join("");
  }

  generateCarRow(car, idx, importantParts) {
    const carIdentifier = (car.car || car.license || "")
      .replace(/'/g, "\\'")
      .replace(/"/g, "&quot;");
    const parts = Object.values(car.parts).filter((p) => p !== null);
    const criticalCount = parts.filter((p) => p.status === "critical").length;
    const warningCount = parts.filter((p) => p.status === "warning").length;
    const goodCount = parts.filter((p) => p.status === "good").length;

    const statusColor =
      criticalCount > 0
        ? "bg-red-500"
        : warningCount > 0
          ? "bg-orange-500"
          : "bg-green-500";

    const rowBg = idx % 2 === 0 ? "bg-gray-50" : "bg-white";

    const partCells = importantParts
      .map((partName) => {
        const part = car.parts[partName];
        const isMonths =
          partName.includes("Діагностика") ||
          partName.includes("Розвал") ||
          partName.includes("Профілактика");
        const display = this.getPartDisplay(part, isMonths);
        const shortName = partName.includes("ТО")
          ? "ТО"
          : partName.includes("ГРМ")
            ? "ГРМ"
            : partName.includes("Помпа")
              ? "Помпа"
              : partName.includes("Обвід")
                ? "Обвідний ремінь"
                : partName.includes("Діагн")
                  ? "Діагностика ходової"
                  : partName.includes("Розвал")
                    ? "Розвал-сходження"
                    : partName.includes("Профілактика") ||
                      partName.includes("Супорт")
                      ? "Профілактика супортів"
                      : partName.split(" ")[0];
        const widthClass = shortName.length > 10 ? "w-[90px]" : "w-[65px]";
        return `<td class="text-center ${widthClass}" style="padding-left: 0.35rem; padding-right: 0.35rem; padding-top: 0.5rem; padding-bottom: 0.5rem;">
                        <div class="${display.bg} ${display.color} font-semibold ${display.textSize} py-1 px-0.5 rounded whitespace-nowrap overflow-hidden text-ellipsis mx-auto">
                            ${display.text}
                        </div>
                    </td>`;
      })
      .join("");

    const healthScore = this.calculateHealthScore(car);
    const healthStatus = this.getHealthScoreLabel(healthScore, car);

    return `
            <tr class="${rowBg} hover:bg-blue-50 cursor-pointer transition-colors"
                data-car-id="${carIdentifier}"
                onclick="if (!event.target.closest('button') && !event.target.closest('select') && !event.target.closest('th')) { app.setState({ selectedCar: '${carIdentifier}' }); }">
                <td class="text-center w-[100px]" style="padding-left: 0.7rem; padding-right: 0.7rem; padding-top: 0.5rem; padding-bottom: 0.5rem;">
                    <div class="flex flex-col items-center gap-1">
                        <div class="flex items-center gap-1.5 w-full">
                            <div class="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                                <div class="h-full bg-gradient-to-r ${this.getHealthScoreColor(healthScore)} rounded-full" 
                                     style="width: ${healthScore}%"></div>
                            </div>
                            <span class="text-xs font-bold text-gray-800 whitespace-nowrap">${healthScore}%</span>
                        </div>
                        <div class="text-[10px] text-gray-600 text-center w-full">${healthStatus}</div>
                    </div>
                </td>
                <td class="text-center w-[90px]" style="padding-left: 0.7rem; padding-right: 0.7rem; padding-top: 0.5rem; padding-bottom: 0.5rem;">
                    <div class="font-bold text-gray-800 text-sm whitespace-nowrap overflow-hidden text-ellipsis"
                         title="${car.license}">${car.license}</div>
                </td>
                <td class="text-center mobile-hidden w-[120px]" style="padding-left: 0.7rem; padding-right: 0.7rem; padding-top: 0.5rem; padding-bottom: 0.5rem;">
                    <div class="text-gray-700 text-xs whitespace-nowrap overflow-hidden text-ellipsis"
                         title="${car.model}">${car.model}</div>
                </td>
                <td class="text-center mobile-hidden w-[50px]" style="padding-left: 0.7rem; padding-right: 0.7rem; padding-top: 0.5rem; padding-bottom: 0.5rem;">
                    <div class="text-gray-600 text-xs whitespace-nowrap">${car.year || "-"}</div>
                </td>
                <td class="text-center w-[80px]" style="padding-left: 0.7rem; padding-right: 0.7rem; padding-top: 0.5rem; padding-bottom: 0.5rem;">
                    <div class="text-gray-700 text-xs whitespace-nowrap flex items-center justify-center gap-1">
                        <span class="text-[10px]">📍</span>
                        <span class="font-medium truncate" title="${car.city || "-"}">${car.city || "-"}</span>
                    </div>
                </td>
                <td class="text-center w-[80px]" style="padding-left: 0.7rem; padding-right: 0.7rem; padding-top: 0.5rem; padding-bottom: 0.5rem;">
                    <div class="font-semibold text-gray-800 text-xs whitespace-nowrap overflow-hidden text-ellipsis">
                        ${this.formatMileage(car.currentMileage)}
                    </div>
                </td>
                ${partCells}
                <td class="text-center mobile-hidden w-[50px]" style="padding-left: 0.35rem; padding-right: 0.35rem; padding-top: 0.5rem; padding-bottom: 0.5rem;">
                    <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-700 font-bold text-xs">
                        ${goodCount}
                    </span>
                </td>
                <td class="text-center mobile-hidden w-[50px]" style="padding-left: 0.35rem; padding-right: 0.35rem; padding-top: 0.5rem; padding-bottom: 0.5rem;">
                    <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-700 font-bold text-xs">
                        ${warningCount}
                    </span>
                </td>
                <td class="text-center mobile-hidden w-[50px]" style="padding-left: 0.35rem; padding-right: 0.35rem; padding-top: 0.5rem; padding-bottom: 0.5rem;">
                    <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-700 font-bold text-xs">
                        ${criticalCount}
                    </span>
                </td>
                <td class="text-center w-[50px]" style="padding-left: 0.35rem; padding-right: 0.35rem; padding-top: 0.5rem; padding-bottom: 0.5rem;">
                    <div class="text-blue-600 font-semibold text-xs whitespace-nowrap">
                        ${car.history.length}
                    </div>
                </td>
            </tr>
        `;
  }

  getPartDisplay(part, isMonths = false) {
    if (!part)
      return {
        color: "text-gray-400",
        text: "-",
        bg: "bg-gray-100",
        textSize: "text-table-value",
      };

    let color = "text-green-600",
      bg = "bg-green-100";
    if (part.status === "warning") {
      color = "text-orange-600";
      bg = "bg-orange-100";
    } else if (part.status === "critical") {
      color = "text-red-600";
      bg = "bg-red-100";
    }

    const text = isMonths
      ? Math.floor(part.daysDiff / 30) + "міс"
      : this.formatMileageDiff(part.mileageDiff);

    return { color, text, bg, textSize: "text-table-value" };
  }

  // === НОВІ ФУНКЦІЇ: HEALTH SCORE ===
  // Використовуємо модуль StatsCalculator
  calculateHealthScore(car) {
    return StatsCalculator.calculateHealthScore(
      car,
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

  getHealthScoreColor(score) {
    return StatsCalculator.getHealthScoreColor(score);
  }

  /**
   * Детальний аналіз стану конкретного авто
   * Використання: app.analyzeCar('КА 0194 ІК')
   */
  analyzeCar(license) {
    if (!this.processedCars) {
      console.error(
        "❌ Дані не завантажені. Зачекайте, поки дані завантажаться.",
      );
      return null;
    }

    const car = this.processedCars.find((c) => c.license === license);
    if (!car) {
      console.error(`❌ Авто з номером "${license}" не знайдено.`);
      return null;
    }

    const details = StatsCalculator.calculateHealthScoreDetailed(
      car,
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

    // Health score calculated

    return details;
  }

  getHealthScoreTextColor(score) {
    // Повертає простий колір для тексту (не градієнт)
    if (score >= 85) return "#10b981"; // green-500 - Відмінний
    if (score >= 60) return "#eab308"; // yellow-500 - Добрий
    if (score >= 35) return "#f97316"; // orange-500 - Задовільний
    return "#ef4444"; // red-500 - Критичний
  }

  getAgeLabel(age) {
    // Повертає правильну форму слова "рік" залежно від числа
    if (!age || age === 0) return "років";
    const lastDigit = age % 10;
    const lastTwoDigits = age % 100;

    if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
      return "років";
    }
    if (lastDigit === 1) {
      return "рік";
    }
    if (lastDigit >= 2 && lastDigit <= 4) {
      return "роки";
    }
    return "років";
  }

  getHealthScoreLabel(score, car = null) {
    return StatsCalculator.getHealthScoreLabel(score, car);
  }

  getHealthScoreStatus(score, car = null) {
    return StatsCalculator.getHealthScoreStatus(score, car);
  }

  // === НОВІ ФУНКЦІЇ: АНАЛІЗ ВИТРАТ ===
  calculateCostStats(history, car = null, selectedYear = null) {
    const stats = {
      totalSpent: 0,
      averagePerMonth: 0,
      lastYearSpent: 0,
      byCategory: {},
      byMonth: {},
      byYear: {},
      predictions: {},
    };

    const now = new Date();
    const oneYearAgo = new Date(
      now.getFullYear() - 1,
      now.getMonth(),
      now.getDate(),
    );
    const sixMonthsAgo = new Date(
      now.getFullYear(),
      now.getMonth() - 6,
      now.getDate(),
    );

    // Фільтруємо історію за вибраним роком
    let filteredHistory = history;
    if (selectedYear) {
      filteredHistory = history.filter((record) => {
        if (!record.date) return false;

        let recordDate = null;
        // Якщо дата в форматі DD.MM.YYYY
        if (typeof record.date === "string" && record.date.includes(".")) {
          const parts = record.date.split(".");
          if (parts.length === 3) {
            const [day, month, year] = parts;
            recordDate = new Date(
              parseInt(year),
              parseInt(month) - 1,
              parseInt(day),
            );
          }
        } else {
          recordDate = new Date(record.date);
        }

        if (!recordDate || isNaN(recordDate.getTime())) {
          return false;
        }

        return recordDate.getFullYear() === selectedYear;
      });
    }

    // Групуємо витрати по місяцях та роках
    filteredHistory.forEach((record) => {
      if (record.totalWithVAT > 0) {
        stats.totalSpent += record.totalWithVAT;

        // Парсимо дату з урахуванням формату DD.MM.YYYY
        let recordDate = null;
        if (record.date) {
          // Якщо дата в форматі DD.MM.YYYY
          if (typeof record.date === "string" && record.date.includes(".")) {
            const parts = record.date.split(".");
            if (parts.length === 3) {
              const [day, month, year] = parts;
              recordDate = new Date(
                parseInt(year),
                parseInt(month) - 1,
                parseInt(day),
              );
            }
          } else {
            // Спробуємо стандартний парсинг
            recordDate = new Date(record.date);
          }
        }

        // Перевіряємо чи дата валідна
        if (!recordDate || isNaN(recordDate.getTime())) {
          // Якщо дата невалідна, пропускаємо групування по датах, але враховуємо в загальній сумі
          const category = this.detectExpenseCategory(record.description);
          stats.byCategory[category] =
            (stats.byCategory[category] || 0) + record.totalWithVAT;
          return;
        }

        const recordYear = recordDate.getFullYear();

        // Групування по роках
        stats.byYear[recordYear] =
          (stats.byYear[recordYear] || 0) + record.totalWithVAT;

        if (recordDate >= oneYearAgo) {
          stats.lastYearSpent += record.totalWithVAT;
        }

        // Групування по місяцях (РРРР-ММ)
        try {
          const monthKey = recordDate.toISOString().substring(0, 7);
          stats.byMonth[monthKey] =
            (stats.byMonth[monthKey] || 0) + record.totalWithVAT;
        } catch (e) {
          // Якщо не вдалося отримати ISO string, використовуємо альтернативний метод
          const year = recordDate.getFullYear();
          const month = String(recordDate.getMonth() + 1).padStart(2, "0");
          const monthKey = `${year}-${month}`;
          stats.byMonth[monthKey] =
            (stats.byMonth[monthKey] || 0) + record.totalWithVAT;
        }

        // Визначення категорії витрат
        const category = this.detectExpenseCategory(record.description);
        stats.byCategory[category] =
          (stats.byCategory[category] || 0) + record.totalWithVAT;
      }
    });

    // Середньомісячні витрати (за останній рік)
    const monthsCount = Object.keys(stats.byMonth).length;
    stats.averagePerMonth =
      monthsCount > 0 ? stats.lastYearSpent / monthsCount : 0;

    // Прогноз на наступні 6 місяців на основі статусів запчастин та регламенту
    if (car) {
      stats.predictions.next6Months = this.calculateForecast6Months(car);
    } else {
      stats.predictions.next6Months = stats.averagePerMonth * 6;
    }

    return stats;
  }

  // Розрахунок прогнозу на 6 місяців на основі статусів та регламенту
  calculateForecast6Months(car) {
    // Використовуємо новий алгоритм якщо доступний
    if (this.partsForecast && this.processedCars) {
      try {
        const forecast = this.partsForecast.calculateForecast(
          [car],
          this.maintenanceRegulations,
          (license, model, year, partName) =>
            this.findRegulationForCar(license, model, year, partName),
          6,
        );
        return forecast.totalBudget;
      } catch (e) {
        console.warn("Помилка при використанні нового алгоритму прогнозу:", e);
      }
    }

    // Fallback до старого алгоритму
    const now = new Date();
    let forecastCost = 0;

    // Середні вартості робіт (можна витягти з історії)
    const avgCosts = this.getAverageCosts(car.history);

    // Перевіряємо всі запчастини та роботи
    for (const partName in car.parts) {
      const part = car.parts[partName];
      if (!part) continue;

      const regulation = this.findRegulationForCar(
        car.license,
        car.model,
        car.year,
        partName,
      );
      if (!regulation || regulation.normalValue === "chain") continue;

      // Визначаємо, коли потрібно буде обслуговування в наступні 6 місяців
      let monthsUntilService = null;

      if (regulation.periodType === "пробіг") {
        const remainingKm = regulation.normalValue - part.mileageDiff;
        // Приблизна оцінка: скільки місяців до обслуговування на основі середньомісячного пробігу
        const avgMonthlyMileage = this.getAverageMonthlyMileage(car);
        if (avgMonthlyMileage > 0 && remainingKm > 0) {
          monthsUntilService = remainingKm / avgMonthlyMileage;
        }
      } else if (regulation.periodType === "місяць") {
        const remainingMonths =
          regulation.normalValue - Math.floor(part.daysDiff / 30);
        if (remainingMonths > 0) {
          monthsUntilService = remainingMonths;
        }
      } else if (regulation.periodType === "рік") {
        const remainingYears = regulation.normalValue - part.daysDiff / 365;
        if (remainingYears > 0) {
          monthsUntilService = remainingYears * 12;
        }
      }

      // Якщо обслуговування потрібне в наступні 6 місяців
      if (
        monthsUntilService !== null &&
        monthsUntilService <= 6 &&
        monthsUntilService > 0
      ) {
        // Додаємо вартість, якщо статус критичний або попереджувальний
        if (part.status === "critical" || part.status === "warning") {
          const cost = avgCosts[partName] || this.getEstimatedCost(partName);
          forecastCost += cost;
        }

        // Для робіт (червоний або помаранчевий статус) - завжди додаємо
        const isWork = [
          "Діагностика ходової 🔍",
          "Розвал-сходження 📐",
          "Профілактика направляючих супортів 🛠️",
          "Компютерна діагностика 💻",
          "Прожиг сажового фільтру 🔥",
          "ТО (масло+фільтри) 🛢️",
        ].includes(partName);
        if (
          isWork &&
          (part.status === "critical" || part.status === "warning")
        ) {
          const cost = avgCosts[partName] || this.getEstimatedCost(partName);
          forecastCost += cost;
        }
      }
    }

    // Додаємо базову оцінку на основі середньомісячних витрат (якщо немає критичних статусів)
    if (forecastCost === 0) {
      const avgMonthly = this.calculateCostStats(car.history).averagePerMonth;
      forecastCost = avgMonthly * 6;
    } else {
      // Додаємо 30% базових витрат до прогнозу
      const avgMonthly = this.calculateCostStats(car.history).averagePerMonth;
      forecastCost += avgMonthly * 6 * 0.3;
    }

    return forecastCost;
  }

  // Отримати середні вартості з історії
  getAverageCosts(history) {
    const costs = {};
    const counts = {};

    history.forEach((record) => {
      if (record.totalWithVAT > 0) {
        const partName = this.findPartNameFromDescription(record.description);
        if (partName) {
          costs[partName] = (costs[partName] || 0) + record.totalWithVAT;
          counts[partName] = (counts[partName] || 0) + 1;
        }
      }
    });

    const averages = {};
    for (const partName in costs) {
      averages[partName] = costs[partName] / counts[partName];
    }

    return averages;
  }

  // Знайти назву запчастини з опису
  findPartNameFromDescription(description) {
    const descLower = description.toLowerCase();
    const partKeywords = CONSTANTS.PARTS_CONFIG;

    for (const partName in partKeywords) {
      const keywords = partKeywords[partName];
      for (const keyword of keywords) {
        if (descLower.includes(keyword.toLowerCase())) {
          return partName;
        }
      }
    }

    return null;
  }

  // Отримати середній місячний пробіг (індивідуально для кожного авто)
  // Підраховує кількість робочих днів (понеділок-субота) між двома датами
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

  // Розраховується за останні 5-6 місяців до сьогоднішнього дня, враховуючи тільки робочі дні (понеділок-субота)
  getAverageMonthlyMileage(car) {
    if (!car || !car.history || car.history.length < 2) return 1000; // За замовчуванням

    const now = new Date();
    // Використовуємо 5.5 місяців (приблизно 165 днів) як середнє між 5 і 6 місяцями
    const fiveAndHalfMonthsAgo = new Date(
      now.getFullYear(),
      now.getMonth() - 5,
      now.getDate() - 15,
    );

    // Фільтруємо історію за останні 5-6 місяців
    const recentHistory = car.history.filter((record) => {
      const recordDate = this.parseDate(record.date);
      if (!recordDate) return false;
      return recordDate >= fiveAndHalfMonthsAgo;
    });

    if (recentHistory.length < 2) {
      // Якщо немає достатньо даних за останні 5-6 місяців, використовуємо всі дані
      const sortedHistory = [...car.history].sort((a, b) => {
        const dateA = this.parseDate(a.date) || new Date(0);
        const dateB = this.parseDate(b.date) || new Date(0);
        return dateA - dateB;
      });

      if (sortedHistory.length < 2) return 1000;

      const firstRecord = sortedHistory[0];
      const lastRecord = sortedHistory[sortedHistory.length - 1];

      const firstDate = this.parseDate(firstRecord.date);
      const lastDate = this.parseDate(lastRecord.date);

      if (!firstDate || !lastDate) return 1000;

      // Підраховуємо робочі дні (понеділок-субота)
      const workingDays = this.countWorkingDays(firstDate, lastDate);
      if (workingDays <= 0) return 1000;

      const mileageDiff = lastRecord.mileage - firstRecord.mileage;
      if (mileageDiff <= 0) return 1000;

      // Розраховуємо середній пробіг на робочий день, потім множимо на середню кількість робочих днів на місяць (26 днів)
      const avgMileagePerWorkingDay = mileageDiff / workingDays;
      const monthlyMileage = avgMileagePerWorkingDay * 26; // ~26 робочих днів на місяць (6 днів * 4.33 тижні)
      return monthlyMileage > 0 ? monthlyMileage : 1000;
    }

    // Сортуємо записи за датою
    const sortedRecentHistory = [...recentHistory].sort((a, b) => {
      const dateA = this.parseDate(a.date) || new Date(0);
      const dateB = this.parseDate(b.date) || new Date(0);
      return dateA - dateB;
    });

    const firstRecord = sortedRecentHistory[0];
    const lastRecord = sortedRecentHistory[sortedRecentHistory.length - 1];

    // Використовуємо parseDate для правильного парсингу дат
    const firstDate = this.parseDate(firstRecord.date);
    // Остання дата - це сьогодні або останній запис в історії
    const lastDate = this.parseDate(lastRecord.date);
    const endDate = lastDate > now ? now : lastDate;

    if (!firstDate || !endDate) return 1000;

    // Підраховуємо робочі дні (понеділок-субота)
    const workingDays = this.countWorkingDays(firstDate, endDate);
    if (workingDays <= 0) return 1000;

    const mileageDiff = lastRecord.mileage - firstRecord.mileage;
    if (mileageDiff <= 0) return 1000;

    // Розраховуємо середній пробіг на робочий день, потім множимо на середню кількість робочих днів на місяць (26 днів)
    const avgMileagePerWorkingDay = mileageDiff / workingDays;
    const monthlyMileage = avgMileagePerWorkingDay * 26; // ~26 робочих днів на місяць (6 днів * 4.33 тижні)
    return monthlyMileage > 0 ? monthlyMileage : 1000;
  }

  // Оцінка вартості для запчастини/роботи
  getEstimatedCost(partName) {
    const estimates = {
      "ТО (масло+фільтри) 🛢️": 2000,
      "ГРМ (ролики+ремінь) ⚙️": 5000,
      "Помпа 💧": 3000,
      "Обвідний ремінь+ролики 🔧": 1500,
      "Діагностика ходової 🔍": 500,
      "Розвал-сходження 📐": 400,
      "Профілактика направляючих супортів 🛠️": 800,
      "Компютерна діагностика 💻": 300,
      "Прожиг сажового фільтру 🔥": 1500,
      "Гальмівні диски передні💿": 3000,
      "Гальмівні диски задні💿": 2500,
      "Гальмівні колодки передні🛑": 1500,
      "Гальмівні колодки задні🛑": 1200,
      "Гальмівні колодки ручного гальма🛑": 800,
      "Амортизатори передні🔧": 4000,
      "Амортизатори задні🔧": 3500,
      "Опора амортизаторів 🛠️": 2000,
      "Шарова опора ⚪": 1500,
      "Рульова тяга 🔗": 1200,
      "Рульовий накінечник 🔩": 1000,
      "Зчеплення ⚙️": 8000,
      "Стартер 🔋": 3000,
      "Генератор ⚡": 4000,
      "Акумулятор 🔋": 3000,
    };

    return estimates[partName] || 2000;
  }

  detectExpenseCategory(description) {
    if (
      window.EXPENSE_CATEGORIES_UTILS &&
      window.EXPENSE_CATEGORIES_UTILS.findCategory
    ) {
      return window.EXPENSE_CATEGORIES_UTILS.findCategory(description);
    }

    // Fallback метод, якщо expense-categories.js не завантажений
    const descLower = description.toLowerCase();

    if (
      descLower.includes("масл") ||
      descLower.includes("фільтр") ||
      descLower.includes("то")
    ) {
      return "ТО та обслуговування";
    } else if (
      descLower.includes("гальм") ||
      descLower.includes("колодк") ||
      descLower.includes("диск")
    ) {
      return "Гальмівна система";
    } else if (
      descLower.includes("амортизатор") ||
      descLower.includes("підвіск") ||
      descLower.includes("ходов")
    ) {
      return "Ходова частина";
    } else if (
      descLower.includes("двигун") ||
      descLower.includes("грм") ||
      descLower.includes("помп")
    ) {
      return "Двигун";
    } else if (
      descLower.includes("акб") ||
      descLower.includes("акумулятор") ||
      descLower.includes("стартер")
    ) {
      return "Електрика";
    } else if (
      descLower.includes("шини") ||
      descLower.includes("колес") ||
      descLower.includes("диагност")
    ) {
      return "Шини та діагностика";
    } else {
      return "Інші витрати";
    }
  }

  prepareMonthlyChartData(byMonth, byYear, selectedYear = null) {
    // Якщо не вибрано рік - показуємо по роках
    if (!selectedYear) {
      const years = Object.keys(byYear || {})
        .map((y) => parseInt(y))
        .sort();
      const maxAmount = Math.max(...Object.values(byYear || {}), 1);

      return years.map((year) => {
        return {
          month: year.toString(),
          label: year.toString(),
          amount: byYear[year] || 0,
          height: ((byYear[year] || 0) / maxAmount) * 100,
          isYear: true,
        };
      });
    }

    // Якщо вибрано рік - показуємо по місяцях
    let filteredMonths = Object.keys(byMonth).sort();
    filteredMonths = filteredMonths.filter((monthKey) => {
      const year = parseInt(monthKey.split("-")[0]);
      return year === selectedYear;
    });

    const maxAmount = Math.max(
      ...filteredMonths.map((m) => byMonth[m] || 0),
      1,
    );

    return filteredMonths.map((monthKey) => {
      const date = new Date(monthKey + "-01");
      const monthNames = [
        "Січ",
        "Лют",
        "Бер",
        "Кві",
        "Тра",
        "Чер",
        "Лип",
        "Сер",
        "Вер",
        "Жов",
        "Лис",
        "Гру",
      ];
      const label = `${monthNames[date.getMonth()]} ${date.getFullYear().toString().slice(-2)}`;

      return {
        month: monthKey,
        label: label,
        amount: byMonth[monthKey] || 0,
        height: ((byMonth[monthKey] || 0) / maxAmount) * 100,
        isYear: false,
      };
    });
  }

  // === НОВІ ФУНКЦІЇ: РЕКОМЕНДОВАНІ ВИРОБНИКИ ===
  getRecommendedManufacturers(partName) {
    const manufacturers = {
      "ТО (масло+фільтри) 🛢️": ["MANN", "KNECHT", "MAHLE"],
      "ГРМ (ролики+ремінь) ⚙️": ["CONTINENTAL"],
      "Помпа 💧": ["INA", "CONTINENTAL", "Pierburg"],
      "Обвідний ремінь+ролики 🔧": ["CONTINENTAL", "INA"],
      "Гальмівні диски передні💿": ["BREMBO", "TRW", "ROADHOUSE"],
      "Гальмівні диски задні💿": ["BREMBO", "TRW", "ROADHOUSE"],
      "Гальмівні колодки передні🛑": ["BREMBO", "TRW", "ROADHOUSE"],
      "Гальмівні колодки задні🛑": ["BREMBO", "TRW", "ROADHOUSE"],
      "Гальмівні колодки ручного гальма🛑": ["BREMBO", "TRW", "ROADHOUSE"],
      "Амортизатори передні🔧": ["SACHS", "BILSTEIN"],
      "Амортизатори задні🔧": ["SACHS", "BILSTEIN"],
      "Опора амортизаторів 🛠️": ["MEYLE", "LEMFÖRDER"],
      "Шарова опора ⚪": ["MEYLE", "LEMFÖRDER"],
      "Рульова тяга 🔗": ["MEYLE", "LEMFÖRDER"],
      "Рульовий накінечник 🔩": ["MEYLE", "LEMFÖRDER"],
    };

    return manufacturers[partName] || null;
  }

  // === НОВІ ФУНКЦІЇ: ПРОГНОЗ ОБСЛУГОВУВАННЯ ===
  generateMaintenanceForecast(car) {
    // Використовуємо новий модуль якщо доступний
    if (this.maintenanceForecastModule) {
      return this.maintenanceForecastModule.generateForecast(
        car,
        (license, model, year, partName) =>
          this.findRegulationForCar(license, model, year, partName),
        (num) => this.formatNumber(num),
        this.partsForecast,
        this.maintenanceRegulations,
      );
    }

    // Fallback до старого алгоритму
    return this.generateMaintenanceForecastOld(car);
  }

  generateMaintenanceForecastOld(car) {
    const forecasts = [];
    const now = new Date();

    // Перевіряємо чи потрібно приховати "Прожиг сажового фільтру"
    const carYear = parseInt(car.year) || 0;
    const carModel = (car.model || "").toUpperCase();
    const shouldHideSootBurn =
      carYear < 2010 ||
      carModel.includes("FIAT TIPO") ||
      carModel.includes("PEUGEOT 301") ||
      carModel.includes("HYUNDAI ACCENT");

    // Використовуємо новий алгоритм якщо доступний
    let useNewAlgorithm = false;
    if (this.partsForecast) {
      try {
        useNewAlgorithm = true;
        // Отримуємо прогноз з нового алгоритму
        const forecastData = this.partsForecast.calculateForecast(
          [car],
          this.maintenanceRegulations,
          (license, model, year, partName) =>
            this.findRegulationForCar(license, model, year, partName),
          6,
        );

        // Перетворюємо дані з нового алгоритму в формат для відображення
        Object.values(forecastData.byMonth).forEach((monthData) => {
          monthData.parts.forEach((need) => {
            // Пропускаємо "Прожиг сажового фільтру" якщо потрібно
            if (
              shouldHideSootBurn &&
              need.partName === "Прожиг сажового фільтру 🔥"
            ) {
              return;
            }
            let urgency = "forecasted";
            let when = "";

            if (need.urgency === "critical") {
              urgency = "critical";
              when =
                "Це лише прогноз, але бажано звернути увагу найближчим часом";
            } else if (need.urgency === "planned") {
              urgency = "warning";
              if (need.monthsUntilReplacement !== null) {
                const months = Math.ceil(need.monthsUntilReplacement);
                if (months <= 1) {
                  when = "Через місяць";
                } else {
                  when = `Через ${months} місяці`;
                }
              } else {
                when = "Планове";
              }
            } else {
              if (need.monthsUntilReplacement !== null) {
                const months = Math.ceil(need.monthsUntilReplacement);
                if (months <= 1) {
                  when = "Через місяць";
                } else {
                  when = `Через ${months} місяці`;
                }
              } else {
                when = "Планове";
              }
            }

            const manufacturers = this.getRecommendedManufacturers(
              need.partName,
            );

            forecasts.push({
              part: need.partName,
              type: need.regulation.periodType === "пробіг" ? "пробіг" : "час",
              status: urgency,
              when: when,
              manufacturers: manufacturers,
              cost: need.totalCost,
            });
          });
        });
      } catch (e) {
        console.warn(
          "Помилка при використанні нового алгоритму в прогнозі:",
          e,
        );
        useNewAlgorithm = false;
      }
    }

    // Якщо новий алгоритм не використовується, використовуємо старий
    if (!useNewAlgorithm) {
      // Визначаємо категорії запчастин
      const otherParts = CONSTANTS.PARTS_ORDER.slice(8);
      const brakeParts = [
        "Гальмівні диски передні💿",
        "Гальмівні диски задні💿",
        "Гальмівні колодки передні🛑",
        "Гальмівні колодки задні🛑",
        "Гальмівні колодки ручного гальма🛑",
      ];
      const suspensionParts = [
        "Амортизатори передні🔧",
        "Амортизатори задні🔧",
        "Опора амортизаторів 🛠️",
        "Шарова опора ⚪",
        "Рульова тяга 🔗",
        "Рульовий накінечник 🔩",
      ];
      const excludedParts = ["Стартер 🔋", "Генератор ⚡", "Акумулятор 🔋"];

      // Перевіряємо запчастини з категорії "Інші запчастини"
      let hasBrakeIssue = false;
      let hasSuspensionIssue = false;

      for (const partName of otherParts) {
        const part = car.parts[partName];
        if (part && (part.status === "critical" || part.status === "warning")) {
          if (brakeParts.includes(partName)) {
            hasBrakeIssue = true;
          } else if (suspensionParts.includes(partName)) {
            hasSuspensionIssue = true;
          }
        }
      }

      if (hasBrakeIssue) {
        forecasts.push({
          part: "Зробити профілактику направляючих та перевірити стан гальмівної системи",
          type: "рекомендація",
          status: "warning",
          when: "Це лише прогноз, але бажано звернути увагу найближчим часом",
        });
      }

      if (hasSuspensionIssue) {
        forecasts.push({
          part: "Зробити діагностику ходової частини",
          type: "рекомендація",
          status: "warning",
          when: "Це лише прогноз, але бажано звернути увагу найближчим часом",
        });
      }

      // Аналізуємо кожну запчастину
      for (const partName in car.parts) {
        const part = car.parts[partName];
        if (!part) continue;

        // Пропускаємо виключені запчастини
        if (excludedParts.includes(partName)) continue;

        // Пропускаємо "Прожиг сажового фільтру" якщо потрібно
        if (shouldHideSootBurn && partName === "Прожиг сажового фільтру 🔥") {
          continue;
        }

        // Для робіт: включаємо якщо статус червоний або помаранчевий
        const isWork = [
          "Діагностика ходової 🔍",
          "Розвал-сходження 📐",
          "Профілактика направляючих супортів 🛠️",
          "Компютерна діагностика 💻",
          "Прожиг сажового фільтру 🔥",
          "ТО (масло+фільтри) 🛢️",
        ].includes(partName);

        if (
          isWork &&
          (part.status === "critical" || part.status === "warning")
        ) {
          forecasts.push({
            part: partName,
            type: "статус",
            status: part.status,
            when: "Це лише прогноз, але бажано звернути увагу найближчим часом",
          });
          continue;
        }

        // Знаходимо регламент для цієї деталі
        const regulation = this.findRegulationForCar(
          car.license,
          car.model,
          car.year,
          partName,
        );

        if (regulation && regulation.normalValue !== "chain") {
          let nextMaintenance = null;
          let isPast = false;

          if (regulation.periodType === "пробіг") {
            const remainingKm = regulation.normalValue - part.mileageDiff;
            isPast = remainingKm < 0;

            if (remainingKm < 5000) {
              // Якщо в минулому - визначаємо термін на основі статусу
              if (isPast) {
                if (part.status === "critical") {
                  nextMaintenance = {
                    part: partName,
                    type: "пробіг",
                    status: part.status,
                    when: "Через 2 тижні",
                  };
                } else if (part.status === "warning") {
                  nextMaintenance = {
                    part: partName,
                    type: "пробіг",
                    status: part.status,
                    when: "Через місяць",
                  };
                } else {
                  nextMaintenance = {
                    part: partName,
                    type: "пробіг",
                    status: part.status,
                    when: `через ${this.formatNumber(Math.max(0, remainingKm))} км`,
                  };
                }
              } else {
                nextMaintenance = {
                  part: partName,
                  type: "пробіг",
                  status: part.status,
                  when: `через ${this.formatNumber(Math.max(0, remainingKm))} км`,
                };
              }
            }
          } else if (regulation.periodType === "місяць") {
            const remainingMonths =
              regulation.normalValue - Math.floor(part.daysDiff / 30);
            isPast = remainingMonths < 0;

            if (remainingMonths < 3) {
              // Якщо в минулому - визначаємо термін на основі статусу
              if (isPast) {
                if (part.status === "critical") {
                  nextMaintenance = {
                    part: partName,
                    type: "час",
                    status: part.status,
                    when: "Через 2 тижні",
                  };
                } else if (part.status === "warning") {
                  nextMaintenance = {
                    part: partName,
                    type: "час",
                    status: part.status,
                    when: "Через місяць",
                  };
                } else {
                  nextMaintenance = {
                    part: partName,
                    type: "час",
                    status: part.status,
                    when: "Згідно розрахунків",
                  };
                }
              } else {
                nextMaintenance = {
                  part: partName,
                  type: "час",
                  status: part.status,
                  when: "Згідно розрахунків",
                };
              }
            }
          }

          if (nextMaintenance) {
            // Додаємо рекомендованих виробників
            const manufacturers = this.getRecommendedManufacturers(partName);
            if (manufacturers) {
              nextMaintenance.manufacturers = manufacturers;
            }
            forecasts.push(nextMaintenance);
          }
        }
      }
    } // Закриваємо if (!useNewAlgorithm)

    // Сортуємо за терміновістю
    forecasts.sort((a, b) => {
      if (a.status === "critical" && b.status !== "critical") return -1;
      if (a.status !== "critical" && b.status === "critical") return 1;
      if (a.status === "warning" && b.status !== "warning") return -1;
      if (a.status !== "warning" && b.status === "warning") return 1;
      return (a.remaining || 0) - (b.remaining || 0);
    });

    return forecasts;
  }

  // === ГЕНЕРАЦІЯ HTML ДЛЯ ДЕТАЛЬНОГО ПЕРЕГЛЯДУ АВТО ===
  generateCarDetailHTML(car) {
    const {
      selectedHistoryPartFilter,
      historySearchTerm,
      carDetailTab = "parts",
    } = this.state;
    let displayHistory = CarFilters.filterCarHistory(
      car.history,
      selectedHistoryPartFilter,
      historySearchTerm,
    );
    // Сортуємо від більшої дати до меншої
    displayHistory = displayHistory.sort((a, b) => {
      const dateA = this.parseDate(a.date) || new Date(0);
      const dateB = this.parseDate(b.date) || new Date(0);
      return dateB - dateA; // Від більшої до меншої
    });
    const partNames = CONSTANTS.PARTS_ORDER;

    // Розраховуємо статистику витрат
    const selectedYear = this.state.selectedYear || null;
    const costStats = this.calculateCostStats(car.history, car, selectedYear);
    const healthScore = this.calculateHealthScore(car);
    const maintenanceForecast = this.generateMaintenanceForecast(car);

    // Розраховуємо метрики для шапки
    const avgMonthlyMileage = this.getAverageMonthlyMileage(car);
    const avgDailyMileage = Math.round(avgMonthlyMileage / 30);
    const avgYearlyMileage = Math.round(avgMonthlyMileage * 12);
    const carAgeMonths = this.calculateCarAgeMonths(car);

    return `
            <div class="min-h-screen bg-gray-50" id="vehicle-detail-wrapper">
                <div class="vehicle-detail-header" id="vehicle-detail-header">
                    <div class="px-3 py-2 vehicle-detail-header-content">
                        <div class="flex items-center justify-between mb-2 vehicle-detail-header-top">
                        <button onclick="app.setState({ selectedCar: null, selectedHistoryPartFilter: null, historySearchTerm: '', carDetailTab: 'parts' });"
                                    class="vehicle-detail-back-btn">
                            ← Назад до списку
                        </button>
                                        </div>
                        <div class="flex items-center justify-between gap-3 vehicle-detail-header-main">
                            <div class="flex items-center gap-3 flex-1 min-w-0">
                                <div class="vehicle-detail-icon-wrapper">
                                    <span class="vehicle-detail-emoji">🚐</span>
                                    </div>
                                <div class="min-w-0 flex-1">
                                    <div class="vehicle-detail-plate">${car.license}</div>
                                    <div class="vehicle-detail-model">${car.model || "Немає моделі"}${car.year ? " • " + car.year + " рік" : ""}${car.city ? " • " + car.city : ""}</div>
                                    ${car.vin ? `<div class="vehicle-detail-vin" style="font-size: 12px; color: #94a3b8; margin-top: 2px;">VIN: ${car.vin}</div>` : ""}
                                </div>
                                            </div>
                            <div class="vehicle-detail-stats-horizontal">
                                <div class="vehicle-detail-stat-item-horizontal">
                                    <div class="stat-label-horizontal">Стан авто</div>
                                    <div class="stat-value-horizontal">${healthScore}%</div>
                                    <div class="vehicle-detail-health-progress">
                                        <div class="vehicle-detail-health-progress-track">
                                            <div class="vehicle-detail-health-progress-fill vehicle-detail-health-progress-${healthScore < 35 ? "critical" : healthScore < 60 ? "warning" : "good"}" 
                                                 style="width: ${healthScore}%"></div>
                                        </div>
                                    </div>
                                </div>
                                <div class="vehicle-detail-stat-item-horizontal vehicle-detail-stat-secondary">
                                    <div class="stat-label-horizontal">Середній пробіг</div>
                                    <div class="stat-value-horizontal">${this.formatNumber(avgDailyMileage)} км/день</div>
                                </div>
                                <div class="vehicle-detail-stat-item-horizontal vehicle-detail-stat-secondary">
                                    <div class="stat-label-horizontal">Середній пробіг</div>
                                    <div class="stat-value-horizontal">${this.formatNumber(avgMonthlyMileage)} км/місяць</div>
                                </div>
                                <div class="vehicle-detail-stat-item-horizontal vehicle-detail-stat-secondary">
                                    <div class="stat-label-horizontal">Середній пробіг</div>
                                    <div class="stat-value-horizontal">${this.formatNumber(avgYearlyMileage)} км/рік</div>
                                </div>
                                <div class="vehicle-detail-stat-item-horizontal vehicle-detail-stat-mileage">
                                    <div class="stat-label-horizontal">Пробіг</div>
                                    <div class="stat-value-horizontal">${this.formatMileage(car.currentMileage)}</div>
                                </div>
                                <div class="vehicle-detail-stat-item-horizontal vehicle-detail-stat-secondary">
                                    <div class="stat-label-horizontal">Вік авто</div>
                                    <div class="stat-value-horizontal">${this.formatCarAge(carAgeMonths)}</div>
                                </div>
                            </div>
                            <div class="vehicle-detail-status-badge vehicle-detail-status-badge-${healthScore < 35 ? "critical" : healthScore < 60 ? "warning" : "good"}">
                                <span class="status-indicator status-${healthScore < 35 ? "critical" : healthScore < 60 ? "warning" : "good"}"></span>
                                <span class="status-text">${healthScore < 35 ? "Критично" : healthScore < 60 ? "Потребує уваги" : "У нормі"}</span>
                            </div>
                        </div>
                            </div>
                    </div>
                
                <!-- Заповнювач для fixed шапки -->
                <div id="vehicle-detail-header-spacer" style="height: 0;"></div>
                    
                    <!-- Таби навігації -->
                <div class="vehicle-detail-navigation" id="vehicle-detail-navigation">
                    <div class="vehicle-detail-nav-container">
                            <button onclick="app.setState({ carDetailTab: 'parts' });"
                                class="vehicle-detail-nav-btn ${carDetailTab === "parts" ? "vehicle-detail-nav-btn-active" : ""}">
                                <span>⚙️</span> Стан запчастин
                            </button>
                        <button onclick="app.setState({ carDetailTab: 'recommendations' });"
                                class="vehicle-detail-nav-btn ${carDetailTab === "recommendations" ? "vehicle-detail-nav-btn-active" : ""}">
                            <span>🎯</span> Рекомендації та прогноз
                        </button>
                            <button onclick="app.setState({ carDetailTab: 'history' });"
                                class="vehicle-detail-nav-btn ${carDetailTab === "history" ? "vehicle-detail-nav-btn-active" : ""}">
                                <span>📄</span> Історія
                            </button>
                            <button onclick="app.setState({ carDetailTab: 'expenses' });"
                                class="vehicle-detail-nav-btn ${carDetailTab === "expenses" ? "vehicle-detail-nav-btn-active" : ""}">
                                <span>💰</span> Витрати
                            </button>
                    </div>
                </div>

                <div class="w-full px-3 sm:px-4" id="vehicle-detail-content">
                    ${carDetailTab === "parts"
        ? `
                    <div class="bg-white rounded-xl shadow-xl p-3 sm:p-4 mb-4 border border-gray-200">
                        ${this.generateCarPartsHTML(car, partNames)}
                    </div>
                    ${this.generatePartsStatusMap(car)}
                    `
        : carDetailTab === "history"
          ? `
                    <div class="bg-white rounded-xl shadow-xl p-3 sm:p-4 mb-4 border border-gray-200">
                        ${this.generateCarHistoryHTML(car, displayHistory)}
                    </div>
                    `
          : carDetailTab === "expenses"
            ? `
                    <div class="bg-white rounded-xl shadow-xl p-3 sm:p-4 mb-4 border border-gray-200">
                        ${this.generateCostChartHTML(car, costStats)}
                    </div>
                    `
            : carDetailTab === "recommendations"
              ? `
                        ${(() => {
                try {
                  const recommendationsHTML =
                    this.generateCostRecommendations(car, costStats);

                  let forecastHTML = "";
                  if (
                    maintenanceForecast &&
                    maintenanceForecast.length > 0
                  ) {
                    if (this.maintenanceForecastModule) {
                      forecastHTML =
                        this.maintenanceForecastModule.generateForecastHTML(
                          maintenanceForecast,
                          car,
                          (license, model, year, partName) =>
                            this.findRegulationForCar(
                              license,
                              model,
                              year,
                              partName,
                            ),
                          (num) => this.formatMileage(num),
                          (date) => this.formatDate(date),
                        );
                    } else {
                      forecastHTML =
                        this.generateMaintenanceForecastOld(
                          maintenanceForecast,
                        );
                    }
                  }

                  return `
                        <div class="bg-white rounded-xl shadow-xl p-3 sm:p-4 mb-4 border border-gray-200">
                                        ${recommendationsHTML}
                        </div>
                                    ${forecastHTML}
                                `;
                } catch (e) {
                  console.error(
                    "Помилка відображення вкладки рекомендацій:",
                    e,
                  );
                  return (
                    '<div class="p-4 text-red-500 bg-red-50 rounded-lg">Помилка відображення вкладки: ' +
                    e.message +
                    "</div>"
                  );
                }
              })()}
                    `
              : ""
      }
                </div>
            </div>
        `;
  }

  // Розрахунок віку авто в місяцях
  calculateCarAgeMonths(car) {
    if (!car || !car.year) return 0;
    const now = new Date();
    const carDate = new Date(parseInt(car.year), 0, 1); // 1 січня року випуску
    const monthsDiff =
      (now.getFullYear() - carDate.getFullYear()) * 12 +
      (now.getMonth() - carDate.getMonth());
    return Math.max(0, monthsDiff);
  }

  formatCarAge(months) {
    if (!months || months === 0) return "-";
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;

    if (years === 0) {
      return `${remainingMonths} міс`;
    } else if (remainingMonths === 0) {
      return `${years} ${this.getAgeLabel(years)}`;
    } else {
      return `${years} ${this.getAgeLabel(years)} ${remainingMonths} міс`;
    }
  }

  generateCarPartsHTML(car, partNames) {
    // Фільтруємо "Прожиг сажового фільтру" для авто року < 2010 та Fiat Tipo, Peugeot 301, Hyundai Accent
    const carYear = parseInt(car.year) || 0;
    const carModel = (car.model || "").toUpperCase();
    const shouldHideSootBurn =
      carYear < 2010 ||
      carModel.includes("FIAT TIPO") ||
      carModel.includes("PEUGEOT 301") ||
      carModel.includes("HYUNDAI ACCENT");

    // Фільтруємо "Свічки запалювання" - показуємо тільки для Peugeot, Hyundai, Fiat
    const shouldShowSparkPlugs = /PEUGEOT|HYUNDAI|FIAT/.test(carModel);

    let filteredPartNames = shouldHideSootBurn
      ? partNames.filter((name) => name !== "Прожиг сажового фільтру 🔥")
      : partNames;

    // Приховуємо свічки запалювання, якщо авто не Peugeot, Hyundai, Fiat
    if (!shouldShowSparkPlugs) {
      filteredPartNames = filteredPartNames.filter(
        (name) => name !== "Свічки запалювання 🔥",
      );
    }

    // Визначаємо групи систем згідно з інтерактивною картою
    const systemsGroups = [
      {
        name: "Двигун",
        emoji: "🔧",
        parts: [
          "ТО (масло+фільтри) 🛢️",
          "ГРМ (ролики+ремінь) ⚙️",
          "Помпа 💧",
          "Обвідний ремінь+ролики 🔧",
          "Свічки запалювання 🔥",
        ],
      },
      {
        name: "Діагностика",
        emoji: "🔍",
        parts: [
          "Діагностика ходової 🔍",
          "Розвал-сходження 📐",
          "Компютерна діагностика 💻",
          "Комп'ютерна діагностика 💻",
          "Прожиг сажового фільтру 🔥",
        ],
      },
      {
        name: "Гальмівна система",
        emoji: "🛑",
        parts: [
          "Профілактика направляючих супортів 🛠️",
          "Гальмівні колодки передні🛑",
          "Гальмівні колодки задні🛑",
          "Гальмівні диски передні💿",
          "Гальмівні диски задні💿",
          "Гальмівні колодки ручного гальма🛑",
        ],
      },
      {
        name: "Ходова частина",
        emoji: "🔩",
        parts: [
          "Амортизатори передні🔧",
          "Амортизатори задні🔧",
          "Опора амортизаторів 🛠️",
          "Шарова опора ⚪",
          "Рульова тяга 🔗",
          "Рульовий накінечник 🔩",
        ],
      },
      {
        name: "Електрика",
        emoji: "⚡",
        parts: ["Стартер 🔋", "Генератор ⚡", "Акумулятор 🔋"],
      },
      {
        name: "Трансмісія",
        emoji: "⚙️",
        parts: ["Зчеплення ⚙️"],
      },
    ];

    // Групуємо запчастини за системами
    const groupedParts = systemsGroups.map((system) => {
      const systemParts = filteredPartNames.filter((partName) => {
        // Перевіряємо точне співпадіння або співпадіння без емодзі
        return system.parts.some((sysPart) => {
          // Точне співпадіння
          if (sysPart === partName) return true;
          // Порівняння без емодзі та спецсимволів
          const normalize = (str) =>
            str
              .replace(/[🔋⚡💻🛢️⚙️💧🔧🔥🔩🛠️⚪🔗🔍📐🛑💿]/g, "")
              .trim()
              .toLowerCase();
          const sysPartNormalized = normalize(sysPart);
          const partNameNormalized = normalize(partName);
          if (sysPartNormalized === partNameNormalized) return true;
          // Для варіантів "Компютерна" та "Комп'ютерна"
          if (
            sysPartNormalized.replace(/'/g, "") ===
            partNameNormalized.replace(/'/g, "")
          )
            return true;
          return false;
        });
      });
      return {
        ...system,
        systemParts: systemParts,
      };
    });

    const { partsFilter = "all" } = this.state;

    // Підрахунок кількості запчастин по статусах для всіх запчастин
    const countPartsByStatus = (parts) => {
      let all = 0,
        critical = 0,
        warning = 0,
        good = 0;
      parts.forEach((partName) => {
        const part = car.parts[partName];
        all++;
        if (!part) return;
        if (part.status === "critical") critical++;
        else if (part.status === "warning") warning++;
        else if (part.status === "good") good++;
      });
      return { all, critical, warning, good };
    };

    const allParts = filteredPartNames;
    const totalCounts = countPartsByStatus(allParts);

    // Фільтрація запчастин за статусом
    const filterParts = (parts) => {
      if (partsFilter === "all") return parts;
      return parts.filter((partName) => {
        const part = car.parts[partName];
        if (!part) return partsFilter === "no-data";
        if (partsFilter === "critical") return part.status === "critical";
        if (partsFilter === "warning") return part.status === "warning";
        if (partsFilter === "good") return part.status === "good";
        return true;
      });
    };

    // Фільтруємо групи та рахуємо кількість для кожної групи
    const filteredGroups = groupedParts
      .map((group) => {
        const filtered = filterParts(group.systemParts);
        const counts = countPartsByStatus(group.systemParts);
        return {
          ...group,
          filteredParts: filtered,
          counts: counts,
        };
      })
      .filter((group) => group.filteredParts.length > 0); // Показуємо тільки групи з запчастинами після фільтрації

    return `
            <div class="mb-4">
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                    <div class="flex items-center gap-2 flex-wrap">
                        <button onclick="app.setState({ partsFilter: 'all' });"
                                class="parts-filter-btn parts-filter-btn-all ${partsFilter === "all" ? "parts-filter-btn-active" : ""}">
                            <span class="parts-filter-label">Всі</span>
                            <span class="parts-filter-badge">${totalCounts.all}</span>
                        </button>
                        <button onclick="app.setState({ partsFilter: 'critical' });"
                                class="parts-filter-btn parts-filter-btn-critical ${partsFilter === "critical" ? "parts-filter-btn-active" : ""}">
                            <span class="parts-filter-icon">🔴</span>
                            <span class="parts-filter-label">Критично</span>
                            <span class="parts-filter-badge">${totalCounts.critical}</span>
                        </button>
                        <button onclick="app.setState({ partsFilter: 'warning' });"
                                class="parts-filter-btn parts-filter-btn-warning ${partsFilter === "warning" ? "parts-filter-btn-active" : ""}">
                            <span class="parts-filter-icon">⚠️</span>
                            <span class="parts-filter-label">Увага</span>
                            <span class="parts-filter-badge">${totalCounts.warning}</span>
                        </button>
                        <button onclick="app.setState({ partsFilter: 'good' });"
                                class="parts-filter-btn parts-filter-btn-good ${partsFilter === "good" ? "parts-filter-btn-active" : ""}">
                            <span class="parts-filter-icon">✓</span>
                            <span class="parts-filter-label">Норма</span>
                            <span class="parts-filter-badge">${totalCounts.good}</span>
                        </button>
                ${this.state.selectedHistoryPartFilter ||
        this.state.historySearchTerm
        ? `
                    <button onclick="app.setState({ selectedHistoryPartFilter: null, historySearchTerm: '' });"
                                    class="ml-2 bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                                ✕ Скинути фільтри
                    </button>
                `
        : ""
      }
                    </div>
                </div>

                ${filteredGroups
        .map((group) => {
          // Для груп "Двигун" і "Діагностика" використовуємо 4 колонки на великих екранах
          const isEngineOrDiagnostics =
            group.name === "Двигун" || group.name === "Діагностика";
          const gridClasses = isEngineOrDiagnostics
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5"
            : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5";

          return `
            <div class="mb-4">
                    <div class="flex items-center justify-between mb-2">
                            <h4 class="text-sm font-semibold text-gray-800 flex items-center gap-2">
                                <span>${group.emoji}</span>
                                <span>${group.name}</span>
                            </h4>
                            <span class="text-xs text-gray-500">${group.filteredParts.length} позиції</span>
                    </div>
                        <div class="${gridClasses}">
                            ${group.filteredParts.map((partName) => this.generatePartCard(car, partName)).join("")}
                </div>
            </div>
                `;
        })
        .join("")}
            </div>
        `;
  }

  generatePartCard(car, partName, small = false) {
    const part = car.parts[partName];
    const isActive = this.state.selectedHistoryPartFilter === partName;

    // Перевірка для ГРМ: чи це авто з ланцюговим приводом ГРМ
    const chainDriveModels = [
      "mercedes-benz sprinter",
      "iveco daily 65c15",
      "isuzu nqr 71r",
      "hyundai accent",
    ];
    const isChainDriveGRM =
      partName === "ГРМ (ролики+ремінь) ⚙️" &&
      car.model &&
      chainDriveModels.some((model) => car.model.toLowerCase().includes(model));

    // Визначаємо стилі залежно від статусу
    let borderClass, bgClass, progressColor;
    if (!part) {
      borderClass = "border-gray-300";
      bgClass = "bg-gray-50";
      progressColor = "bg-gray-300";
    } else if (part.status === "critical") {
      borderClass = "border-red-400";
      bgClass = "bg-red-50";
      progressColor = "bg-red-500";
    } else if (part.status === "warning") {
      borderClass = "border-orange-400";
      bgClass = "bg-orange-50";
      progressColor = "bg-orange-500";
    } else {
      borderClass = "border-green-400";
      bgClass = "bg-green-50";
      progressColor = "bg-green-500";
    }

    const activeClass = isActive ? "ring-2 ring-blue-400 shadow-lg" : "";
    const formattedDate = part ? this.formatDate(part.date) : "";

    // Визначаємо типи запчастин
    const mileageBasedParts = [
      "ТО (масло+фільтри) 🛢️",
      "ГРМ (ролики+ремінь) ⚙️",
      "Обвідний ремінь+ролики 🔧",
      "Помпа 💧",
      "Свічки запалювання 🔥",
    ];
    const dateBasedParts = [
      "Діагностика ходової 🔍",
      "Розвал-сходження 📐",
      "Профілактика направляючих супортів 🛠️",
      "Компютерна діагностика 💻",
      "Комп'ютерна діагностика 💻",
      "Прожиг сажового фільтру 🔥",
    ];
    const isDateBasedPart = dateBasedParts.includes(partName);

    // Запчастини з груп, які показують кілометраж після заміни в основному блоці
    const partsWithMileageAfterReplacement = [
      // Ходова частина
      "Амортизатори передні🔧",
      "Амортизатори задні🔧",
      "Опора амортизаторів 🛠️",
      "Шарова опора ⚪",
      "Рульова тяга 🔗",
      "Рульовий накінечник 🔩",
      // Гальмівна система
      "Гальмівні колодки передні🛑",
      "Гальмівні колодки задні🛑",
      "Гальмівні диски передні💿",
      "Гальмівні диски задні💿",
      "Гальмівні колодки ручного гальма🛑",
      // Електрика
      "Стартер 🔋",
      "Генератор ⚡",
      "Акумулятор 🔋",
      // Трансмісія
      "Зчеплення ⚙️",
    ];
    const isMileageAfterReplacement =
      partsWithMileageAfterReplacement.includes(partName);

    // Розраховуємо прогрес та наступну заміну
    let progressPercent = 0;
    let nextMileage = "";
    let progressText = "";
    let progressLabel = "";
    let nextServiceText = "";

    if (part && !isChainDriveGRM) {
      const regulation = this.findRegulationForCar(
        car.license,
        car.model,
        car.year,
        partName,
      );

      if (
        mileageBasedParts.includes(partName) &&
        regulation &&
        regulation.periodType === "пробіг"
      ) {
        // Перевіряємо, чи є індивідуальний регламент
        const hasIndividualRegulation =
          regulation &&
          ((regulation.licensePattern !== "*" &&
            regulation.licensePattern !== ".*") ||
            (regulation.brandPattern !== "*" &&
              regulation.brandPattern !== ".*" &&
              regulation.modelPattern !== "*" &&
              regulation.modelPattern !== ".*"));

        let normalValue;
        if (hasIndividualRegulation && regulation.regulationValue) {
          normalValue = regulation.regulationValue;
        } else if (
          regulation.normalValue &&
          regulation.normalValue !== "chain"
        ) {
          normalValue = regulation.normalValue;
        }

        if (
          normalValue &&
          part.mileageDiff !== undefined &&
          part.mileageDiff !== null
        ) {
          progressPercent = Math.min(
            100,
            Math.max(0, Math.round((part.mileageDiff / normalValue) * 100)),
          );

          // Для запчастин ТО, ГРМ, Помпа, Обвідний ремінь, Свічки запалювання показуємо мінусовий пробіг при перепробігу
          const partsWithNegativeMileage = [
            "ТО (масло+фільтри) 🛢️",
            "ГРМ (ролики+ремінь) ⚙️",
            "Помпа 💧",
            "Обвідний ремінь+ролики 🔧",
            "Свічки запалювання 🔥",
          ];

          if (
            partsWithNegativeMileage.includes(partName) &&
            part.mileageDiff > normalValue
          ) {
            // Показуємо мінусовий пробіг (перепробіг)
            const overMileage = part.mileageDiff - normalValue;
            progressText = "-" + this.formatMileageDiff(overMileage);
            progressLabel = "Перепробіг";
            progressPercent = 100;
            const nextMileageValue = part.mileage + normalValue;
            nextMileage = this.formatMileage(nextMileageValue);
            nextServiceText = `Наступна заміна на ${nextMileage}`;
          } else {
            // Звичайна логіка для інших випадків
            const remainingMileage = Math.max(
              0,
              normalValue - part.mileageDiff,
            );
            const nextMileageValue = part.mileage + normalValue;
            nextMileage = this.formatMileage(nextMileageValue);
            progressText = this.formatMileageDiff(remainingMileage);
            progressLabel = "До наступної заміни";
            nextServiceText = `Наступна заміна на ${nextMileage}`;
          }
        }
      } else if (dateBasedParts.includes(partName)) {
        // Для робіт з датами розраховуємо залишок пробігу до наступної перевірки
        const regulation = this.findRegulationForCar(
          car.license,
          car.model,
          car.year,
          partName,
        );

        // Визначаємо нормативне значення (місяці)
        let normalValue = 6; // За замовчуванням 6 місяців
        if (regulation) {
          if (regulation.periodType === "місяць") {
            normalValue =
              regulation.regulationValue || regulation.normalValue || 6;
          } else if (
            regulation.normalValue &&
            typeof regulation.normalValue === "number"
          ) {
            normalValue = regulation.normalValue;
          }
        }

        // Завжди розраховуємо через місяці для dateBasedParts
        if (
          part.mileageDiff !== undefined &&
          part.mileageDiff !== null &&
          part.daysDiff !== undefined &&
          part.daysDiff !== null
        ) {
          const remainingMonths = normalValue - Math.floor(part.daysDiff / 30);
          const avgMonthlyMileage = this.getAverageMonthlyMileage(car);
          const remainingMileage =
            remainingMonths > 0
              ? Math.round(remainingMonths * avgMonthlyMileage)
              : 0;

          if (remainingMileage > 0) {
            progressText = this.formatMileageDiff(remainingMileage);
            progressLabel = "До наступної заміни";
            progressPercent = Math.min(
              100,
              Math.max(
                0,
                Math.round(
                  ((normalValue - remainingMonths) / normalValue) * 100,
                ),
              ),
            );
          } else {
            progressText = this.formatMileageDiff(0);
            progressLabel = "До наступної заміни";
            progressPercent = 100;
          }

          // Отримуємо інформацію про наступну перевірку
          const nextInfo = this.getNextReplacementInfo(car, partName, part);
          if (nextInfo) {
            nextServiceText = nextInfo;
          }
        }
      }

      // Для запчастин з груп Ходова частина, Гальмівна система, Електрика, Трансмісія
      // показуємо кілометраж після заміни в основному блоці
      if (
        isMileageAfterReplacement &&
        part &&
        part.mileageDiff !== undefined &&
        part.mileageDiff !== null &&
        !progressText
      ) {
        progressText = this.formatMileageDiff(part.mileageDiff);
        progressLabel = "Після заміни";
      }
    }

    // Витягуємо емодзі з назви
    // Використовуємо більш надійний спосіб - шукаємо всі можливі емодзі
    let emoji = "🔧"; // За замовчуванням
    let nameWithoutEmoji = partName;

    // Список всіх можливих емодзі для запчастин
    const partEmojis = [
      "🛢️",
      "⚙️",
      "💧",
      "🔧",
      "🔍",
      "📐",
      "🛠️",
      "💻",
      "🔥",
      "🕯️",
      "💿",
      "🛑",
      "🔋",
      "⚡",
      "⚪",
      "🔗",
      "🔩",
    ];

    // Шукаємо емодзі в назві
    for (const emojiChar of partEmojis) {
      if (partName.includes(emojiChar)) {
        emoji = emojiChar;
        nameWithoutEmoji = partName.replace(emojiChar, "").trim();
        break;
      }
    }

    // Якщо не знайдено, спробуємо регулярний вираз як fallback
    if (emoji === "🔧" && nameWithoutEmoji === partName) {
      const emojiMatch = partName.match(
        /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u,
      );
      if (emojiMatch) {
        emoji = emojiMatch[0];
        nameWithoutEmoji = partName.replace(emojiMatch[0], "").trim();
      }
    }

    // Визначаємо класи для картки залежно від статусу
    let cardStatusClass = "card-none";
    if (part) {
      if (part.status === "critical") cardStatusClass = "card-critical";
      else if (part.status === "warning") cardStatusClass = "card-warning";
      else if (part.status === "good") cardStatusClass = "card-good";
    }

    // Перевіряємо, чи в регламенті стовпець H (Регламент) = 0
    const regulation = this.findRegulationForCar(
      car.license,
      car.model,
      car.year,
      partName,
    );

    // Перевіряємо, чи regulationValue дорівнює 0 (може бути число 0 або null/undefined для порожнього)
    const hasZeroRegulation =
      regulation &&
      (regulation.regulationValue === 0 ||
        regulation.regulationValue === null ||
        regulation.regulationValue === undefined ||
        (typeof regulation.regulationValue === "string" &&
          regulation.regulationValue.trim() === "0"));

    // Отримуємо текст зі стовпця N (Особливість)
    let specialNote = "";
    if (regulation) {
      if (
        regulation.specialNote !== undefined &&
        regulation.specialNote !== null
      ) {
        specialNote = String(regulation.specialNote).trim();
      }
    }

    // Визначаємо контент картки
    let cardContent = "";

    if (isChainDriveGRM) {
      cardContent = `
                <div class="card-empty-content">
                    <div class="empty-icon">⚙️</div>
                    <div class="empty-text">Ланцюговий привід ГРМ</div>
                    <div class="empty-text" style="font-size: 11px; margin-top: -8px;">регламентної заміни не потребує</div>
                </div>
            `;
    } else if (hasZeroRegulation) {
      // Якщо regulationValue = 0, показуємо тільки текст зі стовпця N (Особливість)
      // Якщо specialNote порожній або undefined, спробуємо отримати його безпосередньо з регламенту
      let displayNote = specialNote;
      if (!displayNote || !displayNote.trim()) {
        // Спробуємо отримати з регламенту напряму
        if (regulation && regulation.specialNote !== undefined) {
          displayNote = String(regulation.specialNote).trim();
        }
      }

      // Якщо все ще немає тексту, показуємо повідомлення
      if (!displayNote || !displayNote.trim()) {
        displayNote = "Немає особливих вказівок";
      } else {
        displayNote = displayNote.trim();
      }

      cardContent = `
                <div class="card-empty-content">
                    <div class="empty-icon">📝</div>
                    <div class="empty-text" style="font-size: 13px; line-height: 1.4; padding: 0.5rem;">${displayNote}</div>
                        </div>
            `;
    } else if (part) {
      cardContent = `
                <div class="card-info-row">
                    <div class="info-cell">
                        <span class="info-icon">📅</span>
                        <span class="info-value">${formattedDate}</span>
                    </div>
                    <div class="info-cell">
                        <span class="info-icon">📊</span>
                        <span class="info-value">${this.formatMileage(part.mileage)}</span>
                        </div>
                </div>
                        ${progressText
          ? `
                    <div class="card-main-value">
                        <div class="main-label">${progressLabel}</div>
                        <div class="main-value">${progressText}</div>
                        </div>
                                ${progressPercent > 0
            ? `
                        <div class="card-progress">
                            <div class="progress-track">
                                <div class="progress-fill" style="width: ${progressPercent}%"></div>
                            </div>
                                    </div>
                                `
            : ""
          }
                                `
          : ""
        }
                <div class="card-footer">
                    ${nextServiceText || (!isDateBasedPart && !isMileageAfterReplacement && part.mileageDiff !== undefined ? this.formatMileageDiff(part.mileageDiff) : "")}
                            </div>
            `;
    } else {
      cardContent = `
                <div class="card-empty-content">
                    <div class="empty-icon">📝</div>
                    <div class="empty-text">Немає даних</div>
                            </div>
            `;
    }

    return `
            <div class="part-card ${cardStatusClass} ${activeClass}" 
                 data-status="${part ? part.status : "none"}"
                 onclick="app.setState({ selectedHistoryPartFilter: app.state.selectedHistoryPartFilter === '${partName}' ? null : '${partName}' });"
                 style="cursor: pointer; position: relative;">
                ${isActive ? '<div style="position: absolute; top: 32px; right: 8px; font-size: 20px; z-index: 10; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">📌</div>' : ""}
                <div class="card-header">
                    <div class="card-title-row">
                        <span class="card-icon">${emoji}</span>
                        <span class="card-name">${nameWithoutEmoji}</span>
                        </div>
                    ${part && part.timeDiff ? `<span class="card-badge">${part.timeDiff}</span>` : ""}
                        </div>
                ${cardContent}
            </div>
        `;
  }

  getNextReplacementInfo(car, partName, part) {
    if (!part) return "";

    // Запчастини з пробігом: ТО, ГРМ, Обвідний ремінь+ролики, Помпа, Свічки запалювання
    const mileageBasedParts = [
      "ТО (масло+фільтри) 🛢️",
      "ГРМ (ролики+ремінь) ⚙️",
      "Обвідний ремінь+ролики 🔧",
      "Помпа 💧",
      "Свічки запалювання 🔥",
    ];

    // Роботи з датами: Діагностика ходової, Розвал-сходження, Профілактика направляючих супортів, Комп'ютерна діагностика
    const dateBasedParts = [
      "Діагностика ходової 🔍",
      "Розвал-сходження 📐",
      "Профілактика направляючих супортів 🛠️",
      "Компютерна діагностика 💻",
      "Комп'ютерна діагностика 💻", // Альтернативна назва з апострофом
      "Прожиг сажового фільтру 🔥",
    ];

    const regulation = this.findRegulationForCar(
      car.license,
      car.model,
      car.year,
      partName,
    );

    // Діагностичне логування тільки якщо DEBUG включений
    const DEBUG = CONFIG.DEBUG;
    if (DEBUG) {
      const normalizedLicense = car.license.replace(/\s+/g, "").toUpperCase();
      if (
        (normalizedLicense === "AI9573OO" ||
          normalizedLicense === "АІ9573ОО" ||
          normalizedLicense === "AA4132XH") &&
        (partName === "ГРМ (ролики+ремінь) ⚙️" ||
          partName === "Помпа 💧" ||
          partName === "Обвідний ремінь+ролики 🔧")
      ) {
        console.log(`[DEBUG] ${partName} для ${car.license}:`, {
          model: car.model,
          year: car.year,
          regulation: regulation
            ? {
              licensePattern: regulation.licensePattern,
              brandPattern: regulation.brandPattern,
              modelPattern: regulation.modelPattern,
              regulationValue: regulation.regulationValue,
              normalValue: regulation.normalValue,
              periodType: regulation.periodType,
              partName: regulation.partName,
              priority: regulation.priority,
            }
            : null,
          mappedPartName:
            (CONSTANTS.PARTS_MAPPING && CONSTANTS.PARTS_MAPPING[partName]) ||
            partName,
          hasRegulation: !!regulation,
        });
      }
    }

    if (mileageBasedParts.includes(partName)) {
      // Стандартні значення для запчастин з пробігом (якщо регламент не знайдено)
      const defaultMileage = {
        "ТО (масло+фільтри) 🛢️": 15000,
        "ГРМ (ролики+ремінь) ⚙️": 60000,
        "Обвідний ремінь+ролики 🔧": 60000,
        "Помпа 💧": 60000,
        "Свічки запалювання 🔥": 30000,
      };

      let normalValue;
      // Перевіряємо, чи є індивідуальний регламент для цього конкретного авто
      // Індивідуальний регламент - це коли вказано конкретний номер (не "*")
      // або коли вказано конкретну марку/модель (не "*")
      const hasIndividualRegulation =
        regulation &&
        ((regulation.licensePattern !== "*" &&
          regulation.licensePattern !== ".*") ||
          (regulation.brandPattern !== "*" &&
            regulation.brandPattern !== ".*" &&
            regulation.modelPattern !== "*" &&
            regulation.modelPattern !== ".*"));

      // Для індивідуальних регламентів використовуємо значення зі стовпця H (Регламент)
      // Для загальних регламентів використовуємо значення зі стовпця I (У нормі)
      if (
        regulation &&
        regulation.normalValue !== "chain" &&
        regulation.periodType === "пробіг"
      ) {
        if (hasIndividualRegulation && regulation.regulationValue) {
          // Для індивідуальних регламентів використовуємо значення зі стовпця H (Регламент) = 110000
          normalValue = regulation.regulationValue;
          console.log(
            `[DEBUG] Використовуємо regulationValue для індивідуального регламенту: ${normalValue}`,
          );
        } else {
          // Для загальних регламентів використовуємо значення зі стовпця I (У нормі)
          normalValue = regulation.normalValue;
        }
      } else {
        // Якщо регламент не знайдено, використовуємо стандартне значення
        normalValue = defaultMileage[partName] || 15000;
        if (
          (normalizedLicense === "AI9573OO" ||
            normalizedLicense === "АІ9573ОО") &&
          (partName === "ГРМ (ролики+ремінь) ⚙️" ||
            partName === "Помпа 💧" ||
            partName === "Обвідний ремінь+ролики 🔧")
        ) {
          console.log(
            `[DEBUG] Регламент не знайдено, використовуємо стандартне значення: ${normalValue}`,
          );
        }
      }

      // Для "Помпа" і "Обвідний ремінь+ролики": перевіряємо, чи є ланцюговий ГРМ
      // Але тільки якщо НЕ маємо індивідуального регламенту
      if (
        (partName === "Помпа 💧" || partName === "Обвідний ремінь+ролики 🔧") &&
        !hasIndividualRegulation
      ) {
        // Перевіряємо, чи це авто з ланцюговим приводом ГРМ
        const chainDriveModels = [
          "mercedes-benz sprinter",
          "iveco daily 65c15",
          "isuzu nqr 71r",
          "hyundai accent",
        ];
        const isChainDriveGRM =
          car.model &&
          chainDriveModels.some((model) =>
            car.model.toLowerCase().includes(model),
          );

        // Якщо це НЕ авто з ланцюговим ГРМ, перевіряємо регламенти ГРМ
        if (!isChainDriveGRM) {
          const grmRegulation = this.findRegulationForCar(
            car.license,
            car.model,
            car.year,
            "ГРМ (ролики+ремінь) ⚙️",
          );
          if (
            grmRegulation &&
            grmRegulation.normalValue !== "chain" &&
            grmRegulation.periodType === "пробіг"
          ) {
            // Якщо значення відрізняються від ГРМ, використовуємо значення з ГРМ для наступної заміни
            if (grmRegulation.normalValue !== normalValue) {
              normalValue = grmRegulation.normalValue;
            }
          }
        }
      }

      // Розраховуємо наступну заміну на основі пробігу (використовуючи значення зі стовпця H)
      const remainingKm = normalValue - part.mileageDiff;
      const nextMileage = car.currentMileage + remainingKm;

      if (remainingKm <= 0) {
        // Для ТО, ГРМ, Помпа, Обвідний ремінь, Свічки запалювання використовуємо спеціальний текст
        const specialParts = [
          "ТО (масло+фільтри) 🛢️",
          "ГРМ (ролики+ремінь) ⚙️",
          "Помпа 💧",
          "Обвідний ремінь+ролики 🔧",
          "Свічки запалювання 🔥",
        ];
        if (specialParts.includes(partName)) {
          return "Уже пора міняти 👨‍🔧";
        }
        return "Наступна заміна: вже потрібна";
      } else {
        return `Наступна заміна на ${this.formatMileage(nextMileage)}`;
      }
    } else if (dateBasedParts.includes(partName)) {
      // Стандартні значення для робіт з датами (якщо регламент не знайдено)
      const defaultMonths = {
        "Діагностика ходової 🔍": 6,
        "Розвал-сходження 📐": 12,
        "Профілактика направляючих супортів 🛠️": 6,
        "Компютерна діагностика 💻": 6,
        "Комп'ютерна діагностика 💻": 6,
        "Прожиг сажового фільтру 🔥": 12,
      };

      let normalValue;
      let periodType = "місяць";

      // Використовуємо значення зі стовпця H ("У нормі") листа "Регламент ТО"
      // Для Комп'ютерної діагностики завжди використовуємо значення з регламенту (стовпець H), якщо воно є
      const isComputerDiagnostics =
        partName === "Компютерна діагностика 💻" ||
        partName === "Комп'ютерна діагностика 💻";

      if (
        regulation &&
        regulation.normalValue !== "chain" &&
        regulation.normalValue !== null &&
        regulation.normalValue !== undefined
      ) {
        // Використовуємо значення зі стовпця H
        normalValue = regulation.normalValue;
        periodType = regulation.periodType || "місяць";
      } else {
        // Якщо регламент не знайдено, використовуємо стандартне значення
        normalValue = defaultMonths[partName] || 6;
        periodType = "місяць";
      }

      // Для Комп'ютерної діагностики завжди використовуємо значення з регламенту (стовпець H), якщо воно є
      // Не перезаписуємо його стандартним значенням навіть якщо periodType не 'місяць'
      if (
        isComputerDiagnostics &&
        regulation &&
        regulation.normalValue !== "chain" &&
        regulation.normalValue !== null &&
        regulation.normalValue !== undefined
      ) {
        normalValue = regulation.normalValue; // Гарантуємо використання значення зі стовпця H
      }

      // Якщо periodType не 'місяць', але це НЕ Комп'ютерна діагностика - використовуємо стандартне значення
      if (periodType !== "місяць" && !isComputerDiagnostics) {
        normalValue = defaultMonths[partName] || 6;
      }

      // Розраховуємо наступне обслуговування на основі місяців (використовуючи значення зі стовпця H)
      const remainingMonths = normalValue - Math.floor(part.daysDiff / 30);

      // Для Діагностика ходової та Розвал-сходження: якщо помаранчевий або червоний - "Виконати протягом тижня ⏳"
      if (
        (partName === "Діагностика ходової 🔍" ||
          partName === "Розвал-сходження 📐") &&
        (part.status === "warning" || part.status === "critical")
      ) {
        return "Виконати протягом тижня ⏳";
      }

      // Для Профілактика направляючих супортів та Комп'ютерна діагностика: якщо помаранчевий - "Виконати протягом тижня ⏳"
      if (
        (partName === "Профілактика направляючих супортів 🛠️" ||
          partName === "Компютерна діагностика 💻" ||
          partName === "Комп'ютерна діагностика 💻") &&
        part.status === "warning"
      ) {
        return "Виконати протягом тижня ⏳";
      }

      if (remainingMonths <= 0) {
        return "Виконати протягом тижня ⏳";
      }

      // Розраховуємо дату наступного обслуговування
      const nextDate = new Date();
      nextDate.setMonth(nextDate.getMonth() + remainingMonths);

      const monthNames = [
        "січень",
        "лютий",
        "березень",
        "квітень",
        "травень",
        "червень",
        "липень",
        "серпень",
        "вересень",
        "жовтень",
        "листопад",
        "грудень",
      ];
      const monthName = monthNames[nextDate.getMonth()];

      return `Наступна перевірка: ${monthName}`;
    }

    return "";
  }

  generateCostChartHTML(car, costStats) {
    const selectedYear = this.state.selectedYear;

    // Отримуємо список доступних років з повної історії (без фільтру року)
    const fullCostStats = this.calculateCostStats(car.history, car, null);
    const availableYears = Object.keys(fullCostStats.byYear || {})
      .map((y) => parseInt(y))
      .sort((a, b) => b - a);
    const currentYear = new Date().getFullYear();
    if (!availableYears.includes(currentYear)) {
      availableYears.unshift(currentYear);
    }

    const monthlyData = this.prepareMonthlyChartData(
      costStats.byMonth,
      costStats.byYear,
      selectedYear,
    );

    // Розраховуємо загальну суму за вибраний рік або за всі роки
    const totalForPeriod = selectedYear
      ? costStats.byYear[selectedYear] || 0
      : costStats.totalSpent;

    return `
            <h3 class="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                <span>💰</span> Аналіз витрат
            </h3>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <!-- Статистика -->
                <div class="space-y-3 order-1 md:order-1">
                    <div class="flex justify-between items-center p-3 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg">
                        <span class="font-semibold text-blue-800">Загалом витрачено:</span>
                        <span class="text-xl font-bold text-blue-600">${this.formatPrice(costStats.totalSpent)} ₴</span>
                    </div>
                    
                    <div class="flex justify-between items-center p-3 bg-gradient-to-r from-green-50 to-green-100 rounded-lg">
                        <span class="font-semibold text-green-800">За останній рік:</span>
                        <span class="text-xl font-bold text-green-600">${this.formatPrice(costStats.lastYearSpent)} ₴</span>
                    </div>
                    
                    <div class="flex justify-between items-center p-3 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg">
                        <span class="font-semibold text-purple-800">Середньомісячно:</span>
                        <span class="text-xl font-bold text-purple-600">${this.formatPrice(costStats.averagePerMonth)} ₴</span>
                    </div>
                    
                    <div class="flex justify-between items-center p-3 bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg">
                        <span class="font-semibold text-orange-800">Прогноз на 6 міс:</span>
                        <span class="text-xl font-bold text-orange-600">${this.formatPrice(costStats.predictions.next6Months)} ₴</span>
                    </div>
                </div>
                
                <!-- Стовпчастий графік витрат по роках/місяцях -->
                <div class="p-3 bg-gray-50 rounded-lg order-2 md:order-2 relative">
                    <div class="flex items-center justify-between mb-2">
                        <div class="text-xs font-semibold text-gray-700">📊 Розподіл по категоріях</div>
                        <div class="text-xs text-gray-600">📅 Період:</div>
                        <select onchange="app.setState({ selectedYear: this.value === 'all' ? null : parseInt(this.value) }); app.render();" 
                                class="ml-2 text-xs border border-gray-300 rounded px-2 py-1 bg-white text-gray-700">
                            <option value="all" ${!selectedYear ? "selected" : ""}>Всі роки</option>
                            ${availableYears
        .map(
          (year) => `
                                <option value="${year}" ${selectedYear === year ? "selected" : ""}>${year}</option>
                            `,
        )
        .join("")}
                        </select>
                    </div>
                    ${(() => {
        if (!monthlyData || monthlyData.length === 0) {
          return '<div class="text-center text-gray-500 text-sm py-8">Немає даних для відображення</div>';
        }

        const chartWidth = 600;
        const chartHeight = 200;
        const padding = {
          top: 20,
          right: 20,
          bottom: 40,
          left: 50,
        };
        const graphWidth =
          chartWidth - padding.left - padding.right;
        const graphHeight =
          chartHeight - padding.top - padding.bottom;
        const maxAmount = Math.max(
          ...monthlyData.map((d) => d.amount),
          1,
        );
        const barWidth = (graphWidth / monthlyData.length) * 0.7;
        const barSpacing = graphWidth / monthlyData.length;

        // Розраховуємо лінію тренду (лінійна регресія)
        let trendLine = "";
        let avgAmount = 0;
        let trendDirection = ""; // 'up', 'down', 'stable'

        if (monthlyData.length > 1) {
          // Обчислюємо середнє значення
          avgAmount =
            monthlyData.reduce((sum, d) => sum + d.amount, 0) /
            monthlyData.length;

          // Розраховуємо лінійну регресію для визначення напрямку тренду
          const n = monthlyData.length;
          let sumX = 0,
            sumY = 0,
            sumXY = 0,
            sumX2 = 0;

          monthlyData.forEach((d, idx) => {
            const x = idx;
            const y = d.amount;
            sumX += x;
            sumY += y;
            sumXY += x * y;
            sumX2 += x * x;
          });

          const slope =
            (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
          const intercept = (sumY - slope * sumX) / n;

          // Визначаємо напрямок тренду
          const threshold = 0.05; // 5% від середнього для визначення стабільності
          if (Math.abs(slope) < (avgAmount * threshold) / n) {
            trendDirection = "stable";
          } else if (slope > 0) {
            trendDirection = "up";
          } else {
            trendDirection = "down";
          }

          // Розраховуємо координати для лінії тренду
          const x1 = padding.left;
          const y1 =
            padding.top +
            graphHeight -
            (intercept / maxAmount) * graphHeight;
          const x2 = padding.left + graphWidth;
          const y2 =
            padding.top +
            graphHeight -
            ((slope * (n - 1) + intercept) / maxAmount) *
            graphHeight;

          // Визначаємо колір та іконку залежно від напрямку
          let trendColor = "#6b7280"; // сірий для стабільного
          let trendIcon = "➡️";
          let trendText = "Стабільно";

          if (trendDirection === "up") {
            trendColor = "#ef4444"; // червоний для зростання
            trendIcon = "📈";
            trendText = "Зростання";
          } else if (trendDirection === "down") {
            trendColor = "#10b981"; // зелений для падіння
            trendIcon = "📉";
            trendText = "Зниження";
          }

          // Малюємо лінію тренду
          trendLine = `
                                <line 
                                    x1="${x1}" 
                                    y1="${y1}" 
                                    x2="${x2}" 
                                    y2="${y2}" 
                                    stroke="${trendColor}" 
                                    stroke-width="2" 
                                    stroke-dasharray="5,5" 
                                    opacity="0.7"
                                />
                                <text 
                                    x="${padding.left + graphWidth - 5}" 
                                    y="${Math.min(y1, y2) - 5}" 
                                    fill="${trendColor}" 
                                    font-size="10" 
                                    text-anchor="end"
                                    font-weight="bold"
                                >${trendIcon} ${trendText}</text>
                            `;
        } else if (monthlyData.length === 1) {
          avgAmount = monthlyData[0].amount;
        }

        return `
                            <div class="overflow-x-auto">
                                <svg width="${chartWidth}" height="${chartHeight}" viewBox="0 0 ${chartWidth} ${chartHeight}" class="w-full">
                                    <!-- Сітка -->
                                    ${Array.from({ length: 5 })
            .map((_, i) => {
              const y =
                padding.top + (graphHeight / 4) * i;
              const value =
                maxAmount - (maxAmount / 4) * i;
              return `
                                            <line 
                                                x1="${padding.left}" 
                                                y1="${y}" 
                                                x2="${padding.left + graphWidth}" 
                                                y2="${y}" 
                                                stroke="#e5e7eb" 
                                                stroke-width="1"
                                            />
                                            <text 
                                                x="${padding.left - 5}" 
                                                y="${y + 4}" 
                                                fill="#6b7280" 
                                                font-size="10" 
                                                text-anchor="end"
                                            >${this.formatPrice(value)}</text>
                                        `;
            })
            .join("")}
                                    
                                    <!-- Лінія тренду -->
                                    ${trendLine}
                                    
                                    <!-- Стовпці -->
                                    ${monthlyData
            .map((data, idx) => {
              const x =
                padding.left +
                idx * barSpacing +
                (barSpacing - barWidth) / 2;
              const barHeight =
                (data.amount / maxAmount) *
                graphHeight;
              const y =
                padding.top + graphHeight - barHeight;
              const color = selectedYear
                ? "#3b82f6"
                : "#10b981";

              return `
                                            <g>
                                                <rect 
                                                    x="${x}" 
                                                    y="${y}" 
                                                    width="${barWidth}" 
                                                    height="${barHeight}" 
                                                    fill="${color}" 
                                                    class="transition-all duration-300 hover:opacity-80 cursor-pointer"
                                                    data-label="${data.label}"
                                                    data-amount="${data.amount}"
                                                />
                                                <text 
                                                    x="${x + barWidth / 2}" 
                                                    y="${y - 5}" 
                                                    fill="#374151" 
                                                    font-size="10" 
                                                    text-anchor="middle"
                                                    font-weight="bold"
                                                >${this.formatPrice(data.amount)}</text>
                                                <text 
                                                    x="${x + barWidth / 2}" 
                                                    y="${chartHeight - padding.bottom + 15}" 
                                                    fill="#6b7280" 
                                                    font-size="9" 
                                                    text-anchor="middle"
                                                    transform="rotate(-45 ${x + barWidth / 2} ${chartHeight - padding.bottom + 15})"
                                                >${data.label}</text>
                                            </g>
                                        `;
            })
            .join("")}
                                </svg>
                                    </div>
                            <div class="mt-2 text-center">
                        <div class="text-sm font-bold">
                            <span class="text-blue-600">Всього: ${this.formatPrice(totalForPeriod)} ₴</span>
                            ${avgAmount > 0 ? ` <span class="text-purple-600">| Середнє: ${this.formatPrice(avgAmount)} ₴</span>` : ""}
                                </div>
                            </div>
                        `;
      })()}
                </div>
            </div>
            
            <!-- Розподіл по категоріях та Частота поломок -->
            <div class="mt-4">
                <!-- Заголовки на одному рівні -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                    <h4 class="font-semibold text-gray-700 flex items-center gap-2">
                        <span>📋</span> Розподіл витрат по категоріях
                    </h4>
                    <h4 class="font-semibold text-gray-700 flex items-center gap-2">
                        <span>📊</span> Частота поломок по категоріях
                    </h4>
                </div>
                
                <!-- Контент в одному блоці -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <!-- Розподіл витрат -->
                    <div>
                        <div class="space-y-3">
                    ${Object.entries(costStats.byCategory)
        .sort((a, b) => b[1] - a[1])
        .map(([category, amount]) => {
          const percentage =
            costStats.totalSpent > 0
              ? ((amount / costStats.totalSpent) * 100).toFixed(1)
              : 0;
          const maxAmount = Math.max(
            ...Object.values(costStats.byCategory),
          );
          const barWidth =
            maxAmount > 0 ? (amount / maxAmount) * 100 : 0;

          return `
                                        <div class="space-y-1">
                                <div class="flex items-center justify-between">
                                                <span class="text-sm text-gray-700 font-medium">${category}</span>
                                    <div class="flex items-center gap-2">
                                                    <span class="text-xs text-gray-500">${this.formatPrice(amount)} ₴</span>
                                                    <span class="text-xs font-semibold text-gray-600">${percentage}%</span>
                                        </div>
                                            </div>
                                            <div class="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                                                <div class="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-500" 
                                                     style="width: ${barWidth}%"></div>
                                    </div>
                                </div>
                            `;
        })
        .join("")}
                        </div>
                        <div class="mt-3 pt-3 border-t border-gray-200">
                            <div class="flex justify-between items-center text-sm">
                                <span class="text-gray-600">Всього витрачено:</span>
                                <span class="font-bold text-gray-800">${this.formatPrice(costStats.totalSpent)} ₴</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Частота поломок -->
                    <div>
                        ${this.generateBreakdownFrequencyChartContent(car)}
                    </div>
                </div>
            </div>
        `;
  }

  generateCostRecommendations(car, costStats) {
    // Використовуємо новий модуль якщо доступний
    if (this.carRecommendations) {
      const recommendations = this.carRecommendations.generateRecommendations(
        car,
        costStats,
        () => this.getAverageMonthlyMileage(car),
        (mileage) => this.formatMileage(mileage),
        this.carWashChecker,
        (license, model, year, partName) =>
          this.findRegulationForCar(license, model, year, partName),
        (car, partName, part) =>
          this.getNextReplacementInfo(car, partName, part),
      );
      return this.carRecommendations.generateRecommendationsHTML(
        recommendations,
      );
    }

    // Fallback (не повинно досягти цього коду)
    return '<div class="mt-6 p-4">Рекомендації недоступні</div>';
  }

  // === НОВІ ФУНКЦІЇ: ГРАФІК ЧАСТОТИ ПОЛОМОК ===
  generateBreakdownFrequencyChart(car) {
    if (!this.breakdownAnalysis) {
      return "";
    }

    const filters = {
      selectedYear: this.state.selectedYear,
      selectedCity: this.state.selectedCity,
    };

    // Аналізуємо тільки поточне авто
    const stats = this.breakdownAnalysis.analyzeBreakdownFrequency(
      [car],
      filters,
    );
    return this.breakdownAnalysis.generateBreakdownFrequencyChartHTML(
      stats,
      (amount) => this.formatPrice(amount),
    );
  }

  // Генерує тільки контент графіка частоти поломок (без заголовка)
  generateBreakdownFrequencyChartContent(car) {
    if (!this.breakdownAnalysis) {
      return '<div class="text-sm text-gray-500 text-center">Немає даних</div>';
    }

    const filters = {
      selectedYear: this.state.selectedYear,
      selectedCity: this.state.selectedCity,
    };

    const stats = this.breakdownAnalysis.analyzeBreakdownFrequency(
      [car],
      filters,
    );

    if (!stats || stats.totalBreakdowns === 0) {
      return '<div class="text-sm text-gray-500 text-center">Немає даних для відображення</div>';
    }

    const sortedCategories = Object.entries(stats.byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const maxFrequency = Math.max(
      ...sortedCategories.map(([_, count]) => count),
    );

    return `
            <div class="space-y-3">
                ${sortedCategories
        .map(([category, count]) => {
          const percentage = (
            (count / stats.totalBreakdowns) *
            100
          ).toFixed(1);
          const barWidth =
            maxFrequency > 0 ? (count / maxFrequency) * 100 : 0;

          return `
                        <div class="space-y-1">
                            <div class="flex items-center justify-between">
                                <span class="text-sm text-gray-700 font-medium">${category}</span>
                                <div class="flex items-center gap-2">
                                    <span class="text-xs text-gray-500">${count} разів</span>
                                    <span class="text-xs font-semibold text-gray-600">${percentage}%</span>
                                </div>
                            </div>
                            <div class="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                                <div class="h-full bg-gradient-to-r from-red-400 via-orange-400 to-yellow-400 rounded-full transition-all duration-500" 
                                     style="width: ${barWidth}%"></div>
                            </div>
                        </div>
                    `;
        })
        .join("")}
            </div>
            <div class="mt-3 pt-3 border-t border-gray-200">
                <div class="flex justify-between items-center text-sm">
                    <span class="text-gray-600">Всього поломок:</span>
                    <span class="font-bold text-gray-800">${stats.totalBreakdowns}</span>
                </div>
            </div>
        `;
  }

  // === НОВІ ФУНКЦІЇ: СЕРЕДНІЙ ПРОБІГ В ШАПЦІ ===
  generateMileageStatsInline(car) {
    const avgMonthlyMileage = this.getAverageMonthlyMileage(car);
    const avgDailyMileage = Math.round(avgMonthlyMileage / 30);
    const avgWeeklyMileage = Math.round(avgMonthlyMileage / 4.33);
    const avgYearlyMileage = Math.round(avgMonthlyMileage * 12);

    return `
            <div class="text-center">
                <div class="text-blue-100 text-xs mb-0.5">Середній пробіг</div>
                <div class="flex flex-col items-start gap-0.5 text-xs text-blue-100">
                    <div class="flex items-center gap-1.5 w-full">
                        <span class="w-5 text-center">📅</span>
                        <span class="font-semibold text-white">${this.formatMileage(avgDailyMileage)}/день</span>
                    </div>
                    <div class="flex items-center gap-1.5 w-full">
                        <span class="w-5 text-center">📆</span>
                        <span class="font-semibold text-white">${this.formatMileage(avgWeeklyMileage)}/тиждень</span>
                    </div>
                    <div class="flex items-center gap-1.5 w-full">
                        <span class="w-5 text-center">📊</span>
                        <span class="font-semibold text-white">${this.formatMileage(avgMonthlyMileage)}/місяць</span>
                    </div>
                    <div class="flex items-center gap-1.5 w-full">
                        <span class="w-5 text-center">🗓️</span>
                        <span class="font-semibold text-white">${this.formatMileage(avgYearlyMileage)}/рік</span>
                    </div>
                </div>
            </div>
        `;
  }

  generateMileageStatsHeader(car) {
    const avgMonthlyMileage = this.getAverageMonthlyMileage(car);
    const avgDailyMileage = Math.round(avgMonthlyMileage / 30);
    const avgWeeklyMileage = Math.round(avgMonthlyMileage / 4.33);
    const avgYearlyMileage = Math.round(avgMonthlyMileage * 12);

    return `
            <div class="mt-2 pt-2 border-t border-blue-700/30">
                <div class="flex flex-wrap items-center justify-center gap-3 text-xs text-blue-100">
                    <div class="flex items-center gap-1">
                        <span>📅</span>
                        <span class="font-semibold">${this.formatMileage(avgDailyMileage)}/день</span>
                        </div>
                    <div class="flex items-center gap-1">
                        <span>📆</span>
                        <span class="font-semibold">${this.formatMileage(avgWeeklyMileage)}/тиждень</span>
                    </div>
                    <div class="flex items-center gap-1">
                        <span>📊</span>
                        <span class="font-semibold">${this.formatMileage(avgMonthlyMileage)}/місяць</span>
                    </div>
                    <div class="flex items-center gap-1">
                        <span>🗓️</span>
                        <span class="font-semibold">${this.formatMileage(avgYearlyMileage)}/рік</span>
                    </div>
                </div>
            </div>
        `;
  }

  // === НОВІ ФУНКЦІЇ: ІНТЕРАКТИВНА КАРТА СТАНУ АВТО ===
  generatePartsStatusMap(car) {
    const carParts = [
      // Верхній ряд
      {
        name: "Гальмівна система",
        emoji: "🛑",
        parts: [
          "Профілактика направляючих супортів 🛠️",
          "Гальмівні колодки передні🛑",
          "Гальмівні колодки задні🛑",
          "Гальмівні диски передні💿",
          "Гальмівні диски задні💿",
          "Гальмівні колодки ручного гальма🛑",
        ],
        x: 25,
        y: 22,
      },
      {
        name: "Ходова частина",
        emoji: "🔩",
        parts: [
          "Амортизатори передні🔧",
          "Амортизатори задні🔧",
          "Опора амортизаторів 🛠️",
          "Шарова опора ⚪",
          "Рульова тяга 🔗",
          "Рульовий накінечник 🔩",
          "Діагностика ходової 🔍",
          "Розвал-сходження 📐",
        ],
        x: 75,
        y: 22,
      },
      // Нижній ряд
      {
        name: "Електрика",
        emoji: "⚡",
        parts: ["Стартер 🔋", "Генератор ⚡", "Акумулятор 🔋"],
        x: 25,
        y: 72,
      },
      {
        name: "Двигун",
        emoji: "🔧",
        parts: [
          "ТО (масло+фільтри) 🛢️",
          "ГРМ (ролики+ремінь) ⚙️",
          "Помпа 💧",
          "Обвідний ремінь+ролики 🔧",
          "Свічки запалювання 🔥",
        ],
        x: 50,
        y: 42,
      },
      {
        name: "Трансмісія",
        emoji: "⚙️",
        parts: ["Зчеплення ⚙️"],
        x: 75,
        y: 72,
      },
    ];

    return `
            <div class="mt-6 mb-4 bg-white rounded-xl shadow-xl p-3 sm:p-4 border border-gray-200">
                <h4 class="font-semibold text-gray-800 mb-3 text-center text-lg">🗺️ Інтерактивна карта стану авто</h4>
                <div class="relative bg-gray-100 rounded-lg p-4 h-80">
                    ${carParts
        .map((system) => {
          const systemStatus = this.getSystemStatus(
            car,
            system.parts,
            system.name,
          );
          const statusColor =
            systemStatus === "good"
              ? "bg-green-500"
              : systemStatus === "warning"
                ? "bg-orange-500"
                : "bg-red-500";
          const statusIcon =
            systemStatus === "good"
              ? "✅"
              : systemStatus === "warning"
                ? "⚠️"
                : "⛔";

          const statusText =
            systemStatus === "good"
              ? "Норма"
              : systemStatus === "warning"
                ? "Увага"
                : "Критично";

          const systemDetails = this.getSystemDetails(
            car,
            system.parts,
          );

          return `
                            <div class="absolute system-map-item" style="left: ${system.x}%; top: ${system.y}%; transform: translate(-50%, -50%); z-index: 10;">
                                <div class="relative">
                                    <div class="system-map-name absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 text-center w-full">
                                        <div class="text-sm font-bold text-gray-800 whitespace-nowrap">${system.name}</div>
                                    </div>
                                    <div class="system-map-icon w-20 h-20 ${statusColor} rounded-full flex flex-col items-center justify-center text-white font-bold shadow-lg cursor-pointer transition-transform hover:scale-110"
                                         style="background: ${systemStatus === "good" ? "#10b981" : systemStatus === "warning" ? "#f97316" : "#ef4444"};">
                                        <div class="text-3xl">${system.emoji}</div>
                                        <div class="text-sm mt-0.5 font-bold">${statusIcon}</div>
                                    </div>
                                    <div class="system-map-label absolute top-full left-1/2 transform -translate-x-1/2 mt-1 text-center w-full">
                                        <div class="text-xs font-bold text-gray-800 whitespace-nowrap">${statusText}</div>
                                    </div>
                                    <div class="system-map-tooltip">
                                        <div class="text-xs text-gray-700 space-y-1">${systemDetails}</div>
                                    </div>
                                </div>
                            </div>
                        `;
        })
        .join("")}
                </div>
                <div class="mt-3 flex justify-center gap-4 text-xs">
                    <div class="flex items-center gap-1.5">
                        <div class="w-4 h-4 bg-green-500 rounded-full"></div>
                        <span class="text-gray-700 font-semibold">Норма</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <div class="w-4 h-4 bg-orange-500 rounded-full"></div>
                        <span class="text-gray-700 font-semibold">Увага</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <div class="w-4 h-4 bg-red-500 rounded-full"></div>
                        <span class="text-gray-700 font-semibold">Критично</span>
                    </div>
                </div>
            </div>
        `;
  }

  getSystemStatus(car, partNames, systemName) {
    let criticalCount = 0;
    let hasWarning = false;

    // Запчастини, для яких не застосовується умова про кількість критичних
    const excludedParts = [
      "ТО (масло+фільтри) 🛢️",
      "ГРМ (ролики+ремінь) ⚙️",
      "Помпа 💧",
      "Обвідний ремінь+ролики 🔧",
    ];

    for (const partName of partNames) {
      const part = car.parts[partName];
      if (part) {
        if (part.status === "critical") {
          // Для вузла "Двигун" і виключених запчастин використовуємо стару логіку
          if (systemName === "Двигун" && excludedParts.includes(partName)) {
            // Для цих запчастин одразу повертаємо critical
            return "critical";
          } else {
            criticalCount++;
          }
        }
        if (part.status === "warning") {
          hasWarning = true;
        }
      }
    }

    // Для вузла "Двигун" з виключеними запчастинами - якщо дійшли сюди, значить немає critical серед виключених
    // Використовуємо стару логіку для вузла "Двигун"
    if (systemName === "Двигун") {
      if (hasWarning) return "warning";
      return "good";
    }

    // Для інших вузлів використовуємо нову логіку з підрахунком критичних
    // Якщо є більше двох блоків з червоним статусом - вузол червоний
    if (criticalCount > 2) return "critical";
    // Якщо є менше двох блоків з червоним статусом (але є хоча б один) - вузол помаранчевий
    if (criticalCount > 0) return "warning";
    // Якщо є блоки з помаранчевим статусом - вузол помаранчевий
    if (hasWarning) return "warning";
    return "good";
  }

  getSystemDetails(car, partNames) {
    const details = [];
    let criticalCount = 0;
    let warningCount = 0;
    let goodCount = 0;
    let noDataCount = 0;

    for (const partName of partNames) {
      const part = car.parts[partName];
      if (part) {
        if (part.status === "critical") {
          criticalCount++;
          details.push(
            `<div class="flex items-center gap-2 py-0.5"><span>⛔</span><span class="text-red-600 font-semibold">${partName}</span></div>`,
          );
        } else if (part.status === "warning") {
          warningCount++;
          details.push(
            `<div class="flex items-center gap-2 py-0.5"><span>⚠️</span><span class="text-orange-600 font-semibold">${partName}</span></div>`,
          );
        } else if (part.status === "good") {
          goodCount++;
          details.push(
            `<div class="flex items-center gap-2 py-0.5"><span>✅</span><span class="text-green-600">${partName}</span></div>`,
          );
        }
      } else {
        noDataCount++;
      }
    }

    let result = details.join("");
    if (noDataCount > 0) {
      result += `<div class="text-gray-500 text-xs mt-2 pt-2 border-t">Немає даних: ${noDataCount}</div>`;
    }

    return result || '<div class="text-gray-500 text-xs">Немає даних</div>';
  }

  // === НОВІ ФУНКЦІЇ: ПАНЕЛЬ ШВИДКИХ ДІЙ ===
  generateQuickActions(car) {
    return `
            <div class="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button onclick="window.print()" 
                        class="flex flex-col items-center justify-center p-3 bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 rounded-lg transition-all hover:shadow">
                    <span class="text-2xl mb-1">🖨️</span>
                    <span class="text-xs font-medium text-blue-700">Друк звіту</span>
                </button>
                
                <button onclick="app.shareReport('${car.license}')" 
                        class="flex flex-col items-center justify-center p-3 bg-gradient-to-r from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 rounded-lg transition-all hover:shadow">
                    <span class="text-2xl mb-1">📤</span>
                    <span class="text-xs font-medium text-green-700">Поділитись</span>
                </button>
                
                <button onclick="app.downloadReport('${car.license}')" 
                        class="flex flex-col items-center justify-center p-3 bg-gradient-to-r from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 rounded-lg transition-all hover:shadow">
                    <span class="text-2xl mb-1">💾</span>
                    <span class="text-xs font-medium text-purple-700">Експорт PDF</span>
                </button>
                
                <button onclick="app.setReminder('${car.license}')" 
                        class="flex flex-col items-center justify-center p-3 bg-gradient-to-r from-orange-50 to-orange-100 hover:from-orange-100 hover:to-orange-200 rounded-lg transition-all hover:shadow">
                    <span class="text-2xl mb-1">⏰</span>
                    <span class="text-xs font-medium text-orange-700">Нагадування</span>
                </button>
            </div>
        `;
  }

  // === НОВІ ФУНКЦІЇ: ПОШУК ЗАПЧАСТИН ===
  generatePartsSearch(car) {
    return `
            <div class="mt-4 mb-4 p-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200">
                <h4 class="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <span>🔍</span> Пошук запчастин для ${car.model}
                </h4>
                
                <div class="flex gap-2 mb-2">
                    <input type="text" 
                           placeholder="Назва запчастини..." 
                           class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                           id="partsSearchInput">
                    <button onclick="app.searchParts()"
                            class="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded transition-colors">
                        Знайти
                    </button>
                </div>
                
                <div class="text-xs text-gray-500">
                    Популярні запити: 
                    <span class="text-blue-600 cursor-pointer hover:underline" onclick="document.getElementById('partsSearchInput').value = 'фільтр масляний'">фільтр</span>, 
                    <span class="text-blue-600 cursor-pointer hover:underline" onclick="document.getElementById('partsSearchInput').value = 'колодки гальмівні'">колодки</span>, 
                    <span class="text-blue-600 cursor-pointer hover:underline" onclick="document.getElementById('partsSearchInput').value = 'амортизатор'">амортизатор</span>
                </div>
            </div>
        `;
  }

  generateCarHistoryHTML(car, displayHistory) {
    return `
            <h3 class="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                <span>📜</span> Історія обслуговування
                ${this.state.selectedHistoryPartFilter ||
        this.state.historySearchTerm
        ? `
                    <div class="flex flex-wrap items-center gap-1">
                        ${this.state.selectedHistoryPartFilter
          ? `
                            <span class="text-xs font-normal text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                📌 ${this.state.selectedHistoryPartFilter}
                            </span>
                        `
          : ""
        }
                        ${this.state.historySearchTerm
          ? `
                            <span class="text-xs font-normal text-green-600 bg-green-50 px-2 py-1 rounded">
                                🔎 "${this.state.historySearchTerm}"
                            </span>
                        `
          : ""
        }
                        <button onclick="app.setState({ selectedHistoryPartFilter: null, historySearchTerm: '' });"
                                class="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs font-semibold transition-colors flex items-center gap-1">
                            ✕ Скинути всі фільтри
                        </button>
                    </div>
                `
        : ""
      }
                <span class="ml-auto text-xs font-normal text-gray-600">
                    ${displayHistory.length} з ${car.history.length} записів
                </span>
            </h3>

            <div class="mb-3">
                <label class="block text-xs font-medium text-gray-700 mb-1">🔍 Пошук в історії</label>
                <div class="flex gap-1">
                    <input
                        type="text"
                        value="${this.state.historySearchTerm}"
                        oninput="app.handleHistorySearchInput(event)"
                        onkeydown="app.handleHistorySearchKeyDown(event)"
                        placeholder="Пошук за текстом, датою або пробігом... (Enter для пошуку)"
                        class="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-800"
                        id="historySearchInput"
                        autocomplete="off"
                        autocorrect="off"
                        spellcheck="false"
                    >
                    ${this.state.historySearchTerm
        ? `
                        <button onclick="app.setState({ historySearchTerm: '' });"
                                class="bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded text-xs font-semibold transition-colors">
                            ✕
                        </button>
                    `
        : ""
      }
                </div>
                <div class="text-xs text-gray-400 mt-1">Пошук працює по опису, даті, пробігу, коду запчастини та статусу</div>
            </div>

            ${displayHistory.length === 0 ? this.generateNoHistoryHTML() : this.generateHistoryListHTML(displayHistory)}
        `;
  }

  generateNoHistoryHTML() {
    const hasFilters =
      this.state.selectedHistoryPartFilter || this.state.historySearchTerm;

    return `
            <div class="text-center py-8 text-gray-500">
                <div class="text-3xl mb-2">🔍</div>
                <div class="text-base font-semibold">Записів не знайдено</div>
                <div class="text-xs text-gray-400 mt-1">
                    ${hasFilters ? "Спробуйте змінити параметри пошуку або очистити фільтри" : "Цей автомобіль ще не має записів в історії"}
                </div>
                ${hasFilters
        ? `
                    <button onclick="app.setState({ selectedHistoryPartFilter: null, historySearchTerm: '' });"
                            class="mt-3 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded transition-colors text-xs">
                        Очистити всі фільтри
                    </button>
                `
        : ""
      }
            </div>
        `;
  }

  generateHistoryListHTML(history) {
    return `
            <div class="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                ${history.map((record) => this.generateHistoryRecordHTML(record)).join("")}
            </div>
        `;
  }

  generateHistoryRecordHTML(record) {
    const formattedDate = this.formatDate(record.date);
    const formattedMileage = this.formatMileage(record.mileage);
    const formattedQuantity =
      record.quantity && record.quantity > 0
        ? this.formatNumber(record.quantity)
        : "";
    const formattedPrice =
      record.price && record.price > 0
        ? this.formatPrice(record.price) + " ₴"
        : "";
    const formattedTotal =
      record.totalWithVAT && record.totalWithVAT > 0
        ? this.formatPrice(record.totalWithVAT) + " ₴"
        : "";

    let description = record.description;

    let statusClass = "bg-gray-100 text-gray-600";
    let statusIcon = "🔄";
    if (record.status) {
      const statusLower = record.status.toLowerCase();
      if (
        statusLower.includes("виконано") ||
        statusLower.includes("готово") ||
        statusLower.includes("підтверджено")
      ) {
        statusClass = "bg-green-100 text-green-700";
        statusIcon = "✅";
      } else if (
        statusLower.includes("очікує") ||
        statusLower.includes("в обробці") ||
        statusLower.includes("замовлено")
      ) {
        statusClass = "bg-blue-100 text-blue-700";
        statusIcon = "⏳";
      } else if (
        statusLower.includes("відмов") ||
        statusLower.includes("скасовано") ||
        statusLower.includes("недоступно")
      ) {
        statusClass = "bg-red-100 text-red-700";
        statusIcon = "❌";
      }
    }

    const unitDisplay = record.unit
      ? record.unit
      : record.quantity > 0
        ? "шт."
        : "";

    return `
            <div class="bg-gray-50 hover:bg-gray-100 rounded-lg p-3 sm:p-4 border border-gray-200 transition-all hover:shadow-sm">
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2">
                        <span class="text-base">📅</span>
                        <span class="font-bold text-gray-800 text-sm">${formattedDate}</span>
                    </div>
                    <div class="flex items-center gap-2 bg-orange-50 px-2 sm:px-3 py-1 rounded-full">
                        <span class="text-sm">🛣️</span>
                        <span class="font-bold text-orange-700 text-sm">${formattedMileage}</span>
                    </div>
                </div>

                <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div class="text-gray-700 text-sm flex-1">
                        ${description}
                        ${record.partCode ||
        record.unit ||
        record.quantity > 0 ||
        record.price > 0 ||
        record.totalWithVAT > 0
        ? `
                            <div class="mt-2 flex flex-wrap gap-2 items-center">
                                ${record.partCode
          ? `
                                    <span class="inline-flex items-center gap-1 bg-gray-100 px-2 py-1 rounded text-xs">
                                        <span>🔩</span>
                                        <span class="font-medium">Код: ${record.partCode}</span>
                                    </span>
                                `
          : ""
        }
                                ${unitDisplay
          ? `
                                    <span class="inline-flex items-center gap-1 bg-gray-100 px-2 py-1 rounded text-xs">
                                        <span>📦</span>
                                        <span>Од.: ${unitDisplay}</span>
                                    </span>
                                `
          : ""
        }
                                ${formattedQuantity
          ? `
                                    <span class="inline-flex items-center gap-1 bg-blue-50 px-2 py-1 rounded text-xs">
                                        <span>🔢</span>
                                        <span>Кільк.: ${formattedQuantity}</span>
                                    </span>
                                `
          : ""
        }
                                ${formattedPrice
          ? `
                                    <span class="inline-flex items-center gap-1 bg-blue-100 px-2 py-1 rounded text-xs">
                                        <span>💰</span>
                                        <span class="font-semibold">Ціна: ${formattedPrice}</span>
                                    </span>
                                `
          : ""
        }
                                ${formattedTotal
          ? `
                                    <span class="inline-flex items-center gap-1 bg-green-100 px-2 py-1 rounded text-xs">
                                        <span>💵</span>
                                        <span class="font-bold">Сума: ${formattedTotal}</span>
                                    </span>
                                `
          : ""
        }
                            </div>
                        `
        : ""
      }
                    </div>

                    ${record.status
        ? `
                        <div class="${statusClass} px-2 sm:px-3 py-1 rounded text-xs font-medium whitespace-nowrap mt-2 sm:mt-0 self-start">
                            ${statusIcon} ${record.status}
                        </div>
                    `
        : ""
      }
                </div>
            </div>
        `;
  }

  // === ДОПОМІЖНІ МЕТОДИ ===
  // Використовуємо модуль StatsCalculator
  getCities(cars) {
    return StatsCalculator.getCities(cars);
  }

  calculateStats(cars) {
    return StatsCalculator.calculateStats(
      cars,
      (car) => this.calculateHealthScore(car),
      (score, car) => this.getHealthScoreLabel(score, car),
    );
  }

  matchesKeywords(description, keywords) {
    if (!description || !keywords || !Array.isArray(keywords)) {
      return false;
    }

    const lowerDesc = description.toLowerCase().trim();

    // Спочатку перевіряємо прості збіги
    for (const keyword of keywords) {
      if (!keyword || typeof keyword !== "string") continue;
      const lowerKeyword = keyword.toLowerCase().trim();
      if (lowerDesc.includes(lowerKeyword)) return true;
    }

    // Якщо є функція для створення гнучких патернів, використовуємо її
    if (typeof createFlexiblePatterns === "function") {
      for (const keyword of keywords) {
        if (!keyword || typeof keyword !== "string") continue;
        const words = keyword
          .toLowerCase()
          .trim()
          .split(/\s+/)
          .filter((w) => w.length > 0);
        if (words.length > 1) {
          const flexiblePatterns = createFlexiblePatterns(keyword);
          for (const pattern of flexiblePatterns) {
            if (pattern.test(lowerDesc)) return true;
          }
        }
      }
    }

    return false;
  }

  // === УПРАВЛІННЯ СТАНОМ ===
  setState(newState) {
    try {
      const oldState = { ...this.state };
      this.state = { ...this.state, ...newState };

      const needsRefilter =
        oldState.searchTerm !== this.state.searchTerm ||
        oldState.selectedCity !== this.state.selectedCity ||
        oldState.selectedStatus !== this.state.selectedStatus ||
        oldState.selectedHealthStatus !== this.state.selectedHealthStatus ||
        oldState.selectedModel !== this.state.selectedModel ||
        JSON.stringify(oldState.selectedPartFilter) !==
        JSON.stringify(this.state.selectedPartFilter);

      if (needsRefilter) {
        this.filteredCars = null;
      }

      // Якщо змінився selectedCar, переходимо в карточку
      if (oldState.selectedCar !== this.state.selectedCar) {
        if (this.state.selectedCar) {
          this.renderCarDetail();
        } else {
          this.render();
        }
      } else {
        this.render();
      }
    } catch (error) {
      console.error("Помилка в setState:", error, newState);
    }
  }

  clearPartFilter() {
    this.setState({ selectedPartFilter: null });
  }

  clearAllFilters() {
    this.setState({
      selectedPartFilter: null,
      selectedHealthStatus: null,
      selectedModel: null,
      selectedCity: "Всі міста",
    });
  }

  showPartFilterMenu(event, partName) {
    event.stopPropagation();

    const existingMenu = document.getElementById("partFilterMenu");
    if (existingMenu) existingMenu.remove();

    const menu = document.createElement("div");
    menu.id = "partFilterMenu";
    menu.className =
      "fixed bg-white shadow-2xl rounded-lg border border-blue-400 p-3 z-50 min-w-[180px]";

    const rect = event.target.getBoundingClientRect();
    menu.style.top = rect.bottom + 5 + "px";
    menu.style.left = rect.left + "px";
    menu.style.position = "fixed";

    menu.innerHTML = `
            <div class="text-sm font-bold text-gray-800 mb-2 pb-2 border-b">Фільтр: ${partName.split(" ")[0]}</div>
            <div class="space-y-1">
                <div class="px-3 py-2 hover:bg-blue-50 rounded cursor-pointer transition-colors text-sm flex items-center gap-2"
                     onclick="app.setState({ selectedPartFilter: { partName: '${partName}', status: 'all' } }); setTimeout(() => { document.getElementById('partFilterMenu')?.remove(); }, 100);">
                    📋 <span>Всі записи</span>
                </div>
                <div class="px-3 py-2 hover:bg-green-50 rounded cursor-pointer transition-colors text-sm flex items-center gap-2"
                     onclick="app.setState({ selectedPartFilter: { partName: '${partName}', status: 'good' } }); setTimeout(() => { document.getElementById('partFilterMenu')?.remove(); }, 100);">
                    ✅ <span>У нормі</span>
                </div>
                <div class="px-3 py-2 hover:bg-orange-50 rounded cursor-pointer transition-colors text-sm flex items-center gap-2"
                     onclick="app.setState({ selectedPartFilter: { partName: '${partName}', status: 'warning' } }); setTimeout(() => { document.getElementById('partFilterMenu')?.remove(); }, 100);">
                    ⚠️ <span>Увага</span>
                </div>
                <div class="px-3 py-2 hover:bg-red-50 rounded cursor-pointer transition-colors text-sm flex items-center gap-2"
                     onclick="app.setState({ selectedPartFilter: { partName: '${partName}', status: 'critical' } }); setTimeout(() => { document.getElementById('partFilterMenu')?.remove(); }, 100);">
                    ⛔ <span>Критично</span>
                </div>
            </div>
        `;

    document.body.appendChild(menu);

    setTimeout(() => {
      const closeMenu = (e) => {
        if (menu && !menu.contains(e.target) && e.target !== event.target) {
          menu.remove();
          document.removeEventListener("click", closeMenu);
        }
      };
      document.addEventListener("click", closeMenu);
    }, 10);
  }

  showHealthStatusFilterMenu(event) {
    event.stopPropagation();

    const existingMenu = document.getElementById("healthStatusFilterMenu");
    if (existingMenu) existingMenu.remove();

    const menu = document.createElement("div");
    menu.id = "healthStatusFilterMenu";
    menu.className =
      "fixed bg-white shadow-2xl rounded-lg border border-blue-400 p-3 z-50 min-w-[180px]";

    const rect = event.target.getBoundingClientRect();
    menu.style.top = rect.bottom + 5 + "px";
    menu.style.left = rect.left + "px";
    menu.style.position = "fixed";

    const healthStatuses = [
      { value: null, label: "Всі стани", icon: "📋" },
      { value: "Відмінний", label: "Відмінний", icon: "🟢" },
      { value: "Добрий", label: "Добрий", icon: "🟡" },
      { value: "Задовільний", label: "Задовільний", icon: "🟠" },
      { value: "Критичний", label: "Критичний", icon: "🔴" },
    ];

    menu.innerHTML = `
            <div class="text-sm font-bold text-gray-800 mb-2 pb-2 border-b">Фільтр: Стан авто</div>
            <div class="space-y-1">
                ${healthStatuses
        .map(
          (status) => `
                    <div class="px-3 py-2 hover:bg-blue-50 rounded cursor-pointer transition-colors text-sm flex items-center gap-2 ${this.state.selectedHealthStatus === status.value ? "bg-blue-100" : ""}"
                         onclick="app.setState({ selectedHealthStatus: ${status.value === null ? "null" : `'${status.value}'`} }); setTimeout(() => { document.getElementById('healthStatusFilterMenu')?.remove(); }, 100);">
                        ${status.icon} <span>${status.label}</span>
                    </div>
                `,
        )
        .join("")}
            </div>
        `;

    document.body.appendChild(menu);

    setTimeout(() => {
      const closeMenu = (e) => {
        if (menu && !menu.contains(e.target) && e.target !== event.target) {
          menu.remove();
          document.removeEventListener("click", closeMenu);
        }
      };
      document.addEventListener("click", closeMenu);
    }, 10);
  }

  showModelFilterMenu(event) {
    event.stopPropagation();

    const existingMenu = document.getElementById("modelFilterMenu");
    if (existingMenu) existingMenu.remove();

    if (!this.processedCars) {
      this.processedCars = CarProcessor.processCarData();
    }

    // Отримуємо список унікальних марок
    const models = new Set();
    for (const car of this.processedCars) {
      if (car.model) {
        const brand = car.model.split(" ")[0];
        if (brand) models.add(brand);
      }
    }
    const sortedModels = Array.from(models).sort((a, b) =>
      a.localeCompare(b, "uk"),
    );

    const menu = document.createElement("div");
    menu.id = "modelFilterMenu";
    menu.className =
      "fixed bg-white shadow-2xl rounded-lg border border-blue-400 p-3 z-50 min-w-[180px] max-h-[400px] overflow-y-auto";

    const rect = event.target.getBoundingClientRect();
    menu.style.top = rect.bottom + 5 + "px";
    menu.style.left = rect.left + "px";
    menu.style.position = "fixed";

    menu.innerHTML = `
            <div class="text-sm font-bold text-gray-800 mb-2 pb-2 border-b">Фільтр: Марка</div>
            <div class="space-y-1">
                <div class="px-3 py-2 hover:bg-blue-50 rounded cursor-pointer transition-colors text-sm flex items-center gap-2 ${this.state.selectedModel === null ? "bg-blue-100" : ""}"
                     onclick="app.setState({ selectedModel: null }); setTimeout(() => { document.getElementById('modelFilterMenu')?.remove(); }, 100);">
                    📋 <span>Всі марки</span>
                </div>
                ${sortedModels
        .map(
          (model) => `
                    <div class="px-3 py-2 hover:bg-blue-50 rounded cursor-pointer transition-colors text-sm flex items-center gap-2 ${this.state.selectedModel === model ? "bg-blue-100" : ""}"
                         onclick="app.setState({ selectedModel: '${model}' }); setTimeout(() => { document.getElementById('modelFilterMenu')?.remove(); }, 100);">
                        🚗 <span>${model}</span>
                    </div>
                `,
        )
        .join("")}
            </div>
        `;

    document.body.appendChild(menu);

    setTimeout(() => {
      const closeMenu = (e) => {
        if (menu && !menu.contains(e.target) && e.target !== event.target) {
          menu.remove();
          document.removeEventListener("click", closeMenu);
        }
      };
      document.addEventListener("click", closeMenu);
    }, 10);
  }

  // === НОВІ ФУНКЦІЇ: ДІЇ ===
  shareReport(license) {
    const car = this.processedCars.find((c) => c.car === license);
    if (!car) return;

    const reportData = {
      license: car.license,
      model: car.model,
      year: car.year,
      city: car.city,
      currentMileage: this.formatMileage(car.currentMileage),
      healthScore: this.calculateHealthScore(car),
      criticalParts: Object.entries(car.parts)
        .filter(([_, part]) => part && part.status === "critical")
        .map(
          ([name, part]) =>
            `${name.split(" ")[0]} (${this.formatMileageDiff(part.mileageDiff)})`,
        ),
    };

    const reportText = `Звіт по авто ${car.license}:
Модель: ${car.model}
Рік: ${car.year}
Місто: ${car.city}
Пробіг: ${this.formatMileage(car.currentMileage)}
Стан авто: ${this.calculateHealthScore(car)}%
Критичні деталі: ${reportData.criticalParts.join(", ") || "немає"}
        
Звіт згенеровано ${new Date().toLocaleDateString("uk-UA")}`;

    if (navigator.share) {
      navigator.share({
        title: `Звіт по авто ${car.license}`,
        text: reportText,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(reportText).then(() => {
        this.showNotification("Звіт скопійовано в буфер обміну", "success");
      });
    }
  }

  downloadReport(license) {
    this.showNotification("Експорт PDF у розробці", "info");
  }

  setReminder(license) {
    const car = this.processedCars.find((c) => c.car === license);
    if (!car) return;

    const forecast = this.generateMaintenanceForecast(car);
    if (forecast.length > 0) {
      const nextMaintenance = forecast[0];
      const reminderText = `Нагадування для ${car.license}: ${nextMaintenance.part.split(" ")[0]} - ${nextMaintenance.when}`;

      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Нагадування про обслуговування", {
          body: reminderText,
          icon: "icon-192.png",
        });
      } else if (
        "Notification" in window &&
        Notification.permission !== "denied"
      ) {
        Notification.requestPermission().then((permission) => {
          if (permission === "granted") {
            new Notification("Нагадування про обслуговування", {
              body: reminderText,
              icon: "icon-192.png",
            });
          }
        });
      }

      localStorage.setItem(
        `reminder_${license}`,
        JSON.stringify({
          car: car.license,
          maintenance: nextMaintenance,
          date: new Date().toISOString(),
        }),
      );

      this.showNotification("Нагадування встановлено", "success");
    } else {
      this.showNotification("Немає запланованих обслуговувань", "info");
    }
  }

  searchParts() {
    this.showNotification("Пошук запчастин у розробці", "info");
  }

  // === ОНОВЛЕННЯ ТА ПОВІДОМЛЕННЯ ===
  async refreshData(force = false) {
    console.log("🔄 Оновлення даних...", force ? "(примусове)" : "");

    this.showNotification("Оновлення даних...", "info");

    try {
      // Завжди очищаємо кеш при оновленні, щоб завантажити нові дані
      // Це гарантує, що нові регламенти з Google Sheets будуть завантажені
      localStorage.removeItem("carAnalyticsData");
      console.log("🗑️ Кеш очищено");

      // Очищаємо оброблені дані, щоб вони переобробилися з новими регламентами
      this.processedCars = null;
      this.filteredCars = null;
      this.cachedData = null;
      this.maintenanceRegulations = []; // Очищаємо регламенти, щоб вони перезавантажилися

      // Спробуємо оновити через API з примусовим оновленням
      try {
        const API_BASE_URL = window.API_BASE_URL || "";
        const response = await fetch(`${API_BASE_URL}/api/data?refresh=true`);

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            this.appData = result.data;
            this.maintenanceRegulations = result.data.regulations || [];
            this.processedCars = result.processedCars || [];

            const cacheData = {
              ...result.data,
              processedCars: result.processedCars,
            };
            this.cacheData(cacheData);

            this.showNotification("Дані успішно оновлено", "success");
            this.render();
            return;
          }
        }
      } catch (apiError) {
        console.warn(
          "⚠️ Помилка оновлення через API, використовуємо fallback:",
          apiError,
        );
      }

      // Fallback на пряму обробку
      await this.fetchDataFromSheets();

      // Діагностичне логування тільки якщо DEBUG включений
      const DEBUG = CONFIG.DEBUG;
      if (DEBUG) {
        console.log(
          "📊 Після оновлення знайдено регламентів:",
          this.maintenanceRegulations.length,
        );
        if (this.maintenanceRegulations.length > 0) {
          // Перевіряємо регламенти для АА 4132 ХН
          const normalizeLicense = (licenseStr) => {
            if (!licenseStr) return "";
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
          const aa4132xhRegs = this.maintenanceRegulations.filter((r) => {
            if (
              !r.licensePattern ||
              r.licensePattern === "*" ||
              r.licensePattern === ".*"
            )
              return false;
            return normalizeLicense(r.licensePattern) === "AA4132XH";
          });
          if (aa4132xhRegs.length > 0) {
            console.log(
              `✅ Знайдено ${aa4132xhRegs.length} регламентів для АА 4132 ХН після оновлення:`,
              aa4132xhRegs.map((r) => ({
                partName: r.partName,
                priority: r.priority,
              })),
            );
          } else {
            console.warn(
              "⚠️ Регламенти для АА 4132 ХН не знайдені після оновлення!",
            );
          }
        }
      }

      this.render();

      this.showNotification("Дані успішно оновлено", "success");
      console.log(
        "✅ Дані оновлено, знайдено регламентів:",
        this.maintenanceRegulations.length,
      );
    } catch (error) {
      console.error("❌ Помилка оновлення:", error);
      this.showNotification(
        "Помилка оновлення даних: " + error.message,
        "error",
      );
    }
  }

  showNotification(message, type = "info") {
    const container = document.getElementById("modals-container");
    const id = "notification-" + Date.now();

    const colors = {
      info: "bg-blue-500",
      success: "bg-green-500",
      warning: "bg-orange-500",
      error: "bg-red-500",
    };

    const notification = document.createElement("div");
    notification.id = id;
    notification.className = `fixed top-4 right-4 ${colors[type]} text-white px-4 py-3 rounded-lg shadow-xl z-50 transform transition-transform duration-300 translate-x-full`;
    notification.innerHTML = `
            <div class="flex items-center gap-3">
                <span class="text-lg">${type === "success" ? "✅" : type === "error" ? "❌" : type === "warning" ? "⚠️" : "ℹ️"}</span>
                <span>${message}</span>
                <button onclick="document.getElementById('${id}').remove()" class="ml-4 text-white/80 hover:text-white">✕</button>
            </div>
        `;

    container.appendChild(notification);

    setTimeout(() => {
      notification.classList.remove("translate-x-full");
      notification.classList.add("translate-x-0");
    }, 10);

    setTimeout(() => {
      if (notification.parentNode) {
        notification.classList.remove("translate-x-0");
        notification.classList.add("translate-x-full");
        setTimeout(() => {
          if (notification.parentNode) {
            notification.remove();
          }
        }, 300);
      }
    }, 5000);
  }

  showError(message) {
    const container = document.getElementById("app");
    container.innerHTML = `
            <div class="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
                <div class="bg-red-500/10 border border-red-500/30 rounded-xl p-6 max-w-md backdrop-blur-sm">
                    <div class="text-center">
                        <div class="text-4xl text-red-400 mb-3">❌</div>
                        <h2 class="text-xl font-bold text-white mb-2">Помилка завантаження</h2>
                        <div class="text-red-200 text-sm mb-4">${message.substring(0, 200)}</div>
                        <div class="text-left text-xs text-blue-200 mb-4">
                            <p class="font-semibold">Можливі причини:</p>
                            <ul class="mt-1 space-y-1">
                                <li>• Неправильний API ключ</li>
                                <li>• Немає доступу до таблиці</li>
                                <li>• Проблеми з інтернетом</li>
                                <li>• Неправильні назви аркушів</li>
                            </ul>
                        </div>
                        <div class="flex gap-3">
                            <button onclick="location.reload()" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                                Оновити сторінку
                            </button>
                            <button onclick="app.refreshData(true)" class="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                                Спробувати знову
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
  }

  // === РЕЗЕРВНІ КАТЕГОРІЇ (якщо expense-categories.js не завантажений) ===
  getDefaultCategories() {
    return {
      "ТО та обслуговування": [],
      "Гальмівна система": [],
      "Ходова частина": [],
      Двигун: [],
      Електрика: [],
      Трансмісія: [],
      "Кузов та салон": [],
      "Система вихлопу": [],
      "Витратні матеріали": [],
      "Мийка авто": [],
      "Інші витрати": [],
    };
  }

  // === КОМПАКТНИЙ РЕЖИМ ШАПКИ ПРИ ПРОКРУТЦІ ===
  initCompactHeader() {
    const header = document.getElementById("vehicle-detail-header");
    const navigation = document.getElementById("vehicle-detail-navigation");
    const spacer = document.getElementById("vehicle-detail-header-spacer");
    const content = document.getElementById("vehicle-detail-content");

    if (!header || !navigation) return;

    // Очищаємо попередні обробники
    this.cleanupCompactHeader();

    // Функція для оновлення позиції навігації (під шапкою)
    const updateNavigationPosition = () => {
      if (!header || !navigation) return;

      // Отримуємо актуальну висоту шапки після всіх змін
      const headerRect = header.getBoundingClientRect();
      const headerHeight = headerRect.height;
      const gap = 0; // Відступ між шапкою та навігацією

      // Встановлюємо позицію навігації одразу під шапкою
      navigation.style.setProperty(
        "top",
        `${headerHeight + gap}px`,
        "important",
      );
      navigation.style.setProperty("position", "fixed", "important");
      navigation.style.setProperty("z-index", "40", "important");

      // Оновлюємо spacer для правильного розміщення контенту
      if (spacer) {
        const navigationHeight = navigation.offsetHeight;
        spacer.style.setProperty(
          "height",
          `${headerHeight + gap + navigationHeight}px`,
          "important",
        );
      }

      // Оновлюємо padding-top для контенту (spacer вже враховує висоту, тому додаємо тільки невеликий відступ)
      if (content) {
        // Spacer вже займає місце для шапки та навігації, тому додаємо тільки невеликий візуальний відступ
        content.style.setProperty("padding-top", "4px", "important");
      }
    };

    // Створюємо обробник прокрутки
    let isCompact = false;
    this.scrollHandler = () => {
      const scrollTop =
        window.pageYOffset || document.documentElement.scrollTop;
      const compactThreshold = 100; // Після 100px прокрутки активується компактний режим

      const shouldBeCompact = scrollTop > compactThreshold;

      // Додаємо/видаляємо клас тільки якщо стан змінився
      if (shouldBeCompact && !isCompact) {
        header.classList.add("vehicle-detail-header-compact");
        navigation.classList.add("vehicle-detail-navigation-compact");
        isCompact = true;
        // Оновлюємо позицію одразу після зміни розміру
        requestAnimationFrame(() => {
          updateNavigationPosition();
        });
      } else if (!shouldBeCompact && isCompact) {
        header.classList.remove("vehicle-detail-header-compact");
        navigation.classList.remove("vehicle-detail-navigation-compact");
        isCompact = false;
        // Оновлюємо позицію одразу після зміни розміру
        requestAnimationFrame(() => {
          updateNavigationPosition();
        });
      }

      // Оновлюємо позицію навігації при кожній прокрутці для надійності
      requestAnimationFrame(() => {
        updateNavigationPosition();
      });
    };

    // Обробник зміни розміру вікна
    this.resizeHandler = () => {
      updateNavigationPosition();
    };

    // Встановлюємо початкову позицію
    updateNavigationPosition();

    // Додаємо обробники
    window.addEventListener("scroll", this.scrollHandler, { passive: true });
    window.addEventListener("resize", this.resizeHandler, { passive: true });

    // Використовуємо ResizeObserver для моніторингу зміни розміру шапки
    if (window.ResizeObserver) {
      this.headerResizeObserver = new ResizeObserver(() => {
        updateNavigationPosition();
      });
      this.headerResizeObserver.observe(header);
    }

    // Перевіряємо початковий стан прокрутки
    this.scrollHandler();
  }

  // === ЗАКРІПЛЕННЯ ФІЛЬТРІВ ТА ЗАГОЛОВКА ТАБЛИЦІ НА ГОЛОВНІЙ СТОРІНЦІ ===
  initStickyFiltersAndTable() {
    const tableHeaderContainer = document.getElementById(
      "main-table-header-container",
    );
    const filtersContainer = document.getElementById("main-filters-container");
    const tableHeader = document.getElementById("cars-table-header");
    const tableHeaderSpacer = document.getElementById(
      "main-table-header-spacer",
    );
    const filtersSpacer = document.getElementById("main-filters-spacer");
    const tableContainer = document.getElementById("main-table-container");
    const pageHeader = document.getElementById("main-page-header");
    const statsCards = document.getElementById("main-stats-cards");

    if (!tableHeaderContainer || !filtersContainer || !tableHeader) return;

    // Зберігаємо початкову позицію фільтрів
    let filtersInitialTop = 0;
    let isFixed = false;
    let filtersInitialWidth = 0;
    let filtersInitialLeft = 0;
    let tableInitialWidth = 0;
    let tableInitialLeft = 0;

    // Функція для обчислення початкової позиції
    const calculateInitialPosition = () => {
      if (filtersContainer) {
        const filtersRect = filtersContainer.getBoundingClientRect();
        filtersInitialTop =
          filtersRect.top +
          (window.pageYOffset || document.documentElement.scrollTop);
        filtersInitialWidth = filtersRect.width;
        filtersInitialLeft = filtersRect.left;
      } else if (pageHeader) {
        const headerRect = pageHeader.getBoundingClientRect();
        const headerHeight = headerRect.height;
        const statsHeight = statsCards ? statsCards.offsetHeight : 0;
        filtersInitialTop = headerHeight + (statsHeight + 12); // 12px = margin-bottom
      }
    };

    // Функція для оновлення позицій
    const updatePositions = (shouldBeFixed) => {
      try {
        if (!tableHeaderContainer || !filtersContainer || !tableHeader) return;

        // Отримуємо висоти
        const headerHeight = tableHeaderContainer.offsetHeight;
        const filtersHeight = filtersContainer.offsetHeight;

        // Отримуємо таблицю та контейнер
        const table = document.getElementById("cars-table");
        const tableContainerWrapper = table
          ? table.closest(".overflow-x-auto")
          : null;

        if (shouldBeFixed && !isFixed) {
          // Зберігаємо поточні розміри перед fixed
          calculateInitialPosition();

          // Закріплюємо фільтри вгорі екрана
          filtersContainer.classList.add("fixed");
          filtersContainer.style.setProperty("top", "0", "important");
          filtersContainer.style.setProperty("left", "0", "important");
          filtersContainer.style.setProperty("right", "0", "important");
          filtersContainer.style.setProperty("width", "100%", "important");

          // Оновлюємо spacer для фільтрів
          if (filtersSpacer) {
            filtersSpacer.style.setProperty(
              "height",
              `${filtersHeight}px`,
              "important",
            );
          }

          // Закріплюємо шапку таблиці під фільтрами
          tableHeaderContainer.classList.add("fixed");
          tableHeaderContainer.style.setProperty(
            "top",
            `${filtersHeight}px`,
            "important",
          );

          // Синхронізуємо ширину шапки з тілом таблиці
          if (tableContainerWrapper) {
            const wrapperRect = tableContainerWrapper.getBoundingClientRect();
            const wrapperWidth = wrapperRect.width;
            const wrapperLeft = wrapperRect.left;

            tableHeaderContainer.style.setProperty(
              "left",
              `${wrapperLeft}px`,
              "important",
            );
            tableHeaderContainer.style.setProperty(
              "width",
              `${wrapperWidth}px`,
              "important",
            );
            tableHeaderContainer.style.setProperty(
              "min-width",
              `${wrapperWidth}px`,
              "important",
            );
            tableHeaderContainer.style.setProperty(
              "max-width",
              `${wrapperWidth}px`,
              "important",
            );
          } else {
            tableHeaderContainer.style.setProperty("left", "0", "important");
            tableHeaderContainer.style.setProperty("right", "0", "important");
            tableHeaderContainer.style.setProperty(
              "width",
              "100%",
              "important",
            );
          }

          // Оновлюємо spacer для шапки
          if (tableHeaderSpacer) {
            tableHeaderSpacer.style.setProperty(
              "height",
              `${headerHeight}px`,
              "important",
            );
          }

          isFixed = true;
        } else if (!shouldBeFixed && isFixed) {
          // Повертаємо до нормального стану
          filtersContainer.classList.remove("fixed");
          filtersContainer.style.removeProperty("top");
          filtersContainer.style.removeProperty("left");
          filtersContainer.style.removeProperty("right");
          filtersContainer.style.removeProperty("width");

          if (filtersSpacer) {
            filtersSpacer.style.setProperty("height", "0", "important");
          }

          tableHeaderContainer.classList.remove("fixed");
          tableHeaderContainer.style.removeProperty("top");
          tableHeaderContainer.style.removeProperty("left");
          tableHeaderContainer.style.removeProperty("right");
          tableHeaderContainer.style.removeProperty("width");

          if (tableHeaderSpacer) {
            tableHeaderSpacer.style.setProperty("height", "0", "important");
          }

          isFixed = false;
        }

        // Оновлюємо позицію, якщо вони fixed
        if (isFixed) {
          const currentFiltersHeight = filtersContainer.offsetHeight;
          const currentHeaderHeight = tableHeaderContainer.offsetHeight;

          // Оновлюємо позицію шапки під фільтрами
          tableHeaderContainer.style.setProperty(
            "top",
            `${currentFiltersHeight}px`,
            "important",
          );

          // Синхронізуємо ширину шапки з тілом таблиці
          if (tableContainerWrapper) {
            const wrapperRect = tableContainerWrapper.getBoundingClientRect();
            const wrapperWidth = wrapperRect.width;
            const wrapperLeft = wrapperRect.left;

            tableHeaderContainer.style.setProperty(
              "left",
              `${wrapperLeft}px`,
              "important",
            );
            tableHeaderContainer.style.setProperty(
              "width",
              `${wrapperWidth}px`,
              "important",
            );
            tableHeaderContainer.style.setProperty(
              "min-width",
              `${wrapperWidth}px`,
              "important",
            );
            tableHeaderContainer.style.setProperty(
              "max-width",
              `${wrapperWidth}px`,
              "important",
            );
          }

          // Оновлюємо spacers
          if (filtersSpacer) {
            filtersSpacer.style.setProperty(
              "height",
              `${currentFiltersHeight}px`,
              "important",
            );
          }
          if (tableHeaderSpacer) {
            tableHeaderSpacer.style.setProperty(
              "height",
              `${currentHeaderHeight}px`,
              "important",
            );
          }
        }
      } catch (error) {
        console.error("Помилка в updatePositions:", error);
      }
    };

    // Обчислюємо початкову позицію після невеликої затримки для завантаження DOM
    setTimeout(() => {
      calculateInitialPosition();
    }, 100);

    // Створюємо обробник прокрутки
    this.filtersScrollHandler = () => {
      try {
        const scrollTop =
          window.pageYOffset || document.documentElement.scrollTop;
        // Перевіряємо, чи потрібно закріпити шапку та фільтри
        // Закріплюємо, коли прокрутили більше, ніж початкова позиція шапки
        let headerInitialTop = filtersInitialTop;
        if (tableHeaderContainer && !isFixed) {
          const rect = tableHeaderContainer.getBoundingClientRect();
          headerInitialTop = rect.top + scrollTop;
        }
        const shouldBeFixed = scrollTop >= headerInitialTop;
        updatePositions(shouldBeFixed);
      } catch (error) {
        console.error("Помилка в обробнику прокрутки:", error);
      }
    };

    // Оновлюємо позиції при зміні розміру вікна
    const resizeHandler = () => {
      try {
        calculateInitialPosition();
        if (isFixed) {
          updatePositions(true);
        }
      } catch (error) {
        console.error("Помилка в обробнику зміни розміру:", error);
      }
    };

    window.addEventListener("scroll", this.filtersScrollHandler, {
      passive: true,
    });
    window.addEventListener("resize", resizeHandler, { passive: true });

    // Використовуємо ResizeObserver для моніторингу зміни розміру шапки та фільтрів
    if (window.ResizeObserver) {
      this.filtersResizeObserver = new ResizeObserver(() => {
        if (isFixed) {
          updatePositions(true);
        }
      });
      this.filtersResizeObserver.observe(tableHeaderContainer);
      this.filtersResizeObserver.observe(filtersContainer);
    }

    // Зберігаємо обробник для очищення
    this.stickyFiltersResizeHandler = resizeHandler;

    // Перевіряємо початковий стан
    this.filtersScrollHandler();
  }

  // Очищення обробників закріплення фільтрів
  cleanupStickyFilters() {
    if (this.filtersScrollHandler) {
      window.removeEventListener("scroll", this.filtersScrollHandler);
      this.filtersScrollHandler = null;
    }
    if (this.stickyFiltersResizeHandler) {
      window.removeEventListener("resize", this.stickyFiltersResizeHandler);
      this.stickyFiltersResizeHandler = null;
    }
    if (this.filtersResizeObserver) {
      this.filtersResizeObserver.disconnect();
      this.filtersResizeObserver = null;
    }
    // Скидаємо позиції та стилі
    const filtersContainer = document.getElementById("main-filters-container");
    const tableHeader = document.getElementById("cars-table-header");
    const filtersSpacer = document.getElementById("main-filters-spacer");
    const tableContainer = document.getElementById("main-table-container");
    if (filtersContainer) {
      filtersContainer.classList.remove("fixed");
      filtersContainer.style.removeProperty("top");
    }
    if (tableHeader) {
      tableHeader.classList.remove("fixed");
      tableHeader.style.removeProperty("top");
    }
    if (filtersSpacer) {
      filtersSpacer.style.removeProperty("height");
    }
    if (tableContainer) {
      tableContainer.style.removeProperty("padding-top");
    }
  }

  // Очищення обробників компактного режиму
  cleanupCompactHeader() {
    if (this.scrollHandler) {
      window.removeEventListener("scroll", this.scrollHandler);
      this.scrollHandler = null;
    }
    if (this.resizeHandler) {
      window.removeEventListener("resize", this.resizeHandler);
      this.resizeHandler = null;
    }
    if (this.headerResizeObserver) {
      this.headerResizeObserver.disconnect();
      this.headerResizeObserver = null;
    }
    // Скидаємо позиції та стилі
    const navigation = document.getElementById("vehicle-detail-navigation");
    const spacer = document.getElementById("vehicle-detail-header-spacer");
    const content = document.getElementById("vehicle-detail-content");
    if (navigation) {
      navigation.style.removeProperty("top");
    }
    if (spacer) {
      spacer.style.removeProperty("height");
    }
    if (content) {
      content.style.removeProperty("padding-top");
    }
  }
}

// Ініціалізація
window.app = null;
document.addEventListener("DOMContentLoaded", () => {
  window.app = new CarAnalyticsApp();
});
