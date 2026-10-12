import { useEffect, useState } from 'react';
import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import BlsMacroReleaseEvidenceDesk from '@/components/macro/BlsMacroReleaseEvidenceDesk';

interface EconomicIndicator { name: string; value: number; unit: string; previous: number; forecast: number; timestamp: number; trend: 'up' | 'down' | 'neutral'; }

interface EconomicEvent {
  id: string;
  name: string;
  country: string;
  importance: 'high' | 'medium' | 'low';
  date: number;
  time: string;
  previous: number | null;
  forecast: number | null;
  actual: number | null;
}

interface EconomicDashboardProps {
  title: string;
}

export default function EconomicDashboard({ title }: EconomicDashboardProps) {
  const [indicators, setIndicators] = useState<EconomicIndicator[]>([]);
  const [activeTab, setActiveTab] = useState<'indicators' | 'calendar'>('indicators');
  const [selectedEvent, setSelectedEvent] = useState<EconomicEvent | null>(null);

  // Economic calendar events
  // Calendar rows are intentionally empty until an authenticated official
  // calendar source is configured. This prevents forecasts being presented
  // as market data.
  const [events] = useState<EconomicEvent[]>([]);

  useEffect(() => {
    setIndicators([]);
  }, []);

  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case 'high':
        return 'text-red-400';
      case 'medium':
        return 'text-yellow-400';
      case 'low':
        return 'text-green-400';
      default:
        return 'text-muted-foreground';
    }
  };

  const getImportanceBg = (importance: string) => {
    switch (importance) {
      case 'high':
        return 'bg-red-500/20';
      case 'medium':
        return 'bg-yellow-500/20';
      case 'low':
        return 'bg-green-500/20';
      default:
        return 'bg-muted/20';
    }
  };

  const upcomingEvents = events
    .filter(e => e.date >= Date.now())
    .sort((a, b) => a.date - b.date)
    .slice(0, 5);

  if (selectedEvent) {
    return (
      <div className="flex flex-col h-full">
        <div className="terminal-header">
          <h3 className="terminal-title text-sm">{selectedEvent.name}</h3>
          <button
            onClick={() => setSelectedEvent(null)}
            className="text-muted-foreground hover:text-foreground transition-colors text-xs"
          >
            ← Back
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-background/50 p-4 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-mono">Country</span>
              <span className="text-xs font-mono text-foreground">{selectedEvent.country}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-mono">Importance</span>
              <span className={cn('text-xs font-semibold uppercase', getImportanceColor(selectedEvent.importance))}>
                {selectedEvent.importance}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-mono">Date & Time</span>
              <span className="text-xs font-mono text-foreground">
                {new Date(selectedEvent.date).toLocaleDateString()} {selectedEvent.time}
              </span>
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-2">
            <div className="text-xs text-muted-foreground font-mono mb-2">FORECAST DATA</div>
            {selectedEvent.previous !== null && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Previous</span>
                <span className="text-xs font-mono text-foreground">{selectedEvent.previous}</span>
              </div>
            )}
            {selectedEvent.forecast !== null && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Forecast</span>
                <span className="text-xs font-mono text-accent">{selectedEvent.forecast}</span>
              </div>
            )}
            {selectedEvent.actual !== null && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Actual</span>
                <span className="text-xs font-mono text-green-400">{selectedEvent.actual}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="terminal-header">
        <h3 className="terminal-title">{title}</h3>
        <span className="text-xs text-muted-foreground">
          {new Date().toLocaleDateString()}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border bg-card/50">
        <button
          onClick={() => setActiveTab('indicators')}
          className={cn(
            'flex-1 px-3 py-2 text-xs font-mono transition-colors',
            activeTab === 'indicators'
              ? 'bg-accent/20 text-accent border-b-2 border-accent'
              : 'text-muted-foreground hover:bg-muted/50'
          )}
        >
          Indicators
        </button>
        <button
          onClick={() => setActiveTab('calendar')}
          className={cn(
            'flex-1 px-3 py-2 text-xs font-mono transition-colors',
            activeTab === 'calendar'
              ? 'bg-accent/20 text-accent border-b-2 border-accent'
              : 'text-muted-foreground hover:bg-muted/50'
          )}
        >
          Calendar
        </button>
      </div>

      {activeTab === 'indicators' && (
        <div className="flex-1 overflow-auto bg-background/50 p-2">
          <BlsMacroReleaseEvidenceDesk />
          {indicators.length === 0 && <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">未配置其他官方经济指标源；不显示静态或预测值。</p>}
        </div>
      )}

      {activeTab === 'calendar' && (
        <div className="flex-1 overflow-y-auto bg-background/50">
          <div className="p-2 space-y-1">
            <div className="text-xs text-muted-foreground font-mono mb-2 px-2">UPCOMING EVENTS</div>
            {upcomingEvents.length > 0 ? (
              <div className="divide-y divide-border">
                {upcomingEvents.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => setSelectedEvent(event)}
                    className={cn(
                      'w-full text-left p-2 hover:bg-muted/10 transition-colors border-l-2',
                      getImportanceBg(event.importance),
                      'border-accent/30'
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-semibold text-foreground">
                          {event.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground font-mono">
                            {event.country}
                          </span>
                          <span className={cn('text-xs font-semibold uppercase', getImportanceColor(event.importance))}>
                            {event.importance}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-muted-foreground">
                            {new Date(event.date).toLocaleDateString()} {event.time}
                          </span>
                          {event.forecast !== null && (
                            <span className="text-xs font-mono text-accent">
                              F: {event.forecast}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p className="text-xs font-mono">No upcoming events</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
