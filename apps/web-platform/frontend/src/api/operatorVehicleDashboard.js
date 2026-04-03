import { requestWithSession } from './sessionRequest';

export async function fetchOperatorVehicleDashboard() {
  return requestWithSession('/operator/vehicle-dashboard', {
    defaultMessage: 'The operator vehicle dashboard could not be loaded.'
  });
}
