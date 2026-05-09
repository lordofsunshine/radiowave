import { useState, useRef, useCallback, useEffect } from 'react';

const VOLUME_STORAGE_KEY = 'radiowave:volume';

function clampVolume(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0.72;
  return Math.max(0, Math.min(1, parsed));
}

function readStoredVolume() {
  if (typeof localStorage === 'undefined') return 0.72;
  return clampVolume(localStorage.getItem(VOLUME_STORAGE_KEY) ?? 0.72);
}

function getStreamUrl(station) {
  return station?.url_resolved || station?.url || '';
}

function getStationIndex(stations, station) {
  if (!station) return -1;
  return stations.findIndex((item) => item.stationuuid === station.stationuuid);
}

function getArtwork(station) {
  if (!station?.favicon || typeof window === 'undefined') return [];
  try {
    return [{ src: new URL(station.favicon, window.location.href).href, sizes: '512x512', type: 'image/png' }];
  } catch {
    return [];
  }
}

export function usePlayer(queue = []) {
  const audioRef = useRef(null);
  const queueRef = useRef(queue);
  const [current, setCurrent] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [volume, setVolumeState] = useState(readStoredVolume);
  const [muted, setMuted] = useState(false);
  const [streamStatus, setStreamStatus] = useState('idle');
  const [streamError, setStreamError] = useState('');

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const cleanup = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    audioRef.current = null;
  }, []);

  const play = useCallback(
    async (station) => {
      const url = getStreamUrl(station);
      if (!station || !url) {
        setStreamStatus('error');
        setStreamError('This station does not provide a playable stream URL.');
        return false;
      }

      if (current?.stationuuid === station.stationuuid && playing && audioRef.current) {
        audioRef.current.pause();
        setPlaying(false);
        setStreamStatus('paused');
        return true;
      }

      cleanup();

      const audio = new Audio();
      audio.volume = muted ? 0 : volume;
      audio.preload = 'none';
      audioRef.current = audio;

      audio.addEventListener('canplay', () => {
        setStreamStatus('ready');
        setStreamError('');
      });

      audio.addEventListener('playing', () => {
        setLoading(false);
        setPlaying(true);
        setStreamStatus('playing');
        setStreamError('');
      });

      audio.addEventListener('pause', () => {
        setPlaying(false);
        if (audioRef.current === audio && !audio.ended) setStreamStatus('paused');
      });

      audio.addEventListener('waiting', () => {
        setLoading(true);
        setStreamStatus('loading');
      });

      audio.addEventListener('stalled', () => {
        setLoading(true);
        setStreamStatus('stalled');
        setStreamError('The station stream stalled. You can wait or try another station.');
      });

      audio.addEventListener('ended', () => {
        setLoading(false);
        setPlaying(false);
        setStreamStatus('ended');
        setStreamError('The station stream ended.');
      });

      audio.addEventListener('error', () => {
        setLoading(false);
        setPlaying(false);
        setStreamStatus('error');
        setStreamError('This station is not responding. Try another station.');
      });

      setCurrent(station);
      setLoading(true);
      setStreamStatus('loading');
      setStreamError('');

      try {
        audio.src = url;
        await audio.play();
        return true;
      } catch (error) {
        setLoading(false);
        setPlaying(false);
        if (error?.name === 'NotAllowedError') {
          setStreamStatus('blocked');
          setStreamError('Your browser blocked autoplay. Press Play to start the station.');
        } else {
          setStreamStatus('error');
          setStreamError('Could not start this stream. Try another station.');
        }
        return false;
      }
    },
    [current?.stationuuid, playing, cleanup, volume, muted]
  );

  const stop = useCallback(
    ({ clearCurrent = false } = {}) => {
      cleanup();
      setPlaying(false);
      setLoading(false);
      setStreamStatus(clearCurrent ? 'idle' : 'paused');
      setStreamError('');
      if (clearCurrent) setCurrent(null);
    },
    [cleanup]
  );

  const setVolume = useCallback((v) => {
    const next = clampVolume(v);
    setVolumeState(next);
    if (typeof localStorage !== 'undefined') localStorage.setItem(VOLUME_STORAGE_KEY, String(next));
    if (next > 0) setMuted(false);
    if (audioRef.current) audioRef.current.volume = next;
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((value) => {
      const next = !value;
      if (audioRef.current) audioRef.current.volume = next ? 0 : volume;
      return next;
    });
  }, [volume]);

  const previous = useCallback(() => {
    const stations = queueRef.current;
    if (!stations.length) return false;
    const index = getStationIndex(stations, current);
    const targetIndex = index <= 0 ? stations.length - 1 : index - 1;
    return play(stations[targetIndex]);
  }, [current, play]);

  const next = useCallback(() => {
    const stations = queueRef.current;
    if (!stations.length) return false;
    const index = getStationIndex(stations, current);
    const targetIndex = index < 0 || index >= stations.length - 1 ? 0 : index + 1;
    return play(stations[targetIndex]);
  }, [current, play]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = muted ? 0 : volume;
  }, [muted, volume]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    if (current) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: current.name || 'RadioWave',
        artist: current.country || current.language || 'Live radio',
        album: current.tags || '',
        artwork: getArtwork(current),
      });
    }

    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
    navigator.mediaSession.setActionHandler('play', () => current && play(current));
    navigator.mediaSession.setActionHandler('pause', () => stop({ clearCurrent: false }));
    navigator.mediaSession.setActionHandler('stop', () => stop({ clearCurrent: false }));
    navigator.mediaSession.setActionHandler('previoustrack', previous);
    navigator.mediaSession.setActionHandler('nexttrack', next);

    return () => {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('stop', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
      navigator.mediaSession.setActionHandler('nexttrack', null);
    };
  }, [current, playing, play, stop, previous, next]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
      }
    };
  }, []);

  return {
    current,
    playing,
    loading,
    volume,
    muted,
    streamStatus,
    streamError,
    play,
    stop,
    setVolume,
    toggleMute,
    next,
    previous,
    hasNext: queue.length > 1,
    hasPrevious: queue.length > 1,
  };
}
