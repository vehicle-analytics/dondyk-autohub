/**
 * ⏰ Модуль прогнозу наступного обслуговування
 * Розраховує приблизні терміни заміни запчастин
 */

export class MaintenanceForecast {
  constructor() {
    this.excludedParts = [
      "Комплексна діагностика 🔍",
      "Діагностика ходової 🔍",
      "Розвал-сходження 📐",
      "Профілактика направляючих супортів 🛠️",
      "Прожиг сажового фільтру 🔥",
    ];

    this.workParts = [
      "Діагностика ходової 🔍",
      "Розвал-сходження 📐",
      "Профілактика направляючих супортів 🛠️",
    ];
  }

  getRecommendedManufacturers(partName) {
    const recommendations = {
      "ТО (масло+фільтри) 🛢️": "Motul, Liqui Moly, Shell",
      "ГРМ (ролики+ремінь) ⚙️": "Gates, Contitech, INA",
      "Помпа 💧": "SKF, HEPU, Airtex",
      "Обвідний ремінь+ролики 🔧": "Gates, Dayco, INA",
      "Гальмівні диски передні💿": "TRW, Brembo, Zimmermann",
      "Гальмівні диски задні💿": "TRW, Brembo, Zimmermann",
      "Гальмівні колодки передні🛑": "ATE, Ferodo, TRW",
      "Гальмівні колодки задні🛑": "ATE, Ferodo, TRW",
      "Акумулятор 🔋": "Bosch, Varta, Exide",
      "Свічки запалювання 🔥": "NGK, Bosch, Denso",
    };

    for (const key in recommendations) {
      if (partName.includes(key.split(" ")[0])) {
        return recommendations[key];
      }
    }
    return "Оригінал або Bosch, Lemforder, TRW";
  }

  getWarningForPart(partName) {
    if (partName.includes("ГРМ"))
      return "⚠️ Обрив ременя ГРМ призводить до капітального ремонту двигуна!";
    if (partName.includes("масло") || partName.includes("ТО"))
      return "⚠️ Несвоєчасна заміна масла скорочує ресурс двигуна та турбіни.";
    if (partName.includes("Гальмівн"))
      return "⚠️ Зношені гальма - це ваша безпека та безпека оточуючих.";
    return null;
  }

  isCarWithSparkPlugs(model) {
    if (!model) return false;
    const modelUpper = model.toUpperCase();
    return (
      modelUpper.includes("PEUGEOT") ||
      modelUpper.includes("HYUNDAI") ||
      modelUpper.includes("FIAT") ||
      modelUpper.includes("301") ||
      modelUpper.includes("ACCENT") ||
      modelUpper.includes("TIPO")
    );
  }

  /**
   * Розраховує прогноз наступного обслуговування для конкретного автомобіля
   * @param {Object} car - Об'єкт автомобіля
   * @param {Function} findRegulationForCar - Функція для пошуку регламенту
   * @param {Function} formatNumber - Функція для форматування чисел
   * @param {Object} partsForecast - Об'єкт модуля прогнозу закупівлі запчастин (опціонально)
   * @param {Array} maintenanceRegulations - Масив усіх регламентів (опціонально)
   * @returns {Array} Масив прогнозів
   */
  generateForecast(
    car,
    findRegulationForCar,
    formatNumber,
    partsForecast = null,
    maintenanceRegulations = [],
  ) {
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
    if (partsForecast) {
      try {
        useNewAlgorithm = true;
        const forecastData = partsForecast.calculateForecast(
          [car],
          maintenanceRegulations,
          findRegulationForCar,
          6,
        );

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
            const isBattery = need.partName === "Акумулятор 🔋";

            if (need.urgency === "critical") {
              urgency = "critical";
              // Для акумулятора не встановлюємо текст, а розраховуємо реальний прогноз
              if (isBattery) {
                // Розраховуємо реальний прогноз на основі регламенту
                if (need.regulation.periodType === "пробіг") {
                  const remainingKm =
                    need.regulation.normalValue - (need.mileageDiff || 0);
                  const avgMonthlyMileage =
                    car.currentMileage /
                    ((new Date() -
                      new Date(
                        parseInt(car.year) || new Date().getFullYear() - 5,
                        0,
                        1,
                      )) /
                      (1000 * 60 * 60 * 24 * 30));
                  const monthsToService =
                    remainingKm / (avgMonthlyMileage || 2000);

                  if (remainingKm < 1000) {
                    when = "~1 тиждень";
                  } else if (remainingKm < 2000) {
                    when = "~2 тижні";
                  } else {
                    const months = Math.ceil(monthsToService);
                    if (months <= 1) when = "~1 місяць";
                    else if (months <= 2) when = "~2 місяці";
                    else if (months <= 3) when = "~3 місяці";
                    else when = `~${months} місяців`;
                  }
                } else if (need.regulation.periodType === "місяць") {
                  const remainingMonths =
                    need.regulation.normalValue -
                    Math.floor((need.daysDiff || 0) / 30);
                  const remainingDays =
                    need.regulation.normalValue * 30 - (need.daysDiff || 0);

                  if (remainingDays <= 14) {
                    when = remainingDays <= 7 ? "~1 тиждень" : "~2 тижні";
                  } else {
                    if (remainingMonths <= 2) when = "~1 місяць";
                    else when = `~${remainingMonths} місяці`;
                  }
                } else {
                  // Для акумулятора розраховуємо на основі пробігу або часу
                  if (isBattery) {
                    // Якщо є пробіг, розраховуємо на основі пробігу
                    if (
                      need.mileageDiff !== null &&
                      need.mileageDiff !== undefined
                    ) {
                      const avgMonthlyMileage =
                        car.currentMileage /
                        ((new Date() -
                          new Date(
                            parseInt(car.year) || new Date().getFullYear() - 5,
                            0,
                            1,
                          )) /
                          (1000 * 60 * 60 * 24 * 30));
                      const monthsSinceReplacement =
                        need.mileageDiff / (avgMonthlyMileage || 2000);
                      const months = Math.ceil(monthsSinceReplacement);
                      if (months <= 1) when = "~1 місяць";
                      else if (months <= 2) when = "~2 місяці";
                      else if (months <= 3) when = "~3 місяці";
                      else when = `~${months} місяців`;
                    } else if (
                      need.daysDiff !== null &&
                      need.daysDiff !== undefined
                    ) {
                      const monthsSinceReplacement = Math.floor(
                        need.daysDiff / 30,
                      );
                      if (monthsSinceReplacement <= 2) when = "~1 місяць";
                      else when = `~${monthsSinceReplacement} місяці`;
                    } else {
                      when = "~1 місяць";
                    }
                  } else {
                    when = "Згідно розрахунків";
                  }
                }
              } else {
                when =
                  "Це лише прогноз, але бажано звернути увагу найближчим часом";
              }
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
            const warning = this.getWarningForPart(need.partName);

            forecasts.push({
              part: need.partName,
              type: need.regulation.periodType === "пробіг" ? "пробіг" : "час",
              status: urgency,
              when: when,
              manufacturers: manufacturers,
              warning: warning,
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
      // Старий алгоритм (збережений для fallback)
      for (const partName in car.parts) {
        const part = car.parts[partName];
        if (!part) continue;

        // Пропускаємо "Прожиг сажового фільтру" якщо потрібно
        if (shouldHideSootBurn && partName === "Прожиг сажового фільтру 🔥") {
          continue;
        }

        if (this.excludedParts.includes(partName)) continue;

        const isWork = this.workParts.includes(partName);

        if (
          isWork &&
          (part.status === "critical" || part.status === "warning")
        ) {
          const manufacturers = this.getRecommendedManufacturers(partName);
          const warning = this.getWarningForPart(partName);
          forecasts.push({
            part: partName,
            type: "діагностика",
            status: part.status,
            when:
              part.status === "critical"
                ? "Терміново"
                : "Бажано найближчим часом",
            manufacturers: manufacturers,
            warning: warning,
          });
          continue;
        }

        const regulation = findRegulationForCar(
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

            // Якщо пробіг < 15000 км (приблизно 6 місяців при середньому пробігу 2500 км/міс)
            if (remainingKm < 15000) {
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
                    when: `через ${formatNumber(Math.max(0, remainingKm))} км`,
                  };
                }
              } else {
                nextMaintenance = {
                  part: partName,
                  type: "пробіг",
                  status: part.status,
                  when: `через ${formatNumber(Math.max(0, remainingKm))} км`,
                };
              }
            }
          } else if (regulation.periodType === "місяць") {
            const remainingMonths =
              regulation.normalValue - Math.floor(part.daysDiff / 30);
            isPast = remainingMonths < 0;

            if (remainingMonths < 6) {
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
                  // Для акумулятора розраховуємо реальний прогноз
                  const isBattery = partName === "Акумулятор 🔋";
                  let whenText = "Згідно розрахунків";

                  if (
                    isBattery &&
                    regulation &&
                    regulation.normalValue !== "chain"
                  ) {
                    const regVal =
                      regulation.regulationValue || regulation.normalValue;
                    const remainingMonths =
                      regVal - Math.floor(part.daysDiff / 30);
                    const remainingDays = regVal * 30 - part.daysDiff;

                    if (remainingDays <= 14) {
                      whenText = remainingDays <= 7 ? "~1 тиждень" : "~2 тижні";
                    } else {
                      if (remainingMonths <= 2) whenText = "~1 місяць";
                      else whenText = `~${remainingMonths} місяці`;
                    }
                  }

                  nextMaintenance = {
                    part: partName,
                    type: "час",
                    status: part.status,
                    when: whenText,
                  };
                }
              } else {
                // Для акумулятора розраховуємо реальний прогноз
                const isBattery = partName === "Акумулятор 🔋";
                let whenText = "Згідно розрахунків";

                if (
                  isBattery &&
                  regulation &&
                  regulation.normalValue !== "chain"
                ) {
                  const regVal =
                    regulation.regulationValue || regulation.normalValue;
                  const remainingMonths =
                    regVal - Math.floor(part.daysDiff / 30);
                  const remainingDays = regVal * 30 - part.daysDiff;

                  if (remainingDays <= 14) {
                    whenText = remainingDays <= 7 ? "~1 тиждень" : "~2 тижні";
                  } else {
                    if (remainingMonths <= 2) whenText = "~1 місяць";
                    else whenText = `~${remainingMonths} місяці`;
                  }
                }

                nextMaintenance = {
                  part: partName,
                  type: "час",
                  status: part.status,
                  when: whenText,
                };
              }
            }
          }

          if (nextMaintenance) {
            const manufacturers = this.getRecommendedManufacturers(partName);
            const warning = this.getWarningForPart(partName);
            nextMaintenance.manufacturers = manufacturers;
            nextMaintenance.warning = warning;
            forecasts.push(nextMaintenance);
          }
        }
      }
    }

    // Додаємо свічки запалювання для Peugeot/Hyundai/Fiat (тільки якщо їх ще немає в прогнозі)
    if (this.isCarWithSparkPlugs(car.model)) {
      // Перевіряємо, чи вже є свічки в прогнозі
      const hasSparkPlugsInForecast = forecasts.some(
        (f) => f.part === "Свічки запалювання 🔥",
      );

      if (!hasSparkPlugsInForecast) {
        const sparkPlugPart = car.parts["Свічки запалювання 🔥"];
        if (sparkPlugPart) {
          const regulation = findRegulationForCar(
            car.license,
            car.model,
            car.year,
            "Свічки запалювання 🔥",
          );
          if (regulation && regulation.normalValue !== "chain") {
            let nextMaintenance = null;

            if (regulation.periodType === "пробіг") {
              const remainingKm =
                regulation.normalValue - sparkPlugPart.mileageDiff;
              if (remainingKm < 10000) {
                nextMaintenance = {
                  part: "Свічки запалювання 🔥",
                  type: "пробіг",
                  status: sparkPlugPart.status,
                  when:
                    remainingKm < 0
                      ? "Це лише прогноз, але бажано звернути увагу найближчим часом"
                      : `через ${formatNumber(Math.max(0, remainingKm))} км`,
                  manufacturers: this.getRecommendedManufacturers(
                    "Свічки запалювання 🔥",
                  ),
                  warning: null,
                };
              }
            } else if (regulation.periodType === "місяць") {
              const remainingMonths =
                regulation.normalValue -
                Math.floor(sparkPlugPart.daysDiff / 30);
              if (remainingMonths < 6) {
                nextMaintenance = {
                  part: "Свічки запалювання 🔥",
                  type: "час",
                  status: sparkPlugPart.status,
                  when:
                    remainingMonths < 0
                      ? "Це лише прогноз, але бажано звернути увагу найближчим часом"
                      : "Згідно розрахунків",
                  manufacturers: this.getRecommendedManufacturers(
                    "Свічки запалювання 🔥",
                  ),
                  warning: null,
                };
              }
            }

            if (nextMaintenance) {
              forecasts.push(nextMaintenance);
            }
          }
        }
      }
    }

    // Видаляємо дублікати (залишаємо перший запис для кожної запчастини)
    const seenParts = new Set();
    const uniqueForecasts = forecasts.filter((forecast) => {
      if (seenParts.has(forecast.part)) {
        return false;
      }
      seenParts.add(forecast.part);
      return true;
    });
    forecasts.length = 0;
    forecasts.push(...uniqueForecasts);

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

  /**
   * Генерує HTML для відображення прогнозу
   * @param {Array} forecasts - Масив прогнозів
   * @param {Object} car - Об'єкт автомобіля
   * @param {Function} findRegulationForCar - Функція пошуку регламенту
   * @param {Function} formatMileage - Функція форматування пробігу
   * @param {Function} formatDate - Функція форматування дати
   * @returns {string} HTML код
   */
  generateForecastHTML(
    forecasts,
    car = null,
    findRegulationForCar = null,
    formatMileage = null,
    formatDate = null,
  ) {
    try {
      if (!forecasts || forecasts.length === 0) {
        return "";
      }

      // Функція для отримання іконки запчастини (витягуємо емодзі з назви)
      const getPartIcon = (partName) => {
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
            return emojiChar;
          }
        }

        // Fallback - спробуємо регулярний вираз
        const emojiMatch = partName.match(
          /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u,
        );
        if (emojiMatch) {
          return emojiMatch[0];
        }

        // Останній fallback за назвою
        if (partName.includes("ТО") || partName.includes("масло")) return "🛢️";
        if (partName.includes("Розвал")) return "📐";
        if (partName.includes("Профілактика") || partName.includes("супорт"))
          return "🔧";
        if (partName.includes("Комп") || partName.includes("діагностика"))
          return "💻";
        if (partName.includes("Свічки")) return "🕯️";
        if (partName.includes("Діагностика ходової")) return "🔍";
        if (partName.includes("Прожиг")) return "🔥";
        return "⚙️";
      };

      // Функція для отримання деталей прогнозу
      // Список запчастин, які завжди мають середній статус та потребують діагностики
      const partsRequiringDiagnostics = [
        "Гальмівні диски передні💿",
        "Гальмівні диски задні💿",
        "Гальмівні колодки передні🛑",
        "Гальмівні колодки задні🛑",
        "Гальмівні колодки ручного гальма🛑",
        "Амортизатори передні🔧",
        "Амортизатори задні🔧",
        "Опора амортизаторів 🛠️",
        "Шарова опора ⚪",
        "Рульова тяга 🔗",
        "Рульовий накінечник 🔩",
        "Зчеплення ⚙️",
        "Стартер 🔋",
        "Генератор ⚡",
        "Акумулятор 🔋",
      ];

      const getForecastDetails = (forecast) => {
        if (!car || !findRegulationForCar || !formatMileage || !formatDate) {
          return {
            lastDate: null,
            lastMileage: null,
            remaining: null,
            forecast: forecast.when,
            progress: 0,
            regulation: null,
            requiresDiagnostics: partsRequiringDiagnostics.includes(
              forecast.part,
            ),
          };
        }

        const part = car.parts[forecast.part];
        if (!part) {
          return {
            lastDate: null,
            lastMileage: null,
            remaining: null,
            forecast: forecast.when,
            progress: 0,
            regulation: null,
            requiresDiagnostics: partsRequiringDiagnostics.includes(
              forecast.part,
            ),
          };
        }

        const regulation = findRegulationForCar
          ? findRegulationForCar(
            car.license,
            car.model,
            car.year,
            forecast.part,
          )
          : null;
        const lastDate = part.date && formatDate ? formatDate(part.date) : null;
        const lastMileage =
          part.mileage && formatMileage ? formatMileage(part.mileage) : null;

        let remaining = null;
        let progress = 0;
        let forecastText = forecast.when;
        let nextMileageText = null;
        let overdueBy = null;
        let expectedDate = null;
        let isTimeBased = false;
        let calculatedStatus = forecast.status || "normal";
        let remainingKm = 0;
        let remainingMonths = 0;

        if (regulation && regulation.normalValue !== "chain") {
          const regVal = regulation.regulationValue || regulation.normalValue;

          if (regulation.periodType === "пробіг") {
            remainingKm = regVal - (part.mileageDiff || 0);

            if (remainingKm < 0) {
              remaining = `-${formatMileage(Math.abs(remainingKm))}`;
              overdueBy = `${formatMileage(Math.abs(remainingKm))}`;
              forecastText = "Прострочено";
              progress = 100;
              calculatedStatus = "critical";

              // Якщо прострочено, встановлюємо очікувану дату на завтра
              const today = new Date();
              const tomorrow = new Date(today);
              tomorrow.setDate(today.getDate() + 1);
              expectedDate = tomorrow;
            } else {
              remaining = `${formatMileage(remainingKm)}`;
              progress = Math.min(
                100,
                Math.max(0, ((part.mileageDiff || 0) / regVal) * 100),
              );

              // Розрахунок очікуваної дати на основі пробігу
              const carYearNum =
                parseInt(car.year) || new Date().getFullYear() - 5;
              const avgMonthlyMileage =
                car.currentMileage /
                ((new Date() - new Date(carYearNum, 0, 1)) /
                  (1000 * 60 * 60 * 24 * 30));
              const monthsToService = remainingKm / (avgMonthlyMileage || 2000);
              const date = new Date();
              date.setMonth(date.getMonth() + Math.round(monthsToService));
              expectedDate = date;

              if (remainingKm < 1000) {
                forecastText = "~1 тиждень";
                calculatedStatus = "warning";
              } else if (remainingKm < 2000) {
                forecastText = "~2 тижні";
                calculatedStatus = "warning";
              } else {
                const months = Math.ceil(monthsToService);
                if (months <= 1) forecastText = "~1 місяць";
                else if (months <= 2) forecastText = "~2 місяці";
                else if (months <= 3) forecastText = "~3 місяці";
                else forecastText = `~${months} місяців`;

                calculatedStatus = "normal";
              }
            }

            if (part.mileage && regVal) {
              nextMileageText = `${formatMileage(part.mileage + regVal)}`;
            }
          } else if (regulation.periodType === "місяць") {
            isTimeBased = true;
            remainingMonths = regVal - Math.floor((part.daysDiff || 0) / 30);
            const remainingDays = regVal * 30 - (part.daysDiff || 0);

            if (part.date) {
              const lastDateObj = window.Formatters
                ? window.Formatters.parseDate(part.date)
                : new Date(part.date);
              if (lastDateObj && !isNaN(lastDateObj.getTime())) {
                const date = new Date(lastDateObj);
                date.setMonth(date.getMonth() + regVal);
                expectedDate = date;
              }
            }

            if (remainingDays < 0) {
              remaining = `-${Math.abs(remainingMonths)} міс.`;
              forecastText = "Прострочено";
              progress = 100;
              overdueBy = `${Math.abs(remainingMonths)} міс.`;
              calculatedStatus = "critical";

              // Якщо прострочено, встановлюємо очікувану дату на завтра
              const today = new Date();
              const tomorrow = new Date(today);
              tomorrow.setDate(today.getDate() + 1);
              expectedDate = tomorrow;
            } else if (remainingDays <= 14) {
              // До 2 тижнів
              remaining = `${remainingMonths} міс.`;
              forecastText = remainingDays <= 7 ? "~1 тиждень" : "~2 тижні";
              calculatedStatus = "warning";
              progress = Math.min(
                100,
                Math.max(0, ((part.daysDiff || 0) / (regVal * 30)) * 100),
              );
            } else {
              remaining = `${remainingMonths} міс.`;
              if (remainingMonths <= 2) forecastText = "~1 місяць";
              else forecastText = `~${remainingMonths} місяці`;
              calculatedStatus = "normal";
              progress = Math.min(
                100,
                Math.max(0, ((part.daysDiff || 0) / (regVal * 30)) * 100),
              );
            }
          }
        }

        const formatExpectedDate = (date) => {
          if (!date) return null;
          const monthsNames = [
            "січня",
            "лютого",
            "березня",
            "квітня",
            "травня",
            "червня",
            "липня",
            "серпня",
            "вересня",
            "жовтня",
            "листопада",
            "грудня",
          ];
          return `~${date.getDate()} ${monthsNames[date.getMonth()]}`;
        };

        const carYearNumForUntil =
          parseInt(car.year) || new Date().getFullYear() - 5;
        const avgMonthlyMileage =
          car.currentMileage && car.year
            ? car.currentMileage /
            ((new Date() - new Date(carYearNumForUntil, 0, 1)) /
              (1000 * 60 * 60 * 24 * 30))
            : 2000;
        const monthsUntil = isTimeBased
          ? Math.max(0, remainingMonths)
          : remainingKm / (avgMonthlyMileage || 2000);

        // Перевіряємо, чи запчастина потребує діагностики
        const requiresDiagnostics = partsRequiringDiagnostics.includes(
          forecast.part,
        );
        const isBattery = forecast.part === "Акумулятор 🔋";

        // Для акумулятора: завжди перераховуємо прогноз на основі регламенту, якщо є текст замість розрахунку
        if (
          isBattery &&
          (forecast.when ===
            "Це лише прогноз, але бажано звернути увагу найближчим часом" ||
            forecast.when === "Згідно розрахунків" ||
            forecast.when === "Планове")
        ) {
          // Перераховуємо forecastText на основі регламенту, якщо він є
          if (regulation && regulation.normalValue !== "chain") {
            const regVal = regulation.regulationValue || regulation.normalValue;

            if (regulation.periodType === "пробіг") {
              const remainingKm = regVal - (part.mileageDiff || 0);
              const carYearNum =
                parseInt(car.year) || new Date().getFullYear() - 5;
              const avgMonthlyMileage =
                car.currentMileage /
                ((new Date() - new Date(carYearNum, 0, 1)) /
                  (1000 * 60 * 60 * 24 * 30));
              const monthsToService = remainingKm / (avgMonthlyMileage || 2000);

              if (remainingKm < 0) {
                forecastText = "~1 тиждень";
              } else if (remainingKm < 1000) {
                forecastText = "~1 тиждень";
              } else if (remainingKm < 2000) {
                forecastText = "~2 тижні";
              } else {
                const months = Math.ceil(monthsToService);
                if (months <= 1) forecastText = "~1 місяць";
                else if (months <= 2) forecastText = "~2 місяці";
                else if (months <= 3) forecastText = "~3 місяці";
                else forecastText = `~${months} місяців`;
              }
            } else if (regulation.periodType === "місяць") {
              const remainingMonths =
                regVal - Math.floor((part.daysDiff || 0) / 30);
              const remainingDays = regVal * 30 - (part.daysDiff || 0);

              if (remainingDays < 0) {
                forecastText = "~1 тиждень";
              } else if (remainingDays <= 14) {
                forecastText = remainingDays <= 7 ? "~1 тиждень" : "~2 тижні";
              } else {
                if (remainingMonths <= 2) forecastText = "~1 місяць";
                else forecastText = `~${remainingMonths} місяці`;
              }
            }
          }
        }

        // Якщо запчастина потребує діагностики, завжди встановлюємо середній статус
        if (requiresDiagnostics) {
          calculatedStatus = "warning";
          // Якщо було "Прострочено", замінюємо на "~1 тиждень"
          if (forecastText === "Прострочено") {
            forecastText = "~1 тиждень";
          }
        }

        // Спеціальна логіка для акумулятора
        let timeSinceInstallation = null;
        if (isBattery && part.date) {
          const lastDateObj = window.Formatters
            ? window.Formatters.parseDate(part.date)
            : new Date(part.date);
          if (lastDateObj && !isNaN(lastDateObj.getTime())) {
            const today = new Date();
            const daysDiff = Math.floor(
              (today - lastDateObj) / (1000 * 60 * 60 * 24),
            );
            const monthsDiff = Math.floor(daysDiff / 30);
            const yearsDiff = Math.floor(monthsDiff / 12);

            if (yearsDiff > 0) {
              timeSinceInstallation = `${yearsDiff} ${yearsDiff === 1 ? "рік" : yearsDiff < 5 ? "роки" : "років"}`;
            } else if (monthsDiff > 0) {
              timeSinceInstallation = `${monthsDiff} ${monthsDiff === 1 ? "місяць" : monthsDiff < 5 ? "місяці" : "місяців"}`;
            } else {
              timeSinceInstallation = `${daysDiff} ${daysDiff === 1 ? "день" : daysDiff < 5 ? "дні" : "днів"}`;
            }
          }
        }

        // Для акумулятора прогноз розраховується згідно алгоритмів і регламенту (не змінюємо forecastText)

        return {
          lastDate,
          lastMileage,
          remaining,
          overdueBy,
          nextMileage: nextMileageText,
          expectedDate: formatExpectedDate(expectedDate),
          isTimeBased,
          forecast: forecastText,
          progress: Math.round(progress),
          status: calculatedStatus,
          monthsUntil: isNaN(monthsUntil) ? 99 : monthsUntil,
          regulation:
            regulation && regulation.regulationValue
              ? regulation.periodType === "пробіг"
                ? `Кожні ${formatMileage(regulation.regulationValue)}`
                : `Кожні ${window.Formatters ? window.Formatters.formatNumber(regulation.regulationValue) : regulation.regulationValue} міс.`
              : null,
          requiresDiagnostics: requiresDiagnostics,
          mileageDiff: part.mileageDiff || 0,
          mileageDiffFormatted:
            part.mileageDiff && formatMileage
              ? formatMileage(part.mileageDiff)
              : part.mileageDiff || "0",
          currentMileage:
            car && car.currentMileage && formatMileage
              ? formatMileage(car.currentMileage)
              : car && car.currentMileage
                ? car.currentMileage
                : "-",
          isBattery: isBattery,
          timeSinceInstallation: timeSinceInstallation,
        };
      };

      // Визначаємо статус для класу
      const getStatusClass = (forecast) => {
        if (forecast.status === "critical") return "urgent";
        if (forecast.status === "warning") return "warning";
        return "normal";
      };

      // Визначаємо колір для значень
      const getStatusColor = (forecast) => {
        if (forecast.status === "critical") return "#ef4444";
        if (forecast.status === "warning") return "#f59e0b";
        return "#10b981";
      };

      // Фільтруємо прогнози для відображення (тільки прострочені або на найближчі 6 місяців)
      const displayForecasts = forecasts.filter((f) => {
        try {
          const details = getForecastDetails(f);
          return (
            details.status === "critical" ||
            (details.monthsUntil !== undefined && details.monthsUntil <= 6)
          );
        } catch (e) {
          return true;
        }
      });

      if (displayForecasts.length === 0) {
        return "";
      }

      return `
                <div class="mt-6">
                    <!-- Section Header -->
                    <div class="flex items-center justify-between mb-4 px-1">
                        <h2 class="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <span>⏰</span> Прогноз наступного обслуговування
                        </h2>
                        <span class="text-sm text-gray-600 font-semibold">${displayForecasts.length} позицій</span>
                    </div>
                    
                    <!-- Section Description -->
                    <div class="text-sm text-gray-600 mb-4 px-1">
                        Прогноз базується на поточному та середньому пробігу, середньої частоти поломок та рекомендованих інтервалах обслуговування. Натисніть на елемент для деталей.
                    </div>

                    <!-- Accordion Container -->
                    <div class="space-y-3">
                        ${displayForecasts
          .map((forecast, index) => {
            const details = getForecastDetails(forecast);
            // Для запчастин, які потребують діагностики, завжди використовуємо середній статус
            const finalStatus = details.requiresDiagnostics
              ? "warning"
              : details.status;
            const statusClass = getStatusClass({
              ...forecast,
              status: finalStatus,
            });
            const statusColor = getStatusColor({
              ...forecast,
              status: finalStatus,
            });
            const icon = getPartIcon(forecast.part);
            const partName = forecast.part
              .replace(
                /[🛢️📐🔧💻🕯️🔍🔥⚙️💿🛑🛠️⚪🔗🔩🔋⚡]/g,
                "",
              )
              .trim();

            return `
                            <div class="accordion-item ${statusClass}" data-index="${index}">
                                <!-- Accordion Header -->
                                <div class="accordion-header" onclick="this.closest('.accordion-item').classList.toggle('open')">
                                    <div class="accordion-status"></div>
                                    <div class="accordion-part">
                                        <span class="accordion-part-icon">${icon}</span>
                                        <div class="accordion-part-info">
                                            <div class="accordion-part-name">${partName}</div>
                                            <div class="accordion-part-last">${details.lastDate ? `Остання заміна: ${details.lastDate}` : "Немає даних"}</div>
                                        </div>
                                    </div>
                                    <div class="accordion-distance">
                                        <div class="accordion-distance-label">Залишок</div>
                                        <div class="accordion-distance-value" style="color: ${statusColor};">${details.remaining || forecast.when}</div>
                                    </div>
                                    <div class="accordion-date">
                                        <div class="accordion-date-label">Прогноз</div>
                                        <div class="accordion-date-value" style="color: ${statusColor}; font-size: 16px;">
                                            ${details.forecast || forecast.when}
                                        </div>
                                    </div>
                                    <div class="accordion-toggle">
                                        <span class="accordion-toggle-icon">▲</span>
                                    </div>
                                </div>
                                
                                <!-- Accordion Body -->
                                <div class="accordion-body">
                                    <div class="accordion-content">
                                        <div class="accordion-detail-group">
                                            <div class="accordion-detail-title">ІНФОРМАЦІЯ ПРО ЗАМІНУ</div>
                                            <div class="accordion-detail-row">
                                                <span class="accordion-detail-label">Остання заміна</span>
                                                <span class="accordion-detail-value">${details.lastDate || "-"}</span>
                                            </div>
                                            <div class="accordion-detail-row">
                                                <span class="accordion-detail-label">Пробіг тоді</span>
                                                <span class="accordion-detail-value">${details.lastMileage || "-"}</span>
                                            </div>
                                            ${!details.requiresDiagnostics
                ? `
                                            <div class="accordion-detail-row">
                                                <span class="accordion-detail-label">Регламент</span>
                                                <span class="accordion-detail-value">${details.regulation || "-"}</span>
                                            </div>
                                            `
                : ""
              }
                                        </div>
                                        <div class="accordion-detail-group">
                                            <div class="accordion-detail-title">ПРОГНОЗ</div>
                                            ${!details.requiresDiagnostics
                ? `
                                            <div class="accordion-detail-row">
                                                <span class="accordion-detail-label">${details.isTimeBased ? "Очікувана дата обслуговування" : "Наступна заміна"}</span>
                                                <span class="accordion-detail-value">${details.isTimeBased ? details.expectedDate || "-" : details.nextMileage || "-"}</span>
                                            </div>
                                            `
                : ""
              }
                                            ${details.requiresDiagnostics ||
                details.overdueBy
                ? `
                                                <div class="accordion-detail-row">
                                                    <span class="accordion-detail-label">${details.requiresDiagnostics ? "Пробіг від заміни" : "Прострочено на"}</span>
                                                    <span class="accordion-detail-value">${details.requiresDiagnostics ? details.mileageDiffFormatted : details.overdueBy}</span>
                                                </div>
                                            `
                : ""
              }
                                            ${details.isBattery &&
                details.timeSinceInstallation
                ? `
                                                <div class="accordion-detail-row">
                                                    <span class="accordion-detail-label">Час від останньої установки</span>
                                                    <span class="accordion-detail-value">${details.timeSinceInstallation}</span>
                                                </div>
                                            `
                : ""
              }
                                            <div class="accordion-detail-row">
                                                <span class="accordion-detail-label">Пріоритет</span>
                                                <span class="accordion-detail-value">
                                                    <span class="status-dot" style="background: ${statusColor};"></span>
                                                    ${finalStatus === "critical" ? "Критичний" : finalStatus === "warning" ? "Середній" : "Нормальний"}
                                                </span>
                                            </div>
                                        </div>
                                        <div class="accordion-progress-section">
                                            <div class="accordion-detail-title">СТАН ВИКОНАННЯ</div>
                                            <div class="accordion-progress-bar">
                                                <div class="accordion-progress-fill" style="width: ${details.progress}%; background: ${statusColor};"></div>
                                            </div>
                                            <div class="accordion-progress-label">${details.progress}% - ${details.requiresDiagnostics ? "Бажано звернути увагу найближчим часом" : finalStatus === "critical" ? "Потребує негайної уваги" : finalStatus === "warning" ? "Бажано звернути увагу найближчим часом" : "Все в нормі"}</div>
                                            ${details.requiresDiagnostics
                ? `
                                            <div class="accordion-diagnostics-warning" style="margin-top: 16px; padding: 16px; background: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; box-shadow: 0 2px 4px rgba(245, 158, 11, 0.2);">
                                                <div style="font-size: 16px; font-weight: 700; color: #92400e; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                                                    <span style="font-size: 20px;">⚠️</span> Важливо:
                                                </div>
                                                <div style="font-size: 14px; font-weight: 600; color: #78350f; line-height: 1.5;">Ця запчастина потребує заміни тільки після діагностики та огляду. Не замінюйте без перевірки стану.</div>
                                            </div>
                                            `
                : ""
              }
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `;
          })
          .join("")}
                </div>

                    <!-- Disclaimer -->
                    <div class="forecast-disclaimer">
                        <span class="forecast-disclaimer-icon">⚠️</span>
                        <span class="forecast-disclaimer-text">Це лише прогноз на основі поточних даних. Фактичні терміни можуть відрізнятися залежно від умов експлуатації.</span>
                </div>
            </div>
        `;
    } catch (e) {
      console.error("Помилка генерації HTML прогнозу:", e);
      return '<div class="p-4 text-red-500">Помилка відображення прогнозу</div>';
    }
  }
}
// Maintenance forecast module loaded
