import { ChevronRight } from 'lucide-react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';

export default function HelpPage() {
  const [, setLocation] = useLocation();
  const shortcuts = [
    { key: 'Ctrl/Cmd + K', description: 'Open command palette' },
    { key: 'Ctrl/Cmd + N', description: 'New window' },
    { key: 'Ctrl/Cmd + W', description: 'Close window' },
    { key: 'Ctrl/Cmd + L', description: 'Focus search' },
    { key: 'Escape', description: 'Close dialog' },
    { key: 'Enter', description: 'Send message' },
    { key: 'Arrow Keys', description: 'Navigate' },
    { key: 'Ctrl/Cmd + +', description: 'Zoom in' },
    { key: 'Ctrl/Cmd + -', description: 'Zoom out' },
    { key: 'Ctrl/Cmd + 0', description: 'Reset zoom' },
  ];

  const modules = [
    {
      name: '市场',
      path: '/market',
      description: 'Real-time market data for bonds, equities, commodities, forex, and derivatives',
    },
    {
      name: '权益与衍生品',
      path: '/equity-market',
      description: 'Stock market, commodities, indices, forex, and derivatives trading data',
    },
    {
      name: '通讯与社区',
      path: '/comms-hub',
      description: 'Instant messaging, contacts, and group channels for collaboration',
    },
    {
      name: '新闻与研究',
      path: '/news-hub',
      description: 'News feed, research reports, and market analysis',
    },
    {
      name: '经济分析',
      path: '/econ-hub',
      description: 'Economic indicators, forecasts, and calendar events',
    },
    {
      name: '专业应用',
      path: '/terminal',
      description: 'Portfolio management, pricing, risk analysis, and trading tools',
    },
    {
      name: '平台工具',
      path: '/settings',
      description: 'Flexible layouts, data export, and system settings',
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold font-mono text-accent mb-2">
            Ucheer Terminal Help
          </h1>
          <p className="text-muted-foreground">
            Professional Financial Terminal v1.0
          </p>
        </div>

        {/* Keyboard Shortcuts */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold font-mono text-accent mb-4">
            Keyboard Shortcuts
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {shortcuts.map((shortcut, idx) => (
              <div
                key={idx}
                className="bg-card border border-border rounded-sm p-3"
              >
                <div className="font-mono font-semibold text-accent text-sm">
                  {shortcut.key}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {shortcut.description}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Modules */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold font-mono text-accent mb-4">
            Modules Overview
          </h2>
          <div className="space-y-3">
            {modules.map((module, idx) => (
              <div
                key={idx}
                className="bg-card border border-border rounded-sm p-4 hover:border-accent/50 transition-colors cursor-pointer"
                onClick={() => setLocation(module.path)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-mono font-semibold text-accent">
                      {module.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {module.description}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* About */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold font-mono text-accent mb-4">
            About
          </h2>
          <div className="bg-card border border-border rounded-sm p-4 space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">
                Ucheer Terminal is a professional financial data and trading platform
                providing real-time market data, news, analysis, and trading tools for
                financial professionals.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-muted-foreground">Version:</span>
                <span className="ml-2 font-mono text-foreground">1.0.0</span>
              </div>
              <div>
                <span className="text-muted-foreground">Release Date:</span>
                <span className="ml-2 font-mono text-foreground">June 2026</span>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>
                <span className="ml-2 font-mono text-green-400">Active</span>
              </div>
              <div>
                <span className="text-muted-foreground">Data:</span>
                <span className="ml-2 font-mono text-foreground">Simulated</span>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="border-t border-border pt-6 text-center">
          <p className="text-xs text-muted-foreground">
            © 2026 Ucheer Terminal. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
