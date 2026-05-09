const API_BASES = [
  'https://de1.api.radio-browser.info',
  'https://nl1.api.radio-browser.info',
  'https://at1.api.radio-browser.info',
  'https://fr1.api.radio-browser.info',
];

const DEFAULT_TIMEOUT = 6500;
const DEFAULT_RETRIES = 1;

function isAbortError(error) {
  return error?.name === 'AbortError';
}

function createRequestSignal(externalSignal, timeout) {
  const controller = new AbortController();
  let timeoutId;

  const abort = () => controller.abort(externalSignal?.reason);

  if (externalSignal?.aborted) {
    abort();
  } else if (externalSignal) {
    externalSignal.addEventListener('abort', abort, { once: true });
  }

  if (timeout > 0) {
    timeoutId = setTimeout(() => {
      const timeoutError = new DOMException('Radio Browser did not respond in time', 'TimeoutError');
      controller.abort(timeoutError);
    }, timeout);
  }

  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timeoutId);
      externalSignal?.removeEventListener('abort', abort);
    },
  };
}

function buildUrl(base, path, params) {
  const url = new URL(`${base}${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') url.searchParams.set(k, v);
  });
  return url;
}

function createApiError(error) {
  if (isAbortError(error)) return error;
  if (error?.name === 'TimeoutError') {
    return new Error('Radio directory is taking too long to respond. Please try again.');
  }
  if (error?.message?.startsWith('Radio API error')) {
    return new Error('Radio directory returned an error. Please try again in a moment.');
  }
  return new Error('Could not reach the radio directory. Check your connection and try again.');
}

async function fetchApi(path, params = {}, options = {}) {
  const { signal, timeout = DEFAULT_TIMEOUT, retries = DEFAULT_RETRIES } = options;
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    for (const base of API_BASES) {
      if (signal?.aborted) throw signal.reason || new DOMException('Request aborted', 'AbortError');

      const request = createRequestSignal(signal, timeout);
      const url = buildUrl(base, path, params);

      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'RadioWave/1.0' },
          signal: request.signal,
        });

        if (!res.ok) {
          throw new Error(`Radio API error: ${res.status}`);
        }

        return await res.json();
      } catch (error) {
        if (signal?.aborted) throw error;
        lastError = request.signal.reason || error;
      } finally {
        request.cleanup();
      }
    }
  }

  throw createApiError(lastError);
}

export function getCountries(options) {
  return fetchApi('/json/countries', { order: 'name', hidebroken: 'true' }, options);
}

export function getStates(country, options) {
  return fetchApi(`/json/states/${encodeURIComponent(country)}`, {
    order: 'name',
    hidebroken: 'true',
  }, options);
}

export function searchStations({ countrycode, state, name, tag, order = 'clickcount', reverse = 'true', limit = 50, offset = 0 }, options) {
  return fetchApi('/json/stations/search', {
    countrycode,
    state,
    name,
    tag,
    order,
    reverse,
    limit: String(limit),
    offset: String(offset),
    hidebroken: 'true',
    lastcheckok: '1',
  }, options);
}

export function countClick(stationuuid, options) {
  return fetchApi(`/json/url/${stationuuid}`, {}, options);
}

export function isRequestAbort(error) {
  return isAbortError(error);
}
