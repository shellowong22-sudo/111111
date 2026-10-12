import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CandleData } from '@/lib/dataEngine';

interface CandleChartProps {
  title: string;
  data: CandleData[];
}

export default function CandleChart({ title, data }: CandleChartProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="terminal-header">
        <h3 className="terminal-title">{title}</h3>
      </div>
      <div className="flex-1 overflow-auto bg-background/50 p-2">
        {data && data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(64, 64, 80)" />
              <XAxis
                dataKey="time"
                stroke="rgb(180, 180, 190)"
                tickFormatter={(time) => new Date(time).toLocaleDateString()}
              />
              <YAxis stroke="rgb(180, 180, 190)" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgb(16, 16, 24)',
                  border: '1px solid rgb(40, 40, 56)',
                }}
                labelStyle={{ color: 'rgb(230, 230, 235)' }}
                formatter={(value: any) => value.toFixed(2)}
              />
              <Bar dataKey="volume" fill="rgb(64, 64, 80)" yAxisId="right" opacity={0.3} />
              <Line
                type="monotone"
                dataKey="close"
                stroke="rgb(255, 184, 28)"
                dot={false}
                yAxisId="left"
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p className="text-xs font-mono">No data available</p>
          </div>
        )}
      </div>
    </div>
  );
}
