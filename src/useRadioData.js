import { useState, useEffect, useCallback, useRef, startTransition } from 'react';
import { getCountries, getStates, searchStations } from './api';

const PAGE_SIZE = 50;

function sortByLogo(stations) {
  const withLogo = [];
  const withoutLogo = [];
  for (const s of stations) {
    if (s.favicon) withLogo.push(s);
    else withoutLogo.push(s);
  }
  return [...withLogo, ...withoutLogo];
}

export function useRadioData() {
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [stations, setStations] = useState([]);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [loadingStations, setLoadingStations] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(null);

  const [selectedCountry, setSelectedCountryState] = useState(null);
  const [selectedState, setSelectedState] = useState('');
  const [searchName, setSearchName] = useState('');
  const [searchTag, setSearchTag] = useState('');
  const offsetRef = useRef(0);

  useEffect(() => {
    getCountries()
      .then((data) => {
        const filtered = data.filter((country) => country.stationcount > 0);
        startTransition(() => {
          setCountries(filtered);
        });
      })
      .catch(() => setError('Failed to load countries'))
      .finally(() => setLoadingCountries(false));
  }, []);

  useEffect(() => {
    if (!selectedCountry) {
      setStates([]);
      return;
    }

    getStates(selectedCountry.name)
      .then((data) => {
        startTransition(() => {
          setStates(data.filter((state) => state.stationcount > 0));
        });
      })
      .catch(() => setStates([]));
  }, [selectedCountry]);

  const search = useCallback(
    async (country = selectedCountry) => {
      if (!country) {
        setStations([]);
        return [];
      }

      setLoadingStations(true);
      setError(null);
      offsetRef.current = 0;

      try {
        const data = await searchStations({
          countrycode: country.iso_3166_1,
          state: selectedState || undefined,
          name: searchName || undefined,
          tag: searchTag || undefined,
          limit: PAGE_SIZE,
          offset: 0,
        });

        startTransition(() => {
          setStations(sortByLogo(data));
          setHasMore(data.length >= PAGE_SIZE);
          offsetRef.current = data.length;
        });

        return data;
      } catch {
        setError('Failed to search stations');
        setStations([]);
        return [];
      } finally {
        setLoadingStations(false);
      }
    },
    [searchName, searchTag, selectedCountry, selectedState]
  );

  const loadMore = useCallback(async () => {
    if (!selectedCountry || loadingMore || !hasMore) return;

    setLoadingMore(true);

    try {
      const data = await searchStations({
        countrycode: selectedCountry.iso_3166_1,
        state: selectedState || undefined,
        name: searchName || undefined,
        tag: searchTag || undefined,
        limit: PAGE_SIZE,
        offset: offsetRef.current,
      });

      startTransition(() => {
        setStations((prev) => {
          const existingIds = new Set(prev.map((s) => s.stationuuid));
          const newStations = data.filter((s) => !existingIds.has(s.stationuuid));
          return sortByLogo([...prev, ...newStations]);
        });
        setHasMore(data.length >= PAGE_SIZE);
        offsetRef.current += data.length;
      });
    } catch {
    } finally {
      setLoadingMore(false);
    }
  }, [selectedCountry, selectedState, searchName, searchTag, loadingMore, hasMore]);

  useEffect(() => {
    if (!selectedCountry) {
      setStations([]);
      return;
    }

    search(selectedCountry);
  }, [search, selectedCountry, selectedState]);

  const setSelectedCountry = useCallback((country) => {
    setSelectedCountryState(country);
    setSelectedState('');
    setSearchName('');
    setSearchTag('');
    setStations([]);
    setError(null);
  }, []);

  const selectCountryByCode = useCallback(
    (countryCode) => {
      if (!countryCode) return null;

      const match = countries.find(
        (country) => country.iso_3166_1.toUpperCase() === countryCode.toUpperCase()
      );

      if (match) {
        setSelectedCountry(match);
      }

      return match ?? null;
    },
    [countries, setSelectedCountry]
  );

  return {
    countries,
    states,
    stations,
    loadingCountries,
    loadingStations,
    loadingMore,
    hasMore,
    error,
    selectedCountry,
    setSelectedCountry,
    selectCountryByCode,
    selectedState,
    setSelectedState,
    searchName,
    setSearchName,
    searchTag,
    setSearchTag,
    search,
    loadMore,
  };
}
