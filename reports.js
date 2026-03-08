import { CacheManager } from './cache/cacheManager.js';
import { DataProcessor } from './data/dataProcessor.js';
import { Formatters } from './utils/formatters.js';
import { CarProcessor } from './processing/carProcessor.js';
import { MaintenanceReports } from './reports/maintenanceReports.js';
import { CONFIG, CONSTANTS } from './config/appConfig.js';

class ReportsApp {
    constructor() {
        this.reportsModule = null;
        this.processedCars = [];
        this.maintenanceRegulations = [];
        this.currentReportData = [];
        this.fullReportData = []; // Зберігаємо повний звіт для фільтрації
        this.selectedPart = null;
        this.formatMileage = null;
        this.formatDate = null;
    }

    async init() {
        // У ESM модулі завантажуються гарантовано
        this.formatMileage = Formatters.formatMileage;
        this.formatDate = Formatters.formatDate;

        // Спочатку завантажуємо дані
        try {
            console.log('🔄 Початок завантаження даних...');
            await this.loadData();
            console.log('✅ Дані завантажено успішно, processedCars:', this.processedCars?.length || 0);
        } catch (error) {
            console.error('❌ Помилка завантаження даних:', error);
            if (!this.processedCars || this.processedCars.length === 0) {
                console.log('📋 Немає даних, спробуємо завантажити з Google Sheets...');
                try {
                    await this.fetchDataFromSheets();
                    console.log('✅ Дані успішно завантажено з Google Sheets');
                } catch (sheetsError) {
                    console.error('❌ Не вдалося завантажити дані з Google Sheets:', sheetsError);
                    alert('Дані про авто не завантажені. Будь ласка, спочатку перейдіть на головну сторінку для завантаження даних, а потім поверніться сюди.');
                    return;
                }
            }
        }

        // Ініціалізуємо модуль звітів
        this.reportsModule = new MaintenanceReports();
        this.reportsModule.appData = this.appData;
        this.reportsModule.processedCars = this.processedCars;
        this.reportsModule.maintenanceRegulations = this.maintenanceRegulations;

        this.showInterface();
        this.initUI();

        setTimeout(() => {
            if (this.selectedPart && this.processedCars && this.processedCars.length > 0) {
                console.log('🔄 Генеруємо звіт для:', this.selectedPart);
                this.generateReport(true).catch(err => console.error('Помилка генерації звіту:', err));
            }
        }, 300);
    }

    async loadData() {
        const cached = CacheManager.getCachedData();
        if (cached && cached.carsInfo && Object.keys(cached.carsInfo).length > 0) {
            this.appData = cached;
            this.maintenanceRegulations = cached.regulations || [];

            if (cached.processedCars && Array.isArray(cached.processedCars) && cached.processedCars.length > 0) {
                this.processedCars = cached.processedCars;
            } else {
                this.processedCars = CarProcessor.processCarData(
                    cached,
                    (partName, mileageDiff, daysDiff, carYear, carModel, license) =>
                        this.getPartStatus(partName, mileageDiff, daysDiff, carYear, carModel, license),
                    (license, model, year, partName) =>
                        CarProcessor.findRegulationForCar(license, model, year, partName, this.maintenanceRegulations)
                );
            }
            return;
        }
        await this.loadDataFromAPI();
    }

    async loadDataFromAPI() {
        // Статичний Vercel-деплой не має backend API — одразу йдемо в Google Sheets
        await this.fetchDataFromSheets();
    }

    async fetchDataFromSheets() {
        const { SPREADSHEET_ID, SHEETS, API_KEY } = CONFIG;
        const [scheduleData, historyData, regulationsData, photoAssessmentData] = await Promise.all([
            this.fetchSheetData(SPREADSHEET_ID, SHEETS.SCHEDULE, API_KEY),
            this.fetchSheetData(SPREADSHEET_ID, SHEETS.HISTORY, API_KEY),
            this.fetchSheetData(SPREADSHEET_ID, SHEETS.REGULATIONS, API_KEY),
            this.fetchSheetData(SPREADSHEET_ID, SHEETS.PHOTO_ASSESSMENT, API_KEY),
        ]);

        const result = DataProcessor.processData(
            scheduleData, historyData, regulationsData, photoAssessmentData,
            Formatters.parseNumber, Formatters.parseDate, Formatters.formatDate
        );

        this.appData = result.appData;
        this.maintenanceRegulations = result.maintenanceRegulations;
        this.processedCars = CarProcessor.processCarData(
            this.appData,
            (partName, mileageDiff, daysDiff, carYear, carModel, license) =>
                this.getPartStatus(partName, mileageDiff, daysDiff, carYear, carModel, license),
            (license, model, year, partName) =>
                CarProcessor.findRegulationForCar(license, model, year, partName, this.maintenanceRegulations)
        );
        CacheManager.cacheData({ ...this.appData, processedCars: this.processedCars });
    }

    async fetchSheetData(spreadsheetId, sheetName, apiKey) {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}?key=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();
        return data.values || [];
    }

    getPartStatus(partName, mileageDiff, daysDiff, carYear, carModel, license) {
        return CarProcessor.getPartStatus(
            partName, mileageDiff, daysDiff, carYear, carModel, license,
            this.maintenanceRegulations,
            CarProcessor.findRegulationForCar
        );
    }

    showInterface() {
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('main-interface').classList.remove('hidden');
    }

    initUI() {
        // Populate parts
        const partSelect = document.getElementById('part-select');
        if (partSelect) {
            CONSTANTS.PARTS_ORDER.forEach(part => {
                const option = document.createElement('option');
                option.value = part;
                option.textContent = part;
                partSelect.appendChild(option);
            });
            partSelect.addEventListener('change', (e) => {
                this.selectedPart = e.target.value;
                this.generateReport();
            });
        }

        // Status filter
        document.getElementById('status-filter')?.addEventListener('change', (e) => {
            this.applyLocalFilters();
        });

        // City filter
        this.updateCityFilter();
        document.getElementById('city-filter')?.addEventListener('change', (e) => {
            this.applyLocalFilters();
        });

        // Export buttons
        document.getElementById('export-csv')?.addEventListener('click', () => this.exportToCSV());
        document.getElementById('export-excel')?.addEventListener('click', () => this.exportToExcel());
        document.getElementById('print-report')?.addEventListener('click', () => window.print());
    }

    updateCityFilter() {
        const cities = new Set();
        this.processedCars.forEach(car => { if (car.city) cities.add(car.city); });
        const cityFilter = document.getElementById('city-filter');
        if (cityFilter) {
            cityFilter.innerHTML = '<option value="Всі міста">Всі міста</option>';
            Array.from(cities).sort().forEach(city => {
                const option = document.createElement('option');
                option.value = city;
                option.textContent = city;
                cityFilter.appendChild(option);
            });
        }
    }

    async generateReport(isInitial = false) {
        if (!this.selectedPart) return;

        const tableBody = document.getElementById('report-table-body');
        const placeholder = document.getElementById('report-placeholder');
        const tableContainer = document.getElementById('report-table-container');
        const statsContainer = document.getElementById('report-stats');

        if (!isInitial) {
            placeholder.classList.add('hidden');
            tableContainer.classList.remove('hidden');
            statsContainer.classList.remove('hidden');
            tableBody.innerHTML = '<tr><td colspan="10" class="py-12 text-center text-gray-500">Генерування звіту...</td></tr>';
        }

        this.fullReportData = this.reportsModule.generateReport(
            this.selectedPart,
            this.processedCars,
            this.maintenanceRegulations,
            CarProcessor.findRegulationForCar,
            Formatters.formatMileage,
            Formatters.formatDate
        );

        this.applyLocalFilters();
        this.updateStats();
        this.enableButtons();
    }

    applyLocalFilters() {
        const status = document.getElementById('status-filter').value;
        const city = document.getElementById('city-filter').value;

        this.currentReportData = this.fullReportData.filter(item => {
            const matchStatus = status === 'all' || item.status === status;
            const matchCity = city === 'Всі міста' || item.city === city;
            return matchStatus && matchCity;
        });

        this.renderReportTable();
    }

    renderReportTable() {
        const tableBody = document.getElementById('report-table-body');
        if (!tableBody) return;

        if (this.currentReportData.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="10" class="py-12 text-center text-gray-500">Немає даних за вибраними фільтрами</td></tr>';
            return;
        }

        tableBody.innerHTML = this.currentReportData.map((item, index) => `
            <tr class="hover:bg-gray-50">
                <td class="px-2 py-4 text-center border-b">${index + 1}</td>
                <td class="px-2 py-4 text-center border-b font-medium">${item.city}</td>
                <td class="px-2 py-4 text-center border-b font-bold">${item.license}</td>
                <td class="px-2 py-4 text-center border-b">${item.model}</td>
                <td class="px-2 py-4 text-center border-b">${Formatters.formatMileage(item.currentMileage)}</td>
                <td class="px-2 py-4 text-center border-b">${item.lastServiceDate}</td>
                <td class="px-2 py-4 text-center border-b">${item.lastServiceMileage}</td>
                <td class="px-2 py-4 text-center border-b ${item.status === 'urgent' ? 'text-red-600 font-bold' : ''}">${item.remainingText}</td>
                <td class="px-2 py-4 text-center border-b font-medium">${item.estimatedNextServiceDateText}</td>
                <td class="px-2 py-4 text-center border-b">
                    <span class="px-2 py-1 rounded-full text-xs font-semibold ${this.getStatusClass(item.status)}">
                        ${item.statusText}
                    </span>
                </td>
            </tr>
        `).join('');
    }

    getStatusClass(status) {
        switch (status) {
            case 'urgent': return 'bg-red-100 text-red-800';
            case 'warning': return 'bg-yellow-100 text-yellow-800';
            default: return 'bg-green-100 text-green-800';
        }
    }

    updateStats() {
        const stats = { urgent: 0, warning: 0, normal: 0, total: this.currentReportData.length };
        this.currentReportData.forEach(item => stats[item.status]++);
        document.getElementById('stats-urgent').textContent = stats.urgent;
        document.getElementById('stats-warning').textContent = stats.warning;
        document.getElementById('stats-normal').textContent = stats.normal;
        document.getElementById('stats-total').textContent = stats.total;
    }

    enableButtons() {
        ['export-csv', 'export-excel', 'print-report'].forEach(id => {
            document.getElementById(id)?.removeAttribute('disabled');
        });
    }

    exportToCSV() {
        if (this.currentReportData.length === 0) return;
        const headers = ["№", "Представництво", "Держ номер", "Модель", "Поточний одометр", "Останнє обслуговування", "Одометр", "Залишилося", "Орієнтовна дата", "Статус"];
        const rows = this.currentReportData.map((item, index) => [
            index + 1, item.city, item.license, item.model, item.currentMileage, item.lastServiceDate, item.lastServiceMileage, item.remainingText, item.estimatedNextServiceDateText, item.statusText
        ]);
        const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `report_${this.selectedPart}_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    }

    async exportToExcel() {
        if (this.currentReportData.length === 0) return;
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Звіт');
        worksheet.columns = [
            { header: '№', key: 'id', width: 5 },
            { header: 'Представництво', key: 'city', width: 20 },
            { header: 'Держ номер', key: 'license', width: 15 },
            { header: 'Модель', key: 'model', width: 20 },
            { header: 'Поточний одометр', key: 'mileage', width: 15 },
            { header: 'Останнє обслуговування', key: 'lastDate', width: 15 },
            { header: 'Одометр', key: 'lastMileage', width: 15 },
            { header: 'Залишилося', key: 'remaining', width: 15 },
            { header: 'Орієнтовна дата', key: 'estDate', width: 15 },
            { header: 'Статус', key: 'status', width: 15 }
        ];
        this.currentReportData.forEach((item, index) => worksheet.addRow({
            id: index + 1, city: item.city, license: item.license, model: item.model, mileage: item.currentMileage, lastDate: item.lastServiceDate, lastMileage: item.lastServiceMileage, remaining: item.remainingText, estDate: item.estimatedNextServiceDateText, status: item.statusText
        }));
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `report_${this.selectedPart}.xlsx`;
        link.click();
    }
}

// Initialize app
window.reportsApp = new ReportsApp();
window.app = window.reportsApp;
document.addEventListener('DOMContentLoaded', () => window.reportsApp.init());
