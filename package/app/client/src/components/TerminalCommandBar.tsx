import { useState, useRef, useEffect, useMemo } from "react";
import {
  Search,
  Settings,
  HelpCircle,
  LogOut,
  Sun,
  Moon,
  Keyboard,
  Bell,
  LayoutDashboard,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc";
import { useSSENotifications } from "@/hooks/useSSENotifications";
import { cn } from "@/lib/utils";

interface TerminalCommandBarProps {
  onNavigate?: (module: string) => void;
}

const QUICK_COMMANDS = [
  { symbol: "SPX", name: "S&P 500" },
  { symbol: "INDU", name: "Dow Jones" },
  { symbol: "CCMP", name: "Nasdaq" },
  { symbol: "USGG10YR", name: "10Y US Yield" },
  { symbol: "EURUSD", name: "EUR/USD" },
  { symbol: "GBPUSD", name: "GBP/USD" },
  { symbol: "AUDUSD", name: "AUD/USD" },
  { symbol: "XAUUSD", name: "Gold" },
  { symbol: "XBRUSD", name: "Brent Oil" },
  { symbol: "XWTIUSD", name: "WTI Oil" },
];

export default function TerminalCommandBar({
  onNavigate,
}: TerminalCommandBarProps) {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 接入真实行情搜索接口
  const { data: searchResults = [] } = trpc.market.search.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.trim().length > 0 }
  );

  // 合并：优先真实行情数据，补充常用快捷指令
  const suggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q)
      return [] as Array<{ symbol: string; name: string; isReal: boolean }>;
    const real = searchResults.map(r => ({
      symbol: r.symbol,
      name: r.name,
      isReal: true,
    }));
    const realSymbols = new Set(real.map(r => r.symbol));
    const quick = QUICK_COMMANDS.filter(
      cmd =>
        (cmd.symbol.toLowerCase().includes(q) ||
          cmd.name.toLowerCase().includes(q)) &&
        !realSymbols.has(cmd.symbol)
    ).map(cmd => ({ symbol: cmd.symbol, name: cmd.name, isReal: false }));
    return [...real, ...quick].slice(0, 10);
  }, [searchQuery, searchResults]);

  // 跳转到行情详情页，并触发 symbol 变更事件
  const goToSymbol = (symbol: string) => {
    setSearchQuery("");
    setShowSuggestions(false);
    navigate(`/market?symbol=${encodeURIComponent(symbol)}`);
    // 延迟触发，确保 MarketDataPage 已挂载后读取最新 URL
    setTimeout(
      () => window.dispatchEvent(new CustomEvent("market-symbol-change")),
      50
    );
  };

  const handleCommandSelect = (symbol: string) => {
    goToSymbol(symbol);
  };

  // 回车：选中第一个建议，若无则尝试直接用输入作为代码跳转
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (suggestions.length > 0) {
        goToSymbol(suggestions[0].symbol);
      } else if (searchQuery.trim()) {
        goToSymbol(searchQuery.trim().toUpperCase());
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  return (
    <div className="bg-card border-b border-border px-4 py-3 flex items-center justify-between gap-4">
      {/* Left: Logo & Title */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-accent rounded-sm flex items-center justify-center">
            <span className="text-accent-foreground font-bold text-lg">B</span>
          </div>
          <div className="hidden sm:block">
            <h1 className="terminal-title text-xs">Finance Hub Terminal</h1>
            <p className="text-xs text-muted-foreground">
              Professional Financial Terminal
            </p>
          </div>
        </div>
      </div>

      {/* Center: Command Search */}
      <div className="flex-1 max-w-md relative" ref={searchRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="输入代码或名称搜索行情（如 AAPL、US10Y）— 回车跳转"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleSearchKeyDown}
            className="pl-9 bg-input border-border text-foreground placeholder:text-muted-foreground font-mono"
          />
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && searchQuery && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-sm shadow-lg z-50 max-h-72 overflow-y-auto">
            {suggestions.length > 0 ? (
              <div className="p-1">
                {suggestions.map((cmd, i) => (
                  <button
                    key={`${cmd.symbol}-${i}`}
                    onClick={() => handleCommandSelect(cmd.symbol)}
                    className="w-full text-left px-3 py-2 hover:bg-muted/50 rounded-sm transition-colors text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-semibold text-accent">
                        {cmd.symbol}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">
                        {cmd.name}
                      </span>
                      {cmd.isReal && (
                        <span className="text-[10px] text-green-500 font-mono shrink-0">
                          ●实时
                        </span>
                      )}
                    </div>
                  </button>
                ))}
                <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-t border-border/40 mt-1">
                  按 Enter 跳转第一个结果
                </div>
              </div>
            ) : (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                未找到匹配品种，按 Enter 直接搜索 “{searchQuery.toUpperCase()}”
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: User Menu & Actions */}
      <div className="flex items-center gap-2">
        {/* Notification Bell */}
        <NotificationBell />

        {/* Theme Toggle */}
        <ThemeToggleButton />

        {/* Shortcuts Help Button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 hover:bg-muted hidden sm:flex items-center justify-center"
          onClick={() => {
            const event = new CustomEvent("open-shortcuts-help");
            window.dispatchEvent(event);
          }}
          title="Show keyboard shortcuts (Ctrl+/)"
        >
          <Keyboard className="w-4 h-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-muted"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={() => navigate("/settings")}
              className="text-xs cursor-pointer"
            >
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigate("/admin")}
              className="text-xs cursor-pointer"
            >
              <LayoutDashboard className="w-4 h-4 mr-2" />
              管理后台
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => navigate("/settings")}
              className="text-xs cursor-pointer"
            >
              Preferences
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigate("/help")}
              className="text-xs cursor-pointer"
            >
              Keyboard Shortcuts
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={logout}
              className="text-xs cursor-pointer"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-muted"
            >
              <HelpCircle className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={() => navigate("/help")}
              className="text-xs cursor-pointer"
            >
              Help & Support
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => navigate("/help")}
              className="text-xs cursor-pointer"
            >
              Keyboard Shortcuts
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigate("/help")}
              className="text-xs cursor-pointer"
            >
              About Terminal
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {user && (
          <div className="hidden sm:flex items-center gap-2 ml-2 pl-2 border-l border-border">
            <div className="w-6 h-6 bg-accent rounded-full flex items-center justify-center">
              <span className="text-xs font-bold text-accent-foreground">
                U
              </span>
            </div>
            <span className="text-xs text-muted-foreground">用户</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Theme toggle button — animated pill switch with Sun/Moon icons
 */
/**
 * Notification bell with unread count badge
 */
function NotificationBell() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { unreadCount: sseUnreadCount, connected: sseConnected } =
    useSSENotifications();
  const { data } = trpc.notification.unreadCount.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 30000, // Poll every 30s
  });

  if (!user) return null;

  const count = sseConnected ? sseUnreadCount : data?.count || 0;

  return (
    <Button
      variant="ghost"
      size="sm"
      className="relative h-8 w-8 p-0 hover:bg-muted"
      onClick={() => navigate("/notifications")}
      title="消息中心"
    >
      <Bell className="w-4 h-4" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 animate-pulse">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Button>
  );
}

function ThemeToggleButton() {
  const { theme, toggleTheme, switchable } = useTheme();
  const [animKey, setAnimKey] = useState(0);
  if (!switchable || !toggleTheme) return null;

  const isDark = theme === "dark";

  const handleClick = () => {
    setAnimKey(k => k + 1);
    toggleTheme();
  };

  return (
    <button
      onClick={handleClick}
      title={isDark ? "切换到日间模式" : "切换到夜间模式"}
      aria-label={isDark ? "切换到日间模式" : "切换到夜间模式"}
      className={cn(
        "relative h-7 w-[3.25rem] rounded-full border flex items-center flex-shrink-0",
        "transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        "active:scale-95",
        isDark
          ? "bg-slate-800 border-slate-600 hover:border-blue-500/60"
          : "bg-amber-50 border-amber-200 hover:border-amber-400"
      )}
    >
      {/* Sliding thumb */}
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full shadow-sm flex items-center justify-center",
          "transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]",
          isDark
            ? "translate-x-[1.625rem] bg-slate-700 border border-slate-500"
            : "translate-x-0.5 bg-white border border-amber-200 shadow-amber-100"
        )}
      >
        <span key={animKey} className="theme-icon-enter">
          {isDark ? (
            <Moon className="w-3 h-3 text-blue-300" />
          ) : (
            <Sun className="w-3 h-3 text-amber-500" />
          )}
        </span>
      </span>
      {/* Background label */}
      <span
        className={cn(
          "absolute font-mono font-bold text-[8px] tracking-wide transition-all duration-200",
          isDark ? "left-1.5 text-blue-400/70" : "right-1.5 text-amber-400/70"
        )}
      >
        {isDark ? "NGT" : "DAY"}
      </span>
    </button>
  );
}
