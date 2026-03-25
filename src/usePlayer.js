import { useState, useRef, useCallback, useEffect } from 'react';

export function usePlayer() {
  const audioRef = useRef(null);
  const [current, setCurrent] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [volume, setVolumeState] = useState(0.72);

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
      const url = station?.url_resolved || station?.url;
      if (!station || !url) return false;

      if (current?.stationuuid === station.stationuuid && playing && audioRef.current) {
        audioRef.current.pause();
        setPlaying(false);
        return true;
      }

      cleanup();

      const audio = new Audio();
      audio.volume = volume;
      audioRef.current = audio;

      audio.addEventListener('playing', () => {
        setLoading(false);
        setPlaying(true);
      });

      audio.addEventListener('pause', () => {
        setPlaying(false);
      });

      audio.addEventListener('waiting', () => {
        setLoading(true);
      });

      audio.addEventListener('error', () => {
        setLoading(false);
        setPlaying(false);
      });

      setCurrent(station);
      setLoading(true);

      try {
        audio.src = url;
        await audio.play();
        return true;
      } catch {
        setLoading(false);
        setPlaying(false);
        return false;
      }
    },
    [current?.stationuuid, playing, cleanup, volume]
  );

  const stop = useCallback(
    ({ clearCurrent = false } = {}) => {
      cleanup();
      setPlaying(false);
      setLoading(false);
      if (clearCurrent) setCurrent(null);
    },
    [cleanup]
  );

  const setVolume = useCallback((v) => {
    setVolumeState(v);
    if (audioRef.current) audioRef.current.volume = v;
  }, []);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
      }
    };
  }, []);

  return { current, playing, loading, volume, play, stop, setVolume };
}
