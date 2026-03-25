const API_BASE = 'https://de1.api.radio-browser.info';

async function fetchApi(path, params = {}) {
  const url = new URL(`${API_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') url.searchParams.set(k, v);
  });
  const res = await fetch(url, {
    headers: { 'User-Agent': 'RadioWave/1.0' },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export function getCountries() {
  return fetchApi('/json/countries', { order: 'name', hidebroken: 'true' });
}

export function getStates(country) {
  return fetchApi(`/json/states/${encodeURIComponent(country)}`, {
    order: 'name',
    hidebroken: 'true',
  });
}

export function searchStations({ countrycode, state, name, tag, order = 'clickcount', reverse = 'true', limit = 50, offset = 0 }) {
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
  });
}

export function countClick(stationuuid) {
  return fetchApi(`/json/url/${stationuuid}`);
}
