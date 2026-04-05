/**
 * Менеджер кешування даних через IndexedDB
 */

export class CacheManager {
  static DB_NAME = 'CarAnalyticsDB';
  static STORE_NAME = 'analytics_cache';
  static DB_VERSION = 1;

  /**
   * Відкриває з'єднання з IndexedDB
   */
  static async openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME);
        }
      };

      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  /**
   * Отримує кешовані дані (тепер асинхронно)
   */
  static async getCachedData() {
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.STORE_NAME], 'readonly');
        const store = transaction.objectStore(this.STORE_NAME);
        const request = store.get('carAnalyticsData');

        request.onsuccess = () => {
          const data = request.result;
          if (!data) {
            resolve(null);
            return;
          }

          const cacheTime = new Date(data.lastUpdated).getTime();
          const currentTime = Date.now();
          const maxAge = 24 * 60 * 60 * 1000; // 24 години

          if (currentTime - cacheTime > maxAge) {
            console.log(
              `⚠️ Кеш застарів (${Math.floor((currentTime - cacheTime) / 1000 / 60 / 60)} годин), але ми використовуємо його для миттєвого відображення`,
            );
          }
          resolve(data);
        };

        request.onerror = (event) => {
          console.warn("⚠️ Помилка читання з IndexedDB:", event.target.error);
          resolve(null);
        };
      });
    } catch (error) {
      console.warn("⚠️ Помилка ініціалізації IndexedDB:", error);
      return null;
    }
  }

  /**
   * Зберігає дані в кеш (асинхронно)
   */
  static async cacheData(data) {
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(this.STORE_NAME);
        
        // Додаємо мітку часу оновлення
        data.lastUpdated = new Date().toISOString();
        
        const request = store.put(data, 'carAnalyticsData');

        transaction.oncomplete = () => {
          console.log("💾 Дані успішно збережено в IndexedDB");
          localStorage.setItem("carAnalyticsCacheTime", data.lastUpdated);
          resolve(true);
        };

        transaction.onerror = (event) => {
          console.error("❌ Помилка запису в IndexedDB:", event.target.error);
          reject(event.target.error);
        };
      });
    } catch (error) {
      console.error("❌ Критична помилка IndexedDB:", error);
      return false;
    }
  }

  /**
   * Очищає кеш
   */
  static async clearCache() {
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(this.STORE_NAME);
        const request = store.clear();

        transaction.oncomplete = () => {
          console.log("🗑️ Кеш IndexedDB очищено");
          localStorage.removeItem("carAnalyticsCacheTime");
          resolve(true);
        };

        transaction.onerror = (event) => reject(event.target.error);
      });
    } catch (error) {
      console.error("❌ Помилка очищення IndexedDB:", error);
      return false;
    }
  }

  /**
   * Оновлює інформацію про кеш (залишаємо в localStorage для швидкої перевірки)
   */
  static updateCacheInfo() {
    try {
      const cacheTime = localStorage.getItem("carAnalyticsCacheTime");
      if (cacheTime) {
        const time = new Date(cacheTime);
        const now = new Date();
        const diffMs = now - time;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        console.log(
          `⏰ Кеш оновлено ${diffHours} годин ${diffMinutes} хвилин тому`,
        );
      }
    } catch (error) {
      // Ігноруємо
    }
  }
}
