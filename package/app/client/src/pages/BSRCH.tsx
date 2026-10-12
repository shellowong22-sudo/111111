import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Search, TrendingUp, TrendingDown, Clock, X, ChevronRight, BarChart2, Globe, DollarSign, Newspaper, Activity, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";

const TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  equity: { label: "Equity", icon: TrendingUp, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  bond: { label: "Bond", icon: BarChart2, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  fx: { label: "FX", icon: Globe, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  commodity: { label: "Commodity", icon: DollarSign, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
  index: { label: "Index", icon: Activity, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
  news: { label: "News", icon: Newspaper, color: "text-gray-400", bg: "bg-gray-500/10 border-gray-500/20" },
  economic: { label: "Economic", icon: Zap, color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20" },
};

const ROUTE_MAP: Record<string, string> = {
  equity: "/equity-market",
  index: "/index-hub",
  fx: "/forex-hub",
  bond: "/fixed-income-trade",
  commodity: "/commodity-prices",
  news: "/news-hub",
  economic: "/econ-hub",
};

const QUICK_SEARCHES = ["SPX", "AAPL", "EURUSD", "T 10Y", "VIX", "CL1", "NVDA", "BTC"];

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function useLocalStorage<T>(key: string, initial: T): [T, (v: T) => void] {
  const [state, setState] = useState<T>(() => {
    try { return JSON.parse(localStorage.getItem(key) || "") as T; }
    catch { return initial; }
  });
  const set = useCallback((v: T) => {
    setState(v);
    localStorage.setItem(key, JSON.stringify(v));
  }, [key]);
  return [state, set];
}

export default function BSRCH() {
  const [query, setQuery] = useState("");
  const [activeTypes, setActiveTypes] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useLocalStorage<string[]>("bsrch_recent", []);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();

  const debouncedQuery = useDebounce(query, 200);

  const { data: suggestions } = trpc.platformTools.getSuggestions.useQuery(
    { query: debouncedQuery },
    { enabled: debouncedQuery.length >= 1 }
  );

  const { data: results, isLoading } = trpc.platformTools.search.useQuery(
    { query: debouncedQuery, types: activeTypes.length > 0 ? activeTypes : undefined, limit: 30 },
    { enabled: debouncedQuery.length >= 1 }
  );

  const handleSearch = useCallback((q: string) => {
    setQuery(q);
    setShowSuggestions(false);
    if (q && !recentSearches.includes(q)) {
      setRecentSearches([q, ...recentSearches.slice(0, 9)]);
    }
  }, [recentSearches, setRecentSearches]);

  const toggleType = (type: string) => {
    setActiveTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  };

  // Build target URL with code parameter so destination page can auto-focus the security
  const handleResultClick = (result: { type: string; code: string; name?: string }) => {
    const baseRoute = ROUTE_MAP[result.type] || "/";
    const params = new URLSearchParams({ code: result.code });
    if (result.name) params.set("name", result.name);
    navigate(`${baseRoute}?${params.toString()}`);
  };

  const clearRecent = () => setRecentSearches([]);

  return (
    <div className="min-h-screen bg-[#010409] text-[#e6edf3] p-4">
      {/* Header */}
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <Search className="w-6 h-6 text-blue-400" />
          <h1 className="text-xl font-bold text-[#e6edf3]">BSRCH – Ucheer Search</h1>
          <span className="text-xs text-[#8b949e] ml-2">Full-market intelligent search engine</span>
        </div>

        {/* Search Box */}
        <div className="relative mb-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8b949e]" />
            <Input
              ref={inputRef}
              value={query}
              onChange={e => { setQuery(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onKeyDown={e => { if (e.key === "Enter") handleSearch(query); if (e.key === "Escape") setShowSuggestions(false); }}
              placeholder="Search securities, bonds, FX, indices, news... (e.g. AAPL, EURUSD, T 10Y)"
              className="pl-12 pr-10 h-12 text-base bg-[#161b22] border-[#30363d] focus:border-blue-500 rounded-xl"
              autoFocus
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8b949e] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {showSuggestions && (suggestions?.suggestions?.length || 0) > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl z-50 overflow-hidden">
              {suggestions!.suggestions.map(s => {
                const cfg = TYPE_CONFIG[s.type];
                const Icon = cfg?.icon || Search;
                return (
                  <button
                    key={s.code}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#21262d] text-left transition-colors"
                    onMouseDown={() => handleSearch(s.code)}
                  >
                    <Icon className={`w-4 h-4 ${cfg?.color || "text-[#8b949e]"}`} />
                    <span className="font-mono text-sm text-[#e6edf3]">{s.code}</span>
                    <span className="text-xs text-[#8b949e]">{s.name}</span>
                    <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded border ${cfg?.bg || ""} ${cfg?.color || ""}`}>{cfg?.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Searches */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-xs text-[#8b949e] self-center">Quick:</span>
          {QUICK_SEARCHES.map(q => (
            <button key={q} onClick={() => handleSearch(q)}
              className="px-2.5 py-1 text-xs rounded-lg bg-[#161b22] border border-[#30363d] text-[#8b949e] hover:text-white hover:border-blue-500 transition-colors">
              {q}
            </button>
          ))}
        </div>

        {/* Type Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={() => setActiveTypes([])}
            className={`px-3 py-1 text-xs rounded-lg transition-colors ${activeTypes.length === 0 ? "bg-blue-600 text-white" : "bg-[#161b22] border border-[#30363d] text-[#8b949e] hover:text-white"}`}>
            All
          </button>
          {Object.entries(TYPE_CONFIG).map(([type, cfg]) => {
            const Icon = cfg.icon;
            const count = results?.byType?.[type as keyof typeof results.byType] || 0;
            return (
              <button key={type} onClick={() => toggleType(type)}
                className={`px-3 py-1 text-xs rounded-lg flex items-center gap-1 transition-colors border ${activeTypes.includes(type) ? `${cfg.bg} ${cfg.color} border-current` : "bg-[#161b22] border-[#30363d] text-[#8b949e] hover:text-white"}`}>
                <Icon className="w-3 h-3" />
                {cfg.label}
                {count > 0 && <span className="ml-1 opacity-70">({count})</span>}
              </button>
            );
          })}
        </div>

        {/* Results or Empty State */}
        {debouncedQuery.length >= 1 ? (
          <div className="space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="ml-3 text-[#8b949e]">Searching...</span>
              </div>
            ) : (results?.results?.length || 0) === 0 ? (
              <div className="text-center py-12">
                <Search className="w-12 h-12 text-[#21262d] mx-auto mb-3" />
                <p className="text-[#8b949e]">No results found for "{debouncedQuery}"</p>
                <p className="text-xs text-[#8b949e]/60 mt-1">Try a different search term or remove filters</p>
              </div>
            ) : (
              <>
                <div className="text-xs text-[#8b949e] mb-2">{results!.total} results for "{debouncedQuery}"</div>
                {(results?.results || []).map(result => {
                  const cfg = TYPE_CONFIG[result.type];
                  const Icon = cfg?.icon || Search;
                  const isPositive = (result.change || 0) >= 0;
                  return (
                    <div key={result.id}
                      onClick={() => handleResultClick(result)}
                      className="bg-[#0d1117] border border-[#21262d] rounded-lg p-3 hover:border-blue-500/50 cursor-pointer transition-all group flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${cfg?.bg || "bg-[#21262d]"}`}>
                        <Icon className={`w-4 h-4 ${cfg?.color || "text-[#8b949e]"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-sm text-[#e6edf3]">{result.code}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${cfg?.bg || ""} ${cfg?.color || ""}`}>{cfg?.label}</span>
                          {result.sector && <span className="text-[10px] text-[#8b949e]">{result.sector}</span>}
                        </div>
                        <div className="text-xs text-[#8b949e] truncate">{result.name}</div>
                        {result.description && <div className="text-[10px] text-[#8b949e]/60 truncate">{result.description}</div>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        {result.type !== "news" && result.type !== "economic" && result.price > 0 && (
                          <>
                            <div className="text-sm font-mono font-semibold text-[#e6edf3]">
                              {result.price > 100 ? result.price.toFixed(2) : result.price.toFixed(4)}
                            </div>
                            <div className={`text-xs font-mono flex items-center gap-0.5 justify-end ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
                              {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {isPositive ? "+" : ""}{result.change?.toFixed(2)}
                            </div>
                          </>
                        )}
                        {result.type === "news" && (result as { date?: string }).date && (
                          <div className="text-xs text-[#8b949e]">{(result as { date?: string }).date}</div>
                        )}
                        {result.mktCap && result.mktCap !== "-" && (
                          <div className="text-[10px] text-[#8b949e]">{result.mktCap}</div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <ChevronRight className="w-4 h-4 text-[#8b949e] group-hover:text-white transition-colors" />
                        <span className="text-[9px] text-[#8b949e]/50 group-hover:text-blue-400/70 transition-colors">
                          {ROUTE_MAP[result.type]?.replace(/\//,"") || "hub"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-[#e6edf3] flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#8b949e]" />
                    Recent Searches
                  </h3>
                  <button onClick={clearRecent} className="text-xs text-[#8b949e] hover:text-white">Clear</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map(s => (
                    <button key={s} onClick={() => handleSearch(s)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-[#161b22] border border-[#30363d] text-[#8b949e] hover:text-white hover:border-blue-500 transition-colors">
                      <Clock className="w-3 h-3" />
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Market Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { code: "SPX Index", name: "S&P 500", value: "5,248.42", change: "+18.25", positive: true, type: "index" },
                { code: "EURUSD", name: "EUR/USD", value: "1.0842", change: "+0.0012", positive: true, type: "fx" },
                { code: "CL1 Comdty", name: "WTI Crude", value: "$78.45", change: "-0.82", positive: false, type: "commodity" },
                { code: "T 10Y", name: "US 10Y Yield", value: "4.35%", change: "+0.02", positive: false, type: "bond" },
              ].map(item => {
                const cfg = TYPE_CONFIG[item.type];
                const Icon = cfg?.icon || Activity;
                return (
                  <div key={item.code} onClick={() => handleSearch(item.code)}
                    className="bg-[#0d1117] border border-[#21262d] rounded-lg p-3 cursor-pointer hover:border-blue-500/50 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={`w-4 h-4 ${cfg?.color}`} />
                      <span className="text-xs text-[#8b949e]">{item.name}</span>
                    </div>
                    <div className="text-lg font-mono font-semibold text-[#e6edf3]">{item.value}</div>
                    <div className={`text-xs font-mono ${item.positive ? "text-emerald-400" : "text-red-400"}`}>{item.change}</div>
                  </div>
                );
              })}
            </div>

            {/* Search Tips */}
            <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-4">
              <h3 className="text-sm font-semibold text-[#e6edf3] mb-3">Search Tips</h3>
              <div className="grid grid-cols-2 gap-2 text-xs text-[#8b949e]">
                {[
                  ["AAPL US", "→ Apple equity page"],
                  ["EURUSD", "→ EUR/USD FX rate"],
                  ["T 10Y", "→ US 10-year Treasury"],
                  ["SPX Index", "→ S&P 500 index"],
                  ["CL1 Comdty", "→ WTI crude oil futures"],
                  ["GDP US", "→ US GDP economic data"],
                ].map(([cmd, desc]) => (
                  <div key={cmd} className="flex items-center gap-2">
                    <code className="bg-[#161b22] px-2 py-0.5 rounded text-blue-400 font-mono">{cmd}</code>
                    <span>{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
