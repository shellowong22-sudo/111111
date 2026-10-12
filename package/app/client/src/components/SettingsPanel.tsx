import { useState } from 'react';
import { Download, Settings, Bell, Eye, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface SettingsPanelProps {
  title: string;
}

export default function SettingsPanel({ title }: SettingsPanelProps) {
  const [settings, setSettings] = useState({
    realTimeUpdates: true,
    soundAlerts: false,
    darkMode: true,
    autoRefresh: true,
    showGrid: true,
    compactView: false,
  });

  const [exportFormat, setExportFormat] = useState<'csv' | 'json' | 'xlsx'>('csv');

  const handleToggleSetting = (key: keyof typeof settings) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleExport = (format: 'csv' | 'json' | 'xlsx') => {
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `terminal-data-${timestamp}.${format === 'xlsx' ? 'xlsx' : format}`;
    
    // Simulate export
    console.log(`Exporting data as ${format} to ${filename}`);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="terminal-header">
        <h3 className="terminal-title">{title}</h3>
      </div>

      <div className="flex-1 overflow-auto bg-background/50 p-3 space-y-4">
        {/* Display Settings */}
        <div className="space-y-2">
          <div className="text-xs font-mono font-semibold text-accent uppercase tracking-wider">
            Display
          </div>
          <div className="space-y-2">
            {[
              { key: 'darkMode', label: 'Dark Mode', icon: Eye },
              { key: 'showGrid', label: 'Show Grid', icon: Zap },
              { key: 'compactView', label: 'Compact View', icon: Settings },
            ].map(({ key, label, icon: Icon }) => (
              <div
                key={key}
                className="flex items-center justify-between p-2 bg-card border border-border rounded-sm"
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-foreground">{label}</span>
                </div>
                <Switch
                  checked={settings[key as keyof typeof settings] as boolean}
                  onCheckedChange={() => handleToggleSetting(key as keyof typeof settings)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Data Settings */}
        <div className="space-y-2">
          <div className="text-xs font-mono font-semibold text-accent uppercase tracking-wider">
            Data
          </div>
          <div className="space-y-2">
            {[
              { key: 'realTimeUpdates', label: 'Real-Time Updates', icon: Zap },
              { key: 'autoRefresh', label: 'Auto Refresh', icon: Settings },
              { key: 'soundAlerts', label: 'Sound Alerts', icon: Bell },
            ].map(({ key, label, icon: Icon }) => (
              <div
                key={key}
                className="flex items-center justify-between p-2 bg-card border border-border rounded-sm"
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-foreground">{label}</span>
                </div>
                <Switch
                  checked={settings[key as keyof typeof settings] as boolean}
                  onCheckedChange={() => handleToggleSetting(key as keyof typeof settings)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Export Data */}
        <div className="space-y-2">
          <div className="text-xs font-mono font-semibold text-accent uppercase tracking-wider">
            Export Data
          </div>
          <div className="space-y-2">
            {(['csv', 'json', 'xlsx'] as const).map(format => (
              <Button
                key={format}
                onClick={() => handleExport(format)}
                variant="outline"
                className="w-full h-8 text-xs justify-start gap-2"
              >
                <Download className="w-3 h-3" />
                Export as {format.toUpperCase()}
              </Button>
            ))}
          </div>
        </div>

        {/* System Info */}
        <div className="space-y-2">
          <div className="text-xs font-mono font-semibold text-accent uppercase tracking-wider">
            System
          </div>
          <div className="bg-card border border-border rounded-sm p-2 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Version:</span>
              <span className="font-mono text-foreground">1.0.0</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Build:</span>
              <span className="font-mono text-foreground">868db16d</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Status:</span>
              <span className="font-mono text-green-400">Active</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Data:</span>
              <span className="font-mono text-foreground">Simulated</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
