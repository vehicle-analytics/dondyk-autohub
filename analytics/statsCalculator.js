/**
 * Калькулятор статистики та аналітики
 */

export class StatsCalculator {
  /**
   * Розраховує health score для автомобіля (покращений алгоритм)
   * @param {Object} car - Об'єкт автомобіля
   * @param {Array} maintenanceRegulations - Масив регламентів обслуговування (опціонально)
   * @param {Function} findRegulationForCar - Функція пошуку регламенту (опціонально)
   */
  static calculateHealthScore(
    car,
    maintenanceRegulations = null,
    findRegulationForCar = null,
  ) {
    let score = 100;
    const criticalParts = [];
    const warningParts = [];

    // Список важливих запчастин з підвищеними штрафами
    const importantParts = [
      "ТО (масло+фільтри) 🛢️",
      "ГРМ (ролики+ремінь) ⚙️",
      "Помпа 💧",
      "Обвідний ремінь+ролики 🔧",
      "Діагностика ходової 🔍",
      "Розвал-сходження 📐",
      "Профілактика направляючих супортів 🛠️",
      "Компютерна діагностика 💻",
      "Прожиг сажового фільтру 🔥",
      "Свічки запалювання 🔥",
    ];

    // Аналізуємо стан запчастин з урахуванням перевиконання регламентів
    for (const partName in car.parts) {
      const part = car.parts[partName];
      if (part) {
        const isImportantPart = importantParts.includes(partName);
        let partDeduction = 0;

        const isElectrical = this.isElectricalPart(partName);
        const isSparkPlug = partName.toLowerCase().includes("свічк");

        if (part.status === "critical") {
          criticalParts.push(partName);
          // Для важливих запчастин: -6%, для інших: -2%
          partDeduction = isImportantPart ? 6 : 2;

          // Для електрики (крім свічок) - мінімальний штраф
          if (isElectrical && !isSparkPlug) partDeduction = 0.5;
        } else if (part.status === "warning") {
          warningParts.push(partName);
          // Для важливих запчастин: -3%, для інших: -0.5%
          partDeduction = isImportantPart ? 3 : 0.5;

          // Для електрики (крім свічок) - мінімальний штраф
          if (isElectrical && !isSparkPlug) partDeduction = 0.2;
        }

        // Додатковий штраф за перевиконання регламенту
        if (
          partDeduction > 0 &&
          maintenanceRegulations &&
          findRegulationForCar
        ) {
          const overrunPenalty = this.calculateOverrunPenalty(
            part,
            partName,
            car,
            maintenanceRegulations,
            findRegulationForCar,
            isImportantPart,
          );
          partDeduction += overrunPenalty;
        }

        // Додатковий штраф за тривалість перебування в критичному стані
        if (part.status === "critical" && part.daysDiff) {
          const monthsInCritical = part.daysDiff / 30;
          if (monthsInCritical > 6) {
            partDeduction += isImportantPart ? 1 : 0.5;
          }
        }

        score -= partDeduction;
      }
    }

    // Каскадний ефект: додатковий штраф за множинні проблеми
    const totalProblematicParts = criticalParts.length + warningParts.length;
    if (criticalParts.length >= 8) {
      score -= 5; // 8+ критичних запчастин: -5%
    } else if (criticalParts.length >= 5) {
      score -= 3; // 5+ критичних запчастин: -3%
    }
    if (totalProblematicParts >= 10) {
      score -= 2; // 10+ запчастин з проблемами: -2%
    }

    // Враховуємо вік авто (плавний розрахунок - ВІДКОРИГОВАНО)
    if (car.year) {
      const carAge = new Date().getFullYear() - parseInt(car.year);
      const agePoints = [
        { x: 0, y: 0 },
        { x: 3, y: 1.5 },
        { x: 7, y: 4 },
        { x: 12, y: 8 },
        { x: 18, y: 15 },
      ];
      score -= this.interpolateValue(carAge, agePoints);
    }

    // Враховуємо пробіг (плавний розрахунок - ВІДКОРИГОВАНО)
    const mileagePoints = [
      { x: 0, y: 0 },
      { x: 150000, y: 1.3 },
      { x: 250000, y: 2.7 },
      { x: 350000, y: 4.7 },
      { x: 500000, y: 8 },
    ];
    score -= this.interpolateValue(car.currentMileage, mileagePoints);

    // Враховуємо інтенсивність експлуатації (плавний розрахунок)
    if (car.year) {
      const carAge = new Date().getFullYear() - parseInt(car.year);
      if (carAge > 0) {
        const avgYearlyMileage = car.currentMileage / carAge;
        const intensityPoints = [
          { x: 0, y: 0 },
          { x: 25000, y: 1 },
          { x: 35000, y: 2 },
          { x: 45000, y: 3 },
          { x: 60000, y: 4 },
        ];
        score -= this.interpolateValue(avgYearlyMileage, intensityPoints);
      }
    }

    // Бонус для нових авто з низьким пробігом
    if (car.year) {
      const carAge = new Date().getFullYear() - parseInt(car.year);
      if (carAge < 5 && car.currentMileage < 100000) {
        score += 2; // Вік <5 років і пробіг <100,000 км: +2%
      }
    }

    // Враховуємо стан з листа "Оцінка авто фото"
    if (car.photoAssessmentStatus) {
      const statusUpper = car.photoAssessmentStatus.toUpperCase().trim();
      if (statusUpper.includes("ВІДМІННИЙ")) {
        score += 6; // Відмінний – плюс 6
      } else if (statusUpper.includes("ДОБРИЙ")) {
        score += 1; // Добрий – плюс 1
      } else if (statusUpper.includes("ЗАДОВІЛЬНИЙ")) {
        score -= 4; // Задовільний – мінус 4
      } else if (statusUpper.includes("КРИТИЧНИЙ")) {
        score -= 20; // Критичний – мінус 20
      }
    }

    // Враховуємо регулярність обслуговування (АКТИВОВАНО)
    if (maintenanceRegulations && findRegulationForCar && car.history) {
      const maintenanceScore = this.calculateMaintenanceRegularity(
        car,
        maintenanceRegulations,
        findRegulationForCar,
      );
      score += maintenanceScore;
    }

    // Враховуємо історію витрат та надійність (АКТИВОВАНО)
    if (car.history && car.history.length > 0) {
      const expenseScore = this.calculateExpenseHistoryScore(car);
      score += expenseScore;
    }

    // Враховуємо прогнозовані ризики
    const riskPenalty = this.calculateRiskPenalty(car, importantParts);
    score -= riskPenalty;

    // Додаткові фактори: стабільність стану та проактивне обслуговування
    if (car.history && car.history.length > 0) {
      const additionalFactors = this.calculateAdditionalFactors(
        car,
        criticalParts,
        warningParts,
      );
      score += additionalFactors;
    }

    // Якщо стан з фото "Критичний", то максимальне значення не може перевищувати 35%
    let maxScore = 100;
    if (car.photoAssessmentStatus) {
      const statusUpper = car.photoAssessmentStatus.toUpperCase().trim();
      if (statusUpper.includes("КРИТИЧНИЙ")) {
        maxScore = 35; // Максимальне значення для критичного стану
      }
    }

    // Забезпечуємо мінімальне значення та максимальне (31% для критичного стану)
    return Math.max(0, Math.min(maxScore, Math.round(score)));
  }

  /**
   * Розраховує штраф за перевиконання регламенту
   */
  static calculateOverrunPenalty(
    part,
    partName,
    car,
    maintenanceRegulations,
    findRegulationForCar,
    isImportantPart,
  ) {
    if (!part.mileageDiff || !maintenanceRegulations || !findRegulationForCar)
      return 0;

    try {
      const regulation = findRegulationForCar(
        car.license,
        car.model,
        car.year,
        partName,
        maintenanceRegulations,
      );
      if (
        !regulation ||
        !regulation.normalValue ||
        regulation.normalValue === "chain"
      )
        return 0;

      let normalValue = regulation.normalValue;
      if (
        regulation.regulationValue &&
        regulation.regulationValue !== "chain"
      ) {
        normalValue = regulation.regulationValue;
      }

      if (regulation.periodType === "пробіг" && normalValue > 0) {
        const overrunPercent =
          ((part.mileageDiff - normalValue) / normalValue) * 100;

        if (overrunPercent > 150) {
          // Перевиконання >150%
          return isImportantPart ? 5 : 3;
        } else if (overrunPercent > 100) {
          // Перевиконання >100%
          return isImportantPart ? 3 : 2;
        } else if (overrunPercent > 50) {
          // Перевиконання >50%
          return isImportantPart ? 1.5 : 1;
        }
      }
    } catch (e) {
      // Ігноруємо помилки при розрахунку
    }

    return 0;
  }

  /**
   * Розраховує бонус/штраф за регулярність обслуговування
   */
  static calculateMaintenanceRegularity(
    car,
    maintenanceRegulations,
    findRegulationForCar,
  ) {
    if (!car.history || car.history.length === 0) return 0;

    let score = 0;
    const toParts = car.history.filter((r) => {
      const desc = (r.description || "").toLowerCase();
      return (
        desc.includes("масло") || desc.includes("то") || desc.includes("фільтр")
      );
    });

    if (toParts.length === 0) return 0;

    // Перевіряємо своєчасність ТО (останні 5 ТО)
    const recentTO = toParts
      .sort((a, b) => {
        const dateA = new Date(a.date || 0);
        const dateB = new Date(b.date || 0);
        return dateB - dateA;
      })
      .slice(0, 5);

    let timelyCount = 0;
    const toPartName = "ТО (масло+фільтри) 🛢️";

    for (const toRecord of recentTO) {
      try {
        const regulation = findRegulationForCar(
          car.license,
          car.model,
          car.year,
          toPartName,
          maintenanceRegulations,
        );
        if (
          regulation &&
          regulation.normalValue &&
          regulation.normalValue !== "chain"
        ) {
          let normalValue = regulation.normalValue;
          if (
            regulation.regulationValue &&
            regulation.regulationValue !== "chain"
          ) {
            normalValue = regulation.regulationValue;
          }

          if (regulation.periodType === "пробіг" && normalValue > 0) {
            // Знаходимо наступне ТО після цього
            const nextTO = toParts.find(
              (t) => new Date(t.date) > new Date(toRecord.date),
            );
            if (nextTO) {
              const mileageDiff = nextTO.mileage - toRecord.mileage;
              const overrunPercent =
                ((mileageDiff - normalValue) / normalValue) * 100;

              // Вважаємо вчасно, якщо в межах ±10%
              if (Math.abs(overrunPercent) <= 10) {
                timelyCount++;
              }
            }
          }
        }
      } catch (e) {
        // Ігноруємо помилки
      }
    }

    const timelyPercent =
      recentTO.length > 0 ? (timelyCount / recentTO.length) * 100 : 0;

    if (timelyPercent >= 95)
      score += 4; // 95%+ ТО вчасно: +4%
    else if (timelyPercent >= 80)
      score += 2; // 80-94% ТО вчасно: +2%
    else if (timelyPercent >= 60) {
      // 60-79% ТО вчасно: 0%
    } else {
      score -= 4; // <60% ТО вчасно: -4%
    }

    // Перевіряємо частоту обслуговування (останні 12 місяців)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const recentHistory = car.history.filter((r) => {
      const recordDate = new Date(r.date || 0);
      return recordDate >= oneYearAgo;
    });

    if (recentHistory.length === 0) {
      score -= 5; // Рідке обслуговування (>12 місяців): -5%
    } else {
      const monthsBetween = 12 / recentHistory.length;
      if (monthsBetween <= 4) {
        score += 4; // Кожні 2-4 місяці: +4%
      } else if (monthsBetween <= 6) {
        score += 2; // Кожні 4-6 місяців: +2%
      } else if (monthsBetween <= 9) {
        // Кожні 6-9 місяців: 0%
      } else if (monthsBetween <= 12) {
        score -= 2; // Кожні 9-12 місяців: -2%
      } else {
        score -= 5; // Рідке (>12 місяців): -5%
      }
    }

    // Перевіряємо повноту обслуговування важливих запчастин
    const importantParts = [
      "ТО (масло+фільтри) 🛢️",
      "ГРМ (ролики+ремінь) ⚙️",
      "Помпа 💧",
      "Обвідний ремінь+ролики 🔧",
    ];

    let servicedImportantParts = 0;
    for (const partName of importantParts) {
      if (car.parts[partName] && car.parts[partName].status !== "critical") {
        servicedImportantParts++;
      }
    }

    if (servicedImportantParts === importantParts.length) {
      score += 2; // Всі важливі запчастини обслуговуються: +2%
    } else if (servicedImportantParts < importantParts.length / 2) {
      score -= 3; // Деякі важливі запчастини пропущені: -3%
    }

    return score;
  }

  /**
   * Розраховує бонус/штраф за історію витрат та надійність
   */
  static calculateExpenseHistoryScore(car) {
    if (!car.history || car.history.length === 0) return 0;

    let score = 0;

    // Аналізуємо останні 12 місяців
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const recentHistory = car.history.filter((r) => {
      const recordDate = new Date(r.date || 0);
      return recordDate >= oneYearAgo && r.totalWithVAT > 0;
    });

    if (recentHistory.length === 0) return 0;

    // Частота поломок (записи з витратами)
    const breakdowns = recentHistory.filter((r) => r.totalWithVAT > 0);
    const breakdownCount = breakdowns.length;

    if (breakdownCount <= 1)
      score += 4; // 0-1 поломка: +4%
    else if (breakdownCount <= 3)
      score += 1; // 2-3 поломки: +1%
    else if (breakdownCount <= 6) {
      // 4-6 поломок: 0%
    } else if (breakdownCount <= 10)
      score -= 5; // 7-10 поломок: -5%
    else score -= 8; // >10 поломок: -8%

    // Середня вартість ремонту
    const totalCost = breakdowns.reduce(
      (sum, r) => sum + (r.totalWithVAT || 0),
      0,
    );
    const avgCost = breakdownCount > 0 ? totalCost / breakdownCount : 0;

    if (avgCost < 3000)
      score += 3; // <3,000 грн/ремонт: +3%
    else if (avgCost <= 8000)
      score += 1; // 3,000-8,000 грн/ремонт: +1%
    else if (avgCost <= 20000) {
      // 8,001-20,000 грн/ремонт: 0%
    } else if (avgCost <= 40000)
      score -= 3; // 20,001-40,000 грн/ремонт: -3%
    else score -= 6; // >40,000 грн/ремонт: -6%

    // Тренд витрат (останні 6 місяців vs попередні 6 місяців)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const last6Months = recentHistory.filter((r) => {
      const recordDate = new Date(r.date || 0);
      return recordDate >= sixMonthsAgo;
    });

    const prev6Months = recentHistory.filter((r) => {
      const recordDate = new Date(r.date || 0);
      return recordDate < sixMonthsAgo;
    });

    if (last6Months.length > 0 && prev6Months.length > 0) {
      const last6Cost = last6Months.reduce(
        (sum, r) => sum + (r.totalWithVAT || 0),
        0,
      );
      const prev6Cost = prev6Months.reduce(
        (sum, r) => sum + (r.totalWithVAT || 0),
        0,
      );

      if (prev6Cost > 0) {
        const costChange = ((last6Cost - prev6Cost) / prev6Cost) * 100;

        if (costChange < -20) {
          score += 3; // Зменшення витрат >20%: +3%
        } else if (costChange < -10) {
          score += 1; // Зменшення витрат 10-20%: +1%
        } else if (costChange > 100) {
          score -= 5; // Збільшення витрат >100%: -5%
        } else if (costChange > 50) {
          score -= 2; // Збільшення витрат 50-100%: -2%
        }
      }
    }

    // Загальна вартість обслуговування відносно вартості авто
    // Припускаємо середню вартість авто ~500,000 грн (можна налаштувати)
    const estimatedCarValue = 500000;
    const totalMaintenanceCost = totalCost;
    const maintenanceCostPercent =
      (totalMaintenanceCost / estimatedCarValue) * 100;

    if (maintenanceCostPercent < 5)
      score += 2; // <5% від вартості авто: +2%
    else if (maintenanceCostPercent <= 15) {
      // 5-15%: 0%
    } else if (maintenanceCostPercent <= 30)
      score -= 2; // 15-30%: -2%
    else score -= 4; // >30%: -4%

    return score;
  }

  /**
   * Розраховує штраф за прогнозовані ризики
   */
  static calculateRiskPenalty(car, importantParts) {
    if (!car.parts) return 0;

    let penalty = 0;

    // Наближення критичних замін
    let approachingCritical = 0;
    let needsAttention = 0;

    for (const partName in car.parts) {
      const part = car.parts[partName];
      if (part) {
        if (part.status === "warning") {
          if (importantParts.includes(partName)) {
            approachingCritical++;
          }
          needsAttention++;
        } else if (part.status === "critical") {
          if (importantParts.includes(partName)) {
            approachingCritical++;
          }
          needsAttention++;
        }
      }
    }

    if (approachingCritical >= 4) penalty += 3; // 4+ важливі запчастини наближаються: -3%
    if (needsAttention >= 7) penalty += 2; // 7+ запчастин потребують уваги: -2%

    // Каскадні ризики
    const hasCriticalGrm =
      car.parts["ГРМ (ролики+ремінь) ⚙️"]?.status === "critical";
    const hasCriticalPump = car.parts["Помпа 💧"]?.status === "critical";
    const hasCriticalTO =
      car.parts["ТО (масло+фільтри) 🛢️"]?.status === "critical";

    if (hasCriticalGrm && hasCriticalPump && hasCriticalTO) {
      penalty += 3; // Критичний двигун (ГРМ + Помпа + ТО): -3%
    } else if (hasCriticalGrm && hasCriticalPump) {
      penalty += 2; // Критичний ГРМ + Помпа: -2%
    }

    const hasCriticalBrakesFront =
      car.parts["Гальмівні колодки передні🛑"]?.status === "critical";
    const hasCriticalBrakesRear =
      car.parts["Гальмівні колодки задні🛑"]?.status === "critical";
    const hasCriticalBrakesDisksFront =
      car.parts["Гальмівні диски передні💿"]?.status === "critical";
    const hasCriticalBrakesDisksRear =
      car.parts["Гальмівні диски задні💿"]?.status === "critical";

    if (
      (hasCriticalBrakesFront && hasCriticalBrakesRear) ||
      (hasCriticalBrakesDisksFront && hasCriticalBrakesDisksRear) ||
      (hasCriticalBrakesFront && hasCriticalBrakesDisksFront) ||
      (hasCriticalBrakesRear && hasCriticalBrakesDisksRear)
    ) {
      penalty += 2; // Критичний стан гальмівної системи: -2%
    }

    // Критична ходова частина (3+ запчастини)
    const suspensionParts = [
      "Амортизатори передні🔧",
      "Амортизатори задні🔧",
      "Опора амортизаторів 🛠️",
      "Шарова опора ⚪",
      "Рульова тяга 🔗",
      "Рульовий накінечник 🔩",
    ];
    let criticalSuspensionParts = 0;
    for (const partName of suspensionParts) {
      if (car.parts[partName]?.status === "critical") {
        criticalSuspensionParts++;
      }
    }
    if (criticalSuspensionParts >= 3) {
      penalty += 2; // Критична ходова частина (3+ запчастини): -2%
    }

    return penalty;
  }

  /**
   * Розраховує додаткові фактори: стабільність стану та проактивне обслуговування
   */
  static calculateAdditionalFactors(car, criticalParts, warningParts) {
    if (!car.history || car.history.length === 0) {
      // Відсутність історії обслуговування (підозріло)
      return -3;
    }

    let score = 0;

    // Стабільність стану (перевіряємо, чи стан не погіршувався за останні 6 місяців)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const recentHistory = car.history.filter((r) => {
      const recordDate = new Date(r.date || 0);
      return recordDate >= sixMonthsAgo;
    });

    // Якщо за останні 6 місяців не було критичних поломок (витрати >20,000 грн)
    const criticalBreakdowns = recentHistory.filter(
      (r) => r.totalWithVAT > 20000,
    );

    if (criticalBreakdowns.length === 0 && recentHistory.length > 0) {
      score += 2; // Стабільність стану: +2%
    }

    // Проактивне обслуговування (перевіряємо, чи запчастини замінюються до критичного стану)
    // Якщо більшість важливих запчастин не в критичному стані, це проактивне обслуговування
    const importantParts = [
      "ТО (масло+фільтри) 🛢️",
      "ГРМ (ролики+ремінь) ⚙️",
      "Помпа 💧",
      "Обвідний ремінь+ролики 🔧",
    ];

    let proactiveCount = 0;
    for (const partName of importantParts) {
      const part = car.parts[partName];
      if (part && part.status !== "critical") {
        proactiveCount++;
      }
    }

    if (proactiveCount === importantParts.length) {
      score += 1; // Всі важливі запчастини обслуговуються проактивно: +1%
    }

    return score;
  }

  /**
   * Отримує колір для health score
   */
  static getHealthScoreColor(score) {
    if (score >= 85) return "from-green-400 to-green-500"; // Відмінний (зелений)
    if (score >= 60) return "from-yellow-400 to-yellow-500"; // Добрий (жовтий)
    if (score >= 35) return "from-orange-400 to-orange-500"; // Задовільний (помаранчевий)
    return "from-red-400 to-red-500"; // Критичний (червоний)
  }

  /**
   * Отримує мітку для health score
   * Якщо в photoAssessmentStatus вказано "Критичний", то завжди повертаємо "Критичний"
   */
  static getHealthScoreLabel(score, car = null) {
    // Якщо в листі "Оцінка авто фото" вказано "Критичний", то завжди повертаємо "Критичний"
    if (car && car.photoAssessmentStatus) {
      const statusUpper = car.photoAssessmentStatus.toUpperCase().trim();
      if (statusUpper.includes("КРИТИЧНИЙ")) {
        return "Критичний";
      }
    }

    // Інакше визначаємо мітку на основі health score
    if (score >= 85) return "Відмінний";
    if (score >= 60) return "Добрий";
    if (score >= 35) return "Задовільний";
    return "Критичний";
  }

  /**
   * Отримує статус для health score
   * Якщо в photoAssessmentStatus вказано "Критичний", то завжди повертаємо "Критичний"
   */
  static getHealthScoreStatus(score, car = null) {
    // Якщо в листі "Оцінка авто фото" вказано "Критичний", то завжди повертаємо "Критичний"
    if (car && car.photoAssessmentStatus) {
      const statusUpper = car.photoAssessmentStatus.toUpperCase().trim();
      if (statusUpper.includes("КРИТИЧНИЙ")) {
        return "Критичний";
      }
    }

    // Інакше визначаємо статус на основі health score
    if (score >= 85) return "Відмінний";
    if (score >= 60) return "Добрий";
    if (score >= 35) return "Задовільний";
    return "Критичний";
  }

  /**
   * Розраховує статистику по автомобілях
   */
  static calculateStats(cars, calculateHealthScore, getHealthScoreLabel) {
    let totalCars = 0;
    let carsWithGood = 0; // Відмінний + Добрий
    let carsWithWarning = 0; // Задовільний
    let carsWithCritical = 0; // Критичний

    // Детальна статистика по станах
    let carsExcellent = 0; // Відмінний (≥85%)
    let carsGood = 0; // Добрий (60-84%)
    let carsSatisfactory = 0; // Задовільний (35-59%)
    let carsBad = 0; // Поганий (залишено для сумісності, тепер об'єднано з Задовільний)
    let carsCritical = 0; // Критичний (<35%)

    for (const car of cars) {
      totalCars++;
      const healthScore = calculateHealthScore(car);
      const healthLabel = getHealthScoreLabel(healthScore, car);

      // Рахуємо детальну статистику на основі healthLabel (як у фільтрі)
      // Використовуємо ту саму логіку, що і фільтр selectedHealthStatus
      if (healthLabel === "Відмінний") {
        carsExcellent++;
        carsWithGood++; // Відмінний входить в "У нормі"
      } else if (healthLabel === "Добрий") {
        carsGood++;
        carsWithGood++; // Добрий входить в "У нормі"
      } else if (healthLabel === "Задовільний") {
        carsSatisfactory++;
        carsWithWarning++; // Задовільний входить в "Увага"
      } else if (healthLabel === "Критичний") {
        carsCritical++;
        carsWithCritical++; // Критичний
      }
    }

    return {
      totalCars,
      carsWithGood,
      carsWithWarning,
      carsWithCritical,
      carsExcellent,
      carsGood,
      carsSatisfactory,
      carsBad,
      carsCritical,
    };
  }

  /**
   * Отримує список міст з автомобілів
   */
  static getCities(cars) {
    const cities = new Set();
    for (const car of cars) {
      if (car.city) cities.add(car.city);
    }
    const sortedCities = Array.from(cities).sort((a, b) =>
      a.localeCompare(b, "uk"),
    );
    return ["Всі міста", ...sortedCities];
  }

  /**
   * Детальний розрахунок стану авто з поясненнями
   * @param {Object} car - Об'єкт автомобіля
   * @param {Array} maintenanceRegulations - Масив регламентів обслуговування (опціонально)
   * @param {Function} findRegulationForCar - Функція пошуку регламенту (опціонально)
   */
  static calculateHealthScoreDetailed(
    car,
    maintenanceRegulations = null,
    findRegulationForCar = null,
  ) {
    const details = {
      license: car.license || "Невідомо",
      model: car.model || "Невідомо",
      year: car.year || "Невідомо",
      currentMileage: car.currentMileage || 0,
      photoAssessmentStatus: car.photoAssessmentStatus || null,
      initialScore: 100,
      deductions: [],
      additions: [],
      finalScore: 0,
      category: "",
      color: "",
    };

    let score = 100;
    const criticalParts = [];
    const warningParts = [];

    // Список важливих запчастин з підвищеними штрафами
    const importantParts = [
      "ТО (масло+фільтри) 🛢️",
      "ГРМ (ролики+ремінь) ⚙️",
      "Помпа 💧",
      "Обвідний ремінь+ролики 🔧",
      "Діагностика ходової 🔍",
      "Розвал-сходження 📐",
      "Профілактика направляючих супортів 🛠️",
      "Компютерна діагностика 💻",
      "Прожиг сажового фільтру 🔥",
      "Свічки запалювання 🔥",
    ];

    // Аналізуємо стан запчастин з урахуванням перевиконання регламентів
    for (const partName in car.parts) {
      const part = car.parts[partName];
      if (part) {
        const isImportantPart = importantParts.includes(partName);
        let partDeduction = 0;
        let overrunPenalty = 0;

        if (part.status === "critical") {
          criticalParts.push(partName);
          partDeduction = isImportantPart ? -6 : -2;
        } else if (part.status === "warning") {
          warningParts.push(partName);
          partDeduction = isImportantPart ? -3 : -0.5;
        }

        // Додатковий штраф за перевиконання регламенту
        if (
          partDeduction < 0 &&
          maintenanceRegulations &&
          findRegulationForCar
        ) {
          overrunPenalty = this.calculateOverrunPenalty(
            part,
            partName,
            car,
            maintenanceRegulations,
            findRegulationForCar,
            isImportantPart,
          );
          partDeduction -= overrunPenalty;
        }

        // Додатковий штраф за тривалість перебування в критичному стані
        if (part.status === "critical" && part.daysDiff) {
          const monthsInCritical = part.daysDiff / 30;
          if (monthsInCritical > 6) {
            partDeduction -= isImportantPart ? 1 : 0.5;
            overrunPenalty += isImportantPart ? 1 : 0.5;
          }
        }

        if (partDeduction < 0) {
          score += partDeduction;
          const reason =
            part.status === "critical"
              ? `Критична деталь: ${partName}${isImportantPart ? " (важлива)" : ""}${overrunPenalty > 0 ? ` (перевиконання +${overrunPenalty}%)` : ""}`
              : `Деталь "Увага": ${partName}${isImportantPart ? " (важлива)" : ""}${overrunPenalty > 0 ? ` (перевиконання +${overrunPenalty}%)` : ""}`;
          details.deductions.push({
            reason: reason,
            amount: partDeduction,
            type: part.status === "critical" ? "critical_part" : "warning_part",
          });
        }
      }
    }

    // Каскадний ефект
    const totalProblematicParts = criticalParts.length + warningParts.length;
    let cascadePenalty = 0;
    if (criticalParts.length >= 8) {
      cascadePenalty = 5;
      details.deductions.push({
        reason: `Каскадний ефект: 8+ критичних запчастин`,
        amount: -5,
        type: "cascade_effect",
      });
    } else if (criticalParts.length >= 5) {
      cascadePenalty = 3;
      details.deductions.push({
        reason: `Каскадний ефект: 5+ критичних запчастин`,
        amount: -3,
        type: "cascade_effect",
      });
    }
    if (totalProblematicParts >= 10) {
      cascadePenalty += 2;
      details.deductions.push({
        reason: `Каскадний ефект: 10+ запчастин з проблемами`,
        amount: -2,
        type: "cascade_effect",
      });
    }
    score -= cascadePenalty;

    // Враховуємо вік авто
    if (car.year) {
      const carAge = new Date().getFullYear() - parseInt(car.year);
      if (carAge > 18) {
        score -= 18;
        details.deductions.push({
          reason: `Вік авто: ${carAge} років (старше 18 років)`,
          amount: -18,
          type: "age",
        });
      } else if (carAge > 12) {
        score -= 10;
        details.deductions.push({
          reason: `Вік авто: ${carAge} років (старше 12 років)`,
          amount: -10,
          type: "age",
        });
      } else if (carAge > 7) {
        score -= 5;
        details.deductions.push({
          reason: `Вік авто: ${carAge} років (старше 7 років)`,
          amount: -5,
          type: "age",
        });
      } else if (carAge > 3) {
        score -= 2;
        details.deductions.push({
          reason: `Вік авто: ${carAge} років (старше 3 років)`,
          amount: -2,
          type: "age",
        });
      }
    }

    // Враховуємо пробіг
    if (car.currentMileage > 500000) {
      score -= 12;
      details.deductions.push({
        reason: `Пробіг: ${car.currentMileage.toLocaleString("uk-UA")} км (понад 500,000 км)`,
        amount: -12,
        type: "mileage",
      });
    } else if (car.currentMileage > 350000) {
      score -= 7;
      details.deductions.push({
        reason: `Пробіг: ${car.currentMileage.toLocaleString("uk-UA")} км (понад 350,000 км)`,
        amount: -7,
        type: "mileage",
      });
    } else if (car.currentMileage > 250000) {
      score -= 4;
      details.deductions.push({
        reason: `Пробіг: ${car.currentMileage.toLocaleString("uk-UA")} км (понад 250,000 км)`,
        amount: -4,
        type: "mileage",
      });
    } else if (car.currentMileage > 150000) {
      score -= 2;
      details.deductions.push({
        reason: `Пробіг: ${car.currentMileage.toLocaleString("uk-UA")} км (понад 150,000 км)`,
        amount: -2,
        type: "mileage",
      });
    }

    // Враховуємо інтенсивність експлуатації
    if (car.year) {
      const carAge = new Date().getFullYear() - parseInt(car.year);
      if (carAge > 0) {
        const avgYearlyMileage = car.currentMileage / carAge;
        if (avgYearlyMileage > 60000) {
          score -= 8;
          details.deductions.push({
            reason: `Інтенсивність експлуатації: ${Math.round(avgYearlyMileage).toLocaleString("uk-UA")} км/рік (>60,000 км/рік)`,
            amount: -8,
            type: "intensity",
          });
        } else if (avgYearlyMileage > 45000) {
          score -= 6;
          details.deductions.push({
            reason: `Інтенсивність експлуатації: ${Math.round(avgYearlyMileage).toLocaleString("uk-UA")} км/рік (>45,000 км/рік)`,
            amount: -6,
            type: "intensity",
          });
        } else if (avgYearlyMileage > 35000) {
          score -= 4;
          details.deductions.push({
            reason: `Інтенсивність експлуатації: ${Math.round(avgYearlyMileage).toLocaleString("uk-UA")} км/рік (>35,000 км/рік)`,
            amount: -4,
            type: "intensity",
          });
        } else if (avgYearlyMileage > 25000) {
          score -= 2;
          details.deductions.push({
            reason: `Інтенсивність експлуатації: ${Math.round(avgYearlyMileage).toLocaleString("uk-UA")} км/рік (>25,000 км/рік)`,
            amount: -2,
            type: "intensity",
          });
        }
      }
    }

    // Бонус для нових авто з низьким пробігом
    if (car.year) {
      const carAge = new Date().getFullYear() - parseInt(car.year);
      if (carAge < 5 && car.currentMileage < 100000) {
        score += 2;
        details.additions.push({
          reason: `Бонус: нове авто з низьким пробігом (вік <5 років, пробіг <100,000 км)`,
          amount: +2,
          type: "new_car_bonus",
        });
      }
    }

    // Враховуємо стан з листа "Оцінка авто фото"
    if (car.photoAssessmentStatus) {
      const statusUpper = car.photoAssessmentStatus.toUpperCase().trim();
      if (statusUpper.includes("ВІДМІННИЙ")) {
        score += 6;
        details.additions.push({
          reason: `Оцінка з фото: Відмінний`,
          amount: +6,
          type: "photo_assessment",
        });
      } else if (statusUpper.includes("ДОБРИЙ")) {
        score += 1;
        details.additions.push({
          reason: `Оцінка з фото: Добрий`,
          amount: +1,
          type: "photo_assessment",
        });
      } else if (statusUpper.includes("ЗАДОВІЛЬНИЙ")) {
        score -= 4;
        details.deductions.push({
          reason: `Оцінка з фото: Задовільний`,
          amount: -4,
          type: "photo_assessment",
        });
      } else if (statusUpper.includes("КРИТИЧНИЙ")) {
        score -= 20;
        details.deductions.push({
          reason: `Оцінка з фото: Критичний`,
          amount: -20,
          type: "photo_assessment",
        });
      }
    }

    // Враховуємо регулярність обслуговування
    // ВИКЛЮЧЕНО: Регулярність обслуговування може бути частою, і це може означати що авто обслужено і навпаки
    // if (maintenanceRegulations && findRegulationForCar && car.history) {
    //     const maintenanceScore = this.calculateMaintenanceRegularity(
    //         car, maintenanceRegulations, findRegulationForCar
    //     );
    //     score += maintenanceScore;
    //     if (maintenanceScore > 0) {
    //         details.additions.push({
    //             reason: `Регулярність обслуговування`,
    //             amount: maintenanceScore,
    //             type: 'maintenance_regularity'
    //         });
    //     } else if (maintenanceScore < 0) {
    //         details.deductions.push({
    //             reason: `Регулярність обслуговування`,
    //             amount: maintenanceScore,
    //             type: 'maintenance_regularity'
    //         });
    //     }
    // }

    // Враховуємо історію витрат та надійність
    // ВИКЛЮЧЕНО: Історія витрат може бути частою, і це може означати що авто обслужено і навпаки
    // if (car.history && car.history.length > 0) {
    //     const expenseScore = this.calculateExpenseHistoryScore(car);
    //     score += expenseScore;
    //     if (expenseScore > 0) {
    //         details.additions.push({
    //             reason: `Історія витрат та надійність`,
    //             amount: expenseScore,
    //             type: 'expense_history'
    //         });
    //     } else if (expenseScore < 0) {
    //         details.deductions.push({
    //             reason: `Історія витрат та надійність`,
    //             amount: expenseScore,
    //             type: 'expense_history'
    //         });
    //     }
    // }

    // Враховуємо прогнозовані ризики
    const riskPenalty = this.calculateRiskPenalty(car, importantParts);
    score -= riskPenalty;
    if (riskPenalty > 0) {
      details.deductions.push({
        reason: `Прогнозовані ризики`,
        amount: -riskPenalty,
        type: "risk_penalty",
      });
    }

    // Додаткові фактори
    if (car.history && car.history.length > 0) {
      const additionalFactors = this.calculateAdditionalFactors(
        car,
        criticalParts,
        warningParts,
      );
      score += additionalFactors;
      if (additionalFactors > 0) {
        details.additions.push({
          reason: `Додаткові фактори (стабільність, проактивність)`,
          amount: additionalFactors,
          type: "additional_factors",
        });
      } else if (additionalFactors < 0) {
        details.deductions.push({
          reason: `Додаткові фактори (відсутність історії)`,
          amount: additionalFactors,
          type: "additional_factors",
        });
      }
    }

    // Якщо стан з фото "Критичний", то максимальне значення не може перевищувати 35%
    let maxScore = 100;
    if (car.photoAssessmentStatus) {
      const statusUpper = car.photoAssessmentStatus.toUpperCase().trim();
      if (statusUpper.includes("КРИТИЧНИЙ")) {
        maxScore = 35;
        details.maxScoreLimit = 35;
      }
    }

    // Забезпечуємо мінімальне значення та максимальне
    const finalScore = Math.max(0, Math.min(maxScore, Math.round(score)));
    details.finalScore = finalScore;
    details.category = this.getHealthScoreLabel(finalScore, car);
    details.color = this.getHealthScoreColor(finalScore);
    details.criticalParts = criticalParts;
    details.warningParts = warningParts;

    return details;
  }

  /**
   * Допоміжний метод для лінійної інтерполяції значень
   * @param {number} value - Значення (x)
   * @param {Array} points - Масив точок {x, y}
   */
  static interpolateValue(value, points) {
    if (!points || points.length === 0) return 0;
    if (value <= points[0].x) return points[0].y;
    if (value >= points[points.length - 1].x) return points[points.length - 1].y;

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];

      if (value >= p1.x && value <= p2.x) {
        // Формула лінійної інтерполяції: y = y1 + (x - x1) * (y2 - y1) / (x2 - x1)
        return p1.y + ((value - p1.x) * (p2.y - p1.y)) / (p2.x - p1.x);
      }
    }
    return 0;
  }

  /**
   * Перевіряє, чи належить запчастина до категорії "Електрика"
   * @param {string} partName - Назва запчастини
   */
  static isElectricalPart(partName) {
    if (!partName) return false;
    const name = partName.toLowerCase();
    const electricalKeywords = [
      "акумулятор",
      "акб",
      "стартер",
      "генератор",
      "датчик",
      "свічк", // Свічки входять в категорію, але для них є окрема логіка
      "зажигание",
      "запалювання",
      "катушк",
      "провод",
      "електр",
      "блок керування",
      "ебу",
    ];
    return electricalKeywords.some((kw) => name.includes(kw));
  }
}

// Експортуємо для використання
