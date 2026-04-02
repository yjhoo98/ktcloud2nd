import { requestWithSession } from './sessionRequest';

async function request(path, defaultMessage) {
  return requestWithSession(path, { defaultMessage });
}

export async function fetchAnomalyEmbeds() {
  return request(
    '/quicksight/anomaly-embeds',
    'QuickSight anomaly embeds could not be loaded.'
  );
}

export async function fetchVehicleEmbeds() {
  return request(
    '/quicksight/vehicle-embeds',
    'QuickSight vehicle embeds could not be loaded.'
  );
}

export async function fetchLatestAnomalyAlert() {
  return request(
    '/anomalies/latest-alert',
    'The latest anomaly alert could not be loaded.'
  );
}
