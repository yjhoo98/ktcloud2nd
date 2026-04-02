import { requestWithSession } from './sessionRequest';

export async function fetchUserDashboard() {
  return requestWithSession('/user/dashboard', {
    defaultMessage: 'The user dashboard could not be loaded.'
  });
}
