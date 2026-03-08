import { CacheManager } from '../cache/cacheManager.js';
import { CarProcessor } from '../processing/carProcessor.js';

export class MaintenanceReports {
  constructor() {
    this.appData = null;
    this.processedCars = null;
    this.maintenanceRegulations = [];
    this.selectedPart = null;
    this.selectedStatus = "all";
    this.selectedCity = "Всі міста";
  }

  /**
   * Отримує normalValue для запчастини - та сама логіка що й у карточці авто (app.js)
   */
  getNormalValue(car, partName, regulation) {
    // Стандартні значення для запчастин з пробігом
    const defaultMileage = {
      "ТО (масло+фільтри) 🛢️": 15000,
      "ГРМ (ролики+ремінь) ⚙️": 60000,
      "Обвідний ремінь+ролики 🔧": 60000,
      "Помпа 💧": 60000,
      "Свічки запалювання 🔥": 30000,
    };

    // Стандартні значення для робіт з датами
    const defaultMonths = {
      "Діагностика ходової 🔍": 6,
      "Розвал-сходження 📐": 12,
      "Профілактика направляючих супортів 🛠️": 6,
      "Компютерна діагностика 💻": 6,
      "Комп'ютерна діагностика 💻": 6,
      "Прожиг сажового фільтру 🔥": 12,
    };

    // Запчастини з пробігом
    const mileageBasedParts = [
      "ТО (масло+фільтри) 🛢️",
      "ГРМ (ролики+ремінь) ⚙️",
      "Обвідний ремінь+ролики 🔧",
      "Помпа 💧",
      "Свічки запалювання 🔥",
    ];

    // Роботи з датами
    const dateBasedParts = [
      "Діагностика ходової 🔍",
      "Розвал-сходження 📐",
      "Профілактика направляючих супортів 🛠️",
      "Компютерна діагностика 💻",
      "Комп'ютерна діагностика 💻",
      "Прожиг сажового фільтру 🔥",
    ];

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

    if (mileageBasedParts.includes(partName)) {
      // Для запчастин з пробігом
      if (
        regulation &&
        regulation.normalValue !== "chain" &&
        regulation.periodType === "пробіг"
      ) {
        if (hasIndividualRegulation && regulation.regulationValue) {
          // Для індивідуальних регламентів використовуємо значення зі стовпця H (Регламент)
          normalValue = regulation.regulationValue;
        } else {
          // Для загальних регламентів використовуємо значення зі стовпця I (У нормі)
          normalValue = regulation.normalValue;
        }
      } else {
        // Стандартне значення якщо регламент не знайдено
        normalValue = defaultMileage[partName] || 15000;
      }

      // Для "Помпа" і "Обвідний ремінь+ролики": перевіряємо, чи є ланцюговий ГРМ
      if (
        (partName === "Помпа 💧" || partName === "Обвідний ремінь+ролики 🔧") &&
        !hasIndividualRegulation
      ) {
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

        if (!isChainDriveGRM) {
          // Знаходимо регламент ГРМ
          const grmRegulation = this.findRegulationForCarInReports(
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
            if (grmRegulation.normalValue !== normalValue) {
              normalValue = grmRegulation.normalValue;
            }
          }
        }
      }
    } else if (dateBasedParts.includes(partName)) {
      // Для робіт з датами
      const isComputerDiagnostics =
        partName === "Компютерна діагностика 💻" ||
        partName === "Комп'ютерна діагностика 💻";

      if (
        regulation &&
        regulation.normalValue !== "chain" &&
        regulation.normalValue !== null &&
        regulation.normalValue !== undefined
      ) {
        normalValue = regulation.normalValue;
      } else {
        normalValue = defaultMonths[partName] || 6;
      }

      if (
        isComputerDiagnostics &&
        regulation &&
        regulation.normalValue !== "chain" &&
        regulation.normalValue !== null &&
        regulation.normalValue !== undefined
      ) {
        normalValue = regulation.normalValue;
      }
    } else {
      // За замовчуванням
      normalValue = regulation?.normalValue || 15000;
    }

    return normalValue;
  }

  /**
   * Допоміжний метод для пошуку регламенту (використовується в getNormalValue)
   */
  findRegulationForCarInReports(license, model, year, partName) {
    if (
      !this.maintenanceRegulations ||
      this.maintenanceRegulations.length === 0
    ) {
      return null;
    }

    // Використовуємо CarProcessor якщо доступний
    if (CarProcessor) {
      return CarProcessor.findRegulationForCar(
        license,
        model,
        year,
        partName,
        this.maintenanceRegulations,
      );
    }

    return null;
  }

  /**
   * Ініціалізує дані
   */
  async init() {
    // Дані завантажуються в ReportsApp, тому тут просто ініціалізуємо порожні масиви
    // Якщо потрібно завантажити дані напряму (без ReportsApp), використовуємо loadData()
    await this.loadData();
  }

  /**
   * Завантажує дані з API або кешу
   */
  async loadData() {
    // Дані завантажуються в ReportsApp, тому тут просто перевіряємо кеш як fallback
    try {
      // Спочатку перевіряємо кеш
      if (CacheManager) {
        const cached = CacheManager.getCachedData();
        if (
          cached &&
          cached.carsInfo &&
          Object.keys(cached.carsInfo).length > 0
        ) {
          console.log("✅ MaintenanceReports: використано кешовані дані");
          this.appData = cached;
          this.processedCars = cached.processedCars || [];
          this.maintenanceRegulations = cached.regulations || [];
          return;
        }
      }
    } catch (error) {
      console.warn("⚠️ MaintenanceReports: помилка при перевірці кешу:", error);
    }
    // Якщо кешу немає, дані мають бути завантажені через ReportsApp
  }

  /**
   * Завантажує дані з API (не використовується — статичний деплой без backend)
   */
  async loadDataFromAPI() {
    // Статичний Vercel-деплой не має backend API, дані завантажуються в ReportsApp
    console.warn('[MaintenanceReports] loadDataFromAPI: статичний деплой, пропускаємо');
  }

  /**
   * Генерує звіт по вибраній запчастині
   */
  generateReport(
    partName,
    cars,
    maintenanceRegulations,
    findRegulationForCar,
    formatMileage,
    formatDate,
  ) {
    if (!partName || !cars || cars.length === 0) {
      console.warn("generateReport: немає даних", {
        partName,
        carsCount: cars?.length || 0,
      });
      return [];
    }

    if (!maintenanceRegulations || maintenanceRegulations.length === 0) {
      console.warn("generateReport: немає регламентів");
      return [];
    }

    const reportData = [];
    let skippedNoPart = 0;
    let skippedNoRegulation = 0;
    let skippedNoNormalValue = 0;

    // Діагностика для першого авто
    if (cars.length > 0 && cars[0].parts) {
      const firstCarParts = Object.keys(cars[0].parts);
      console.log("🔍 Діагностика generateReport:");
      console.log("  - Шукаємо запчастину:", partName);
      console.log(
        "  - Назви запчастин у першому авто (перші 10):",
        firstCarParts.slice(0, 10),
      );
    }

    for (const car of cars) {
      // Знаходимо запчастину для цього авто
      let part = null;
      let actualPartName = partName;

      if (!car.parts) {
        skippedNoPart++;
        continue;
      }

      // Функція для нормалізації назви
      const normalizePartName = (name) => {
        if (!name) return "";
        return name
          .replace(/[\u{1F300}-\u{1F9FF}]/gu, "")
          .replace(/\uFE0F/g, "")
          .replace(/[🛠️⚙️💧🔧🔍📐💻🔥💿🛑⚪🔗🔩🔋⚡]/g, "")
          .trim()
          .toLowerCase();
      };

      const partNameNormalized = normalizePartName(partName);

      // Спочатку перевіряємо точне співпадіння ключа
      if (car.parts.hasOwnProperty(partName)) {
        const foundPart = car.parts[partName];
        // Перевіряємо, чи значення не є null або undefined і є об'єктом
        if (
          foundPart !== null &&
          foundPart !== undefined &&
          typeof foundPart === "object"
        ) {
          part = foundPart;
          actualPartName = partName;
          if (cars[0] === car && skippedNoPart === 0) {
            console.log("✅ Знайдено запчастину (точне співпадіння):", {
              searched: partName,
              found: partName,
              partValue: "EXISTS",
            });
          }
        }
      }

      // Якщо не знайдено, шукаємо за нормалізованою назвою
      if (!part) {
        for (const key in car.parts) {
          if (!car.parts.hasOwnProperty(key)) continue;

          const foundPart = car.parts[key];
          // Пропускаємо null/undefined значення
          if (foundPart === null || foundPart === undefined) continue;
          if (typeof foundPart !== "object") continue;

          // Перевіряємо точне співпадіння ключа
          if (key === partName) {
            part = foundPart;
            actualPartName = key;
            if (cars[0] === car && skippedNoPart === 0) {
              console.log("✅ Знайдено запчастину (точне співпадіння ключа):", {
                searched: partName,
                found: key,
                partValue: "EXISTS",
              });
            }
            break;
          }

          // Перевіряємо за нормалізованою назвою
          const keyNormalized = normalizePartName(key);
          if (keyNormalized === partNameNormalized) {
            part = foundPart;
            actualPartName = key;
            if (cars[0] === car && skippedNoPart === 0) {
              console.log(
                "✅ Знайдено запчастину (нормалізоване співпадіння):",
                {
                  searched: partName,
                  found: key,
                  searchedNormalized: partNameNormalized,
                  foundNormalized: keyNormalized,
                  partValue: "EXISTS",
                },
              );
            }
            break;
          }

          // Додаткові перевірки для частин назви
          if (
            partNameNormalized.includes("то") &&
            keyNormalized.includes("то") &&
            partNameNormalized.includes("масло") &&
            keyNormalized.includes("масло")
          ) {
            part = foundPart;
            actualPartName = key;
            if (cars[0] === car && skippedNoPart === 0) {
              console.log(
                "✅ Знайдено запчастину (часткове співпадіння - ТО):",
                {
                  searched: partName,
                  found: key,
                },
              );
            }
            break;
          }
          if (
            partNameNormalized.includes("грм") &&
            keyNormalized.includes("грм")
          ) {
            part = foundPart;
            actualPartName = key;
            if (cars[0] === car && skippedNoPart === 0) {
              console.log(
                "✅ Знайдено запчастину (часткове співпадіння - ГРМ):",
                {
                  searched: partName,
                  found: key,
                },
              );
            }
            break;
          }
          if (
            partNameNormalized.includes("помпа") &&
            keyNormalized.includes("помпа")
          ) {
            part = foundPart;
            actualPartName = key;
            if (cars[0] === car && skippedNoPart === 0) {
              console.log(
                "✅ Знайдено запчастину (часткове співпадіння - Помпа):",
                {
                  searched: partName,
                  found: key,
                },
              );
            }
            break;
          }
          if (
            partNameNormalized.includes("профілактика") &&
            keyNormalized.includes("профілактика") &&
            partNameNormalized.includes("супорт") &&
            keyNormalized.includes("супорт")
          ) {
            part = foundPart;
            actualPartName = key;
            if (cars[0] === car && skippedNoPart === 0) {
              console.log(
                "✅ Знайдено запчастину (часткове співпадіння - Профілактика):",
                {
                  searched: partName,
                  found: key,
                },
              );
            }
            break;
          }
          if (
            partNameNormalized.includes("обвідний") &&
            keyNormalized.includes("обвідний") &&
            partNameNormalized.includes("ремінь") &&
            keyNormalized.includes("ремінь")
          ) {
            part = foundPart;
            actualPartName = key;
            if (cars[0] === car && skippedNoPart === 0) {
              console.log(
                "✅ Знайдено запчастину (часткове співпадіння - Обвідний ремінь):",
                {
                  searched: partName,
                  found: key,
                },
              );
            }
            break;
          }
        }
      }

      if (!part) {
        skippedNoPart++;
        if (skippedNoPart === 1 && cars[0] === car) {
          // Детальна діагностика для першого авто
          const availableParts = car.parts ? Object.keys(car.parts) : [];
          const partsWithValues = availableParts.filter((key) => {
            const val = car.parts[key];
            return val !== null && val !== undefined && typeof val === "object";
          });

          // Додаткова діагностика - перевіряємо перші кілька значень
          const sampleValues = availableParts.slice(0, 5).map((key) => {
            const val = car.parts[key];
            return {
              key: key,
              value: val,
              type: typeof val,
              isNull: val === null,
              isUndefined: val === undefined,
              isObject: typeof val === "object" && val !== null,
            };
          });

          console.warn("⚠️ Перше авто без запчастини:", {
            license: car.license,
            searchedPart: partName,
            searchedNormalized: partNameNormalized,
            availableParts: availableParts.slice(0, 10),
            partsWithValues: partsWithValues.slice(0, 10),
            totalParts: availableParts.length,
            partsWithValidValues: partsWithValues.length,
            sampleValues: sampleValues,
          });

          // Якщо всі значення null/undefined, це проблема з обробкою даних
          if (partsWithValues.length === 0 && availableParts.length > 0) {
            console.error(
              "❌ КРИТИЧНА ПОМИЛКА: Всі значення запчастин є null або undefined! Це означає проблему з обробкою даних.",
            );
            console.error(
              "Перевірте, чи правильно обробляються дані в CarProcessor.processCarData",
            );
          }
        }
        continue;
      }

      // actualPartName вже встановлено вище під час пошуку запчастини

      // Знаходимо регламент для цього авто та запчастини
      const regulation = findRegulationForCar(
        car.license,
        car.model,
        car.year,
        actualPartName,
        maintenanceRegulations,
      );

      if (!regulation) {
        skippedNoRegulation++;
        if (skippedNoRegulation === 1 && cars[0] === car) {
          console.warn("⚠️ Перше авто без регламенту:", {
            license: car.license,
            model: car.model,
            partName: actualPartName,
          });
        }
        continue;
      }

      // Визначаємо нормальне значення - використовуємо ту саму логіку що й у карточці авто
      const normalValue = this.getNormalValue(car, actualPartName, regulation);

      if (!normalValue || normalValue === "chain") {
        skippedNoNormalValue++;
        if (skippedNoNormalValue === 1 && cars[0] === car) {
          console.warn("⚠️ Перше авто без normalValue:", {
            license: car.license,
            partName: actualPartName,
            normalValue: regulation.normalValue,
            regulationValue: regulation.regulationValue,
          });
        }
        continue;
      }

      // Розраховуємо залишок
      let remaining = 0;
      let remainingText = "";
      let estimatedNextServiceDate = null;

      if (regulation.periodType === "пробіг") {
        // Для пробігу
        remaining = normalValue - (part.mileageDiff || 0);
        // Для червоних (негативних) значень показуємо мінус
        remainingText =
          remaining >= 0
            ? formatMileage(remaining)
            : `-${formatMileage(Math.abs(remaining))}`;

        // Визначаємо статус перед розрахунком дати
        const tempStatusInfo = this.getMaintenanceStatus(
          remaining,
          regulation,
          part,
          partName,
        );

        // Розраховуємо орієнтовну дату наступної заміни
        if (
          tempStatusInfo.status === "normal" ||
          tempStatusInfo.status === "warning"
        ) {
          // Для "Норма" та "Спланувати" розраховуємо на основі середньомісячного пробігу
          estimatedNextServiceDate = this.calculateNextServiceDateForMileage(
            car,
            part,
            remaining,
            normalValue,
          );
        } else if (tempStatusInfo.status === "urgent") {
          // Для "Негайно" (червоний) встановлюємо дату як сьогодні + 1 день
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          estimatedNextServiceDate = tomorrow;
        } else {
          estimatedNextServiceDate = null;
        }
      } else if (regulation.periodType === "місяць") {
        // Для місяців
        const monthsDiff = (part.daysDiff || 0) / 30;
        remaining = normalValue - monthsDiff;
        // Для червоних (негативних) значень показуємо мінус
        remainingText =
          remaining >= 0
            ? `${Math.round(remaining)} міс.`
            : `-${Math.round(Math.abs(remaining))} міс.`;

        // Визначаємо статус перед розрахунком дати
        const tempStatusInfo = this.getMaintenanceStatus(
          remaining,
          regulation,
          part,
          partName,
        );

        // Розраховуємо орієнтовну дату наступної заміни
        if (tempStatusInfo.status === "urgent") {
          // Для "Негайно" (червоний) встановлюємо дату як сьогодні + 1 день
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          estimatedNextServiceDate = tomorrow;
        } else {
          // Для інших статусів розраховуємо на основі залишку місяців
          const date = new Date();
          date.setMonth(date.getMonth() + Math.round(remaining));
          estimatedNextServiceDate = date;
        }
      } else if (regulation.periodType === "рік") {
        // Для років
        const yearsDiff = (part.daysDiff || 0) / 365;
        remaining = normalValue - yearsDiff;
        // Для червоних (негативних) значень показуємо мінус
        remainingText =
          remaining >= 0
            ? `${Math.round(remaining * 10) / 10} р.`
            : `-${Math.round(Math.abs(remaining) * 10) / 10} р.`;

        // Визначаємо статус перед розрахунком дати
        const tempStatusInfo = this.getMaintenanceStatus(
          remaining,
          regulation,
          part,
          partName,
        );

        // Розраховуємо орієнтовну дату наступної заміни
        if (tempStatusInfo.status === "urgent") {
          // Для "Негайно" (червоний) встановлюємо дату як сьогодні + 1 день
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          estimatedNextServiceDate = tomorrow;
        } else {
          // Для інших статусів розраховуємо на основі залишку років
          const date = new Date();
          date.setFullYear(
            date.getFullYear() + Math.round(remaining * 10) / 10,
          );
          estimatedNextServiceDate = date;
        }
      }

      // Визначаємо статус (для всіх типів вже визначено вище)
      const statusInfo = this.getMaintenanceStatus(
        remaining,
        regulation,
        part,
        partName,
      );

      // Форматуємо дату останнього обслуговування
      let lastServiceDate = "—";
      if (part.date) {
        try {
          let dateObj;
          if (typeof part.date === "string") {
            // Якщо дата в форматі з крапками, спробуємо розпарсити правильно
            const parts = String(part.date).split(".");
            if (parts.length === 3) {
              const first = parseInt(parts[0], 10);
              const second = parseInt(parts[1], 10);
              const third = parseInt(parts[2], 10);

              // Якщо перше число <= 12 і друге > 12, це MM.DD.YYYY (американський формат)
              // Інакше вважаємо DD.MM.YYYY (європейський формат)
              if (first <= 12 && second > 12) {
                // MM.DD.YYYY -> конвертуємо в Date об'єкт правильно
                dateObj = new Date(third, first - 1, second);
              } else {
                // DD.MM.YYYY -> конвертуємо в Date об'єкт правильно
                dateObj = new Date(third, second - 1, first);
              }
            } else {
              // Спробуємо стандартний парсинг
              dateObj = new Date(part.date);
            }
          } else {
            dateObj =
              part.date instanceof Date ? part.date : new Date(part.date);
          }

          if (!isNaN(dateObj.getTime())) {
            lastServiceDate = formatDate(dateObj);
          }
        } catch (e) {
          lastServiceDate = "—";
        }
      }
      // Форматуємо одометр на момент останнього обслуговування без "км" (як у прикладі)
      const lastServiceMileage = part.mileage ? part.mileage.toString() : "—";

      // Форматуємо орієнтовну дату
      let estimatedDateText = "—";
      if (estimatedNextServiceDate) {
        try {
          const dateObj = new Date(estimatedNextServiceDate);
          if (!isNaN(dateObj.getTime())) {
            // Якщо дата припадає на сьогодні, додаємо 1 день
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const serviceDate = new Date(dateObj);
            serviceDate.setHours(0, 0, 0, 0);

            if (serviceDate.getTime() === today.getTime()) {
              // Додаємо 1 день
              serviceDate.setDate(serviceDate.getDate() + 1);
            }

            estimatedDateText = formatDate(serviceDate);
          }
        } catch (e) {
          estimatedDateText = "—";
        }
      }

      reportData.push({
        city: car.city || "—",
        license: car.license || "—",
        model: car.model || "—",
        currentMileage: car.currentMileage || 0,
        lastServiceDate: lastServiceDate,
        lastServiceMileage: lastServiceMileage,
        remaining: remaining,
        remainingText: remainingText,
        estimatedNextServiceDate: estimatedNextServiceDate,
        estimatedNextServiceDateText: estimatedDateText,
        status: statusInfo.status,
        statusText: statusInfo.text,
        statusColor: statusInfo.color,
        part: part,
      });
    }

    // Сортуємо: спочатку негайно, потім попередження, потім норма
    reportData.sort((a, b) => {
      const statusOrder = { urgent: 0, warning: 1, normal: 2 };
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;

      // Якщо статус однаковий, сортуємо за залишеним (від меншого до більшого)
      return a.remaining - b.remaining;
    });

    if (reportData.length === 0) {
      console.warn("generateReport: звіт порожній", {
        partName,
        totalCars: cars.length,
        skippedNoPart,
        skippedNoRegulation,
        skippedNoNormalValue,
      });
    } else {
      console.log(
        "✅ generateReport: згенеровано",
        reportData.length,
        "записів",
      );
    }

    return reportData;
  }

  /**
   * Розраховує орієнтовну дату наступної заміни для пробігу на основі середньодобового пробігу
   */
  calculateNextServiceDateForMileage(car, part, remaining, normalValue) {
    if (!car || !part || remaining === undefined) {
      return null;
    }

    // Розраховуємо середній добовий пробіг
    let avgDailyMileage = 66.67; // За замовчуванням ~2000 км/місяць = ~66.67 км/день

    if (car.history && car.history.length >= 2) {
      // Фільтруємо записи зі статусом "відмова" (для додаткової безпеки)
      const filteredHistory = car.history.filter((r) => {
        const status = r.status ? String(r.status).trim().toLowerCase() : "";
        return status !== "відмова";
      });

      if (filteredHistory.length < 2) {
        // Якщо після фільтрації залишилося менше 2 записів, використовуємо значення за замовчуванням
        avgDailyMileage = 66.67;
      } else {
        // Сортуємо історію за датою
        const sortedHistory = [...filteredHistory].sort((a, b) => {
          const dateA = new Date(a.date || 0);
          const dateB = new Date(b.date || 0);
          return dateA - dateB;
        });

        // Беремо останні 6 місяців або всі записи, якщо менше
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const recentHistory = sortedHistory.filter((r) => {
          const recordDate = new Date(r.date || 0);
          return recordDate >= sixMonthsAgo;
        });

        if (recentHistory.length >= 2) {
          const firstRecord = recentHistory[0];
          const lastRecord = recentHistory[recentHistory.length - 1];

          const firstDate = new Date(firstRecord.date || 0);
          const lastDate = new Date(lastRecord.date || 0);
          const daysDiff = (lastDate - firstDate) / (1000 * 60 * 60 * 24);

          if (daysDiff > 0) {
            const mileageDiff =
              (lastRecord.mileage || 0) - (firstRecord.mileage || 0);
            avgDailyMileage = mileageDiff / daysDiff;
          }
        } else if (sortedHistory.length >= 2) {
          // Якщо немає достатньо даних за останні 6 місяців, використовуємо всі дані
          const firstRecord = sortedHistory[0];
          const lastRecord = sortedHistory[sortedHistory.length - 1];

          const firstDate = new Date(firstRecord.date || 0);
          const lastDate = new Date(lastRecord.date || 0);
          const daysDiff = (lastDate - firstDate) / (1000 * 60 * 60 * 24);

          if (daysDiff > 0) {
            const mileageDiff =
              (lastRecord.mileage || 0) - (firstRecord.mileage || 0);
            avgDailyMileage = mileageDiff / daysDiff;
          }
        }
      }
    } else if (car.year) {
      // Якщо немає історії, оцінюємо на основі віку авто та поточного пробігу
      const carYear = parseInt(car.year) || new Date().getFullYear() - 5;
      const carAge = new Date().getFullYear() - carYear;
      if (carAge > 0 && car.currentMileage) {
        const totalDays = carAge * 365;
        avgDailyMileage = car.currentMileage / totalDays;
      }
    }

    // Якщо середній пробіг дуже малий або великий, використовуємо значення за замовчуванням
    if (avgDailyMileage < 3 || avgDailyMileage > 500) {
      avgDailyMileage = 66.67; // ~2000 км/місяць
    }

    // Якщо залишок від'ємний (перевиконання), дата вже минула
    if (remaining < 0) {
      return new Date(); // Повертаємо сьогоднішню дату
    }

    // Розраховуємо дні до наступного обслуговування
    const daysToService = remaining / avgDailyMileage;

    // Розраховуємо дату
    const date = new Date();
    date.setDate(date.getDate() + Math.round(daysToService));

    return date;
  }

  /**
   * Визначає статус обслуговування
   */
  getMaintenanceStatus(remaining, regulation, part, partName) {
    // Запчастини, для яких поріг попередження = 1500 км (замість 2000 км)
    const earlyWarningParts = [
      "ТО (масло+фільтри) 🛢️",
      "ГРМ (ролики+ремінь) ⚙️",
      "Помпа 💧",
      "Обвідний ремінь+ролики 🔧",
      "Свічки запалювання 🔥",
    ];

    // Перевіряємо, чи це запчастина зі зменшеним порогом попередження
    // Перевіряємо за повним співпадінням або частковим (без емодзі та в нижньому регістрі)
    const normalizeForCompare = (name) => {
      if (!name) return "";
      return name
        .replace(/[🛢️⚙️💧🔧🔍📐💻🔥💿🛑⚪🔗🔩🔋⚡🛠️]/g, "")
        .trim()
        .toLowerCase();
    };

    const normalizedPartName = normalizeForCompare(partName);
    const isEarlyWarningPart =
      partName &&
      earlyWarningParts.some((p) => {
        const normalizedEarly = normalizeForCompare(p);
        return (
          partName.includes(p) ||
          p.includes(partName) ||
          normalizedPartName.includes(normalizedEarly) ||
          normalizedEarly.includes(normalizedPartName)
        );
      });

    // Якщо залишок від'ємний - перевиконання (негайно)
    if (remaining < 0) {
      return {
        status: "urgent",
        text: "🔴 НЕГАЙНО (ТЕРМІНОВО)",
        color: "red",
      };
    }

    // Визначаємо поріг попередження на основі регламенту
    let warningThreshold = 0;

    if (regulation.periodType === "пробіг") {
      // Для певних запчастин завжди використовуємо поріг 1500 км
      // Для інших - 2000 км або значення з регламенту
      if (isEarlyWarningPart) {
        warningThreshold = 1500;
      } else if (regulation.warningValue) {
        const remainingToWarning =
          regulation.warningValue - (part.mileageDiff || 0);
        warningThreshold = Math.min(2000, Math.max(0, remainingToWarning));
      } else {
        warningThreshold = 2000;
      }
    } else if (regulation.periodType === "місяць") {
      // Для місяців: попередження якщо залишилося <= 1 місяць
      if (regulation.warningValue) {
        const remainingToWarning =
          regulation.warningValue - (part.daysDiff || 0) / 30;
        warningThreshold = Math.min(1, Math.max(0, remainingToWarning));
      } else {
        warningThreshold = 1;
      }
    } else if (regulation.periodType === "рік") {
      // Для років: попередження якщо залишилося <= 0.2 року (2.4 місяці)
      if (regulation.warningValue) {
        const remainingToWarning =
          regulation.warningValue - (part.daysDiff || 0) / 365;
        warningThreshold = Math.min(0.2, Math.max(0, remainingToWarning));
      } else {
        warningThreshold = 0.2;
      }
    }

    // Якщо залишок <= порогу попередження - спланувати
    if (remaining <= warningThreshold) {
      return {
        status: "warning",
        text: "🟡 СПЛАНУВАТИ",
        color: "yellow",
      };
    }

    // Інакше - норма
    return {
      status: "normal",
      text: "НОРМА",
      color: "green",
    };
  }

  /**
   * Фільтрує звіт за статусом та містом
   */
  filterReport(reportData, statusFilter, cityFilter) {
    if (!reportData || reportData.length === 0) {
      return [];
    }

    return reportData.filter((item) => {
      // Фільтр за статусом
      if (
        statusFilter &&
        statusFilter !== "all" &&
        item.status !== statusFilter
      ) {
        return false;
      }

      // Фільтр за містом
      if (
        cityFilter &&
        cityFilter !== "Всі міста" &&
        item.city !== cityFilter
      ) {
        return false;
      }

      return true;
    });
  }

  /**
   * Експортує звіт у CSV
   */
  exportToCSV(reportData, partName) {
    if (!reportData || reportData.length === 0) {
      alert("Немає даних для експорту");
      return;
    }

    // Заголовки
    const headers = [
      "№",
      "Представництво",
      "Держ номер",
      "Модель",
      "Поточний одометр",
      "Останнє обслуговування",
      "Одометр",
      "Залишилося",
      "Орієнтовна дата обслуговування",
      "Статус",
    ];

    // Дані
    const rows = reportData.map((item, index) => [
      index + 1,
      item.city,
      item.license,
      item.model,
      item.currentMileage,
      item.lastServiceDate,
      item.lastServiceMileage,
      item.remainingText,
      item.estimatedNextServiceDateText || "—",
      item.statusText,
    ]);

    // Формуємо CSV
    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");

    // Додаємо BOM для правильного відображення кирилиці в Excel
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Звіт_${partName.replace(/[^a-zA-Zа-яА-Я0-9]/g, "_")}_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Експортує звіт у Excel у форматі .xlsx з кольоровим форматуванням
   */
  async exportToExcel(reportData, partName) {
    if (!reportData || reportData.length === 0) {
      alert("Немає даних для експорту");
      return;
    }

    // Перевіряємо, чи доступна бібліотека ExcelJS
    if (typeof ExcelJS === "undefined") {
      console.error(
        "Бібліотека ExcelJS не завантажена. Використовуємо CSV як резервний варіант.",
      );
      this.exportToCSV(reportData, partName);
      return;
    }

    // Створюємо новий workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Звіт");

    // Заголовки
    const headers = [
      "№",
      "Представництво",
      "Держ номер",
      "Модель",
      "Поточний одометр",
      "Останнє обслуговування",
      "Одометр",
      "Залишилося",
      "Орієнтовна дата обслуговування",
      "Статус",
    ];

    // Додаємо заголовки
    const headerRow = worksheet.addRow(headers);

    // Стилізація заголовків
    headerRow.font = { bold: true, color: { argb: "FF000000" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };
    headerRow.border = {
      top: { style: "thin", color: { argb: "FF000000" } },
      bottom: { style: "thin", color: { argb: "FF000000" } },
      left: { style: "thin", color: { argb: "FF000000" } },
      right: { style: "thin", color: { argb: "FF000000" } },
    };

    // Кольори для статусів (ARGB формат)
    const statusColors = {
      urgent: { bg: "FFFFE6E6", fg: "FFCC0000" }, // Червоний
      warning: { bg: "FFFFF9E6", fg: "FFCC6600" }, // Жовтий
      normal: { bg: "FFE6F7E6", fg: "FF006600" }, // Зелений
    };

    // Додаємо дані
    reportData.forEach((item, index) => {
      const row = worksheet.addRow([
        index + 1,
        item.city || "",
        item.license || "",
        item.model || "",
        item.currentMileage || "",
        item.lastServiceDate || "",
        item.lastServiceMileage || "",
        item.remainingText || "",
        item.estimatedNextServiceDateText || "—",
        item.statusText || "",
      ]);

      // Застосовуємо кольори згідно зі статусом
      const statusColor = statusColors[item.status];
      if (statusColor) {
        row.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: statusColor.bg },
          };
          cell.font = { color: { argb: statusColor.fg } };
          cell.alignment = { horizontal: "center", vertical: "middle" };
          cell.border = {
            top: { style: "thin", color: { argb: "FFCCCCCC" } },
            bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
            left: { style: "thin", color: { argb: "FFCCCCCC" } },
            right: { style: "thin", color: { argb: "FFCCCCCC" } },
          };
        });
      }
    });

    // Налаштування ширини стовпців
    worksheet.columns = [
      { width: 5 }, // №
      { width: 20 }, // Представництво
      { width: 15 }, // Держ номер
      { width: 25 }, // Модель
      { width: 18 }, // Поточний одометр
      { width: 20 }, // Останнє обслуговування
      { width: 15 }, // Одометр
      { width: 15 }, // Залишилося
      { width: 25 }, // Орієнтовна дата обслуговування
      { width: 20 }, // Статус
    ];

    // Генеруємо ім'я файлу
    const fileName = `Звіт_${partName.replace(/[^a-zA-Zа-яА-Я0-9]/g, "_")}_${new Date().toISOString().split("T")[0]}.xlsx`;

    // Експортуємо файл
    try {
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Помилка експорту:", error);
      alert("Помилка при експорті файлу. Спробуйте використати CSV.");
      this.exportToCSV(reportData, partName);
    }
  }

  /**
   * Друкує звіт
   */
  printReport(reportData, partName) {
    if (!reportData || reportData.length === 0) {
      alert("Немає даних для друку");
      return;
    }

    // Створюємо HTML для друку
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="uk">
            <head>
                <meta charset="UTF-8">
                <title>Звіт: ${partName}</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        font-size: 12px;
                        padding: 20px;
                    }
                    h1 {
                        text-align: center;
                        margin-bottom: 20px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 20px;
                    }
                    th, td {
                        border: 1px solid #ddd;
                        padding: 8px;
                        text-align: left;
                    }
                    th {
                        background-color: #f2f2f2;
                        font-weight: bold;
                    }
                    .urgent { background-color: #fee; color: #c00; }
                    .warning { background-color: #ffe; color: #c60; }
                    .normal { background-color: #efe; color: #060; }
                    @media print {
                        body { padding: 0; }
                    }
                </style>
            </head>
            <body>
                <h1>${partName}</h1>
                <table>
                    <thead>
                        <tr>
                            <th>№</th>
                            <th>Представництво</th>
                            <th>Держ номер</th>
                            <th>Модель</th>
                            <th>Поточний одометр</th>
                            <th>Останнє обслуговування</th>
                            <th>Одометр</th>
                            <th>Залишилося</th>
                            <th>Орієнтовна дата обслуговування</th>
                            <th>Статус</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${reportData
        .map(
          (item, index) => `
                            <tr class="${item.status}">
                                <td>${index + 1}</td>
                                <td>${item.city}</td>
                                <td>${item.license}</td>
                                <td>${item.model}</td>
                                <td>${item.currentMileage}</td>
                                <td>${item.lastServiceDate}</td>
                                <td>${item.lastServiceMileage}</td>
                                <td>${item.remainingText}</td>
                                <td>${item.estimatedNextServiceDateText || "—"}</td>
                                <td>${item.statusText}</td>
                            </tr>
                        `,
        )
        .join("")}
                    </tbody>
                </table>
            </body>
            </html>
        `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }
}


