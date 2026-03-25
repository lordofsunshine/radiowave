import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useRadioData } from './useRadioData';
import { usePlayer } from './usePlayer';
import CountryPicker from './CountryPicker';
import Filters from './Filters';
import StationList from './StationList';

function detectRegionFromBrowser() {
  if (typeof navigator === 'undefined') return '';
  const locales = [...(navigator.languages || []), navigator.language].filter(Boolean);
  for (const locale of locales) {
    const region = locale.split('-')[1]?.toUpperCase();
    if (region && region.length === 2) return region;
  }
  return '';
}

async function detectCountryCode() {
  const browserRegion = detectRegionFromBrowser();
  if (browserRegion) return browserRegion;
  try {
    const response = await fetch('https://ipwho.is/');
    const data = await response.json();
    if (data?.success && data?.country_code) return String(data.country_code).toUpperCase();
  } catch {}
  return '';
}

function cleanStationName(name = '') {
  return name.replace(/\s+/g, ' ').trim();
}

function scoreStation(station) {
  const bitrateScore = Math.min(Number(station.bitrate) || 0, 320) * 0.18;
  const votesScore = (Number(station.votes) || 0) * 6;
  const clickScore = (Number(station.clickcount) || 0) * 0.6;
  const trendScore = (Number(station.clicktrend) || 0) * 1.2;
  const visualScore = station.favicon ? 20 : 0;
  const metadataScore = station.homepage ? 12 : 0;
  const tagsScore = station.tags ? 8 : 0;
  const languageScore = station.language ? 5 : 0;
  const stableCodecScore = ['MP3', 'AAC', 'AAC+'].includes(String(station.codec).toUpperCase()) ? 9 : 3;
  const cleanNameScore = cleanStationName(station.name).length > 2 ? 6 : 0;
  return bitrateScore + votesScore + clickScore + trendScore + visualScore + metadataScore + tagsScore + languageScore + stableCodecScore + cleanNameScore;
}

function pickBestStation(stations) {
  if (!stations.length) return null;
  return [...stations]
    .map((s) => ({ ...s, name: cleanStationName(s.name) }))
    .sort((a, b) => scoreStation(b) - scoreStation(a))[0];
}

function App() {
  const radio = useRadioData();
  const player = usePlayer();
  const [countryQuery, setCountryQuery] = useState('');
  const [detectedCountryCode, setDetectedCountryCode] = useState('');
  const [detectingCountry, setDetectingCountry] = useState(true);
  const [startupFallback, setStartupFallback] = useState(false);
  const autoStartRef = useRef(false);
  const deferredCountryQuery = useDeferredValue(countryQuery);

  const [activePanel, setActivePanel] = useState(null);
  const fallbackShownRef = useRef(false);

  const {
    countries, selectedCountry, setSelectedCountry, selectCountryByCode,
    states, selectedState, setSelectedState,
    stations, loadingCountries, loadingStations, loadingMore, hasMore, error,
    searchName, setSearchName, searchTag, setSearchTag,
    search, loadMore,
  } = radio;
  const playStation = player.play;

  const filteredCountries = useMemo(() => {
    const q = deferredCountryQuery.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter((c) => c.name.toLowerCase().includes(q));
  }, [deferredCountryQuery, countries]);

  useEffect(() => {
    let cancelled = false;
    detectCountryCode()
      .then((code) => { if (!cancelled) setDetectedCountryCode(code); })
      .finally(() => { if (!cancelled) setDetectingCountry(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!countries.length || selectedCountry || !detectedCountryCode) return;
    const match = selectCountryByCode(detectedCountryCode);
    if (!match && !fallbackShownRef.current) {
      fallbackShownRef.current = true;
      queueMicrotask(() => {
        setStartupFallback(true);
        setActivePanel('country');
      });
    }
  }, [detectedCountryCode, countries.length, selectedCountry, selectCountryByCode]);

  const bestStation = useMemo(() => pickBestStation(stations), [stations]);

  useEffect(() => {
    if (!selectedCountry || loadingStations) return;
    if (!stations.length) {
      if (!fallbackShownRef.current && detectedCountryCode && selectedCountry.iso_3166_1.toUpperCase() === detectedCountryCode) {
        fallbackShownRef.current = true;
        queueMicrotask(() => {
          setStartupFallback(true);
          setActivePanel('country');
        });
      }
      return;
    }
    if (!autoStartRef.current && bestStation && detectedCountryCode && selectedCountry.iso_3166_1.toUpperCase() === detectedCountryCode) {
      autoStartRef.current = true;
      playStation(bestStation).catch(() => {});
    }
  }, [bestStation, detectedCountryCode, playStation, loadingStations, selectedCountry, stations.length]);

  const featuredStation = player.current || bestStation;
  const tags = featuredStation?.tags?.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 3).join(' / ') || '';

  const closePanel = () => setActivePanel(null);

  const statusText = player.playing
    ? 'On Air'
    : player.loading
      ? 'Connecting...'
      : detectingCountry
        ? 'Detecting location...'
        : loadingStations
          ? 'Loading stations...'
          : featuredStation
            ? 'Ready'
            : 'Select a country';

  return (
    <div className="min-h-screen overflow-hidden bg-[#0c0d14] text-slate-100">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-18rem] top-[-12rem] h-[32rem] w-[32rem] rounded-full bg-violet-900/20 blur-3xl float-slow" />
        <div className="absolute right-[-10rem] top-[10rem] h-[26rem] w-[26rem] rounded-full bg-indigo-950/30 blur-3xl float-delay" />
        <div className="absolute bottom-[-12rem] left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-violet-950/25 blur-3xl pulse-surface" />
      </div>

      <div className="fixed left-4 top-4 z-30 flex flex-col gap-2 sm:left-6 sm:top-6">
        <button
          onClick={() => setActivePanel(p => p === 'country' ? null : 'country')}
          className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition duration-300 ${activePanel === 'country' ? 'border-violet-400/40 bg-violet-400/16 text-violet-100' : 'border-white/12 bg-slate-950/70 text-white backdrop-blur-xl hover:border-white/24 hover:bg-white/10'}`}
          title="Countries"
        >
          <GlobeIcon />
        </button>
        <button
          onClick={() => setActivePanel(p => p === 'filters' ? null : 'filters')}
          className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition duration-300 ${activePanel === 'filters' ? 'border-violet-400/40 bg-violet-400/16 text-violet-100' : 'border-white/12 bg-slate-950/70 text-white backdrop-blur-xl hover:border-white/24 hover:bg-white/10'}`}
          title="Filters"
        >
          <FilterIcon />
        </button>
      </div>

      <div className="fixed right-4 top-4 z-30 sm:right-6 sm:top-6">
        <button
          onClick={() => setActivePanel(p => p === 'stations' ? null : 'stations')}
          className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition duration-300 ${activePanel === 'stations' ? 'border-violet-400/40 bg-violet-400/16 text-violet-100' : 'border-white/12 bg-slate-950/70 text-white backdrop-blur-xl hover:border-white/24 hover:bg-white/10'}`}
          title="Stations"
        >
          <ListIcon />
        </button>
      </div>

      {activePanel === 'country' && (
        <div className="fixed inset-0 z-40 flex" onClick={closePanel}>
          <div
            className="flex h-full w-[340px] max-w-[85vw] flex-col border-r border-white/10 bg-[#12121e]/95 p-5 backdrop-blur-2xl rise-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Countries</h2>
              <button onClick={closePanel} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/12 text-slate-300 hover:bg-white/10">
                <CloseIcon />
              </button>
            </div>
            {startupFallback && !loadingStations && !stations.length && (
              <div className="mb-4 rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                No stations found for your region. Try another country.
              </div>
            )}
            <CountryPicker
              countries={filteredCountries}
              selected={selectedCountry}
              onSelect={(country) => {
                setSelectedCountry(country);
                setStartupFallback(false);
                closePanel();
              }}
              loading={loadingCountries}
              query={countryQuery}
              onQueryChange={setCountryQuery}
            />
          </div>
        </div>
      )}

      {activePanel === 'filters' && (
        <div className="fixed inset-0 z-40 flex" onClick={closePanel}>
          <div
            className="flex h-full w-[340px] max-w-[85vw] flex-col border-r border-white/10 bg-[#12121e]/95 p-5 backdrop-blur-2xl rise-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Filters</h2>
              <button onClick={closePanel} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/12 text-slate-300 hover:bg-white/10">
                <CloseIcon />
              </button>
            </div>
            {selectedCountry ? (
              <Filters
                states={states}
                selectedState={selectedState}
                onStateChange={setSelectedState}
                searchName={searchName}
                onNameChange={setSearchName}
                searchTag={searchTag}
                onTagChange={setSearchTag}
                onSearch={() => { search(); closePanel(); }}
              />
            ) : (
              <p className="text-sm text-slate-400">Select a country first to use filters.</p>
            )}
          </div>
        </div>
      )}

      {activePanel === 'stations' && (
        <div className="fixed inset-0 z-40 flex justify-end" onClick={closePanel}>
          <div
            className="flex h-full w-[380px] max-w-[90vw] flex-col border-l border-white/10 bg-[#12121e]/95 p-5 backdrop-blur-2xl rise-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                Stations{selectedCountry ? ` — ${selectedCountry.name}` : ''}
              </h2>
              <button onClick={closePanel} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/12 text-slate-300 hover:bg-white/10">
                <CloseIcon />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <StationList
                stations={stations}
                loading={loadingStations}
                currentUuid={player.current?.stationuuid}
                playing={player.playing}
                onPlay={(station) => { player.play(station); closePanel(); }}
                onLoadMore={loadMore}
                hasMore={hasMore}
                loadingMore={loadingMore}
              />
            </div>
          </div>
        </div>
      )}

      <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-12 sm:px-6">
        {error && (
          <div className="mb-6 w-full max-w-lg rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-center text-sm text-rose-100">
            {error}
          </div>
        )}

        <div className="hero-shell w-full max-w-xl">
          <div className="relative overflow-hidden rounded-[34px] border border-white/10 bg-slate-950/70 shadow-[0_35px_120px_rgba(10,5,25,0.6)]">
            {featuredStation?.favicon && (
              <img
                src={featuredStation.favicon}
                alt=""
                className="absolute inset-0 h-full w-full scale-110 object-cover opacity-20 blur-2xl"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            )}
            <div className="absolute inset-0 bg-slate-950/60" />

            <div className="relative p-6 sm:p-8">
              <div className="flex items-center gap-2 text-xs font-medium">
                <span className={`rounded-full px-3 py-1 tracking-[0.2em] uppercase ${player.playing ? 'border border-emerald-300/25 bg-emerald-400/14 text-emerald-200' : 'border border-white/10 bg-white/8 text-slate-300'}`}>
                  {statusText}
                </span>
                {selectedCountry && (
                  <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-slate-300">
                    {selectedCountry.name}
                  </span>
                )}
              </div>

              <div className="mt-8 flex items-center gap-5">
                <div className={`station-avatar flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[26px] border border-white/12 bg-white/10 shadow-[0_20px_60px_rgba(109,40,217,0.15)] ${player.playing ? 'bass-pulse' : ''}`}>
                  {featuredStation?.favicon ? (
                    <img
                      src={featuredStation.favicon}
                      alt=""
                      className="h-full w-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <span className="text-3xl font-semibold text-white/70">
                      {featuredStation?.name?.slice(0, 1)?.toUpperCase() || 'R'}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-2xl font-semibold text-white sm:text-4xl">
                    {featuredStation?.name || 'RadioWave'}
                  </h1>
                  {tags && <p className="mt-1.5 truncate text-sm text-slate-300">{tags}</p>}
                  {featuredStation && (
                    <p className="mt-1 text-xs text-slate-400">
                      {[featuredStation.codec, featuredStation.bitrate ? `${featuredStation.bitrate} kbps` : ''].filter(Boolean).join(' / ')}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-8 flex items-center justify-center gap-4">
                <button
                  onClick={() => player.stop({ clearCurrent: false })}
                  disabled={!featuredStation}
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-white/12 bg-white/8 text-white transition duration-300 hover:border-white/24 hover:bg-white/14 disabled:opacity-40"
                >
                  <StopIcon />
                </button>
                <button
                  onClick={() => featuredStation && player.play(featuredStation)}
                  disabled={!featuredStation}
                  className="group flex h-[72px] w-[72px] items-center justify-center rounded-full bg-white text-slate-950 shadow-[0_12px_40px_rgba(139,92,246,0.25)] transition duration-300 hover:scale-105 hover:bg-violet-200 disabled:opacity-40"
                >
                  {player.loading ? (
                    <span className="h-6 w-6 rounded-full border-[3px] border-slate-950/20 border-t-slate-950 animate-spin" />
                  ) : player.playing ? (
                    <PauseIcon />
                  ) : (
                    <PlayIcon />
                  )}
                </button>
                {featuredStation?.homepage && (
                  <a
                    href={featuredStation.homepage}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-12 w-12 items-center justify-center rounded-full border border-white/12 bg-white/8 text-white transition duration-300 hover:border-white/24 hover:bg-white/14"
                    title="Station website"
                  >
                    <LinkIcon />
                  </a>
                )}
              </div>

              <div className="mt-6 flex items-center gap-3">
                <VolumeIcon />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={player.volume}
                  onChange={(e) => player.setVolume(parseFloat(e.target.value))}
                  className="volume-slider flex-1"
                />
                <span className="w-10 text-right text-xs text-slate-400">{Math.round(player.volume * 100)}%</span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-center gap-2 text-xs text-slate-500">
            <span>{stations.length} stations</span>
            {selectedCountry && <span>in {selectedCountry.name}</span>}
          </div>
        </div>
      </main>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-7 w-7 fill-current">
      <path d="M6.5 4.8c0-.98 1.08-1.58 1.92-1.05l7 4.2a1.23 1.23 0 010 2.1l-7 4.2A1.23 1.23 0 016.5 13.2V4.8Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-7 w-7 fill-current">
      <path d="M6.5 4.5A1.5 1.5 0 018 6v8a1.5 1.5 0 11-3 0V6a1.5 1.5 0 011.5-1.5Zm6 0A1.5 1.5 0 0114 6v8a1.5 1.5 0 11-3 0V6a1.5 1.5 0 011.5-1.5Z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current">
      <path d="M6.4 4.9h7.2A1.5 1.5 0 0115.1 6.4v7.2a1.5 1.5 0 01-1.5 1.5H6.4a1.5 1.5 0 01-1.5-1.5V6.4a1.5 1.5 0 011.5-1.5Z" />
    </svg>
  );
}


function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10A15.3 15.3 0 0112 2z" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 6h16M6 12h12M9 18h6" strokeLinecap="round" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function VolumeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default App;
