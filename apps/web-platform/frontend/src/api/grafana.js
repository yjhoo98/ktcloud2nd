import { requestWithSession } from './sessionRequest';

export async function fetchGrafanaEmbed() {
  return requestWithSession('/grafana/embed', {
    defaultMessage: 'Grafana embed configuration could not be loaded.'
  });
}
