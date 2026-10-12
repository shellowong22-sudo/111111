import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function CreditRatings() {
  const ratingHistory = [
    { date: "2010-11-23", rating: "A3", agency: "Moody's", action: "初始", outlook: "稳定" },
    { date: "2017-05-03", rating: "A1", agency: "Moody's", action: "升级", outlook: "稳定" },
    { date: "2018-10-29", rating: "A1", agency: "Moody's", action: "确认", outlook: "稳定" },
    { date: "2019-07-09", rating: "A2", agency: "Moody's", action: "降级", outlook: "负面" },
    { date: "2021-09-29", rating: "A2", agency: "Moody's", action: "确认", outlook: "稳定" },
    { date: "2021-10-14", rating: "A3", agency: "Moody's", action: "降级", outlook: "稳定" },
  ];

  const currentRatings = [
    { agency: "Moody's", rating: "A3", outlook: "稳定", date: "2021-10-14" },
    { agency: "S&P", rating: "A-", outlook: "稳定", date: "2021-10-15" },
    { agency: "Fitch", rating: "A", outlook: "稳定", date: "2021-10-14" },
  ];

  const ratingScale = [
    { rating: "AAA", description: "最高信用等级", color: "bg-green-600" },
    { rating: "AA", description: "非常高的信用等级", color: "bg-green-500" },
    { rating: "A", description: "高的信用等级", color: "bg-blue-500" },
    { rating: "BBB", description: "中等信用等级", color: "bg-yellow-500" },
    { rating: "BB", description: "较低信用等级", color: "bg-orange-500" },
    { rating: "B", description: "低信用等级", color: "bg-red-500" },
    { rating: "CCC", description: "非常低信用等级", color: "bg-red-600" },
  ];

  const trendData = [
    { year: 2016, moodys: 3.5, sp: 3.2, fitch: 3.3 },
    { year: 2017, moodys: 3.8, sp: 3.5, fitch: 3.6 },
    { year: 2018, moodys: 3.8, sp: 3.5, fitch: 3.6 },
    { year: 2019, moodys: 3.2, sp: 3.0, fitch: 3.1 },
    { year: 2020, moodys: 3.2, sp: 3.0, fitch: 3.1 },
    { year: 2021, moodys: 3.0, sp: 2.8, fitch: 3.0 },
  ];

  const getRatingColor = (rating: string) => {
    if (rating.startsWith("AAA") || rating.startsWith("AA")) return "bg-green-100 text-green-800";
    if (rating.startsWith("A")) return "bg-blue-100 text-blue-800";
    if (rating.startsWith("BBB")) return "bg-yellow-100 text-yellow-800";
    if (rating.startsWith("BB")) return "bg-orange-100 text-orange-800";
    return "bg-red-100 text-red-800";
  };

  const getActionColor = (action: string) => {
    if (action === "升级") return "bg-green-100 text-green-800";
    if (action === "降级") return "bg-red-100 text-red-800";
    return "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">信用评级</h1>
        <p className="text-gray-500 mt-2">查看信用评级历史和评级机构评价</p>
      </div>

      {/* 当前评级 */}
      <Card>
        <CardHeader>
          <CardTitle>当前信用评级</CardTitle>
          <CardDescription>649906BB9 Muni 的最新评级</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {currentRatings.map((rating) => (
              <div key={rating.agency} className="border rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-2">{rating.agency}</p>
                <div className="flex items-center gap-3 mb-2">
                  <Badge className={getRatingColor(rating.rating)}>{rating.rating}</Badge>
                  <span className="text-sm font-medium">{rating.outlook}</span>
                </div>
                <p className="text-xs text-gray-500">更新于 {rating.date}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 评级历史 */}
      <Card>
        <CardHeader>
          <CardTitle>评级历史</CardTitle>
          <CardDescription>Moody's 发行人评级变化历程</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>生效日期</TableHead>
                <TableHead>评级</TableHead>
                <TableHead>评级行动</TableHead>
                <TableHead>前次评级</TableHead>
                <TableHead>前次日期</TableHead>
                <TableHead>展望</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ratingHistory.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium text-red-600">{item.date}</TableCell>
                  <TableCell>
                    <Badge className={getRatingColor(item.rating)}>{item.rating}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getActionColor(item.action)}>{item.action}</Badge>
                  </TableCell>
                  <TableCell>{idx > 0 ? ratingHistory[idx - 1].rating : "-"}</TableCell>
                  <TableCell>{idx > 0 ? ratingHistory[idx - 1].date : "-"}</TableCell>
                  <TableCell>{item.outlook}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 评级等级说明 */}
      <Card>
        <CardHeader>
          <CardTitle>评级等级说明</CardTitle>
          <CardDescription>Moody's 信用评级体系</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {ratingScale.map((item) => (
              <div key={item.rating} className="flex items-center gap-4 p-2 border rounded">
                <div className={`w-12 h-12 rounded ${item.color} flex items-center justify-center text-white font-bold`}>
                  {item.rating}
                </div>
                <div>
                  <p className="font-medium">{item.rating}</p>
                  <p className="text-sm text-gray-600">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 评级趋势 */}
      <Card>
        <CardHeader>
          <CardTitle>评级趋势</CardTitle>
          <CardDescription>过去 6 年的评级数值变化（数值越高评级越好）</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="moodys" stroke="#3b82f6" name="Moody's" />
              <Line type="monotone" dataKey="sp" stroke="#ef4444" name="S&P" />
              <Line type="monotone" dataKey="fitch" stroke="#10b981" name="Fitch" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
