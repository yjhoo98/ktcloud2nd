import { clearStoredSession, getStoredSession } from '../utils/authStorage';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').trim();

function createRequestError(message, status, extra = {}) {
  const error = new Error(message);
  error.status = status;
  return Object.assign(error, extra);
}

function redirectToLoginIfNeeded() {
  if (typeof window === 'undefined') {
    return;
  }

  if (window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
}

export async function requestWithSession(path, options = {}) {
  const {
    defaultMessage = 'The request could not be completed.',
    headers = {},
    ...restOptions
  } = options;
  const session = getStoredSession();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      ...(session?.token
        ? { Authorization: `Bearer ${session.token}` }
        : {}),
      ...headers
    },
    ...restOptions
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      clearStoredSession();
      redirectToLoginIfNeeded();
    }

    throw createRequestError(data.message || defaultMessage, response.status, {
      missingFields: data.missingFields || [],
      panels: data.panels || []
    });
  }

  return data;
}
