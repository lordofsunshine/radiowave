import { useState, useEffect, useCallback, useRef, startTransition } from 'react';
import { getCountries, getStates, isRequestAbort, searchStations } from './api';

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
  const searchRequestRef = useRef(null);
  const loadMoreRequestRef = useRef(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const controller = new AbortController();

    getCountries({ signal: controller.signal })
      .then((data) => {
        const filtered = data.filter((country) => country.stationcount > 0);
        startTransition(() => {
          setCountries(filtered);
        });
      })
      .catch((error) => {
        if (!isRequestAbort(error)) setError(error.message || 'Failed to load countries');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingCountries(false);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selectedCountry) {
      setStates([]);
      return;
    }

    const controller = new AbortController();

    getStates(selectedCountry.name, { signal: controller.signal })
      .then((data) => {
        startTransition(() => {
          setStates(data.filter((state) => state.stationcount > 0));
        });
      })
      .catch((error) => {
        if (!isRequestAbort(error)) setStates([]);
      });

    return () => controller.abort();
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
      searchRequestRef.current?.abort();
      loadMoreRequestRef.current?.abort();

      const controller = new AbortController();
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      searchRequestRef.current = controller;

      try {
        const data = await searchStations({
          countrycode: country.iso_3166_1,
          state: selectedState || undefined,
          name: searchName || undefined,
          tag: searchTag || undefined,
          limit: PAGE_SIZE,
          offset: 0,
        }, { signal: controller.signal });

        if (requestIdRef.current !== requestId || controller.signal.aborted) return [];

        startTransition(() => {
          setStations(sortByLogo(data));
          setHasMore(data.length >= PAGE_SIZE);
          offsetRef.current = data.length;
        });

        return data;
      } catch (error) {
        if (!isRequestAbort(error) && requestIdRef.current === requestId) {
          setError(error.message || 'Failed to search stations');
          setStations([]);
          setHasMore(false);
        }
        return [];
      } finally {
        if (requestIdRef.current === requestId && !controller.signal.aborted) {
          setLoadingStations(false);
        }
        if (searchRequestRef.current === controller) searchRequestRef.current = null;
      }
    },
    [searchName, searchTag, selectedCountry, selectedState]
  );

  const loadMore = useCallback(async () => {
    if (!selectedCountry || loadingMore || !hasMore) return;

    setLoadingMore(true);
    loadMoreRequestRef.current?.abort();

    const controller = new AbortController();
    const requestId = requestIdRef.current;
    loadMoreRequestRef.current = controller;

    try {
      const data = await searchStations({
        countrycode: selectedCountry.iso_3166_1,
        state: selectedState || undefined,
        name: searchName || undefined,
        tag: searchTag || undefined,
        limit: PAGE_SIZE,
        offset: offsetRef.current,
      }, { signal: controller.signal });

      if (requestIdRef.current !== requestId || controller.signal.aborted) return;

      startTransition(() => {
        setStations((prev) => {
          const existingIds = new Set(prev.map((s) => s.stationuuid));
          const newStations = data.filter((s) => !existingIds.has(s.stationuuid));
          return sortByLogo([...prev, ...newStations]);
        });
        setHasMore(data.length >= PAGE_SIZE);
        offsetRef.current += data.length;
      });
    } catch (error) {
      if (!isRequestAbort(error)) setError(error.message || 'Failed to load more stations');
    } finally {
      if (!controller.signal.aborted) setLoadingMore(false);
      if (loadMoreRequestRef.current === controller) loadMoreRequestRef.current = null;
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
    searchRequestRef.current?.abort();
    loadMoreRequestRef.current?.abort();
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

  useEffect(() => {
    return () => {
      searchRequestRef.current?.abort();
      loadMoreRequestRef.current?.abort();
    };
  }, []);

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
