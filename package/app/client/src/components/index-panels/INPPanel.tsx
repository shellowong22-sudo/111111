import React, { useState, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  AreaChart, 
  Area, 
  BarChart as RechartsBarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from 'recharts';
import {
  FileText, 
  Search, 
  Filter, 
  ArrowUpDown, 
  BellRing, 
  BarChart, // lucide-react BarChart
  PieChart, // lucide-react PieChart
  LineChart as LucideLineChart, // lucide-react LineChart
  BookOpen, 
  Megaphone, 
  ScrollText, 
  Scale, 
  History, 
  ChevronDown
} from 'lucide-react';

interface Document {
  id: string;
  title: string;
  indexName: string;
  publishDate: string;
  documentType: 'Methodology' | 'Rebalancing Announcement' | 'Research Report' | 'Regulatory Document' | 'Historical Data';
  version: string;
  fileSize: number;
  summary: string;
  keyChanges: string[];
  impactAnalysis: string;
}

interface VersionComparison {
  versionA: string;
  versionB: string;
  changes: string[];
}

interface ImpactData {
  year: string;
  constituents: number;
  concentration: number;
  returns: number;
}

interface Subscription {
  id: string;
  indexName: string;
  subscribed: boolean;
  emailAlerts: boolean;
}

const INPPanel: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'publishDate' | 'indexName' | 'fileSize'>('publishDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<'All' | Document['documentType']>('All');
  const [versionA, setVersionA] = useState<string | null>(null);
  const [versionB, setVersionB] = useState<string | null>(null);

  const allDocuments = useMemo<Document[]>(() => {
    const docs: Document[] = [];
    const types: Document['documentType'][] = ['Methodology', 'Rebalancing Announcement', 'Research Report', 'Regulatory Document', 'Historical Data'];
    const indexNames = ['S&P 500', 'NASDAQ 100', 'Dow Jones Industrial Average', 'FTSE 100', 'Nikkei 225'];

    for (let i = 0; i < 50; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      const index = indexNames[Math.floor(Math.random() * indexNames.length)];
      const year = 2020 + Math.floor(Math.random() * 6); // 2020-2025
      const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
      const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
      const versionNum = (1.0 + Math.random() * 2).toFixed(1);

      docs.push({
        id: `doc-${i}`,
        title: `${index} ${type} Document ${i + 1}`,
        indexName: index,
        publishDate: `${year}-${month}-${day}`,
        documentType: type,
        version: `v${versionNum}`,
        fileSize: parseFloat((0.5 + Math.random() * 10).toFixed(2)), // MB
        summary: `This document provides a comprehensive overview of the ${index} ${type} and its implications for market participants. It details the key components and operational guidelines.`, 
        keyChanges: [
          `Updated calculation methodology for ${index}.`,
          `Adjusted constituent selection criteria.`,
          `Revised data sources for improved accuracy.`,
        ],
        impactAnalysis: `The changes are expected to have a moderate impact on the index's sector allocation and a minor impact on overall performance. Specific details are provided in section 3.2.`,
      });
    }
    return docs;
  }, []);

  const documentCategories = useMemo(() => {
    const categories = allDocuments.reduce((acc, doc) => {
      acc[doc.documentType] = (acc[doc.documentType] || 0) + 1;
      return acc;
    }, {} as Record<Document['documentType'], number>);
    return { All: allDocuments.length, ...categories };
  }, [allDocuments]);

  const filteredDocuments = useMemo(() => {
    let filtered = allDocuments.filter(doc => 
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.indexName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (selectedCategory !== 'All') {
      filtered = filtered.filter(doc => doc.documentType === selectedCategory);
    }

    filtered.sort((a, b) => {
      let compare = 0;
      if (sortBy === 'publishDate') {
        compare = new Date(a.publishDate).getTime() - new Date(b.publishDate).getTime();
      } else if (sortBy === 'indexName') {
        compare = a.indexName.localeCompare(b.indexName);
      } else if (sortBy === 'fileSize') {
        compare = a.fileSize - b.fileSize;
      }
      return sortOrder === 'asc' ? compare : -compare;
    });

    return filtered;
  }, [allDocuments, searchTerm, selectedCategory, sortBy, sortOrder]);

  const availableVersions = useMemo(() => {
    const versions = new Set<string>();
    allDocuments.forEach(doc => versions.add(doc.version));
    return Array.from(versions).sort();
  }, [allDocuments]);

  const versionComparisonResult = useMemo<VersionComparison | null>(() => {
    if (!versionA || !versionB) return null;
    // Simulate comparison logic
    const changes = [
      `Changes detected between ${versionA} and ${versionB}:`,
      `• Section 2.1: Calculation methodology updated.`,
      `• Section 3.5: Constituent eligibility criteria revised.`,
      `• Appendix A: Data sources for backtesting adjusted.`,
    ];
    return { versionA, versionB, changes };
  }, [versionA, versionB]);

  const impactAnalysisData = useMemo<ImpactData[]>(() => {
    const data: ImpactData[] = [];
    for (let i = 0; i < 5; i++) {
      const year = `${2021 + i}`;
      data.push({
        year: year,
        constituents: parseFloat((50 + Math.random() * 100).toFixed(0)),
        concentration: parseFloat((0.1 + Math.random() * 0.4).toFixed(2)),
        returns: parseFloat((-5 + Math.random() * 20).toFixed(2)),
      });
    }
    return data;
  }, []);

  const subscriptions = useMemo<Subscription[]>(() => {
    const subs: Subscription[] = [];
    const indexNames = ['S&P 500', 'NASDAQ 100', 'FTSE 100'];
    indexNames.forEach((name, i) => {
      subs.push({
        id: `sub-${i}`,
        indexName: name,
        subscribed: Math.random() > 0.5,
        emailAlerts: Math.random() > 0.3,
      });
    });
    return subs;
  }, []);

  const handleSort = useCallback((column: 'publishDate' | 'indexName' | 'fileSize') => {
    if (sortBy === column) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  }, [sortBy]);

  return (
    <div className="p-4 bg-gray-950 text-gray-100 min-h-screen font-mono">
      <Card className="bg-gray-900 border-gray-800 shadow-lg">
        <CardHeader className="border-b border-gray-800">
          <CardTitle className="text-2xl font-bold text-blue-400 flex items-center">
            <FileText className="mr-2" /> 指数出版物文档库
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <Tabs defaultValue="documents" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-gray-800 text-gray-300">
              <TabsTrigger value="documents" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">文档列表</TabsTrigger>
              <TabsTrigger value="analysis" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">分析工具</TabsTrigger>
              <TabsTrigger value="subscriptions" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">订阅管理</TabsTrigger>
            </TabsList>

            <TabsContent value="documents" className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left Panel: Document Categories and Search */}
              <div className="md:col-span-1 space-y-4">
                <Input
                  type="text"
                  placeholder="搜索文档..."
                  className="bg-gray-800 border-gray-700 text-gray-100 placeholder-gray-400 focus:border-blue-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}

                />
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-lg text-blue-300">文档分类</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {Object.entries(documentCategories).map(([category, count]) => (
                      <Button
                        key={category}
                        variant="ghost"
                        className={`w-full justify-between text-left ${selectedCategory === category ? 'bg-blue-700 text-white hover:bg-blue-600' : 'text-gray-300 hover:bg-gray-700'}`}
                        onClick={() => setSelectedCategory(category as Document['documentType'] | 'All')}
                      >
                        <span>{category}</span>
                        <Badge className={`${selectedCategory === category ? 'bg-blue-500' : 'bg-gray-600'} text-white`}>{count}</Badge>
                      </Button>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* Middle Panel: Document List */}
              <div className="md:col-span-2 space-y-4">
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg text-blue-300">文档列表</CardTitle>
                    <div className="flex items-center space-x-2">
                      <Button variant="ghost" size="sm" onClick={() => handleSort('title' as any)} className="text-gray-300 hover:bg-gray-700">
                        标题 <ArrowUpDown className="ml-1 h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleSort('indexName')} className="text-gray-300 hover:bg-gray-700">
                        指数名称 <ArrowUpDown className="ml-1 h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleSort('publishDate')} className="text-gray-300 hover:bg-gray-700">
                        发布日期 <ArrowUpDown className="ml-1 h-3 w-3" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="max-h-[600px] overflow-y-auto">
                    {filteredDocuments.length === 0 ? (
                      <p className="text-gray-400 text-center py-4">无匹配文档。</p>
                    ) : (
                      <div className="space-y-2">
                        {filteredDocuments.map(doc => (
                          <div
                            key={doc.id}
                            className={`flex justify-between items-center p-3 rounded-md cursor-pointer transition-colors ${selectedDoc?.id === doc.id ? 'bg-blue-800' : 'bg-gray-700 hover:bg-gray-600'}`}
                            onClick={() => setSelectedDoc(doc)}
                          >
                            <div>
                              <p className="text-blue-200 font-medium">{doc.title}</p>
                              <p className="text-gray-400 text-sm">{doc.indexName} - {doc.publishDate} - {doc.version}</p>
                            </div>
                            <Badge className="bg-blue-600 text-white">{doc.documentType}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right Panel: Document Preview */}
              <div className="md:col-span-3 lg:col-span-1 space-y-4">
                {selectedDoc ? (
                  <Card className="bg-gray-800 border-gray-700">
                    <CardHeader>
                      <CardTitle className="text-lg text-blue-300">文档预览: {selectedDoc.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-gray-300">
                      <div>
                        <h4 className="font-semibold text-blue-200">摘要:</h4>
                        <p>{selectedDoc.summary}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold text-blue-200">关键变更点:</h4>
                        <ul className="list-disc list-inside">
                          {selectedDoc.keyChanges.map((change, i) => (
                            <li key={i}>{change}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold text-blue-200">影响分析:</h4>
                        <p>{selectedDoc.impactAnalysis}</p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="bg-gray-800 border-gray-700 h-full flex items-center justify-center">
                    <CardContent className="text-gray-400">请从列表中选择一个文档进行预览。</CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="analysis" className="mt-6 space-y-6">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-lg text-blue-300 flex items-center"><Scale className="mr-2" />版本对比工具</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex space-x-4">
                    <Select onValueChange={setVersionA}>
                      <SelectTrigger className="w-[180px] bg-gray-700 border-gray-600 text-gray-100">
                        <SelectValue placeholder="选择版本 A" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700 text-gray-100">
                        {availableVersions.map(version => (
                          <SelectItem key={version} value={version}>{version}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select onValueChange={setVersionB}>
                      <SelectTrigger className="w-[180px] bg-gray-700 border-gray-600 text-gray-100">
                        <SelectValue placeholder="选择版本 B" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700 text-gray-100">
                        {availableVersions.map(version => (
                          <SelectItem key={version} value={version}>{version}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {versionComparisonResult && (
                    <div className="bg-gray-700 p-4 rounded-md text-gray-200">
                      <h5 className="font-semibold text-blue-200">版本 {versionComparisonResult.versionA} vs {versionComparisonResult.versionB} 变更:</h5>
                      <ul className="list-disc list-inside mt-2">
                        {versionComparisonResult.changes.map((change, i) => (
                          <li key={i} className="text-yellow-300">{change}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-lg text-blue-300 flex items-center"><RechartsBarChart className="mr-2" />变更影响分析图</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsBarChart
                      data={impactAnalysisData}
                      margin={{
                        top: 20, right: 30, left: 20, bottom: 5,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                      <XAxis dataKey="year" stroke="#cbd5e0" />
                      <YAxis yAxisId="left" orientation="left" stroke="#cbd5e0" />
                      <YAxis yAxisId="right" orientation="right" stroke="#cbd5e0" />
                      <Tooltip 
                        cursor={{ fill: 'rgba(255,255,255,0.1)' }}
                        contentStyle={{ backgroundColor: '#2d3748', borderColor: '#4a5568', color: '#cbd5e0' }}
                        labelStyle={{ color: '#a0aec0' }}
                      />
                      <Legend />
                      <Bar yAxisId="left" dataKey="constituents" fill="#8884d8" name="成分股数量" />
                      <Bar yAxisId="right" dataKey="concentration" fill="#82ca9d" name="权重集中度" />
                      <Bar yAxisId="left" dataKey="returns" fill="#ffc658" name="回报影响" />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-lg text-blue-300 flex items-center"><LucideLineChart className="mr-2" />历史回报趋势</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart
                      data={impactAnalysisData}
                      margin={{
                        top: 5, right: 30, left: 20, bottom: 5,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                      <XAxis dataKey="year" stroke="#cbd5e0" />
                      <YAxis stroke="#cbd5e0" />
                      <Tooltip 
                        cursor={{ fill: 'rgba(255,255,255,0.1)' }}
                        contentStyle={{ backgroundColor: '#2d3748', borderColor: '#4a5568', color: '#cbd5e0' }}
                        labelStyle={{ color: '#a0aec0' }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="returns" stroke="#8884d8" activeDot={{ r: 8 }} name="回报" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="subscriptions" className="mt-6 space-y-4">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-lg text-blue-300 flex items-center"><BellRing className="mr-2" />我的订阅</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {subscriptions.map(sub => (
                    <div key={sub.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-md">
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-200 font-medium">{sub.indexName}</span>
                        <Badge className={`${sub.subscribed ? 'bg-green-600' : 'bg-red-600'} text-white`}>
                          {sub.subscribed ? '已订阅' : '未订阅'}
                        </Badge>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className={`border-blue-500 text-blue-300 hover:bg-blue-900 ${sub.emailAlerts ? 'bg-blue-800' : ''}`}
                        onClick={() => toast.info(`${sub.indexName} 邮件提醒已切换`)}
                      >
                        {sub.emailAlerts ? '邮件提醒: 开' : '邮件提醒: 关'}
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default INPPanel;
