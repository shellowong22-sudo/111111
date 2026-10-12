import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface YieldData {
  maturity: string;
  yield: number;
}

interface YieldCurveChartProps {
  title: string;
  data: YieldData[];
}

export default function YieldCurveChart({ title, data }: YieldCurveChartProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="terminal-header">
        <h3 className="terminal-title">{title}</h3>
      </div>
      <div className="flex-1 overflow-auto bg-background/50 p-2">
        {data && data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(64, 64, 80)" />
              <XAxis dataKey="maturity" stroke="rgb(180, 180, 190)" />
              <YAxis stroke="rgb(180, 180, 190)" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgb(16, 16, 24)',
                  border: '1px solid rgb(40, 40, 56)',
                }}
                labelStyle={{ color: 'rgb(230, 230, 235)' }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="yield"
                stroke="rgb(255, 184, 28)"
                dot={{ fill: 'rgb(255, 184, 28)', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
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
