function trimTrailingSlash(value = '') {
  return value.replace(/\/+$/, '');
}

function withGrafanaTheme(value = '', theme = 'dark') {
  if (!value) {
    return '';
  }

  try {
    const url = new URL(value);

    if (!url.searchParams.has('theme')) {
      url.searchParams.set('theme', theme);
    }

    return url.toString();
  } catch {
    const separator = value.includes('?') ? '&' : '?';
    return value.includes('theme=') ? value : `${value}${separator}theme=${theme}`;
  }
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
    embedUrl: withGrafanaTheme(embedUrl, 'dark'),
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
