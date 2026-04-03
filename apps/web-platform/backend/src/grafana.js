function trimTrailingSlash(value = '') {
  return value.replace(/\/+$/, '');
}

function normalizeGrafanaUrl(value = '', operatorHost = '', scheme = 'http') {
  if (!value) {
    return '';
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (value.startsWith('/') && operatorHost) {
    return `${scheme}://${operatorHost}${value}`;
  }

  return value;
}

export function getGrafanaConfig() {
  const enabled = process.env.GRAFANA_ENABLED === 'true';
  const operatorHost = String(process.env.OPERATOR_APP_HOST || '').trim();
  const publicScheme = String(process.env.APP_PUBLIC_SCHEME || 'http').trim() || 'http';
  const baseUrl = trimTrailingSlash(
    normalizeGrafanaUrl(process.env.GRAFANA_BASE_URL || '', operatorHost, publicScheme)
  );
  const embedUrl = normalizeGrafanaUrl(
    process.env.GRAFANA_EMBED_URL || '',
    operatorHost,
    publicScheme
  );
  const provider = process.env.GRAFANA_PROVIDER || 'self-hosted';
  const allowEmbed = process.env.GRAFANA_ALLOW_EMBED === 'true';

  return {
    enabled,
    baseUrl,
    embedUrl,
    provider,
    allowEmbed
  };
}

export function getGrafanaEmbedPayload() {
  const config = getGrafanaConfig();

  return {
    enabled: config.enabled && config.allowEmbed && Boolean(config.embedUrl),
    provider: config.provider,
    embedUrl: config.embedUrl
  };
}
