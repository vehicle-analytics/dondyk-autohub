// expense-categories.js
// Конфігурація категорій витрат для аналітичної панелі авто

export const EXPENSE_CATEGORIES = {
  "ТО та обслуговування": [
    /масл\w*/i,
    /фільтр\w*/i,
    /олив\w*/i,
    /то\b/i,
    /технічне\s*обслуговування/i,
    /техогляд/i,
    /сервісн/i,
    /заміна\s*масла/i,
    /техобслуговування/i,
    /сервіс/i,
    /обслуговування/i,
    /технічний/i,

    // Система ГРМ (перенесено з окремої категорії)
    /грм\b/i,
    /ремін\w*/i,
    /ролик\w*/i,
    /помп\w*/i,
    /ремень/i,
    /грм.*рем/i,
    /ролик.*грм/i,
    /помпа.*грм/i,
    /timing\s*belt/i,
    /ремень\s*грм/i,
    /ремкомплект\s*грм/i,
    /ремень.*распред/i,
  ],

  "Гальмівна система": [
    /гальм\w*/i,
    /колодк\w*/i,
    /тормоз/i,
    /супорт/i,
    /циліндр\s*гальм/i,
    /тормозн/i,
    /гальмівка/i,
    /направляюч/i,
    /ремкомлект\s*суп/i,
    /гальмівний/i,
    /стоп/i,
    /brake/i,
    /тормозной/i,
    /тормозка/i,
    // Складні фрази з варіаціями порядку слів
    /гальмівн.*диск.*перед/i,
    /диск.*гальмівн.*перед/i,
    /гальмівн.*диск.*передн/i,
    /диск.*гальмівн.*передн/i,
    /гальм.*диск.*перед/i,
    /диск.*гальм.*перед/i,
    /гальмівн.*диск.*зад/i,
    /диск.*гальмівн.*зад/i,
    /гальмівн.*диск.*задн/i,
    /диск.*гальмівн.*задн/i,
    /гальм.*диск.*зад/i,
    /диск.*гальм.*зад/i,
    /гальмівн.*колодк.*перед/i,
    /колодк.*гальмівн.*перед/i,
    /гальмівн.*колодк.*передн/i,
    /колодк.*гальмівн.*передн/i,
    /гальм.*колодк.*перед/i,
    /колодк.*гальм.*перед/i,
    /гальмівн.*колодк.*зад/i,
    /колодк.*гальмівн.*зад/i,
    /гальмівн.*колодк.*задн/i,
    /колодк.*гальмівн.*задн/i,
    /гальм.*колодк.*зад/i,
    /колодк.*гальм.*зад/i,
  ],

  "Ходова частина": [
    /амортизатор\w*/i,
    /підвіск\w*/i,
    /подвеск\w*/i,
    /ходов\w*/i,
    /пружин\w*/i,
    /стойк\w*/i,
    /сайлентблок/i,
    /шаров\w*/i,
    /рульов\w*/i,
    /руль\w*/i,
    /тяг\w*/i,
    /наконечник/i,
    /опор\w*/i,
    /важіл/i,
    /підвіс/i,
    /стабіліз/i,
    /втулк\w*/i,
    /підшипник/i,
    /підвіска/i,

    // Шини та диски
    /шин\w*/i,
    /колес\w*/i,
    /покришк\w*/i,
    /диск\s*колес/i,
    /шиномонтаж/i,
    /колесо/i,
    /шина/i,
    /покришка/i,
    /шип/i,
    /литий/i,
    /штамп/i,
    /колесный/i,
    /диск.*колес/i,
    /покрышка/i,
    /колеса/i,

    // Діагностика та геометрія
    /диагност\w*/i,
    /розвал/i,
    /сходження/i,
    /баланс\w*/i,
    /геометрія\w*/i,
    /развал/i,
    /діагностика/i,
    /сходження/i,
    /геометрия/i,
    /диагностика/i,
    /хідова\s*діагностика/i,
    /діагностика\s*ходової/i,
    /діагностика.*підвіск/i,
    /diagnostic/i,
  ],

  Двигун: [
    /двигун\w*/i,
    /мотор\w*/i,
    /колінвал\w*/i,
    /коленв\w*/i,
    /поршн\w*/i,
    /клапан\w*/i,
    /циліндр\w*/i,
    /головк\w*\s*блок/i,
    /гбц/i,
    /распредвал/i,
    /распред/i,
    /шатун/i,
    /розподільч/i,
    /\bвал\b/i,
    /двигуна/i,
    /engine/i,
    /мотор/i,
    /двигатель/i,
    /коленвал/i,
    /распределительный/i,
  ],

  Електрика: [
    /акб\b/i,
    /акумулятор\w*/i,
    /стартер\w*/i,
    /генератор\w*/i,
    /електрик/i,
    /провод\w*/i,
    /реле/i,
    /блок\s*керування/i,
    /бку/i,
    /датчик\w*/i,
    /свічк\w*/i,
    /запалювання/i,
    /катушк/i,
    /модуль/i,
    /комутатор/i,
    /ебу/i,
    /прошив/i,
    /комп\b/i,
    /програм/i,
    /електро/i,
    /проводка/i,
    /электрика/i,
    /зажигание/i,
  ],

  Трансмісія: [
    /коробк/i,
    /кпп/i,
    /трансміс/i,
    /зчеплення/i,
    /сцеплен/i,
    /диференціал/i,
    /привід/i,
    /шарнір/i,
    /кардан/i,
    /редуктор/i,
    /раздаточ/i,
    /муфт/i,
    /трансмиссия/i,
    /коробка/i,
    /передач/i,
    /трансмиссия/i,
    /сцепление/i,
    /трансмиссия/i,
  ],

  "Кузов та салон": [
    /кузов/i,
    /фар\w*/i,
    /дзеркал/i,
    /скло/i,
    /вітрове/i,
    /сидіння/i,
    /оббивк/i,
    /кондиціонер/i,
    /опалення/i,
    /печка/i,
    /обігрів/i,
    /люк/i,
    /двер/i,
    /капот/i,
    /багажник/i,
    /бампер/i,
    /салон/i,
    /кузовной/i,
    /дверь/i,
    /зеркало/i,
    /фары/i,
    /стекло/i,
    /лобовое/i,
  ],

  "Система вихлопу": [
    /глушін/i,
    /вихлоп/i,
    /глушитель/i,
    /выхлоп/i,
    /катализатор/i,
    /сажевий/i,
    /саж\w*/i,
    /прожиг/i,
    /сажевый/i,
    /выпуск/i,
    /глушилка/i,
    /сажевик/i,
  ],

  "Витратні матеріали": [
    /очисник/i,
    /пральн/i,
    /антифриз/i,
    /тосол/i,
    /омівка/i,
    /склоомів/i,
    /рідин/i,
    /мастил/i,
    /спрей/i,
    /герметик/i,
    /клей/i,
    /паста/i,
    /смазк/i,
    /порошок/i,
    /жидкость/i,
    /очиститель/i,
    /промывка/i,
    /смазка/i,
    /герметик/i,
  ],

  "Мийка авто": [
    /мийка/i,
    /мойка/i,
    /полірування/i,
    /поліровка/i,
    /чистка/i,
    /мойки/i,
    /мийки/i,
    /полировка/i,
    /мойщик/i,
    /мойщица/i,
  ],

  "Інші витрати": [
    // Ця категорія залишається порожньою - це fallback категорія
    // для записів, які не підходять під жодну з інших категорій
  ],
};



// Словник варіацій форм слів для покращення пошуку
export const WORD_VARIATIONS = {
  // Гальмівна система
  гальмівний: [
    "гальмівний",
    "гальм",
    "гальмівна",
    "гальмівне",
    "гальмівні",
    "гальмівка",
  ],
  гальм: [
    "гальм",
    "гальмівний",
    "гальмівна",
    "гальмівне",
    "гальмівні",
    "гальмівка",
  ],
  перед: ["перед", "передній", "передня", "переднє", "передні"],
  передній: ["передній", "перед", "передня", "переднє", "передні"],
  зад: ["зад", "задній", "задня", "заднє", "задні"],
  задній: ["задній", "зад", "задня", "заднє", "задні"],
  диск: ["диск", "диски", "дисків"],
  колодка: ["колодка", "колодки", "колодок"],
  колодки: ["колодки", "колодка", "колодок"],
  супорт: ["супорт", "супорти", "супортів"],
  тормоз: ["тормоз", "тормозной", "тормозка", "тормозн", "тормозной"],
  тормозной: ["тормозной", "тормоз", "тормозка", "тормозн"],

  // ТО та обслуговування
  фільтр: ["фільтр", "фільтри", "фільтрів"],
  фільтри: ["фільтри", "фільтр", "фільтрів"],
  масло: ["масло", "мастило", "олива", "масел"],
  мастило: ["мастило", "масло", "олива", "масел"],
  олива: ["олива", "масло", "мастило"],
  ремінь: ["ремінь", "ремень", "ремні", "ремнів"],
  ремень: ["ремень", "ремінь", "ремні", "ремнів"],
  ролик: ["ролик", "ролики", "роликів"],
  ролики: ["ролики", "ролик", "роликів"],
  помпа: ["помпа", "помпи", "помп"],
  грм: ["грм", "газорозподільний", "газорозподіл"],
  обслуговування: ["обслуговування", "обслуга", "сервіс"],
  сервіс: ["сервіс", "обслуговування", "обслуга"],
  технічний: ["технічний", "технічна", "технічне", "технічні"],

  // Ходова частина
  амортизатор: ["амортизатор", "амортизатори", "аморт", "амортизаторів"],
  аморт: ["аморт", "амортизатор", "амортизатори", "амортизаторів"],
  ходова: ["ходова", "ходов", "ходової", "ходовою"],
  ходов: ["ходов", "ходова", "ходової", "ходовою"],
  підвіска: ["підвіска", "підвіск", "підвіски", "підвісок"],
  підвіск: ["підвіск", "підвіска", "підвіски", "підвісок"],
  діагностика: ["діагностика", "диагност", "діагностики", "диагностика"],
  диагност: ["диагност", "діагностика", "діагностики", "диагностика"],
  шина: ["шина", "шини", "шин", "покришка", "покришки"],
  покришка: ["покришка", "покришки", "шина", "шини", "шин"],
  колесо: ["колесо", "колеса", "коліс"],
  колеса: ["колеса", "колесо", "коліс"],
  пружина: ["пружина", "пружини", "пружин"],
  стойка: ["стойка", "стойки", "стоек"],
  сайлентблок: ["сайлентблок", "сайлентблоки", "сайлентблоків"],
  шарова: ["шарова", "шаров", "шарової"],
  рульова: ["рульова", "рульов", "рульової"],
  тяга: ["тяга", "тяги", "тяг"],
  наконечник: ["наконечник", "наконечники", "наконечників"],
  опора: ["опора", "опори", "опор"],
  стабілізатор: ["стабілізатор", "стабілізатори", "стабілізаторів"],
  втулка: ["втулка", "втулки", "втулок"],
  підшипник: ["підшипник", "підшипники", "підшипників"],
  розвал: ["розвал", "развал"],
  сходження: ["сходження", "схождение"],
  баланс: ["баланс", "балансування"],
  геометрія: ["геометрія", "геометрия"],

  // Двигун
  двигун: ["двигун", "двигуни", "двигунів", "мотор"],
  мотор: ["мотор", "двигун", "двигуни"],
  колінвал: ["колінвал", "коленвал", "колінвальний"],
  коленвал: ["коленвал", "колінвал", "колінвальний"],
  поршень: ["поршень", "поршні", "поршнів"],
  клапан: ["клапан", "клапани", "клапанів"],
  циліндр: ["циліндр", "циліндри", "циліндрів"],
  головка: ["головка", "головки", "головок"],
  распредвал: ["распредвал", "розподільний", "розподільч"],
  шатун: ["шатун", "шатуни", "шатунів"],
  вал: ["вал", "вали", "валів"],

  // Електрика
  акумулятор: ["акумулятор", "акумулятори", "акумуляторів", "акб"],
  акб: ["акб", "акумулятор", "акумулятори"],
  стартер: ["стартер", "стартери", "стартерів"],
  генератор: ["генератор", "генератори", "генераторів"],
  свічка: ["свічка", "свічки", "свічок", "запалювання"],
  свічки: ["свічки", "свічка", "свічок", "запалювання"],
  запалювання: ["запалювання", "свічка", "свічки", "свічок"],
  датчик: ["датчик", "датчики", "датчиків"],
  катушка: ["катушка", "катушки", "катушок"],
  модуль: ["модуль", "модулі", "модулів"],
  провод: ["провод", "проводи", "проводів", "проводка"],
  реле: ["реле", "реле"],
  блок: ["блок", "блоки", "блоків"],
  електрика: ["електрика", "електрик", "електро"],

  // Трансмісія
  коробка: ["коробка", "коробки", "коробок", "кпп"],
  кпп: ["кпп", "коробка", "коробки"],
  трансмісія: ["трансмісія", "трансмиссия", "трансміс"],
  зчеплення: ["зчеплення", "сцепление", "сцеплен"],
  диференціал: ["диференціал", "дифференциал"],
  привід: ["привід", "приводи", "приводів"],
  шарнір: ["шарнір", "шарниры", "шарнірів"],
  кардан: ["кардан", "кардани", "карданів"],
  редуктор: ["редуктор", "редуктори", "редукторів"],
  муфта: ["муфта", "муфти", "муфт"],
  передача: ["передача", "передачі", "передач"],

  // Кузов та салон
  кузов: ["кузов", "кузови", "кузовів"],
  фара: ["фара", "фари", "фар"],
  дзеркало: ["дзеркало", "дзеркала", "зеркало"],
  скло: ["скло", "скла", "стекло"],
  вітрове: ["вітрове", "лобовое", "вітрового"],
  сидіння: ["сидіння", "сиденья", "сидінь"],
  кондиціонер: ["кондиціонер", "кондиціонери", "кондиціонерів"],
  опалення: ["опалення", "обігрів", "печка"],
  печка: ["печка", "опалення", "обігрів"],
  обігрів: ["обігрів", "опалення", "печка"],
  двері: ["двері", "дверь", "дверей"],
  капот: ["капот", "капоти", "капотів"],
  багажник: ["багажник", "багажники", "багажників"],
  бампер: ["бампер", "бампери", "бамперів"],
  салон: ["салон", "салони", "салонів"],

  // Система вихлопу
  глушитель: ["глушитель", "глушін", "глушители"],
  глушін: ["глушін", "глушитель", "глушители"],
  вихлоп: ["вихлоп", "выхлоп", "вихлопна"],
  катализатор: ["катализатор", "каталізатор", "катализатори"],
  сажевий: ["сажевий", "сажевый", "саж", "сажевик"],
  саж: ["саж", "сажевий", "сажевый", "сажевик"],

  // Витратні матеріали
  антифриз: ["антифриз", "антифризи", "антифризів"],
  тосол: ["тосол", "тосолы", "тосолів"],
  рідина: ["рідина", "жидкость", "рідини"],
  смазка: ["смазка", "смазки", "смазок", "мастило"],
  герметик: ["герметик", "герметики", "герметиків"],
  клей: ["клей", "клеї", "клеїв"],
  паста: ["паста", "пасти", "паст"],

  // Мийка авто
  мийка: ["мийка", "мойка", "мийки", "мойки"],
  мойка: ["мойка", "мийка", "мийки", "мойки"],
  полірування: ["полірування", "полировка", "поліровка"],
  поліровка: ["поліровка", "полірування", "полировка"],
  чистка: ["чистка", "чистки", "чисток"],
};

// Функція для отримання варіацій слова
export function getWordVariations(word) {
  const lowerWord = word.toLowerCase().trim();

  // Перевіряємо точний збіг
  if (WORD_VARIATIONS[lowerWord]) {
    return WORD_VARIATIONS[lowerWord];
  }

  // Перевіряємо частковий збіг (якщо слово містить ключ або ключ містить слово)
  for (const [key, variations] of Object.entries(WORD_VARIATIONS)) {
    if (lowerWord.includes(key) || key.includes(lowerWord)) {
      return variations;
    }
  }

  // Автоматична генерація варіацій для слів, яких немає в словнику
  const autoVariations = [lowerWord];

  // Додаємо варіації з різними закінченнями для українських слів
  if (lowerWord.length > 3) {
    // Прикметники: -ий/-а/-е/-і
    if (lowerWord.endsWith("ий")) {
      const base = lowerWord.slice(0, -2);
      autoVariations.push(
        base + "а",
        base + "е",
        base + "і",
        base + "ого",
        base + "ому",
      );
    }
    if (lowerWord.endsWith("а")) {
      const base = lowerWord.slice(0, -1);
      autoVariations.push(
        base + "ий",
        base + "е",
        base + "і",
        base + "ої",
        base + "ій",
      );
    }
    if (lowerWord.endsWith("е")) {
      const base = lowerWord.slice(0, -1);
      autoVariations.push(
        base + "ий",
        base + "а",
        base + "і",
        base + "ого",
        base + "ому",
      );
    }

    // Іменники: однина/множина
    if (lowerWord.endsWith("а")) {
      autoVariations.push(
        lowerWord.slice(0, -1) + "и",
        lowerWord.slice(0, -1) + "ок",
      );
    }
    if (lowerWord.endsWith("о")) {
      autoVariations.push(
        lowerWord.slice(0, -1) + "а",
        lowerWord.slice(0, -1) + "ок",
      );
    }
    if (lowerWord.endsWith("я")) {
      autoVariations.push(
        lowerWord.slice(0, -1) + "і",
        lowerWord.slice(0, -1) + "ь",
      );
    }

    // Скорочення: прибираємо закінчення для пошуку основи
    if (lowerWord.length > 5) {
      const shortBase = lowerWord.slice(0, -2);
      if (shortBase.length > 3) {
        autoVariations.push(shortBase);
      }
    }
  }

  return autoVariations;
}

// Функція для генерації всіх перестановок масиву
export function generatePermutations(arr) {
  if (arr.length <= 1) return [arr];
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    const perms = generatePermutations(rest);
    for (const perm of perms) {
      result.push([arr[i], ...perm]);
    }
  }
  return result;
}

// Функція для генерації всіх комбінацій варіацій слів (оптимізована версія)
export function generateWordCombinations(words) {
  // Обмежуємо кількість слів для уникнення експоненційного зростання
  if (words.length > 4) {
    // Для довгих фраз використовуємо тільки основні варіації
    return [words.join(" ")];
  }

  const variations = words.map((word) => getWordVariations(word));

  // Обмежуємо кількість варіацій на слово
  const limitedVariations = variations.map((vars) => vars.slice(0, 3));

  // Генеруємо всі комбінації варіацій
  function cartesianProduct(arrays) {
    if (arrays.length === 0) return [[]];
    const result = [];
    const first = arrays[0];
    const rest = cartesianProduct(arrays.slice(1));
    for (const item of first) {
      for (const combo of rest) {
        result.push([item, ...combo]);
      }
    }
    return result;
  }

  const allCombinations = cartesianProduct(limitedVariations);
  const allPermutations = new Set();

  // Обмежуємо кількість перестановок
  const maxPermutations = 20;
  let permutationCount = 0;

  // Для кожної комбінації генеруємо перестановки (обмежено)
  for (const combo of allCombinations) {
    if (permutationCount >= maxPermutations) break;

    // Для 2-3 слів генеруємо всі перестановки, для більше - тільки основні
    if (combo.length <= 3) {
      const perms = generatePermutations(combo);
      for (const perm of perms) {
        if (permutationCount >= maxPermutations) break;
        allPermutations.add(perm.join(" "));
        permutationCount++;
      }
    } else {
      // Для довгих фраз додаємо тільки оригінальний порядок та один зворотний
      allPermutations.add(combo.join(" "));
      allPermutations.add([...combo].reverse().join(" "));
      permutationCount += 2;
    }
  }

  return Array.from(allPermutations);
}

// Функція для створення регулярних виразів з варіацій ключових слів (оптимізована версія)
export function createFlexiblePatterns(keywordPhrase) {
  if (!keywordPhrase || typeof keywordPhrase !== "string") {
    return [];
  }

  const words = keywordPhrase
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  if (words.length === 0) return [];

  // Обмежуємо кількість патернів для швидкості
  const MAX_PATTERNS = 15;
  const patterns = [];
  const patternsSet = new Set(); // Для уникнення дублікатів

  // Спочатку додаємо простий патерн для оригінальної фрази з варіаціями
  const originalPattern = words
    .map((w) => {
      const variations = getWordVariations(w);
      // Обмежуємо кількість варіацій
      const limitedVariations = variations.slice(0, 3);
      return `(?:${limitedVariations.map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`;
    })
    .join(".*?");

  const originalKey = originalPattern.toLowerCase();
  if (!patternsSet.has(originalKey)) {
    patterns.push(new RegExp(originalPattern, "i"));
    patternsSet.add(originalKey);
  }

  // Генеруємо комбінації та перестановки (обмежено)
  if (words.length <= 4 && patterns.length < MAX_PATTERNS) {
    const combinations = generateWordCombinations(words);

    for (const combo of combinations) {
      if (patterns.length >= MAX_PATTERNS) break;

      // Створюємо патерн, який дозволяє будь-які символи між словами
      const patternStr = combo
        .split(" ")
        .map((word) => {
          // Екрануємо спеціальні символи
          return word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        })
        .join(".*?");

      const patternKey = patternStr.toLowerCase();
      if (!patternsSet.has(patternKey)) {
        patterns.push(new RegExp(patternStr, "i"));
        patternsSet.add(patternKey);
      }
    }
  }

  return patterns;
}

// Кеш для патернів (щоб не генерувати їх повторно)
const patternsCache = new Map();

// Зберігаємо оригінальну функцію перед створенням кешованої версії
const createFlexiblePatternsOriginal = createFlexiblePatterns;

// Оптимізована версія з кешуванням
export function createFlexiblePatternsCached(keywordPhrase) {
  if (!keywordPhrase || typeof keywordPhrase !== "string") {
    return [];
  }

  // Захист від рекурсії - перевіряємо, чи не обробляємо вже цей ключ
  if (!createFlexiblePatternsCached._processing) {
    createFlexiblePatternsCached._processing = new Set();
  }

  const cacheKey = keywordPhrase.toLowerCase().trim();

  // Якщо вже обробляємо цей ключ, повертаємо порожній масив, щоб уникнути рекурсії
  if (createFlexiblePatternsCached._processing.has(cacheKey)) {
    console.warn(
      "⚠️ Рекурсивний виклик createFlexiblePatternsCached для:",
      cacheKey,
    );
    return [];
  }

  // Перевіряємо кеш
  if (patternsCache.has(cacheKey)) {
    return patternsCache.get(cacheKey);
  }

  // Позначаємо, що обробляємо цей ключ
  createFlexiblePatternsCached._processing.add(cacheKey);

  try {
    // Використовуємо оригінальну функцію, а не кешовану версію
    const patterns = createFlexiblePatternsOriginal(keywordPhrase);
    patternsCache.set(cacheKey, patterns);
    return patterns;
  } finally {
    // Знімаємо позначку після обробки
    createFlexiblePatternsCached._processing.delete(cacheKey);
  }
}



// Додаткові утиліти для роботи з категоріями
export const EXPENSE_CATEGORIES_UTILS = {
  // Метод для отримання всіх категорій
  getAllCategories: function () {
    return Object.keys(EXPENSE_CATEGORIES);
  },

  // Метод для пошуку категорії за описом
  findCategory: function (description) {
    if (!description || typeof description !== "string") {
      return "Інші витрати";
    }

    const desc = description.toLowerCase().trim();

    // Спеціальні випадки для уникнення неоднозначності
    if (desc.includes("диск")) {
      if (
        desc.includes("колес") ||
        desc.includes("шип") ||
        desc.includes("литий") ||
        desc.includes("штамп")
      ) {
        return "Ходова частина";
      }
      if (desc.includes("гальм") || desc.includes("тормоз")) {
        return "Гальмівна система";
      }
    }

    // Перевіряємо категорії в порядку пріоритету
    const priorityOrder = [
      "Гальмівна система", // Найвищий пріоритет - безпека
      "ТО та обслуговування", // Тепер включає ГРМ
      "Двигун",
      "Трансмісія",
      "Ходова частина",
      "Електрика",
      "Система вихлопу",
      "Кузов та салон",
      "Мийка авто",
      "Витратні матеріали",
    ];

    for (const category of priorityOrder) {
      const patterns = EXPENSE_CATEGORIES[category];
      if (patterns && patterns.length > 0) {
        for (const pattern of patterns) {
          if (pattern.test(desc)) {
            return category;
          }
        }
      }
    }

    // Додаткова перевірка з використанням гнучких патернів для складних фраз
    // Перевіряємо опис на наявність ключових слів з кожної категорії
    for (const category of priorityOrder) {
      const patterns = EXPENSE_CATEGORIES[category];
      if (patterns && patterns.length > 0) {
        // Збираємо всі ключові слова з патернів категорії
        const categoryKeywords = new Set();
        for (const pattern of patterns) {
          const patternStr = pattern.toString();
          // Витягуємо ключові слова з патерну (прибираємо regex символи)
          const cleanStr = patternStr
            .replace(/[\/\^$.*+?()[\]{}|\\]/g, " ")
            .replace(/\w\*/g, "")
            .replace(/\s+/g, " ")
            .trim();

          const words = cleanStr
            .split(/\s+/)
            .filter(
              (w) =>
                w.length > 2 &&
                !["test", "i", "brake", "timing", "belt", "w"].includes(
                  w.toLowerCase(),
                ),
            );

          words.forEach((w) => {
            const cleanWord = w.toLowerCase().trim();
            if (cleanWord.length > 2) {
              categoryKeywords.add(cleanWord);
            }
          });
        }

        // Якщо в описі знайдено кілька ключових слів з категорії, створюємо гнучкі патерни
        const foundKeywords = Array.from(categoryKeywords).filter((kw) => {
          // Перевіряємо як точний збіг, так і варіації
          const variations = getWordVariations(kw);
          return variations.some((v) => desc.includes(v));
        });

        if (foundKeywords.length >= 2) {
          // Створюємо гнучкі патерни для комбінацій знайдених ключових слів
          // Спробуємо різні комбінації з 2-3 ключових слів
          for (let i = 0; i < foundKeywords.length; i++) {
            for (let j = i + 1; j < foundKeywords.length; j++) {
              const keywordPhrase = [foundKeywords[i], foundKeywords[j]].join(
                " ",
              );
              const flexiblePatterns =
                createFlexiblePatternsOriginal(keywordPhrase);
              for (const flexPattern of flexiblePatterns) {
                if (flexPattern.test(desc)) {
                  return category;
                }
              }

              // Якщо є третє слово, додаємо його
              if (j + 1 < foundKeywords.length) {
                const keywordPhrase3 = [
                  foundKeywords[i],
                  foundKeywords[j],
                  foundKeywords[j + 1],
                ].join(" ");
                const flexiblePatterns3 =
                  createFlexiblePatternsOriginal(keywordPhrase3);
                for (const flexPattern of flexiblePatterns3) {
                  if (flexPattern.test(desc)) {
                    return category;
                  }
                }
              }
            }
          }
        }
      }
    }

    return "Інші витрати";
  },

  // Метод для детального тестування опису
  analyzeDescription: function (description) {
    if (!description || typeof description !== "string") {
      return {
        category: "Інші витрати",
        matches: [],
        reason: "Пустий або некоректний опис",
      };
    }

    const desc = description.toLowerCase().trim();
    const matches = [];
    const usedPatterns = new Set(); // Для уникнення дублікатів

    // Збираємо всі збіги
    for (const [category, patterns] of Object.entries(EXPENSE_CATEGORIES)) {
      for (const pattern of patterns) {
        const patternKey = pattern.toString();
        if (usedPatterns.has(patternKey)) continue;

        if (pattern.test(desc)) {
          const matchText = desc.match(pattern)?.[0] || pattern.toString();
          matches.push({
            category: category,
            pattern: patternKey,
            matchedText: matchText,
            priority: this.getCategoryPriority(category),
          });
          usedPatterns.add(patternKey);
        }
      }
    }

    // Додаткова перевірка з гнучкими патернами
    for (const [category, patterns] of Object.entries(EXPENSE_CATEGORIES)) {
      for (const pattern of patterns) {
        const patternStr = pattern.toString();
        const words = patternStr
          .replace(/[\/\^$.*+?()[\]{}|\\]/g, " ")
          .split(/\s+/)
          .filter(
            (w) => w.length > 2 && !["test", "i"].includes(w.toLowerCase()),
          );

        if (words.length > 1) {
          const flexiblePatterns = createFlexiblePatternsOriginal(
            words.join(" "),
          );
          for (const flexPattern of flexiblePatterns) {
            const flexKey = flexPattern.toString();
            if (usedPatterns.has(flexKey)) continue;

            if (flexPattern.test(desc)) {
              const matchText =
                desc.match(flexPattern)?.[0] || flexPattern.toString();
              matches.push({
                category: category,
                pattern: flexKey,
                matchedText: matchText,
                priority: this.getCategoryPriority(category),
              });
              usedPatterns.add(flexKey);
            }
          }
        }
      }
    }

    // Сортуємо за пріоритетом
    matches.sort((a, b) => b.priority - a.priority);

    // Визначаємо фінальну категорію
    let finalCategory = "Інші витрати";
    if (matches.length > 0) {
      finalCategory = matches[0].category;
    }

    return {
      description: description,
      category: finalCategory,
      matches: matches,
      matchCount: matches.length,
      topMatches: matches.slice(0, 3),
    };
  },

  // Приватний метод для отримання пріоритету категорії
  getCategoryPriority: function (categoryName) {
    const priorities = {
      "Гальмівна система": 100,
      "ТО та обслуговування": 90,
      Двигун: 80,
      Трансмісія: 70,
      "Ходова частина": 60,
      Електрика: 50,
      "Система вихлопу": 40,
      "Кузов та салон": 30,
      "Мийка авто": 20,
      "Витратні матеріали": 10,
      "Інші витрати": 0,
    };

    return priorities[categoryName] || 0;
  },

  // Метод для додавання нової категорії динамічно
  addCategory: function (categoryName, keywords) {
    if (!EXPENSE_CATEGORIES[categoryName]) {
      EXPENSE_CATEGORIES[categoryName] = [];
    }

    keywords.forEach((keyword) => {
      if (keyword.startsWith("/") && keyword.endsWith("/")) {
        // Регулярний вираз
        const regexStr = keyword.slice(1, -1);
        try {
          const regex = new RegExp(regexStr, "i");
          EXPENSE_CATEGORIES[categoryName].push(regex);
        } catch (e) {
          console.error(`Помилка в регулярному виразі: ${keyword}`, e);
        }
      } else {
        // Простий текст
        const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(escapedKeyword, "i");
        EXPENSE_CATEGORIES[categoryName].push(regex);
      }
    });

    // Оновлюємо глобальну змінну
    window.EXPENSE_CATEGORIES_CONFIG = EXPENSE_CATEGORIES;
    // Category updated
  },

  // Метод для видалення категорії
  removeCategory: function (categoryName) {
    if (categoryName !== "Інші витрати" && EXPENSE_CATEGORIES[categoryName]) {
      delete EXPENSE_CATEGORIES[categoryName];
      window.EXPENSE_CATEGORIES_CONFIG = EXPENSE_CATEGORIES;
      console.log(`🗑️ Категорія "${categoryName}" видалена`);
    }
  },

  // Метод для тестування категорій
  testDescription: function (description) {
    return this.analyzeDescription(description);
  },

  // Метод для перевірки всіх категорій
  getCategoryStats: function () {
    const stats = {};
    let totalPatterns = 0;

    for (const [category, patterns] of Object.entries(EXPENSE_CATEGORIES)) {
      stats[category] = {
        patternCount: patterns.length,
        samplePatterns: patterns.slice(0, 3).map((p) => {
          // Прибираємо /.../ з регулярних виразів для читабельності
          const str = p.toString();
          return str.substring(1, str.length - 2);
        }),
      };
      totalPatterns += patterns.length;
    }

    stats._meta = {
      totalCategories: Object.keys(EXPENSE_CATEGORIES).length,
      totalPatterns: totalPatterns,
    };

    return stats;
  },

  // Метод для пошуку ключових слів
  searchKeywords: function (searchText) {
    const results = [];
    const searchLower = searchText.toLowerCase();

    for (const [category, patterns] of Object.entries(EXPENSE_CATEGORIES)) {
      for (const pattern of patterns) {
        const patternStr = pattern.toString().toLowerCase();
        if (patternStr.includes(searchLower)) {
          results.push({
            category: category,
            pattern: pattern.toString(),
          });
        }
      }
    }

    return results;
  },
};

// Expense categories module loaded
