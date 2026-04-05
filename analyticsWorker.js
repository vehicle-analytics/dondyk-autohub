/**
 * Analytics Data Processing Worker
 * Handles heavy computations in the background to prevent UI freezing.
 */

import { DataProcessor } from './data/dataProcessor.js';
import { CarProcessor } from './processing/carProcessor.js';

self.onmessage = async (e) => {
  const { type, data } = e.data;

  try {
    switch (type) {
      case 'PROCESS_RAW_DATA': {
        const { scheduleData, historyData, regulationsData, photoAssessmentData } = data;
        
        console.log('[Worker] Starting raw data processing...');
        const startTime = performance.now();
        
        const result = DataProcessor.processData(
          scheduleData,
          historyData,
          regulationsData,
          photoAssessmentData
        );
        
        const endTime = performance.now();
        console.log(`[Worker] Raw data processed in ${Math.round(endTime - startTime)}ms`);
        
        self.postMessage({ type: 'PROCESS_RAW_DATA_SUCCESS', payload: result });
        break;
      }

      case 'PROCESS_CARS': {
        const { appData, maintenanceRegulations } = data;
        
        console.log('[Worker] Starting car data processing...');
        const startTime = performance.now();
        
        const processedCars = CarProcessor.processCarData(
          appData,
          undefined, // Use default getPartStatus
          undefined, // Use default findRegulationForCar
          maintenanceRegulations
        );
        
        const endTime = performance.now();
        console.log(`[Worker] Cars processed in ${Math.round(endTime - startTime)}ms`);
        
        self.postMessage({ type: 'PROCESS_CARS_SUCCESS', payload: processedCars });
        break;
      }

      case 'PING':
        self.postMessage({ type: 'PONG' });
        break;

      default:
        console.warn('[Worker] Unknown worker message type:', type);
    }
  } catch (error) {
    console.error('[Worker] Error:', error);
    self.postMessage({ type: 'ERROR', payload: error.message || String(error) });
  }
};
