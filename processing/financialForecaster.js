import { CarProcessor } from './carProcessor.js';

/**
 * 💰 Модуль фінансового прогнозування для автомобілів та автопарку
 * Розраховує бюджет на основі історії, регламенту та рекомендацій
 */

export class FinancialForecaster {
  constructor(constants) {
    this.settings = constants?.FORECAST_SETTINGS || {
      HISTORICAL_DEPTH_MONTHS: 12,
      DEFAULT_RESERVE_COEFFICIENT: 0.15,
      INFLATION_MULTIPLIER: 1.10,
      WORK_COST_COEFFICIENT: 0.25,
    };
    
    // Базові вартості запчастин (синхронізовано з app.js)
    this.basePartCosts = {
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

    // Ключові слова для виключення робіт з розрахунку "Базових витрат" (щоб не рахувати їх двічі)
    this.MAINTENANCE_KEYWORDS = /ТО|масло|фільтр|ГРМ|помпа|ролик|ремонт|заміна|ходова|колодки|диски|амортизатор|ричаг|сайлентблок|підвіска|зчеплення|стартер|генератор|акумулятор|комп'ютерна|діагностика/i;
  }

  /**
   * Розраховує фінансовий прогноз для конкретного авто
   * @param {Object} car - Об'єкт авто з історією та деталями
   * @param {Array} regulations - Регламенти ТО
   * @param {number} monthsAhead - Глибина прогнозу (за замовчуванням 6)
   * @returns {Object} Об'єкт з прогнозом
   */
  calculateCarForecast(car, regulations, monthsAhead = 6) {
    // 1. Розрахунок середньомісячних витрат (Base Cost) за останній рік
    // Аналог _getAvgMonthlyFromHistory з app.js
    const avgMonthlyBase = this.calculateAverageMonthlySpent(car.history);
    const baseOperationalExpense = avgMonthlyBase * monthsAhead;
    
    let scheduledMaintenanceExpense = 0;
    let predictiveWorkExpense = 0;
    const amm = this.calculateAMM(car);
    
    // 2. Розрахунок вартості запланованих та рекомендованих робіт
    for (const partName in car.parts) {
      const part = car.parts[partName];
      const regulation = CarProcessor.findRegulationForCar(car.license, car.model, car.year, partName, regulations);
      
      if (regulation && regulation.normalValue !== 'chain') {
        let triggersSoon = false;
        for (let m = 0; m < monthsAhead; m++) {
          if (this.checkRegulationTrigger(part, regulation, m, amm)) {
            triggersSoon = true;
            break;
          }
        }

        if (triggersSoon) {
          scheduledMaintenanceExpense += this.getEstimatedPartCost(partName, car.history);
        }
      }

      // Рекомендовані роботи на основі критичного стану
      if (part && (part.status === 'critical' || part.status === 'warning')) {
        predictiveWorkExpense += this.getEstimatedPartCost(partName, car.history);
      }
    }

    // 3. Загальний прогноз (Base + Maintenance) без інфляції та резерву (як у вкладці Витрати)
    const totalForecast = baseOperationalExpense + scheduledMaintenanceExpense + predictiveWorkExpense;

    return {
      averageMonthlyMileage: amm,
      baseOperationalExpense,
      scheduledMaintenanceExpense,
      predictiveWorkExpense,
      totalForecast,
    };
  }

  /**
   * Розраховує консолідований прогноз для всього автопарку
   * @param {Array} cars - Список автомобілів
   * @param {Array} regulations - Регламенти ТО
   * @returns {Object} Консолідований прогноз
   */
  calculateFleetForecast(cars, regulations) {
    const fleetForecast = {
      averageMonthlyMileage: 0,
      baseOperationalExpense: 0,
      scheduledMaintenanceExpense: 0,
      predictiveWorkExpense: 0,
      totalForecast: 0
    };

    cars.forEach(car => {
      const carForecast = this.calculateCarForecast(car, regulations);
      fleetForecast.averageMonthlyMileage += carForecast.averageMonthlyMileage;
      fleetForecast.baseOperationalExpense += carForecast.baseOperationalExpense;
      fleetForecast.scheduledMaintenanceExpense += carForecast.scheduledMaintenanceExpense;
      fleetForecast.predictiveWorkExpense += carForecast.predictiveWorkExpense;
      fleetForecast.totalForecast += carForecast.totalForecast;
    });

    return fleetForecast;
  }

  /**
   * Розраховує консолідований ПОМІСЯЧНИЙ прогноз для всього автопарку
   * @param {Array} cars - Список автомобілів
   * @param {Array} regulations - Регламенти ТО
   * @param {Number} monthsCount - Кількість місяців прогнозу
   * @returns {Array} Масив з сумами прогнозу на кожен місяць
   */
  calculateFleetMonthlyForecast(cars, regulations, monthsCount = 12) {
    const monthlyTotals = new Array(monthsCount).fill(0);
    
    cars.forEach(car => {
      const avgMonthlyBase = this.calculateAverageMonthlySpent(car.history);
      const amm = this.calculateAMM(car);
      
      for (let m = 0; m < monthsCount; m++) {
        // 1. Базові витрати (завжди однакові щомісяця)
        monthlyTotals[m] += avgMonthlyBase;
        
        // 2. Заплановані роботи (ТО)
        for (const partName in car.parts) {
          const part = car.parts[partName];
          const regulation = CarProcessor.findRegulationForCar(car.license, car.model, car.year, partName, regulations);
          
          if (regulation && regulation.normalValue !== 'chain') {
            // Перевіряємо, чи спрацьовує регламент САМЕ в цьому місяці m
            if (this.checkRegulationTrigger(part, regulation, m, amm)) {
              monthlyTotals[m] += this.getEstimatedPartCost(partName, car.history);
            }
          }
          
          // 3. Рекомендовані роботи (критичний стан) — відносимо до першого місяця прогнозу (це найтерміновіше)
          if (m === 0 && part && (part.status === 'critical' || part.status === 'warning')) {
            monthlyTotals[m] += this.getEstimatedPartCost(partName, car.history);
          }
        }
      }
    });
    
    return monthlyTotals;
  }

  /**
   * Розраховує середній пробіг (AMM) — ідентично до app.js getAverageMonthlyMileage
   */
  calculateAMM(car) {
    if (!car || !car.history || car.history.length < 2) return 1000;

    const now = new Date();
    const fiveAndHalfMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, now.getDate() - 15);

    const recentHistory = car.history.filter(record => {
      const recordDate = this.parseDate(record.isoDate || record.date);
      return recordDate && recordDate >= fiveAndHalfMonthsAgo;
    });

    if (recentHistory.length < 2) {
      const sortedHistory = [...car.history].sort((a, b) => {
        const dateA = this.parseDate(a.isoDate || a.date) || new Date(0);
        const dateB = this.parseDate(b.isoDate || b.date) || new Date(0);
        return dateA - dateB;
      });

      if (sortedHistory.length < 2) return 1000;

      const firstRecord = sortedHistory[0];
      const lastRecord = sortedHistory[sortedHistory.length - 1];
      const firstDate = this.parseDate(firstRecord.isoDate || firstRecord.date);
      const lastDate = this.parseDate(lastRecord.isoDate || lastRecord.date);

      if (!firstDate || !lastDate) return 1000;
      const workingDays = this.countWorkingDays(firstDate, lastDate);
      if (workingDays <= 0) return 1000;

      const mileageDiff = lastRecord.mileage - firstRecord.mileage;
      return Math.max(500, (mileageDiff / workingDays) * 26);
    }

    const sortedRecentHistory = [...recentHistory].sort((a, b) => {
      const dateA = this.parseDate(a.isoDate || a.date) || new Date(0);
      const dateB = this.parseDate(b.isoDate || b.date) || new Date(0);
      return dateA - dateB;
    });

    const firstRecord = sortedRecentHistory[0];
    const lastRecord = sortedRecentHistory[sortedRecentHistory.length - 1];
    const firstDate = this.parseDate(firstRecord.isoDate || firstRecord.date);
    const lastDate = this.parseDate(lastRecord.isoDate || lastRecord.date);
    const endDate = lastDate > now ? now : lastDate;

    if (!firstDate || !endDate) return 1000;
    const workingDays = this.countWorkingDays(firstDate, endDate);
    if (workingDays <= 0) return 1000;

    const mileageDiff = lastRecord.mileage - firstRecord.mileage;
    return Math.max(500, (mileageDiff / workingDays) * 26);
  }

  /**
   * Підраховує кількість робочих днів (Пн-Сб) — ідентично до app.js
   */
  countWorkingDays(startDate, endDate) {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    
    let workingDays = 0;
    const current = new Date(start);
    while (current <= end) {
      const day = current.getDay();
      if (day >= 1 && day <= 6) workingDays++;
      current.setDate(current.getDate() + 1);
    }
    return workingDays;
  }

  /**
   * Парсинг дати — ідентично до app.js
   */
  parseDate(dateStr) {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;
    if (typeof dateStr === 'string' && dateStr.includes('.')) {
      const parts = dateStr.split('.');
      if (parts.length === 3) {
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      }
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }

  /**
   * Розраховує середньомісячні витрати за останні 12 місяців (Аналог _getAvgMonthlyFromHistory)
   */
  calculateAverageMonthlySpent(history) {
    if (!history || history.length === 0) return 0;
    
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    
    let lastYearSpentSource = 0;
    const byMonth = {};

    history.forEach(record => {
      if (!record.totalWithVAT || record.totalWithVAT <= 0) return;
      if (record.status && String(record.status).trim().toLowerCase() === 'відмова') return;
      
      // Виключаємо ремонти та ТО, щоб вони не дублювались у прогнозі (бо ми їх додаємо окремо за станом)
      const isMaintenance = this.MAINTENANCE_KEYWORDS.test(record.description || '');
      if (isMaintenance) return;

      let recordDate = null;
      if (record.isoDate) {
        recordDate = new Date(record.isoDate);
      } else if (record.date) {
        if (typeof record.date === 'string' && record.date.includes('.')) {
          const parts = record.date.split('.');
          if (parts.length === 3) {
            recordDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
          }
        } else {
          recordDate = new Date(record.date);
        }
      }
      
      if (!recordDate || isNaN(recordDate.getTime())) return;
      
      // Сума за останній рік
      if (recordDate >= oneYearAgo) {
        lastYearSpentSource += record.totalWithVAT;
        
        try {
          const monthKey = recordDate.toISOString().substring(0, 7);
          byMonth[monthKey] = (byMonth[monthKey] || 0) + record.totalWithVAT;
        } catch (e) {
          const year = recordDate.getFullYear();
          const month = String(recordDate.getMonth() + 1).padStart(2, '0');
          const monthKey = `${year}-${month}`;
          byMonth[monthKey] = (byMonth[monthKey] || 0) + record.totalWithVAT;
        }
      }
    });

    const monthsWithData = Object.keys(byMonth).length;
    return monthsWithData > 0 ? lastYearSpentSource / monthsWithData : 0;
  }

  /**
   * Перевіряє, чи спрацює регламент у вказаному місяці
   */
  checkRegulationTrigger(part, regulation, month, amm) {
    if (!part) return false;
    
    if (regulation.periodType === 'пробіг') {
      const remainingKm = regulation.normalValue - (part.mileageDiff || 0);
      const monthsToService = remainingKm / amm;
      return Math.floor(monthsToService) === month;
    } else if (regulation.periodType === 'місяць') {
      const remainingMonths = regulation.normalValue - Math.floor((part.daysDiff || 0) / 30);
      return remainingMonths === month;
    }
    return false;
  }

  /**
   * Отримує оціночну вартість запчастини (синхронізовано з app.js)
   */
  getEstimatedPartCost(partName, history) {
    // 1. Пошук в історії (як в app.js getAverageCosts)
    if (history) {
      // Шукаємо записи що містять назву запчастини
      const pastRecords = history.filter(r => 
        r.totalWithVAT > 0 && 
        r.description && 
        r.description.toLowerCase().includes(partName.split(' ')[0].toLowerCase())
      );
      
      if (pastRecords.length > 0) {
        const sum = pastRecords.reduce((s, r) => s + r.totalWithVAT, 0);
        return sum / pastRecords.length;
      }
    }
    
    // 2. Пошук в базових вартостях
    const baseCost = this.basePartCosts[partName];
    if (baseCost) return baseCost;

    // Спроба знайти по ключовому слову
    for (const key in this.basePartCosts) {
      if (partName.toLowerCase().includes(key.split(' ')[0].toLowerCase())) {
        return this.basePartCosts[key];
      }
    }
    
    return 2000; // Fallback ідентично app.js
  }
}
