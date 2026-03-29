/**
 * Утиліти для форматування та парсингу даних
 */

export class Formatters {
  /**
   * Парсить число з різних форматів
   */
  static parseNumber(value) {
    if (value === null || value === undefined || value === "") {
      return 0;
    }

    if (typeof value === "number") {
      return isNaN(value) ? 0 : value;
    }

    const cleanStr = String(value)
      .trim()
      .replace(/\s+/g, "")
      .replace(/,/g, ".");

    if (cleanStr.toLowerCase() === "ланцюг") {
      return "chain";
    }

    const parsed = parseFloat(cleanStr);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Конвертує значення в тисячі (якщо потрібно)
   */
  static convertToThousands(value) {
    if (value === null || value === undefined || isNaN(value)) {
      return 0;
    }
    return value;
  }

  /**
   * Форматує число з пробілами для тисяч
   */
  static formatNumber(number) {
    if (number === null || number === undefined || isNaN(number)) {
      return "-";
    }
    const roundedNumber = Math.round(number);
    return roundedNumber.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }

  /**
   * Форматує пробіг
   */
  static formatMileage(mileage) {
    if (mileage === null || mileage === undefined || isNaN(mileage)) {
      return "- км";
    }
    const convertedMileage = Formatters.convertToThousands(mileage);
    const formatted = Formatters.formatNumber(convertedMileage);
    return `${formatted} км`;
  }

  /**
   * Отримує оригінальний пробіг
   */
  static getOriginalMileage(mileage) {
    if (mileage === null || mileage === undefined || isNaN(mileage)) {
      return 0;
    }
    return Formatters.convertToThousands(mileage);
  }

  /**
   * Форматує різницю пробігу
   */
  static formatMileageDiff(mileageDiff) {
    if (
      mileageDiff === null ||
      mileageDiff === undefined ||
      isNaN(mileageDiff)
    ) {
      return "- км";
    }
    const formatted = Formatters.formatNumber(mileageDiff);
    return `${formatted} км`;
  }

  /**
   * Форматує ціну
   */
  static formatPrice(price) {
    if (price === null || price === undefined || isNaN(price) || price === 0) {
      return "";
    }

    const rounded = Math.round(price * 100) / 100;
    const parts = rounded.toFixed(2).split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");

    return parts.join(".");
  }

  /**
   * Форматує дату в формат DD.MM.YYYY
   */
  static formatDate(dateString) {
    if (!dateString) return "";

    // Якщо це вже Date об'єкт, форматуємо безпосередньо
    if (dateString instanceof Date) {
      if (!isNaN(dateString.getTime())) {
        const day = String(dateString.getDate()).padStart(2, "0");
        const month = String(dateString.getMonth() + 1).padStart(2, "0");
        const year = dateString.getFullYear();
        return `${day}.${month}.${year}`;
      }
      return "";
    }

    // Спочатку намагаємося розпарсити дату через parseDate для правильного розпізнавання формату
    const parsedDate = Formatters.parseDate(dateString);
    if (parsedDate) {
      const day = String(parsedDate.getDate()).padStart(2, "0");
      const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
      const year = parsedDate.getFullYear();
      return `${day}.${month}.${year}`;
    }

    // Якщо parseDate не спрацював, спробуємо стандартний Date парсер
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      return `${day}.${month}.${year}`;
    }

    return String(dateString);
  }

  /**
   * Парсить дату з різних форматів
   */
  static parseDate(dateString) {
    if (dateString === null || dateString === undefined || dateString === "") return null;

    // Якщо це вже є об'єктом Date
    if (dateString instanceof Date) {
      return isNaN(dateString.getTime()) ? null : dateString;
    }

    // Якщо це число (серійний номер дати в Excel/Sheets)
    if (typeof dateString === "number" || (!isNaN(dateString) && !isNaN(parseFloat(dateString)) && !String(dateString).includes("."))) {
      const serial = parseFloat(dateString);
      // Базова дата для Excel/Sheets: 30 грудня 1899 року (це 0 в серійному форматі)
      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(excelEpoch.getTime() + serial * 86400000);
      if (!isNaN(date.getTime())) return date;
    }

    const str = String(dateString).trim();

    // Спробуємо парсити DD.MM.YYYY або MM.DD.YYYY формат
    const dotParts = str.split(".");
    if (dotParts.length === 3) {
      const first = parseInt(dotParts[0], 10);
      const second = parseInt(dotParts[1], 10);
      const third = parseInt(dotParts[2], 10);

      if (!isNaN(first) && !isNaN(second) && !isNaN(third) && third > 0) {
        let day, month, year;

        // Покращена логіка розпізнавання:
        // DD.MM.YYYY - день може бути більше 12
        // MM.DD.YYYY - місяць не може бути більше 12
        if (first > 12) {
          day = first; month = second; year = third;
        } else if (second > 12) {
          month = first; day = second; year = third;
        } else {
          // За замовчуванням DD.MM.YYYY (Україна)
          day = first; month = second; year = third;
        }

        const date = new Date(year, month - 1, day);
        if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
          return date;
        }
      }
    }

    // Спробуємо парсити YYYY-MM-DD або DD-MM-YYYY
    const dashParts = str.split("-");
    if (dashParts.length === 3) {
      let year, month, day;
      if (dashParts[0].length === 4) {
        year = parseInt(dashParts[0], 10);
        month = parseInt(dashParts[1], 10);
        day = parseInt(dashParts[2], 10);
      } else {
        day = parseInt(dashParts[0], 10);
        month = parseInt(dashParts[1], 10);
        year = parseInt(dashParts[2], 10);
      }
      
      const date = new Date(year, month - 1, day);
      if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
        return date;
      }
    }

    try {
      const date = new Date(str);
      if (!isNaN(date.getTime())) return date;
    } catch (e) {}

    return null;
  }
}
