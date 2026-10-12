import React, { useState, useMemo, useCallback } from 'react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis, ScatterChart, Scatter } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Slider } from '@/components/ui/slider';
import { CalendarIcon, TrendingUp, DollarSign, BarChart3, Clock, Zap } from 'lucide-react';

// Utility function to format dates for display in a consistent manner.
// This helps in presenting date information clearly within the UI.
const formatDate = (dateString: string) => {
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(dateString).toLocaleDateString('en-US', options);
};

// Defines the possible months for TBA forward curve analysis.
// Using `as const` ensures type safety and immutability.

// Main Panel Component
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
// Defines the possible coupon rates for TBA forward curve analysis.
// These are typical coupon rates observed in the TBA market.
const coupons = ['2.0', '2.5', '3.0', '3.5', '4.0', '4.5', '5.0', '5.5', '6.0'] as const;

// Main Panel Component: BBTMPanel
// This component serves as the primary container for all TBA electronic trading monitoring features.
// It integrates various sub-components for data visualization and user interaction.

export const BBTMPanel: React.FC = () => {
  // State for interactive elements
  // These states control various aspects of the panel, from selected filters to real-time data updates.

  const [selectedMonth, setSelectedMonth] = useState<typeof months[number]>('Jan'); // Currently selected month for filtering TBA forward curve.
  const [selectedCoupon, setSelectedCoupon] = useState<typeof coupons[number]>('2.5'); // Currently selected coupon for filtering TBA forward curve.
  const [rollPeriod, setRollPeriod] = useState<number>(30); // Defines the period for Dollar Roll analysis in days.
  const [showFailedDeliveries, setShowFailedDeliveries] = useState<boolean>(false); // Toggles the visibility of the delivery failure heatmap.
  const [liquidityScore] = useState<number | null>(null);
  const [status, setStatus] = useState('等待授权的 TBA 行情、头寸与交割数据。');


  // Market observations are deliberately empty until an authorized TBA/MBS
  // feed is configured.  The original five views remain available, but no
  // synthetic observations are presented as live data.
  const tbaForwardCurveData = useMemo(() => [] as { month: string; coupon: string; yield: number; z: number }[], []);

  // Filtered TBA Forward Curve Data
  // This memoized value provides a filtered subset of the TBA forward curve data.
  // It highlights the data point corresponding to the currently selected month and coupon.
  const filteredTbaForwardCurveData = useMemo(() => {
    return tbaForwardCurveData.filter(d => {
      const monthMatch = selectedMonth === d.month;
      const couponMatch = selectedCoupon === d.coupon;
      return monthMatch && couponMatch;
    });
  }, [tbaForwardCurveData, selectedMonth, selectedCoupon]);

  // 2. Dollar Roll收益率分析（Roll vs持有对比）
  // Data generation for Dollar Roll Yield Analysis
  // Dollar Roll Yield Analysis Data Generation
  // This generates comparative yield data for Dollar Roll versus a simple hold strategy.
  // The data is influenced by the `rollPeriod` state, simulating different investment horizons.
  const dollarRollYieldData = useMemo(() => [] as { period: string; rollYield: number; holdYield: number }[], [rollPeriod]);

  // 3. TBA净多空头寸监控（堆叠面积图）
  // Data generation for TBA Net Long/Short Positions
  // TBA Net Long/Short Positions Data Generation
  // This function creates a time series of long, short, and net positions.
  // It simulates market movements with random fluctuations and ensures positions remain realistic.
  const tbaNetPositionsData = useMemo(() => [] as { date: string; long: number; short: number; net: number }[], []);

  // 4. 交割失败率趋势图（日历热力图）
  // Data generation for Delivery Failure Rate Trend (Calendar Heatmap)
  // Delivery Failure Rate Trend Data Generation
  // This generates a year's worth of daily delivery failure data.
  // It incorporates seasonal and recent trend biases to make the data more interesting.
  const deliveryFailureData = useMemo(() => [] as { date: string; failures: number }[], []);

    // 5. TBA流动性评分仪表盘（实时更新）
  // This data is updated via state, not useMemo for real-time effect.
  // Manual Liquidity Score Update Handler
  // This callback function allows for manual triggering of a liquidity score update.
  // It's useful for demonstrating the real-time update mechanism.
  const updateLiquidityScore = useCallback(() => {
    setStatus('已请求刷新 TBA 流动性；当前无授权行情输入，未生成模拟评分。');
  }, []);

  // Generate a date series for potential future use in additional charts
  // This demonstrates the generateDateSeries utility function
  const recentDates = useMemo(() => [] as string[], []);

  // Additional state for more interactivity
  const [viewMode, setViewMode] = useState<'standard' | 'compact'>('standard');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);

  // Toggle auto refresh functionality for the panel.
  // This allows users to pause or resume automatic data updates, enhancing user control.

  const toggleAutoRefresh = useCallback(() => {
    setAutoRefresh(prev => {
      const next = !prev;
      setStatus(next
        ? '自动刷新已开启；授权 TBA 数据通道尚未配置，因此不会生成或轮询模拟行情。'
        : '自动刷新已关闭。');
      return next;
    });
  }, []);

  return (
    <div className={`p-4 bg-slate-950 text-yellow-500 min-h-screen font-mono ${viewMode === 'compact' ? 'text-sm' : 'text-base'}`}>
      <div className="flex justify-between items-center mb-6 border-b border-red-800 pb-4">
        <h1 className="text-3xl font-bold text-center flex-1">BBTMPanel - TBA Electronic Trading Monitor</h1>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode(viewMode === 'standard' ? 'compact' : 'standard')}
            className="border-red-700 text-yellow-500 hover:bg-red-900"
          >
            {viewMode === 'standard' ? 'Compact View' : 'Standard View'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleAutoRefresh}
            className={`border-red-700 ${autoRefresh ? 'bg-red-900 text-yellow-500' : 'text-gray-400 hover:bg-red-900'}`}
          >
            <Clock className="w-4 h-4 mr-2" />
            {autoRefresh ? 'Auto-Refresh ON' : 'Auto-Refresh OFF'}
          </Button>
        </div>
      </div>

      <div role="status" className="mb-6 rounded border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-xs text-amber-300">
        {status} 远期曲线、Dollar Roll、净头寸、交割失败和流动性评分仅在可核验数据返回后填充。
      </div>

      {/* Section 1: TBA Forward Curve */}
      <Card className="mb-6 bg-slate-900 border-red-800 shadow-lg shadow-red-900/20">
        <CardHeader className="border-b border-red-800/50 pb-2">
          <CardTitle className="text-yellow-500 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2" />
            1. TBA Forward Curve (3D Grid)
          </CardTitle>
        </CardHeader>
          <CardContent className="flex flex-col items-center">
          <div className="flex flex-wrap justify-center gap-2 mb-4">
            <span className="text-gray-400">Select Month:</span>
            <ToggleGroup type="single" value={selectedMonth} onValueChange={(v) => setSelectedMonth(v as any)} className="mr-4">
              {months.map(month => (
                <ToggleGroupItem key={month} value={month} className="data-[state=on]:bg-red-700 data-[state=on]:text-yellow-500 hover:bg-red-800">
                  {month}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <span className="text-gray-400">Select Coupon:</span>
            <ToggleGroup type="single" value={selectedCoupon} onValueChange={(v) => setSelectedCoupon(v as any)}>
              {coupons.map(coupon => (
                <ToggleGroupItem key={coupon} value={coupon} className="data-[state=on]:bg-red-700 data-[state=on]:text-yellow-500 hover:bg-red-800">
                  {coupon}%
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <ScatterChart
              margin={{
                top: 20,
                right: 20,
                bottom: 20,
                left: 20,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#4A4A4A" />
              <XAxis
                dataKey="month"
                type="category"
                allowDuplicatedCategory={false}
                stroke="#FFD700"
                tick={{ fill: '#FFD700' }}
                tickLine={{ stroke: '#FFD700' }}
                axisLine={{ stroke: '#FFD700' }}
              />
              <YAxis
                dataKey="coupon"
                type="category"
                allowDuplicatedCategory={false}
                stroke="#FFD700"
                tick={{ fill: '#FFD700' }}
                tickLine={{ stroke: '#FFD700' }}
                axisLine={{ stroke: '#FFD700' }}
              />
              <ZAxis dataKey="yield" type="number" range={[60, 400]} name="Yield" />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                contentStyle={{ backgroundColor: '#333', borderColor: '#FFD700', color: '#FFD700' }}
                formatter={(value: number, name: string) => [`${value.toFixed(2)}%`, name]}
              />
              {/* Renders the main TBA Yield data points. */}
              <Scatter name="TBA Yield" data={tbaForwardCurveData} fill="#FFD700" />
              {/* Highlights the selected data point with a distinct shape and color. */}
              <Scatter name="Selected Point" data={filteredTbaForwardCurveData} fill="#DC2626" shape="diamond" />
              {/* Additional Scatter for potential future data series or anomalies. */}
              {/* <Scatter name="Anomaly" data={[]} fill="#00BFFF" shape="triangle" /> */}
            </ScatterChart>
          </ResponsiveContainer>
          {tbaForwardCurveData.length === 0 && <p className="text-sm text-amber-300">— 未接入授权 TBA 远期曲线。</p>}
          <p className="text-xs text-gray-500 mt-2">Hover over points for yield details. Red star indicates selected month/coupon.</p>
        </CardContent>
      </Card>

      {/* Section 2: Dollar Roll Yield Analysis */}
      <Card className="mb-6 bg-slate-900 border-red-800 shadow-lg shadow-red-900/20">
        <CardHeader className="border-b border-red-800/50 pb-2">
          <CardTitle className="text-yellow-500 flex items-center">
            <DollarSign className="w-5 h-5 mr-2" />
            2. Dollar Roll Yield Analysis (Roll vs Hold)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-4">
            <label htmlFor="roll-period-slider" className="text-yellow-500">Roll Period: {rollPeriod} days</label>
            <Slider
              id="roll-period-slider"
              min={10}
              max={90}
              step={5}
              value={[rollPeriod]}
              onValueChange={(val) => setRollPeriod(val[0])}
              className="w-[200px]"
            />
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart
              data={dollarRollYieldData}
              syncId="anyId"
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#4A4A4A" />
              <XAxis
                dataKey="period"
                stroke="#FFD700"
                tick={{ fill: '#FFD700' }}
                tickLine={{ stroke: '#FFD700' }}
                axisLine={{ stroke: '#FFD700' }}
              />
              <YAxis
                stroke="#FFD700"
                tick={{ fill: '#FFD700' }}
                tickLine={{ stroke: '#FFD700' }}
                axisLine={{ stroke: '#FFD700' }}
                tickFormatter={(value) => `${(value * 100).toFixed(2)}%`}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#333', borderColor: '#FFD700', color: '#FFD700' }}
                formatter={(value: number, name: string) => [`${(value * 100).toFixed(2)}%`, name]}
              />
              <Line
                type="monotone"
                dataKey="rollYield"
                stroke="#FFD700"
                activeDot={{ r: 8, stroke: '#FFD700', fill: '#FFD700' }}
                name="Roll Yield"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="holdYield"
                stroke="#DC2626"
                activeDot={{ r: 8, stroke: '#DC2626', fill: '#DC2626' }}
                name="Hold Yield"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
          {dollarRollYieldData.length === 0 && <p className="text-sm text-amber-300">— 未接入可核验 Dollar Roll 与持有收益观测。</p>}
          <p className="text-xs text-gray-500 mt-2">Compares the yield from a Dollar Roll strategy versus a simple Buy & Hold.</p>

        </CardContent>
      </Card>

      {/* Section 3: TBA Net Long/Short Positions */}
      <Card className="mb-6 bg-slate-900 border-red-800 shadow-lg shadow-red-900/20">
        <CardHeader className="border-b border-red-800/50 pb-2">
          <CardTitle className="text-yellow-500 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2" />
            3. TBA Net Long/Short Positions (Stacked Area)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart
              data={tbaNetPositionsData}
              syncId="anyId"
              margin={{
                top: 10,
                right: 30,
                left: 0,
                bottom: 0,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#4A4A4A" />
              <XAxis
                dataKey="date"
                stroke="#FFD700"
                tick={{ fill: '#FFD700' }}
                tickLine={{ stroke: '#FFD700' }}
                axisLine={{ stroke: '#FFD700' }}
                tickFormatter={formatDate}
              />
              <YAxis
                stroke="#FFD700"
                tick={{ fill: '#FFD700' }}
                tickLine={{ stroke: '#FFD700' }}
                axisLine={{ stroke: '#FFD700' }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#333', borderColor: '#FFD700', color: '#FFD700' }}
                formatter={(value: number, name: string) => [`${value.toLocaleString()}`, name]}
              />
              <Area
                type="monotone"
                dataKey="long"
                stackId="1"
                stroke="#FFD700"
                fill="#FFD700"
                fillOpacity={0.6}
                name="Long Positions"
              />
              <Area
                type="monotone"
                dataKey="short"
                stackId="1"
                stroke="#DC2626"
                fill="#DC2626"
                fillOpacity={0.6}
                name="Short Positions"
              />
              <Line type="monotone" dataKey="net" stroke="#FFFFFF" strokeWidth={2} dot={false} name="Net Position" />
            </AreaChart>
          </ResponsiveContainer>
          {tbaNetPositionsData.length === 0 && <p className="text-sm text-amber-300">— 未接入授权 TBA 多空头寸流。</p>}
          <p className="text-xs text-gray-500 mt-2">Monitors the aggregate long and short positions in TBA securities over time.</p>

        </CardContent>
      </Card>

      {/* Section 4: Delivery Failure Rate Trend (Calendar Heatmap) */}
      <Card className="mb-6 bg-slate-900 border-red-800 shadow-lg shadow-red-900/20">
        <CardHeader className="border-b border-red-800/50 pb-2">
          <CardTitle className="text-yellow-500 flex items-center">
            <CalendarIcon className="w-5 h-5 mr-2" />
            4. Delivery Failure Rate Trend (Calendar Heatmap)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <CalendarIcon className="h-5 w-5 text-yellow-500" />
            <span className="text-yellow-500">Show Failed Deliveries:</span>
            <Button
              onClick={() => setShowFailedDeliveries(!showFailedDeliveries)}
              className={`px-4 py-2 rounded-md transition-colors duration-200 ${showFailedDeliveries ? 'bg-red-700 text-yellow-500 hover:bg-red-600' : 'bg-slate-700 text-yellow-500 hover:bg-slate-600'}`}
            >
              {showFailedDeliveries ? 'Hide Heatmap' : 'Show Heatmap'}
            </Button>
          </div>
          {showFailedDeliveries && (
            <div className="flex flex-col items-center w-full">
              {deliveryFailureData.length === 0 ? (
                <p className="w-full rounded border border-amber-900/50 bg-amber-950/20 p-3 text-center text-sm text-amber-300">
                  — 未接入可核验的交割失败日历数据。
                </p>
              ) : <div className="grid grid-cols-7 gap-1 p-2 bg-slate-800 rounded-md w-full max-w-md">
                {/* Day of week headers for better calendar readability. */}
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="w-full h-8 flex items-center justify-center text-xs text-gray-400">
                    {day}
                  </div>
                ))}
                {/* Empty cells are added to correctly align the first day of the month in the calendar grid. */}
                {Array.from({ length: new Date(deliveryFailureData[0]!.date).getDay() }).map((_, i) => (
                  <div key={`empty-${i}`} className="w-full h-8"></div>
                ))}
                {/* Iterates through the delivery failure data to render each day's failure intensity. */}
                {deliveryFailureData.map((day, index) => {
                  const intensity = Math.min(day.failures * 25, 255); // Scales failure count to a color intensity (0-255).
                  const bgColor = `rgb(${intensity}, 0, 0)`; // Generates a red-scale background color based on intensity.
                  return (
                    <div
                      key={index}
                      className="w-full h-8 flex items-center justify-center text-xs text-white rounded-sm transition-colors duration-100"
                      style={{ backgroundColor: bgColor }}
                      title={`${formatDate(day.date)}: ${day.failures} failures`}
                    >
                      {new Date(day.date).getDate()}
                    </div>
                  );
                })}
              </div>}
              {/* Heatmap Legend: Provides a visual guide to interpret the color intensity of the heatmap. */}
              <div className="flex justify-center items-center mt-4">
                <span className="text-xs text-gray-400 mr-2">Less Failures</span>
                <div className="flex rounded-md overflow-hidden">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={`legend-${i}`}
                      className="w-6 h-4"
                      style={{ backgroundColor: `rgb(${i * 50}, 0, 0)` }}
                    ></div>
                  ))}
                </div>
                <span className="text-xs text-gray-400 ml-2">More Failures</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 5: TBA Liquidity Score Dashboard */}
      <Card className="mb-6 bg-slate-900 border-red-800 shadow-lg shadow-red-900/20">
        <CardHeader className="border-b border-red-800/50 pb-2">
          <CardTitle className="text-yellow-500 flex items-center">
            <Zap className="w-5 h-5 mr-2" />
            5. TBA Liquidity Score Dashboard (Real-time)
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-6">
          <div className="relative w-40 h-40 flex items-center justify-center rounded-full border-8 border-red-700 mb-4 overflow-hidden">
            <div
              className="absolute inset-0 rounded-full bg-gradient-to-br from-red-900 to-slate-900 opacity-75 transform transition-all duration-1000 ease-out"
              style={{ transform: `scale(${liquidityScore === null ? 0 : liquidityScore / 100})` }}
            ></div>
            <span className="relative text-6xl font-bold text-yellow-500 z-10 drop-shadow-lg">{liquidityScore === null ? '—' : liquidityScore.toFixed(1)}</span>
            <div className="absolute bottom-4 text-sm text-gray-300 z-10">
              {liquidityScore === null ? 'Awaiting Data' : `${liquidityScore > 85 ? 'High' : liquidityScore > 70 ? 'Medium' : 'Low'} Liquidity`}
            </div>
          </div>
          <Button onClick={updateLiquidityScore} className="bg-red-700 text-yellow-500 hover:bg-red-600 transition-colors duration-200">
            <Zap className="h-4 w-4 mr-2" /> Manual Update
          </Button>
          <p className="text-sm text-gray-400 mt-2">{autoRefresh ? 'Auto-refresh armed; awaiting authorized feed' : 'Auto-refresh paused'}</p>
          <div className="mt-4 text-xs text-gray-500">
            <span className="text-yellow-600">Recent Activity Dates: </span>
            {recentDates.length ? recentDates.slice(0, 3).join(' | ') : '—'}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};


// ============================================================
// BBTMPanel - TBA Electronic Trading Monitor
// ============================================================
// This panel provides a comprehensive view of TBA (To-Be-Announced) market activity.
// It includes the following key sections:
//
// 1. TBA Forward Curve (3D Grid):
//    - Displays the yield surface across different months and coupon rates.
//    - Interactive month and coupon selection for targeted analysis.
//    - Scatter plot with bubble size proportional to yield magnitude.
//
// 2. Dollar Roll Yield Analysis (Roll vs Hold):
//    - Compares the yield from a Dollar Roll strategy against a simple Buy & Hold.
//    - Adjustable roll period via a slider for dynamic analysis.
//    - Line chart with clear color differentiation for each strategy.
//
// 3. TBA Net Long/Short Positions (Stacked Area):
//    - Monitors the aggregate long and short positions over 60 days.
//    - Stacked area chart for visual representation of position dynamics.
//    - Net position line overlaid for quick assessment.
//
// 4. Delivery Failure Rate Trend (Calendar Heatmap):
//    - Visualizes the daily delivery failure rate over the past year.
//    - Calendar heatmap with color intensity indicating failure severity.
//    - Toggle to show/hide the heatmap for a cleaner interface.
//
// 5. TBA Liquidity Score Dashboard (Real-time):
//    - Displays a real-time liquidity score that updates every 5 seconds.
//    - Circular gauge with dynamic fill based on the current score.
//    - Manual update button for immediate score refresh.
//
// ============================================================
// Key Design Principles:
// - Bloomberg Terminal aesthetic: Dark background, yellow highlights.
// - Interactive elements with clear visual feedback.
// - Simulated real-time data for demonstration purposes.
// - Responsive design for various screen sizes.
// ============================================================
// Data Generation Strategy:
// - All observations require an authorized adapter; unavailable data remains empty.
// - No external libraries (like faker.js) are used for data generation.
// - useMemo is used to memoize data generation, preventing unnecessary recalculations.
// - useState is used for interactive state management.
// - useCallback is used for memoized event handlers.
// - React.useEffect is used for side effects like real-time updates.
// ============================================================
// Styling:
// - Tailwind CSS classes are used for all styling.
// - No inline CSS pseudo-classes (e.g., &:hover) are used.
// - Color scheme: Deep red background, yellow highlights, white text.
// ============================================================
// Export:
// The BBTMPanel component is exported as a named export for use in other modules.
// ============================================================

export default BBTMPanel;
