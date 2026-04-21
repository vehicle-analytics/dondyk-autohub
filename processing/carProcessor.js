import { Formatters } from '../utils/formatters.js';
import { CONSTANTS, CONFIG } from '../config/appConfig.js';

export class CarProcessor {
  /**
   * Обробляє дані автомобілів
   */
  static processCarData(
    appData,
    getPartStatus = CarProcessor.getPartStatus,
    findRegulationForCar = CarProcessor.findRegulationForCar,
    maintenanceRegulations = [],
  ) {
    if (!appData) return [];

    const {
      records,
      carsInfo,
      currentMileages,
      partKeywords,
      compiledPartKeywords,
      partsOrder,
      currentDate,
      photoAssessmentStatuses,
    } = appData;
    const cars = {};

    for (const license in carsInfo) {
      const carInfo = carsInfo[license];
      cars[license] = {
        city: carInfo.city,
        car: license,
        license: license,
        model: carInfo.model,
        year: carInfo.year,
        vin: carInfo.vin,
        currentMileage: currentMileages[license] || 0,
        parts: {},
        history: [],
        photoAssessmentStatus:
          photoAssessmentStatuses && photoAssessmentStatuses[license]
            ? photoAssessmentStatuses[license]
            : null,
      };

      for (const partName of partsOrder) {
        cars[license].parts[partName] = null;
      }
    }

    for (const record of records) {
      const car = cars[record.car];
      if (!car) continue;

      // Перевірка статусу - записи з "відмова" додаються до історії для відображення,
      // але не враховуються при обробці частин
      const isRejected =
        record.status &&
        String(record.status).trim().toLowerCase() === "відмова";

      // Додаємо всі записи до історії (включно з "відмова") для відображення
      car.history.push(record);

      // Пропускаємо обробку частин для записів зі статусом "відмова"
      if (isRejected) {
        continue;
      }

      const descLower = (record.description || "").toLowerCase();

      for (const partName in (compiledPartKeywords || partKeywords)) {
        let matched = false;

        if (compiledPartKeywords) {
          const compiled = compiledPartKeywords[partName];
          // Check simple includes
          for (let i = 0; i < compiled.simple.length; i++) {
             if (descLower.includes(compiled.simple[i])) {
                matched = true;
                break;
             }
          }
          // Check complex includes
          if (!matched) {
             for (let i = 0; i < compiled.complex.length; i++) {
                const words = compiled.complex[i];
                let allWordsPresent = true;
                for (let j = 0; j < words.length; j++) {
                   if (!descLower.includes(words[j])) {
                      allWordsPresent = false;
                      break;
                   }
                }
                if (allWordsPresent) {
                   matched = true;
                   break;
                }
             }
          }
        } else {
          // Fallback to old behavior if old cache exists without compiled keywords
          const keywords = partKeywords[partName];
          for (const keyword of keywords) {
            if (descLower.includes(keyword.toLowerCase())) {
              matched = true;
              break;
            }
          }
          if (!matched) {
            for (const keyword of keywords) {
              const words = keyword.toLowerCase().trim().split(/\s+/).filter((w) => w.length > 0);
              if (words.length > 1 && words.every((word) => descLower.includes(word))) {
                matched = true;
                break;
              }
            }
          }
        }

        if (matched) {
          const existingPart = car.parts[partName];

          // Використовуємо Formatters для парсингу дат
          const parseDateFunc = Formatters.parseDate ||
            ((dateString) => {
              if (!dateString) return null;
              const date = new Date(dateString);
              return !isNaN(date.getTime()) ? date : null;
            });

          const recordDate = parseDateFunc(record.date);
          if (!recordDate) {
            continue;
          }

          // Визначаємо, чи потрібно оновити запчастину
          // Оновлюємо якщо: немає існуючої, або більший пробіг, або той самий пробіг але пізніша дата
          let shouldUpdate = false;
          if (!existingPart) {
            shouldUpdate = true;
          } else {
            const existingDate = parseDateFunc(existingPart.date);
            if (record.mileage > existingPart.mileage) {
              shouldUpdate = true;
            } else if (
              record.mileage === existingPart.mileage &&
              existingDate &&
              recordDate > existingDate
            ) {
              shouldUpdate = true;
            }
          }

          if (shouldUpdate) {
            const mileageDiff = car.currentMileage - record.mileage;

            // Завжди використовуємо поточну дату для розрахунку часу, що минув
            const currentDateObj = new Date();
            currentDateObj.setHours(0, 0, 0, 0);

            // Нормалізуємо recordDate до початку дня для точного розрахунку
            const normalizedRecordDate = new Date(recordDate);
            normalizedRecordDate.setHours(0, 0, 0, 0);

            const daysDiff = Math.floor(
              (currentDateObj - normalizedRecordDate) / (1000 * 60 * 60 * 24),
            );

            if (isNaN(daysDiff) || daysDiff < 0) {
              continue;
            }

            const carYear = parseInt(car.year) || 0;
            const carModel = car.model || "";

            // Точніший розрахунок років і місяців на основі реальних дат
            let years = 0;
            let months = 0;

            // Використовуємо нормалізовані дати для точного розрахунку
            const startDate = new Date(normalizedRecordDate);
            const endDate = new Date(currentDateObj);

            // Розраховуємо роки
            years = endDate.getFullYear() - startDate.getFullYear();
            let monthDiff = endDate.getMonth() - startDate.getMonth();

            // Корекція якщо місяць ще не настав
            if (monthDiff < 0) {
              years--;
              monthDiff += 12;
            }

            // Корекція якщо день ще не настав
            if (monthDiff === 0 && endDate.getDate() < startDate.getDate()) {
              years--;
              monthDiff = 11;
            } else if (endDate.getDate() < startDate.getDate()) {
              monthDiff--;
              if (monthDiff < 0) {
                monthDiff += 12;
                years--;
              }
            }

            months = monthDiff;

            // Якщо років більше 0, не показуємо місяці окремо (вони вже враховані)
            let timeDiff = "";

            if (years > 0) {
              timeDiff = years + "р";
              if (months > 0) {
                timeDiff += " " + months + "міс";
              }
            } else if (months > 0) {
              timeDiff = months + "міс";
            } else if (daysDiff >= 0) {
              timeDiff = daysDiff + "дн";
            } else {
              timeDiff = "0дн";
            }

            car.parts[partName] = {
              date: record.date,
              mileage: record.mileage,
              currentMileage: car.currentMileage,
              mileageDiff: mileageDiff,
              timeDiff: timeDiff,
              daysDiff: daysDiff,
              status: getPartStatus(
                partName,
                mileageDiff,
                daysDiff,
                carYear,
                carModel,
                car.license,
                maintenanceRegulations,
                findRegulationForCar,
              ),
            };
          }
        }
      }
    }

    const sortedCars = Object.values(cars);
    sortedCars.sort((a, b) => {
      const cityCompare = (a.city || "").localeCompare(b.city || "", "uk");
      return cityCompare !== 0
        ? cityCompare
        : (a.license || "").localeCompare(b.license || "", "uk");
    });

    for (const car of sortedCars) {
      car.history.sort((a, b) => {
        const parseDateFunc =
          (Formatters && Formatters.parseDate) ||
          ((dateString) => {
            if (!dateString) return null;
            const date = new Date(dateString);
            return !isNaN(date.getTime()) ? date : null;
          });
        const dateA = parseDateFunc(a.date) || new Date(0);
        const dateB = parseDateFunc(b.date) || new Date(0);
        return dateB - dateA;
      });
    }

    return sortedCars;
  }

  /**
   * Знаходить регламент для конкретного автомобіля
   */
  static findRegulationForCar(
    license,
    model,
    year,
    partName,
    maintenanceRegulations,
  ) {
    if (!maintenanceRegulations || maintenanceRegulations.length === 0) {
      return null;
    }

    const carYear = parseInt(year) || 0;

    const mappedPartName =
      (CONSTANTS.PARTS_MAPPING && CONSTANTS.PARTS_MAPPING[partName]) ||
      partName;

    // Функція для нормалізації номерів (кирилиця/латиниця)
    const normalizeLicense = (licenseStr) => {
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

    // Діагностичне логування (відключено для продуктивності)
    const normalizedLicense = normalizeLicense(license);
    const DEBUG = CONFIG && CONFIG.DEBUG;
    const isDebugCar =
      false &&
      DEBUG &&
      (normalizedLicense === "AI9573OO" || normalizedLicense === "AA4132XH");

    // Визначаємо normalizedMappedPartName поза циклом, щоб вона була доступна в усіх місцях
    // Видаляємо емодзі з назви для порівняння
    const removeEmoji = (str) => {
      if (!str) return "";
      // Видаляємо емодзі та зайві пробіли
      return str
        .replace(/[\u{1F300}-\u{1F9FF}]/gu, "")
        .replace(/\s+/g, " ")
        .trim();
    };

    const normalizedMappedPartName = removeEmoji(mappedPartName.trim());

    const matchingRegulations = [];

    for (const regulation of maintenanceRegulations) {
      // Використовуємо попередньо розраховану нормалізовану назву
      const regulationPartName = regulation.normalizedPartName || "";

      let partNameMatches = false;

      // Для ТО (масло+фільтри) перевіряємо різні варіанти назви
      if (
        normalizedMappedPartName.includes("ТО") &&
        (normalizedMappedPartName.includes("масло") ||
          normalizedMappedPartName.includes("фільтр"))
      ) {
        partNameMatches =
          (regulationPartName.includes("ТО") &&
            (regulationPartName.includes("масло") ||
              regulationPartName.includes("фільтр"))) ||
          regulationPartName === "ТО" ||
          regulationPartName === "ТО (масло+фільтри)";
      }
      // Для Комп'ютерної діагностики перевіряємо обидва варіанти назви
      else if (
        normalizedMappedPartName === "Компютерна діагностика" ||
        normalizedMappedPartName === "Комп'ютерна діагностика"
      ) {
        partNameMatches =
          regulationPartName === "Компютерна діагностика" ||
          regulationPartName === "Комп'ютерна діагностика";
      } else if (
        normalizedMappedPartName === "Обвідний ремінь" ||
        normalizedMappedPartName === "Обвідний ремінь+ролики"
      ) {
        // Для Обвідного реміння перевіряємо обидва варіанти назви
        partNameMatches =
          regulationPartName === "Обвідний ремінь" ||
          regulationPartName === "Обвідний ремінь+ролики";
      } else if (
        normalizedMappedPartName === "ГРМ (ролики+ремінь)" ||
        normalizedMappedPartName.includes("ГРМ")
      ) {
        // Для ГРМ перевіряємо точне співпадіння або часткове
        partNameMatches =
          regulationPartName === "ГРМ (ролики+ремінь)" ||
          regulationPartName.includes("ГРМ");
      } else if (
        normalizedMappedPartName === "Помпа" ||
        normalizedMappedPartName.includes("Помпа")
      ) {
        // Для Помпи перевіряємо точне співпадіння або часткове
        partNameMatches =
          regulationPartName === "Помпа" ||
          regulationPartName.includes("Помпа");
      } else if (
        normalizedMappedPartName === "Прожиг сажового фільтру" ||
        normalizedMappedPartName.includes("Прожиг сажового фільтру")
      ) {
        // Для Прожигу сажового фільтру перевіряємо з урахуванням емодзі
        partNameMatches =
          regulationPartName === "Прожиг сажового фільтру" ||
          regulationPartName.includes("Прожиг сажового фільтру");
      } else if (
        normalizedMappedPartName.includes("Профілактика") &&
        normalizedMappedPartName.includes("супорт")
      ) {
        // Для Профілактики направляючих супортів перевіряємо за ключовими словами
        partNameMatches =
          (regulationPartName.includes("Профілактика") &&
            regulationPartName.includes("супорт")) ||
          (regulationPartName.includes("профілактика") &&
            regulationPartName.includes("супорт"));
      } else {
        // Для інших деталей - точне порівняння
        partNameMatches = regulationPartName === normalizedMappedPartName;
      }

      if (!partNameMatches) {
        continue;
      }

      // Якщо licensePattern = "*", то регламент застосовується для всіх авто (не перевіряємо номер)
      if (
        regulation.licensePattern !== "*" &&
        regulation.licensePattern !== ".*"
      ) {
        // Порівнюємо номери з урахуванням кирилиці/латиниці - використовуємо попередньо розрахований
        const normalizedLicensePattern = regulation.normalizedLicensePattern || "";
        if (normalizedLicensePattern !== normalizedLicense) {
          continue;
        }
      }

      // Якщо brandPattern = "*", то регламент застосовується для всіх марок (не перевіряємо марку)
      if (regulation.brandPattern && regulation.brandPattern !== "*" && regulation.brandPattern !== ".*") {
        // Перевіряємо, чи є brandRegex методом (може бути втрачено при серіалізації в Worker)
        if (!regulation.brandRegex || typeof regulation.brandRegex.test !== 'function') {
          try {
            regulation.brandRegex = new RegExp(regulation.brandPattern, "i");
          } catch(e) {
            regulation.brandRegex = null;
          }
        }
        
        if (regulation.brandRegex && !regulation.brandRegex.test(model)) {
          continue;
        }
      }

      // Якщо modelPattern = "*", то регламент застосовується для всіх моделей (не перевіряємо модель)
      if (regulation.modelPattern && regulation.modelPattern !== "*" && regulation.modelPattern !== ".*") {
        // Перевіряємо, чи є modelRegex методом
        if (!regulation.modelRegex || typeof regulation.modelRegex.test !== 'function') {
          try {
            let pattern = regulation.modelPattern;
            if (pattern.startsWith(".")) pattern = pattern.replace(/^\./, "(?:^|\\s)");
            if (pattern.endsWith(".")) pattern = pattern.replace(/\.$/, "(?:\\s|$)");
            regulation.modelRegex = new RegExp(pattern, "i");
          } catch(e) {
            regulation.modelRegex = null;
          }
        }
        
        if (regulation.modelRegex && !regulation.modelRegex.test(model)) {
          continue;
        }
      }

      // Перевіряємо рік випуску авто
      if (carYear < regulation.yearFrom || carYear > regulation.yearTo) {
        continue;
      }

      matchingRegulations.push(regulation);
    }

    // Діагностичне логування для АІ 9573 ОО
    if (isDebugCar) {
      const isRelevantPart =
        normalizedMappedPartName === "ГРМ (ролики+ремінь)" ||
        normalizedMappedPartName === "Помпа" ||
        normalizedMappedPartName === "Обвідний ремінь+ролики" ||
        normalizedMappedPartName === "Обвідний ремінь";
      if (isRelevantPart) {
        console.log(
          `[DEBUG] Після фільтрації знайдено ${matchingRegulations.length} регламентів для ${normalizedMappedPartName}:`,
        );
        matchingRegulations.forEach((r, idx) => {
          console.log(`  Регламент ${idx + 1}:`, {
            licensePattern: r.licensePattern,
            brandPattern: r.brandPattern,
            modelPattern: r.modelPattern,
            yearFrom: r.yearFrom,
            yearTo: r.yearTo,
            regulationValue: r.regulationValue,
            normalValue: r.normalValue,
            priority: r.priority,
          });
        });
      }
    }

    if (matchingRegulations.length === 0) {
      return null;
    }

    // Сортуємо регламенти: спочатку за пріоритетом, потім за специфічністю
    // Індивідуальні регламенти (з конкретним номером) мають вищий пріоритет
    // Менший пріоритет = вищий пріоритет (1 < 2, тому 1 має вищий пріоритет)
    matchingRegulations.sort((a, b) => {
      // Спочатку перевіряємо пріоритет
      // Якщо пріоритет не вказано, вважаємо його 2 (загальний)
      const priorityA =
        a.priority !== undefined && a.priority !== null && a.priority !== ""
          ? Number(a.priority)
          : 2;
      const priorityB =
        b.priority !== undefined && b.priority !== null && b.priority !== ""
          ? Number(b.priority)
          : 2;

      if (priorityA !== priorityB) {
        // Менший пріоритет = вищий пріоритет (1 < 2, тому 1 має вищий пріоритет)
        const result = priorityA - priorityB;
        // Діагностичне логування для АІ 9573 ОО
        if (isDebugCar) {
          const isRelevantPart =
            normalizedMappedPartName === "ГРМ (ролики+ремінь)" ||
            normalizedMappedPartName === "Помпа" ||
            normalizedMappedPartName === "Обвідний ремінь+ролики" ||
            normalizedMappedPartName === "Обвідний ремінь";
          if (isRelevantPart) {
            console.log(
              `[DEBUG] Сортування за пріоритетом: A(priority=${priorityA}, license="${a.licensePattern}") vs B(priority=${priorityB}, license="${b.licensePattern}") => ${result > 0 ? "B вище" : result < 0 ? "A вище" : "однаково"}`,
            );
          }
        }
        return result;
      }

      // Якщо пріоритети однакові, перевіряємо специфічність
      // Регламент з конкретним номером має вищий пріоритет
      const aHasSpecificLicense =
        a.licensePattern !== "*" && a.licensePattern !== ".*";
      const bHasSpecificLicense =
        b.licensePattern !== "*" && b.licensePattern !== ".*";
      if (aHasSpecificLicense && !bHasSpecificLicense) return -1;
      if (!aHasSpecificLicense && bHasSpecificLicense) return 1;

      // Якщо обидва мають або не мають конкретного номера, перевіряємо марку/модель
      const aHasSpecificBrand =
        a.brandPattern !== "*" && a.brandPattern !== ".*";
      const bHasSpecificBrand =
        b.brandPattern !== "*" && b.brandPattern !== ".*";
      const aHasSpecificModel =
        a.modelPattern !== "*" && a.modelPattern !== ".*";
      const bHasSpecificModel =
        b.modelPattern !== "*" && b.modelPattern !== ".*";

      if (
        aHasSpecificBrand &&
        aHasSpecificModel &&
        !(bHasSpecificBrand && bHasSpecificModel)
      )
        return -1;
      if (
        !(aHasSpecificBrand && aHasSpecificModel) &&
        bHasSpecificBrand &&
        bHasSpecificModel
      )
        return 1;

      return 0;
    });

    // Детальне логування збігів регламентів відключено для прискорення роботи
    // if (window.CONFIG && window.CONFIG.DEBUG && matchingRegulations.length > 1) {
    //     console.log(`Знайдено ${matchingRegulations.length} регламентів для ${license} ${model} ${partName}:`,
    //         matchingRegulations.map(r => ({
    //             license: r.licensePattern,
    //             brand: r.brandPattern,
    //             model: r.modelPattern,
    //             priority: r.priority,
    //             normalValue: r.normalValue
    //         })));
    // }

    // Діагностичне логування тільки якщо DEBUG включений
    if (isDebugCar && matchingRegulations.length > 0) {
      const isRelevantPart =
        normalizedMappedPartName === "ГРМ (ролики+ремінь)" ||
        normalizedMappedPartName === "Помпа" ||
        normalizedMappedPartName === "Обвідний ремінь+ролики" ||
        normalizedMappedPartName === "Обвідний ремінь";
      if (isRelevantPart) {
        console.log(
          `[DEBUG] 📊 Після сортування регламенти для ${normalizedMappedPartName}:`,
        );
        matchingRegulations.forEach((r, idx) => {
          console.log(
            `  ${idx + 1}. priority=${r.priority}, license="${r.licensePattern}", regulationValue=${r.regulationValue}, normalValue=${r.normalValue}`,
          );
        });
        const selectedRegulation = matchingRegulations[0];
        console.log(
          `[DEBUG] ✅ Повертаємо регламент для ${normalizedMappedPartName}:`,
          {
            licensePattern: selectedRegulation.licensePattern,
            brandPattern: selectedRegulation.brandPattern,
            modelPattern: selectedRegulation.modelPattern,
            regulationValue: selectedRegulation.regulationValue,
            normalValue: selectedRegulation.normalValue,
            priority: selectedRegulation.priority,
            periodType: selectedRegulation.periodType,
          },
        );
      }
    }

    return matchingRegulations[0];
  }

  /**
   * Визначає статус запчастини
   */
  static getPartStatus(
    partName,
    mileageDiff,
    daysDiff,
    carYear,
    carModel,
    license,
    maintenanceRegulations,
    findRegulationForCar,
  ) {
    const monthsDiff = daysDiff / 30;
    const yearsDiff = daysDiff / 365;

    const regulation = findRegulationForCar(
      license,
      carModel,
      carYear,
      partName,
      maintenanceRegulations,
    );

    if (regulation) {
      if (regulation.normalValue === "chain") {
        return "good";
      }

      let currentValue;
      if (regulation.periodType === "місяць") {
        currentValue = monthsDiff;
      } else if (regulation.periodType === "рік") {
        currentValue = yearsDiff;
      } else {
        currentValue = mileageDiff;
      }

      if (regulation.criticalValue && currentValue >= regulation.criticalValue)
        return "critical";
      if (regulation.warningValue && currentValue >= regulation.warningValue)
        return "warning";
      if (
        regulation.normalValue !== undefined &&
        regulation.normalValue !== null
      )
        return "good";
    }

    return CarProcessor.getPartStatusLegacy(
      partName,
      mileageDiff,
      daysDiff,
      carYear,
      carModel,
    );
  }

  /**
   * Старий алгоритм визначення статусу (fallback)
   */
  static getPartStatusLegacy(
    partName,
    mileageDiff,
    daysDiff,
    carYear,
    carModel,
  ) {
    const monthsDiff = daysDiff / 30;
    const isMercedesSprinter =
      carModel &&
      carModel.toLowerCase().includes("mercedes") &&
      carModel.toLowerCase().includes("sprinter");

    if (isMercedesSprinter) {
      if (partName === "ГРМ (ролики+ремінь) ⚙️") {
        return "good";
      }
      if (partName === "Помпа 💧") {
        if (mileageDiff >= 120000) return "warning";
        return "good";
      }
    }

    switch (partName) {
      case "ТО (масло+фільтри) 🛢️":
        if (carYear && carYear >= 2010) {
          if (mileageDiff >= 15500) return "critical";
          if (mileageDiff >= 14000) return "warning";
          return "good";
        } else {
          if (mileageDiff >= 10500) return "critical";
          if (mileageDiff >= 9000) return "warning";
          return "good";
        }
      case "ГРМ (ролики+ремінь) ⚙️":
      case "Обвідний ремінь+ролики 🔧":
        if (mileageDiff >= 60500) return "critical";
        if (mileageDiff >= 58000) return "warning";
        return "good";
      case "Помпа 💧":
      case "Зчеплення ⚙️":
      case "Стартер 🔋":
      case "Генератор ⚡":
        if (mileageDiff >= 120000) return "critical";
        if (mileageDiff >= 80000) return "warning";
        return "good";
      case "Діагностика ходової 🔍":
        if (monthsDiff > 3) return "critical";
        if (monthsDiff >= 2) return "warning";
        return "good";
      case "Розвал-сходження 📐":
      case "Профілактика направляючих супортів 🛠️":
      case "Компютерна діагностика 💻":
      case "Прожиг сажового фільтру 🔥":
        if (monthsDiff > 4) return "critical";
        if (monthsDiff >= 2) return "warning";
        return "good";
      case "Гальмівні колодки 🛑":
        if (mileageDiff > 80000) return "critical";
        if (mileageDiff >= 60000) return "warning";
        return "good";
      case "Гальмівні диски 💿":
      case "Амортизатори 🔧":
        if (mileageDiff > 100000) return "critical";
        if (mileageDiff >= 70000) return "warning";
        return "good";
      case "Опора амортизаторів 🛠️":
      case "Шарова опора ⚪":
      case "Рульова тяга 🔗":
      case "Рульовий накінечник 🔩":
        if (mileageDiff > 60000) return "critical";
        if (mileageDiff >= 50000) return "warning";
        return "good";
      case "Акумулятор 🔋":
        const yearsDiff = daysDiff / 365;
        if (yearsDiff > 4) return "critical";
        if (yearsDiff >= 3) return "warning";
        return "good";
      default:
        if (mileageDiff > 50000) return "critical";
        if (mileageDiff > 30000) return "warning";
        return "good";
    }
  }
  /**
   * Перевіряє, чи є авто з ланцюговим приводом ГРМ
   */
  static isChainDriveGRM(model) {
    if (!model) return false;
    const modelLower = model.toLowerCase();
    const chainDriveModels = [
      "mercedes-benz sprinter",
      "iveco daily 65c15",
      "isuzu nqr 71r",
      "hyundai accent",
    ];
    return chainDriveModels.some((m) => modelLower.includes(m));
  }

  /**
   * Визначає, чи повинна запчастина відображатися для конкретного авто
   */
  static shouldShowPartForCar(car, partName) {
    if (!car) return false;
    
    const carYear = parseInt(car.year) || 0;
    const carModel = (car.model || "").toUpperCase();

    // 1. Прожиг сажового фільтру
    if (partName.includes("Прожиг сажового фільтру")) {
      const shouldHide = 
        carYear < 2010 ||
        carModel.includes("FIAT TIPO") ||
        carModel.includes("PEUGEOT 301") ||
        carModel.includes("HYUNDAI ACCENT");
      if (shouldHide) return false;
    }

    // 2. Свічки запалювання
    if (partName.includes("Свічки запалювання")) {
      const isGasolineModel = /PEUGEOT|HYUNDAI|FIAT/.test(carModel);
      if (!isGasolineModel) return false;
    }

    // 3. ГРМ (для ланцюгових авто ГРМ "незастосовується" у звітах)
    if (partName.includes("ГРМ")) {
      if (this.isChainDriveGRM(car.model)) return false;
    }

    return true;
  }
}
