import { useEffect, useRef } from 'react';
import { countClick } from './api';

function StationList({ stations, loading, currentUuid, playing, onPlay, onLoadMore, hasMore, loadingMore }) {
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!onLoadMore || !hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) onLoadMore();
      },
      { rootMargin: '200px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [onLoadMore, hasMore]);
  if (loading) {
    return (
      <div className="rounded-[26px] border border-white/8 bg-white/6 px-4 py-12 text-center text-slate-300">
        <div className="mx-auto h-8 w-8 rounded-full border-2 border-white/20 border-t-violet-400 animate-spin" />
        <p className="mt-4 text-sm">Loading stations...</p>
      </div>
    );
  }

  if (!stations.length) {
    return (
      <div className="rounded-[26px] border border-white/8 bg-white/6 px-4 py-12 text-center text-sm text-slate-400">
        No stations found
      </div>
    );
  }

  const handlePlay = (station) => {
    onPlay(station);
    countClick(station.stationuuid).catch(() => {});
  };

  return (
    <div className="space-y-2 overflow-y-auto pr-1">
      {stations.map((station, index) => {
        const active = currentUuid === station.stationuuid;
        const isPlaying = active && playing;
        const tags = station.tags
          ?.split(',')
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 2)
          .join(' · ');

        return (
          <button
            key={station.stationuuid}
            onClick={() => handlePlay(station)}
            className={`station-row w-full rounded-[24px] border px-4 py-4 text-left transition duration-300 ${
              active
                ? 'border-violet-400/30 bg-violet-400/12 shadow-[0_16px_45px_rgba(139,92,246,0.12)]'
                : 'border-white/8 bg-white/6 hover:border-white/16 hover:bg-white/10'
            }`}
            style={{ animationDelay: `${index * 60}ms` }}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-[18px] border border-white/10 bg-black/28">
                {station.favicon ? (
                  <img
                    src={station.favicon}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <span className="text-sm font-semibold text-slate-300">
                    {station.name.trim().slice(0, 1).toUpperCase() || 'R'}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="truncate text-sm font-semibold text-white">
                    {station.name.trim()}
                  </div>
                  {active && (
                    <span className="rounded-full border border-violet-400/18 bg-violet-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-violet-100">
                      Live
                    </span>
                  )}
                </div>
                <div className="mt-1 truncate text-xs text-slate-400">
                  {[station.codec, station.bitrate ? `${station.bitrate} kbps` : '', tags]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/24 text-white">
                {isPlaying ? <PauseGlyph /> : <PlayGlyph />}
              </div>
            </div>
          </button>
        );
      })}
      {loadingMore && (
        <div className="py-4 text-center">
          <div className="mx-auto h-6 w-6 rounded-full border-2 border-white/20 border-t-violet-400 animate-spin" />
        </div>
      )}
      {hasMore && <div ref={sentinelRef} className="h-1" />}
    </div>
  );
}

function PlayGlyph() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current">
      <path d="M6.8 5.14c0-.81.9-1.3 1.6-.87l5.82 3.5c.68.42.68 1.4 0 1.82l-5.82 3.5A1.03 1.03 0 016.8 12.2V5.14Z" />
    </svg>
  );
}

function PauseGlyph() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current">
      <path d="M6.7 5.1a1.2 1.2 0 011.2 1.2v7.4a1.2 1.2 0 11-2.4 0V6.3a1.2 1.2 0 011.2-1.2Zm6.6 0a1.2 1.2 0 011.2 1.2v7.4a1.2 1.2 0 11-2.4 0V6.3a1.2 1.2 0 011.2-1.2Z" />
    </svg>
  );
}

export default StationList;
