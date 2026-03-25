function CountryPicker({ countries, selected, onSelect, loading, query, onQueryChange }) {
  return (
    <div className="flex flex-col gap-4 min-h-0 flex-1">
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
          Search Country
        </label>
        <input
          type="text"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Japan, Germany, Brazil..."
          className="w-full rounded-2xl border border-white/10 bg-black/22 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-violet-400/35 focus:outline-none"
        />
      </div>

      {selected && (
        <div className="rounded-2xl border border-violet-400/20 bg-violet-400/10 px-4 py-3 text-sm text-violet-50">
          Selected: {selected.name}
        </div>
      )}

      <div className="flex-1 min-h-0 space-y-2 overflow-y-auto pr-1">
        {loading && (
          <div className="rounded-2xl border border-white/8 bg-white/6 px-4 py-8 text-center text-sm text-slate-300">
            Loading countries...
          </div>
        )}

        {!loading && countries.length === 0 && (
          <div className="rounded-2xl border border-white/8 bg-white/6 px-4 py-8 text-center text-sm text-slate-400">
            No countries found
          </div>
        )}

        {!loading &&
          countries.map((country) => {
            const active = selected?.iso_3166_1 === country.iso_3166_1;

            return (
              <button
                key={country.iso_3166_1}
                onClick={() => onSelect(country)}
                className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition duration-300 ${
                  active
                    ? 'border-violet-400/30 bg-violet-400/12 text-white'
                    : 'border-white/8 bg-white/6 text-slate-200 hover:border-white/16 hover:bg-white/10'
                }`}
              >
                <span className="truncate text-sm font-medium">{country.name}</span>
                <span className="rounded-full bg-black/20 px-2.5 py-1 text-xs text-slate-400">
                  {country.stationcount}
                </span>
              </button>
            );
          })}
      </div>
    </div>
  );
}

export default CountryPicker;
