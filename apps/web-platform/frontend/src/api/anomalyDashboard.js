import { requestWithSession } from './sessionRequest';

export async function fetchAnomalyDashboard() {
  return requestWithSession('/anomalies/dashboard', {
    defaultMessage: 'The anomaly dashboard could not be loaded.'
  });
}
