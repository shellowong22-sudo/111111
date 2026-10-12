import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Newspaper, TrendingUp, AlertCircle, Zap, Clock, User } from 'lucide-react';

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  category: string;
  timestamp: string;
  impact: 'high' | 'medium' | 'low';
  related: string[];
}

interface MarketNewsPanelProps {
  title: string;
}

export default function MarketNewsPanel({ title }: MarketNewsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const newsItems: NewsItem[] = [
    {
      id: '1',
      title: 'Apple 发布新款 iPhone 15 Pro，采用 A17 Pro 芯片',
      summary: '苹果公司今日发布了最新的 iPhone 15 Pro 系列，搭载自研 A17 Pro 芯片，性能提升 20%，预计将推动股价上升。',
      source: '新浪财经',
      category: '公司新闻',
      timestamp: '2026-06-17 14:32',
      impact: 'high',
      related: ['AAPL', 'TECH'],
    },
    {
      id: '2',
      title: '美联储宣布暂停加息，市场反应积极',
      summary: '美联储主席在新闻发布会上表示，鉴于通胀压力缓解，将暂停加息周期。此举推动美股大幅上涨。',
      source: '佑诚社',
      category: '经济数据',
      timestamp: '2026-06-17 13:15',
      impact: 'high',
      related: ['SPX', 'INDU', 'CCMP'],
    },
    {
      id: '3',
      title: 'Tesla 第二季度交付量超预期，股价上升 3.5%',
      summary: 'Tesla 公布第二季度交付 466,140 辆电动车，超过市场预期。公司表示将继续扩大产能。',
      source: '财经新闻',
      category: '公司新闻',
      timestamp: '2026-06-17 12:45',
      impact: 'high',
      related: ['TSLA'],
    },
    {
      id: '4',
      title: '中国 GDP 增速超预期，经济复苏势头强劲',
      summary: '中国国家统计局公布，第二季度 GDP 同比增长 6.3%，超过预期的 6.0%，显示经济复苏势头强劲。',
      source: '新华社',
      category: '经济数据',
      timestamp: '2026-06-17 11:20',
      impact: 'medium',
      related: ['BABA', 'TCEHY'],
    },
    {
      id: '5',
      title: 'Microsoft 与 OpenAI 扩大合作，投资 100 亿美元',
      summary: 'Microsoft 宣布将向 OpenAI 追加投资 100 亿美元，用于开发下一代 AI 技术。',
      source: '科技新闻',
      category: '合作协议',
      timestamp: '2026-06-17 10:30',
      impact: 'medium',
      related: ['MSFT', 'NVDA'],
    },
    {
      id: '6',
      title: '油价上升 2.3%，OPEC+ 宣布减产协议',
      summary: 'OPEC+ 在会议中宣布延续减产协议，导致国际油价上升至 $85/桶。',
      source: '能源新闻',
      category: '商品市场',
      timestamp: '2026-06-17 09:45',
      impact: 'medium',
      related: ['XBRUSD', 'XWTIUSD'],
    },
    {
      id: '7',
      title: '欧洲央行维持利率不变，暗示未来可能降息',
      summary: '欧洲央行在货币政策会议上维持基准利率不变，但表示如果通胀继续下降，未来可能考虑降息。',
      source: '欧洲金融',
      category: '央行动态',
      timestamp: '2026-06-17 08:15',
      impact: 'medium',
      related: ['EURUSD', 'BUND'],
    },
    {
      id: '8',
      title: 'Nvidia 推出新款 H200 GPU，性能提升 50%',
      summary: 'Nvidia 发布最新的 H200 GPU，相比 H100 性能提升 50%，将推动 AI 计算成本大幅下降。',
      source: '科技新闻',
      category: '产品发布',
      timestamp: '2026-06-17 07:30',
      impact: 'high',
      related: ['NVDA', 'MSFT', 'GOOGL'],
    },
  ];

  const categories = [
    { id: 'all', name: '全部新闻' },
    { id: 'company', name: '公司新闻' },
    { id: 'economic', name: '经济数据' },
    { id: 'market', name: '市场动态' },
    { id: 'policy', name: '政策动态' },
  ];

  const filteredNews = newsItems.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.summary.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high':
        return 'bg-red-500/10 text-red-700 border-red-200';
      case 'medium':
        return 'bg-orange-500/10 text-orange-700 border-orange-200';
      case 'low':
        return 'bg-blue-500/10 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-500/10 text-gray-700';
    }
  };

  const getImpactLabel = (impact: string) => {
    switch (impact) {
      case 'high':
        return '高影响';
      case 'medium':
        return '中等';
      case 'low':
        return '低影响';
      default:
        return '未知';
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Newspaper className="w-8 h-8 text-accent" />
            <h1 className="text-3xl font-bold">{title}</h1>
          </div>
          <p className="text-muted-foreground">
            实时财经新闻聚合，掌握市场动态
          </p>
        </div>

        {/* 搜索和筛选 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">搜索和筛选</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="搜索新闻标题或内容..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full"
            />
            <div className="flex gap-2 flex-wrap">
              {categories.map(cat => (
                <Button
                  key={cat.id}
                  variant={selectedCategory === cat.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  {cat.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 新闻列表 */}
        <div className="space-y-4">
          {filteredNews.length === 0 ? (
            <Card>
              <CardContent className="pt-12 pb-12">
                <div className="text-center">
                  <Newspaper className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    没有找到匹配的新闻
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            filteredNews.map(news => (
              <Card key={news.id} className="hover:border-accent/50 transition-colors">
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-base leading-tight mb-2">
                          {news.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-3">
                          {news.summary}
                        </p>
                      </div>
                      <Badge className={`flex-shrink-0 ${getImpactColor(news.impact)}`}>
                        {getImpactLabel(news.impact)}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-border/50">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {news.source}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {news.timestamp}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {news.related.map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs font-mono">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* 新闻统计 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">今日新闻统计</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">总新闻数</p>
                <p className="text-2xl font-bold">{newsItems.length}</p>
              </div>
              <div className="p-4 bg-red-500/10 rounded-lg border border-red-200">
                <p className="text-sm text-red-700 mb-1">高影响新闻</p>
                <p className="text-2xl font-bold text-red-700">
                  {newsItems.filter(n => n.impact === 'high').length}
                </p>
              </div>
              <div className="p-4 bg-orange-500/10 rounded-lg border border-orange-200">
                <p className="text-sm text-orange-700 mb-1">中等影响</p>
                <p className="text-2xl font-bold text-orange-700">
                  {newsItems.filter(n => n.impact === 'medium').length}
                </p>
              </div>
              <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-700 mb-1">低影响新闻</p>
                <p className="text-2xl font-bold text-blue-700">
                  {newsItems.filter(n => n.impact === 'low').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
