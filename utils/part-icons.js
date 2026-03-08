/**
 * 🎨 Модуль іконок для запчастин
 * Замінює емодзі на професійні SVG іконки
 */

class PartIcons {
  constructor() {
    // Мапа емодзі до SVG іконок
    this.iconMap = {
      "🛢️": this.getOilIcon(),
      "⚙️": this.getGearIcon(),
      "💧": this.getWaterIcon(),
      "🔧": this.getWrenchIcon(),
      "💻": this.getComputerIcon(),
      "🕯️": this.getSparkIcon(),
      "🔍": this.getSearchIcon(),
      "🔥": this.getFireIcon(),
      "💿": this.getDiscIcon(),
      "🛑": this.getBrakeIcon(),
      "🔋": this.getBatteryIcon(),
      "⚡": this.getElectricIcon(),
      "📐": this.getRulerIcon(),
      "🛠️": this.getToolIcon(),
      "⚪": this.getCircleIcon(),
      "🔗": this.getLinkIcon(),
      "🔩": this.getBoltIcon(),
      "🚐": this.getVanIcon(),
    };
  }

  /**
   * Отримує SVG іконку за емодзі
   * @param {string} emoji - Емодзі для заміни
   * @param {string} className - Додаткові CSS класи
   * @param {number} size - Розмір іконки (за замовчуванням 24)
   * @returns {string} HTML з SVG іконкою
   */
  getIcon(emoji, className = "", size = 24) {
    const iconSvg = this.iconMap[emoji];
    if (!iconSvg) return emoji; // Якщо іконки немає, повертаємо емодзі

    return `<svg class="part-icon ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: inline-block; vertical-align: middle;">
            ${iconSvg}
        </svg>`;
  }

  /**
   * Замінює емодзі в тексті на іконки
   * @param {string} text - Текст з емодзі
   * @param {number} size - Розмір іконок
   * @returns {string} Текст з SVG іконками
   */
  replaceEmojis(text, size = 24) {
    if (!text) return text;

    let result = text;
    for (const [emoji, svg] of Object.entries(this.iconMap)) {
      if (result.includes(emoji)) {
        result = result.replace(
          new RegExp(emoji.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
          `<svg class="part-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: inline-block; vertical-align: middle;">${svg}</svg>`,
        );
      }
    }
    return result;
  }

  /**
   * Отримує іконку за назвою запчастини
   * @param {string} partName - Назва запчастини
   * @param {number} size - Розмір іконки
   * @returns {string} HTML з SVG іконкою
   */
  getIconByPartName(partName, size = 24) {
    if (!partName) return "";

    // Визначаємо емодзі за назвою
    if (partName.includes("ТО") || partName.includes("масло"))
      return this.getIcon("🛢️", "", size);
    if (partName.includes("ГРМ")) return this.getIcon("⚙️", "", size);
    if (partName.includes("Помпа")) return this.getIcon("💧", "", size);
    if (partName.includes("Обвідний") || partName.includes("ремінь"))
      return this.getIcon("🔧", "", size);
    if (partName.includes("Комп") || partName.includes("діагностика"))
      return this.getIcon("💻", "", size);
    if (partName.includes("Свічки")) return this.getIcon("🕯️", "", size);
    if (partName.includes("Діагностика ходової"))
      return this.getIcon("🔍", "", size);
    if (partName.includes("Прожиг")) return this.getIcon("🔥", "", size);
    if (partName.includes("диск")) return this.getIcon("💿", "", size);
    if (partName.includes("колодк")) return this.getIcon("🛑", "", size);
    if (partName.includes("Акумулятор") || partName.includes("Стартер"))
      return this.getIcon("🔋", "", size);
    if (partName.includes("Генератор")) return this.getIcon("⚡", "", size);
    if (partName.includes("Розвал")) return this.getIcon("📐", "", size);
    if (partName.includes("Профілактика") || partName.includes("супорт"))
      return this.getIcon("🛠️", "", size);
    if (partName.includes("Шарова")) return this.getIcon("⚪", "", size);
    if (partName.includes("Рульова") || partName.includes("тяга"))
      return this.getIcon("🔗", "", size);
    if (partName.includes("накінечник")) return this.getIcon("🔩", "", size);
    if (partName.includes("Зчеплення")) return this.getIcon("⚙️", "", size);

    return this.getIcon("⚙️", "", size); // За замовчуванням
  }

  // SVG іконки (Heroicons style)
  getOilIcon() {
    return `<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4m0 4h.01" />`;
  }

  getGearIcon() {
    return `<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />`;
  }

  getWaterIcon() {
    return `<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />`;
  }

  getWrenchIcon() {
    return `<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />`;
  }

  getComputerIcon() {
    return `<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />`;
  }

  getSparkIcon() {
    return `<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />`;
  }

  getSearchIcon() {
    return `<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />`;
  }

  getFireIcon() {
    return `<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />`;
  }

  getDiscIcon() {
    return `<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" />
                <circle cx="12" cy="12" r="6" stroke="currentColor" stroke-width="1.5" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />`;
  }

  getBrakeIcon() {
    return `<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />`;
  }

  getBatteryIcon() {
    return `<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />`;
  }

  getElectricIcon() {
    return `<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />`;
  }

  getRulerIcon() {
    return `<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />`;
  }

  getToolIcon() {
    return `<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />`;
  }

  getCircleIcon() {
    return `<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" />
                <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" />`;
  }

  getLinkIcon() {
    return `<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />`;
  }

  getBoltIcon() {
    return `<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />`;
  }

  getVanIcon() {
    return `<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />`;
  }
}

// Експортуємо для використання
window.PartIcons = PartIcons;
// Part icons module loaded
