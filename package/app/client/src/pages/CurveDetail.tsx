import { exportPanelCsv } from '@/components/PanelActionButton';
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowLeft, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function CurveDetail() {
  const params = useParams<{ curveId: string }>();
  const [, setLocation] = useLocation();
  const curveId = params?.curveId ? parseInt(params.curveId, 10) : 0;

  // 获取曲线详情
  const { data: curve, isLoading: curveLoading } = trpc.curves.getDetail.useQuery(
    { curveId },
    { enabled: curveId > 0 }
  );

  // 获取曲线数据点
  const { data: dataPoints = [] } = trpc.curves.getDataPoints.useQuery(
    { curveId: curve?.id || 0 },
    { enabled: !!curve?.id }
  );

  if (curveLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!curve) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            className="mb-6"
            onClick={() => setLocation("/curves-list")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回曲线列表
          </Button>
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-slate-600">未找到曲线数据</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // 按成熟度分组数据
  const maturities = ["3M", "6M", "1Y", "2Y", "3Y", "5Y", "7Y", "10Y", "15Y", "20Y", "30Y"];
  const latestData = maturities.map((maturity) => {
    const point = dataPoints.find((p) => p.period === maturity);
    return {
      maturity,
      value: point ? parseFloat(point.value ?? "0") : 0,
    };
  });

  // 获取历史数据用于图表
  const chartData = dataPoints
    .sort((a, b) => (a.dataDate ?? "").localeCompare(b.dataDate ?? ""))
    .slice(-30)
    .map((p) => ({
      date: p.dataDate ?? "",
      value: parseFloat(p.value),
    }));

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      Government: "bg-blue-100 text-blue-800",
      Corporate: "bg-green-100 text-green-800",
      CDS: "bg-red-100 text-red-800",
      Municipal: "bg-purple-100 text-purple-800",
      Agency: "bg-orange-100 text-orange-800",
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* 返回按钮 */}
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => setLocation("/curves-list")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回曲线列表
        </Button>

        {/* 曲线基本信息 */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 mb-2">{curve.name}</h1>
                <p className="text-slate-600">{curve.nameEn}</p>
              </div>
              <Badge className={getTypeColor(curve.type || "")}>
                {curve.type}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-slate-600 mb-1">曲线代码</p>
                <p className="text-lg font-mono font-semibold text-slate-900">{curve.curveId}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-1">国家</p>
                <p className="text-lg font-semibold text-slate-900">{curve.country}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-1">地区</p>
                <p className="text-lg font-semibold text-slate-900">{curve.region}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-1">货币</p>
                <p className="text-lg font-mono font-semibold text-slate-900">{curve.currency}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 详细数据 */}
        <Tabs defaultValue="curve" className="mb-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="curve">期限结构</TabsTrigger>
            <TabsTrigger value="history">历史走势</TabsTrigger>
          </TabsList>

          {/* 期限结构 */}
          <TabsContent value="curve">
            <Card>
              <CardHeader>
                <CardTitle>收益率期限结构</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {latestData.map((item) => (
                    <div key={item.maturity} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <p className="text-xs text-slate-600 font-medium mb-1">{item.maturity}</p>
                      <p className="text-xl font-bold text-slate-900">
                        {item.value.toFixed(3)}%
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 历史走势 */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>10 年期收益率 - 30 天走势</CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12 }}
                        interval={Math.floor(chartData.length / 6)}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value) => `${(value as number).toFixed(3)}%`}
                        labelFormatter={(label) => `日期: ${label}`}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#2563eb"
                        dot={false}
                        name="收益率"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="py-8 text-center text-slate-600">
                    暂无历史数据
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 操作按钮 */}
        <div className="flex gap-3">
          <Button type="button" className="flex-1" onClick={() => setLocation('/curves-compare')}>
            <TrendingUp className="w-4 h-4 mr-2" />
            对比分析
          </Button>
          <Button type="button" onClick={(event) => exportPanelCsv(event.currentTarget)} variant="outline" className="flex-1">
            导出数据
          </Button>
        </div>
      </div>
    </div>
  );
}
