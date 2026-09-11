/* ── weather.js ── IP geolocation + wttr.in weather ── */
import { $, el, bgFetch, storageGet, storageSet, scroll, settings } from './core.js';
import { registerCommand } from './commands.js';
import { registerApp } from './apps.js';

const WEATHER_API = 'https://wttr.in';
const WCACHE_KEY = '_wc', WCACHE_TTL = 30 * 60 * 1000;

let lat = null, lon = null, locationName = '', weatherData = null;
export function getLocation() { return { lat, lon, name: locationName }; }
export function hasWeatherData() { return !!weatherData; }

export async function ipLoc() {
  const apis = [
    { url: 'https://ip-api.com/json/?fields=lat,lon,city,region,country,zip', parse: d => ({ lat: d.lat, lon: d.lon, city: [d.city, d.region].filter(Boolean).join(', ') + ', ' + d.country }) },
    { url: 'https://ipapi.co/json/', parse: d => ({ lat: d.latitude, lon: d.longitude, city: d.city ? d.city + ', ' + d.country : '' }) },
    { url: 'https://ipinfo.io/json', parse: d => { const [la, lo] = d.loc.split(','); return { lat: parseFloat(la), lon: parseFloat(lo), city: d.city ? d.city + ', ' + d.region + ', ' + d.country : '' }; } }
  ];
  try {
    return await Promise.any(apis.map(api =>
      bgFetch(api.url).then(body => {
        const d = JSON.parse(body);
        const parsed = api.parse(d);
        if (parsed.lat != null && parsed.lon != null) return parsed;
        throw new Error('invalid');
      })
    ));
  } catch { return null; }
}

export async function setLocation(la, lo, name) {
  lat = la; lon = lo; locationName = name || la.toFixed(4) + ', ' + lo.toFixed(4);
  await storageSet({ manualLocation: { lat, lon, name: locationName } });
  const es = document.querySelectorAll('.loc');
  if (es.length) es[0].textContent = '  ' + locationName;
  weatherData = null;
  await renderWeatherData();
  scroll();
}
export function setLocationState(la, lo, name) { lat = la; lon = lo; locationName = name; }

function normalizeWeather(raw) {
  const c = raw.current_condition[0];
  const d = raw.weather?.[0];
  return {
    temp: +c.temp_C, feels: +c.FeelsLikeC, humidity: +c.humidity, wind: +c.windspeedKmph,
condition: c.weatherDesc[0].value, precip: c.precipMM ? +c.precipMM : null,
  daily: d ? { max: +d.maxtempC, min: +d.mintempC, sunrise: d.astronomy[0].sunrise, sunset: d.astronomy[0].sunset } : null
  };
}
async function getWeatherCached() {
  const d = await storageGet([WCACHE_KEY]);
  const c = d[WCACHE_KEY];
  return (c && Date.now() - c.ts < WCACHE_TTL) ? c.data : null;
}
export async function getWeatherFresh() {
  if (!lat || !lon) return null;
  const url = WEATHER_API + '/' + lat + ',' + lon + '?format=j1';
  try {
    const body = await bgFetch(url);
    const raw = JSON.parse(body);
    if (raw.error) return null;
    const data = normalizeWeather(raw);
    await storageSet({ [WCACHE_KEY]: { data, ts: Date.now() } });
    weatherData = data;
    return data;
  } catch (_) { }
  return null;
}

export async function renderWeatherData() {
  const ws = document.querySelectorAll('.w');
  if (!ws.length) return;
  const el = ws[0];
  if (!lat || !lon) {
    const locEl = document.querySelector('.loc');
    if (locEl) locEl.textContent = '  location unavailable';
    return;
  }
  const show = d => {
    let txt = '  ' + d.temp + '\u00b0C \u00b7 ' + d.condition + '\n';
    txt += '  feels like ' + d.feels + '\u00b0C \u00b7 wind ' + d.wind + ' km/h';
    if (d.humidity != null) txt += ' \u00b7 humidity ' + d.humidity + '%';
    if (d.precip != null) txt += ' \u00b7 rain ' + d.precip + ' mm';
    if (d.daily) {
      txt += ' \u00b7 L ' + d.daily.min + '\u00b0 H ' + d.daily.max + '\u00b0';
    }
    el.className = 'l r w';
    el.textContent = txt;
  };
  const cached = await getWeatherCached();
  if (cached && !weatherData) {
    weatherData = cached;
    show(cached);
    getWeatherFresh().then(d => { if (d) show(d); });
    return;
  }
  if (!weatherData) {
    el.className = 'l w fetching';
    el.textContent = '  fetching weather...';
    const d = await getWeatherFresh();
    if (!d) { el.className = 'l d w'; el.textContent = '  weather unavailable'; return; }
  }
  show(weatherData);
  if (locationName) {
    const ls = document.querySelectorAll('.loc');
    if (ls.length) ls[0].textContent = '  ' + locationName;
  }
}

function wDetail(c, loc) {
  $('  weather for ' + loc, 'h');
  $('  condition     ' + c.condition, 'r');
  $('  temperature   ' + c.temp + '\u00b0C (feels ' + c.feels + '\u00b0C)', 'r');
  if (c.humidity != null) $('  humidity      ' + c.humidity + '%', 'r');
  if (c.wind != null) $('  wind speed    ' + c.wind + ' km/h', 'r');
  if (c.precip != null) $('  rain          ' + c.precip + ' mm', 'r');
if (c.daily) {
      if (c.daily.min != null) $('  low / high    ' + c.daily.min + '\u00b0C / ' + c.daily.max + '\u00b0C', 'r');
      if (c.daily.sunrise) $('  sunrise       ' + c.daily.sunrise, 'r');
      if (c.daily.sunset) $('  sunset        ' + c.daily.sunset, 'r');
    }
}
async function showWeatherDetail() {
  if (!lat || !lon) { $('  no location data \u2014 type "weather" to fetch', 'd'); scroll(); return; }
  const loc = locationName || lat.toFixed(2) + ', ' + lon.toFixed(2);
  let dd = weatherData || await getWeatherCached();
  if (dd) { wDetail(dd, loc); if (!weatherData) $('  (cached)', 'd'); scroll(); }
  else { $('  fetching weather...', 'd'); scroll(); }
  const d = await getWeatherFresh();
  if (d) { if (dd) return; wDetail(d, loc); scroll(); }
  else if (!dd) { $('  weather unavailable', 'd'); scroll(); }
}

registerCommand('weather', 'detailed weather info', async () => {
  if (!lat || !lon) {
    $('  locating...', 'd');
    const ip = await ipLoc();
    if (ip) { lat = ip.lat; lon = ip.lon; locationName = ip.city; $('  ' + locationName, 'd'); }
    else { $('  could not determine location', 'd'); scroll(); return; }
  }
  await showWeatherDetail();
  scroll();
});
registerCommand('location', 'set location: location <name> or <lat, lon>', async args => {
  if (!args.length) { $('  usage: location <name> or <lat, lon>', 'd'); scroll(); return; }
  const q = args.join(' ').replace(/\s*,\s*/g, ' ').replace(/\s+/g, ' ').trim();
  const coordMatch = q.match(/^(-?\d+\.?\d*)\s*[,; ]\s*(-?\d+\.?\d*)$/);
  if (coordMatch) {
    const la = parseFloat(coordMatch[1]), lo = parseFloat(coordMatch[2]);
    $('  setting location to ' + la.toFixed(4) + ', ' + lo.toFixed(4), 'd');
    await setLocation(la, lo, '');
  } else {
    const searchTerm = q.split(/[,; ]/)[0];
    $('  geocoding "' + searchTerm + '"...', 'd'); scroll();
    try {
      const body = await bgFetch('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(searchTerm) + '&count=1&language=en&format=json');
      const d = JSON.parse(body);
      if (d.results && d.results[0]) {
        const r = d.results[0];
        const name = [r.name, r.admin1, r.county, r.country].filter(Boolean).join(', ');
        $('  found: ' + name, 'r'); scroll();
        await setLocation(r.latitude, r.longitude, name);
      } else $('  location not found', 'd');
    } catch (e) { $('  geocoding failed', 'd'); }
  }
  scroll();
});

export async function initLocation() {
  const saved = await storageGet(['manualLocation', 'ipCache']);
  const es = document.querySelectorAll('.loc');
  if (saved.manualLocation) {
    const m = saved.manualLocation;
    lat = m.lat; lon = m.lon; locationName = m.name || '';
    if (es.length) es[0].textContent = '  ' + locationName;
  } else if (saved.ipCache && Date.now() - saved.ipCache.ts < 3600000) {
    const c = saved.ipCache;
    lat = c.lat; lon = c.lon; locationName = c.city || '';
    if (es.length) es[0].textContent = '  ' + (locationName || lat.toFixed(2) + ', ' + lon.toFixed(2));
  } else {
    if (es.length) es[0].textContent = '  locating by IP...';
    const ip = await ipLoc();
    if (ip) {
      lat = ip.lat; lon = ip.lon; locationName = ip.city || '';
      if (es.length) es[0].textContent = '  ' + (locationName || lat.toFixed(2) + ', ' + lon.toFixed(2));
      await storageSet({ ipCache: { lat, lon, city: locationName, ts: Date.now() } });
    } else if (es.length) es[0].textContent = '  location unavailable';
  }
  await renderWeatherData();
  scroll();
}

export function startWeatherRefresh() {
  setInterval(async () => { if (lat && lon) await getWeatherFresh(); }, 10 * 60 * 1000);
}

/* ── window app ── */
export function mountWeatherApp(body) {
  const sec = el('div', 'wx');
  const loc = el('div', 'wx-loc', locationName || 'ubicaci\u00f3n...');
  const main = el('div', 'wx-main');
  const temp = el('div', 'wx-temp', '--\u00b0C');
  const cond = el('div', 'wx-cond', '--');
  main.append(temp, cond);
  const grid = el('div', 'wx-grid');
  const detail = label => {
    const row = el('div', 'wx-item');
    row.appendChild(el('span', '', label));
    const v = el('b', '', '--');
    row.appendChild(v);
    grid.appendChild(row);
    return v;
  };
  const dFeels = detail('Sensaci\u00f3n'), dWind = detail('Viento'), dHumi = detail('Humedad'), dRain = detail('Lluvia');
  const dRange = detail('M\u00edn / M\u00e1x'), dSun = detail('Sol');
  const refresh = el('button', 'wx-refresh', 'Actualizar');

  const paint = d => {
    temp.textContent = d.temp + '\u00b0C';
    cond.textContent = d.condition;
    dFeels.textContent = d.feels != null ? d.feels + '\u00b0C' : '--';
    dWind.textContent = d.wind != null ? d.wind + ' km/h' : '--';
    dHumi.textContent = d.humidity != null ? d.humidity + '%' : '--';
    dRain.textContent = d.precip != null ? d.precip + ' mm' : '--';
    dRange.textContent = d.daily ? d.daily.min + '\u00b0 / ' + d.daily.max + '\u00b0' : '--';
    dSun.textContent = d.daily && d.daily.sunrise && d.daily.sunset ? d.daily.sunrise + ' \u2192 ' + d.daily.sunset : '--';
  };

  const load = async () => {
    if (!lat || !lon) {
      loc.textContent = 'localizando...';
      const ip = await ipLoc();
      if (ip) { lat = ip.lat; lon = ip.lon; locationName = ip.city || ''; }
    }
    if (!lat || !lon) { loc.textContent = 'ubicaci\u00f3n no disponible'; return; }
    loc.textContent = locationName || lat.toFixed(2) + ', ' + lon.toFixed(2);
    const cached = await getWeatherCached();
    if (cached) paint(cached);
    const fresh = await getWeatherFresh();
    if (fresh) paint(fresh);
  };

  refresh.addEventListener('click', load);
  sec.append(loc, main, grid, refresh);
  body.appendChild(sec);
  load();
}

registerApp({ id: 'clima', name: 'Clima', icon: '\u2600', w: 380, h: 460, mount: mountWeatherApp });
