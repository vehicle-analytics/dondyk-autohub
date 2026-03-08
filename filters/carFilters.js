/**
 * Фільтрація автомобілів та історії
 */

class CarFilters {
  /**
   * Фільтрує список автомобілів
   */
  static filterCars(cars, state, calculateHealthScore, getHealthScoreLabel) {
    const {
      searchTerm,
      selectedCity,
      selectedStatus,
      selectedPartFilter,
      selectedHealthStatus,
      selectedModel,
    } = state;
    const term = searchTerm.toLowerCase();
    const isAllCities = selectedCity === "Всі міста";

    return cars.filter((car) => {
      // Smart search: matching all words in any order
      if (term) {
        const words = term.split(/\s+/).filter(w => w.length > 0);
        const carStr = [car.car, car.city, car.model, car.license]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const allWordsMatch = words.every(word => carStr.includes(word));
        if (!allWordsMatch) return false;
      }

      if (!isAllCities && car.city !== selectedCity) return false;

      if (selectedHealthStatus) {
        const healthScore = calculateHealthScore(car);
        const healthLabel = getHealthScoreLabel(healthScore, car);
        // Нормалізуємо значення для порівняння (видаляємо пробіли)
        const normalizedLabel = String(healthLabel || "").trim();
        const normalizedSelected = String(selectedHealthStatus || "").trim();
        // Порівнюємо нормалізовані значення
        if (normalizedLabel !== normalizedSelected) {
          return false;
        }
      }

      if (selectedModel) {
        const carBrand = car.model ? car.model.split(" ")[0] : "";
        if (carBrand !== selectedModel) return false;
      }

      if (selectedStatus !== "all") {
        const healthScore = calculateHealthScore(car);
        const healthLabel = getHealthScoreLabel(healthScore, car);

        if (selectedStatus === "good") {
          // Відмінний + Добрий = "У нормі"
          if (healthLabel !== "Відмінний" && healthLabel !== "Добрий")
            return false;
        } else if (selectedStatus === "warning") {
          // Задовільний = "Увага"
          if (healthLabel !== "Задовільний") return false;
        } else if (selectedStatus === "critical") {
          // Критичний = "Критично"
          if (healthLabel !== "Критичний") return false;
        }
      }

      if (selectedPartFilter) {
        const part = car.parts[selectedPartFilter.partName];
        if (selectedPartFilter.status === "all") {
          if (!part) return false;
        } else if (!part || part.status !== selectedPartFilter.status) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Фільтрує історію автомобіля (оптимізована версія)
   */
  static filterCarHistory(history, partFilter, searchTerm) {
    // Якщо немає фільтрів, повертаємо оригінальну історію
    if (!partFilter && (!searchTerm || !searchTerm.trim())) {
      return history;
    }

    let filtered = history;
    const searchTermLower = searchTerm ? searchTerm.toLowerCase().trim() : "";

    // Спочатку фільтруємо за partFilter (якщо є)
    if (partFilter) {
      const keywords = CONSTANTS.PARTS_CONFIG[partFilter];
      if (keywords && keywords.length > 0) {
        const keywordsLower = keywords.map((k) => k.toLowerCase());
        const simpleKeywords = [];
        const complexKeywords = [];

        // Розділяємо ключові слова на прості (одне слово) та складні (кілька слів)
        for (const keyword of keywordsLower) {
          const words = keyword.split(/\s+/).filter((w) => w.length > 0);
          if (words.length === 1) {
            simpleKeywords.push(keyword);
          } else {
            complexKeywords.push(keyword);
          }
        }

        filtered = filtered.filter((record) => {
          const descLower = record.description.toLowerCase();

          // Спочатку швидка перевірка простих ключових слів
          for (const keyword of simpleKeywords) {
            if (descLower.includes(keyword)) return true;
          }

          // Потім перевірка складних ключових слів (спочатку простий includes)
          for (const keyword of complexKeywords) {
            // Швидка перевірка - чи містить опис всі слова з ключового слова
            const words = keyword.split(/\s+/);
            const allWordsPresent = words.every((word) =>
              descLower.includes(word),
            );

            if (allWordsPresent) {
              // Якщо всі слова присутні, перевіряємо точний порядок
              if (descLower.includes(keyword)) {
                return true;
              }

              // Якщо порядок інший, використовуємо гнучкі патерни (тільки якщо потрібно)
              if (typeof window.createFlexiblePatterns === "function") {
                const flexiblePatterns = window.createFlexiblePatterns(keyword);
                for (const pattern of flexiblePatterns) {
                  if (pattern.test(descLower)) return true;
                }
              }
            }
          }

          return false;
        });
      }
    }

    // Потім фільтруємо за searchTerm (якщо є)
    if (searchTermLower) {
      const words = searchTermLower.split(/\s+/).filter(w => w.length > 0);

      filtered = filtered.filter((record) => {
        const recordStr = [
          record.description || "",
          record.date || "",
          record.mileage ? record.mileage.toString() : "",
          record.partCode || "",
          record.unit || "",
          record.status || ""
        ].join(" ").toLowerCase();

        // Return true only if ALL words are found in the record string
        return words.every(word => recordStr.includes(word));
      });
    }
    return filtered;
  }
}

// Експортуємо для використання
window.CarFilters = CarFilters;
