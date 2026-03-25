function Filters({
  states,
  selectedState,
  onStateChange,
  searchName,
  onNameChange,
  searchTag,
  onTagChange,
  onSearch,
}) {
  return (
    <div className="space-y-4">
      {states.length > 0 && (
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            Region
          </label>
          <select
            value={selectedState}
            onChange={(event) => onStateChange(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/22 px-4 py-3 text-sm text-white focus:border-violet-400/35 focus:outline-none"
          >
            <option value="">All regions</option>
            {states.map((state) => (
              <option key={state.name} value={state.name}>
                {state.name} ({state.stationcount})
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
          Station Name
        </label>
        <input
          type="text"
          value={searchName}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="Rock FM, Jazz, Hits"
          className="w-full rounded-2xl border border-white/10 bg-black/22 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-violet-400/35 focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
          Genre
        </label>
        <input
          type="text"
          value={searchTag}
          onChange={(event) => onTagChange(event.target.value)}
          placeholder="pop, jazz, news"
          className="w-full rounded-2xl border border-white/10 bg-black/22 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-violet-400/35 focus:outline-none"
        />
      </div>

      <button
        onClick={onSearch}
        className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition duration-300 hover:bg-violet-200"
      >
        Search
      </button>
    </div>
  );
}

export default Filters;
