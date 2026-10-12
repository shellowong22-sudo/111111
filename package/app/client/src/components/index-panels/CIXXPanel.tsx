import { refreshPanelData } from '@/components/PanelActionButton';
import React, { useState, useMemo, useCallback, ChangeEvent, DragEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Calendar, DollarSign, TrendingUp, BarChart as LucideBarChart, Clock, CheckCircle, XCircle, Info } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Bar, ComposedChart, Legend } from 'recharts';
import * as XLSX from 'xlsx';

interface ImportedDataRow {
  [key: string]: any;
}

interface ColumnMapping {
  excelColumn: string;
  targetField: 'date' | 'price' | 'volume' | 'other' | '';
  dataType: 'string' | 'number' | 'date' | '';
}

interface DataQualityReport {
  missingValueRatio: { [key: string]: number };
  outlierCount: { [key: string]: number };
  timeCoverage: string;
  frequencyConsistency: string;
  totalRows: number;
  totalColumns: number;
}

interface ImportHistoryEntry {
  id: string;
  fileName: string;
  importDate: string;
  status: 'success' | 'failed';
  processedRows: number;
  originalColumns: number;
}

const CIXXPanel: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ImportedDataRow[]>([]);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [alignmentFrequency, setAlignmentFrequency] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [missingValueStrategy, setMissingValueStrategy] = useState<'ffill' | 'bfill' | 'linear'>('ffill');
  const [dataQualityReport, setDataQualityReport] = useState<DataQualityReport | null>(null);
  const [importHistory, setImportHistory] = useState<ImportHistoryEntry[]>([]);
  const [activeTab, setActiveTab] = useState<string>('upload');

  const handleFileDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      parseFile(droppedFile);
    }
  }, []);

  const handleFileInput = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseFile(selectedFile);
    }
  }, []);

  const parseFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json<ImportedDataRow>(worksheet, { header: 1 });

      if (json.length > 1) {
        const headers = json[0] as string[];
        const rows = json.slice(1);
        const parsedRows = rows.map(row => {
          const newRow: ImportedDataRow = {};
          headers.forEach((header, index) => {
            newRow[header] = row[index];
          });
          return newRow;
        });
        setParsedData(parsedRows);
        setColumnMappings(headers.map(col => ({
          excelColumn: col,
          targetField: '',
          dataType: inferDataType(parsedRows, col)
        })));
        setActiveTab('mapping');
      } else {
        setParsedData([]);
        setColumnMappings([]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const inferDataType = (data: ImportedDataRow[], column: string): 'string' | 'number' | 'date' | '' => {
    if (!data || data.length === 0) return '';
    const sample = data.slice(0, 10).map(row => row[column]);

    const isNumber = sample.every(val => val === null || val === undefined || !isNaN(parseFloat(val)));
    if (isNumber) return 'number';

    const isDate = sample.every(val => val === null || val === undefined || !isNaN(new Date(val).getTime()));
    if (isDate) return 'date';

    return 'string';
  };

  const handleMappingChange = useCallback((index: number, field: keyof ColumnMapping, value: string) => {
    setColumnMappings(prev => {
      const newMappings = [...prev];
      (newMappings[index][field] as string) = value;
      return newMappings;
    });
  }, []);

  const processData = useMemo(() => {
    if (!parsedData.length || !columnMappings.length) return [];

    const mappedData = parsedData.map(row => {
      const newRow: ImportedDataRow = {};
      columnMappings.forEach(mapping => {
        if (mapping.targetField && mapping.excelColumn) {
          let value = row[mapping.excelColumn];
          if (mapping.dataType === 'number') {
            value = parseFloat(value);
          } else if (mapping.dataType === 'date') {
            value = new Date(value);
          }
          newRow[mapping.targetField] = value;
        }
      });
      return newRow;
    }).filter(row => row.date);

    // Simple time series alignment and missing value handling (for demonstration)
    // In a real scenario, this would be much more complex.
    const sortedData = mappedData.sort((a, b) => (a.date as Date).getTime() - (b.date as Date).getTime());

    const alignedAndFilledData = sortedData.map((row, index, arr) => {
      const processedRow = { ...row };
      // Apply missing value strategy (simplified)
      if (processedRow.price === undefined || isNaN(processedRow.price)) {
        if (missingValueStrategy === 'ffill' && index > 0) {
          processedRow.price = arr[index - 1].price;
        } else if (missingValueStrategy === 'bfill' && index < arr.length - 1) {
          processedRow.price = arr[index + 1].price;
        } else if (missingValueStrategy === 'linear' && index > 0 && index < arr.length - 1) {
          const prevPrice = arr[index - 1].price;
          const nextPrice = arr[index + 1].price;
          if (typeof prevPrice === 'number' && typeof nextPrice === 'number') {
            processedRow.price = parseFloat(((prevPrice + nextPrice) / 2).toFixed(2));
          }
        }
      }
      return processedRow;
    });

    return alignedAndFilledData.map(row => ({
      ...row,
      date: (row.date as Date).toISOString().split('T')[0] // Format date for charts
    }));
  }, [parsedData, columnMappings, alignmentFrequency, missingValueStrategy]);

  const runDataQualityReport = useCallback(() => {
    if (!processData.length) return;

    const report: DataQualityReport = {
      missingValueRatio: {},
      outlierCount: {},
      timeCoverage: '',
      frequencyConsistency: 'Consistent',
      totalRows: processData.length,
      totalColumns: Object.keys(processData[0] || {}).length,
    };

    const dateColumn = processData.map(d => new Date(d.date));
    if (dateColumn.length > 0) {
      report.timeCoverage = `${dateColumn[0].toLocaleDateString()} - ${dateColumn[dateColumn.length - 1].toLocaleDateString()}`;
    }

    // Simplified missing value and outlier detection
    columnMappings.forEach(mapping => {
      if (mapping.targetField && mapping.targetField !== 'date') {
        const values = (processData as any[]).map(row => row[mapping.targetField as string]);
        const missingCount = values.filter(v => v === undefined || v === null || (typeof v === 'number' && isNaN(v))).length;
        report.missingValueRatio[mapping.targetField] = parseFloat((missingCount / values.length).toFixed(2));

        if (mapping.dataType === 'number') {
          const numericValues = values.filter(v => typeof v === 'number' && !isNaN(v)) as number[];
          if (numericValues.length > 0) {
            const q1 = numericValues.sort((a, b) => a - b)[Math.floor(numericValues.length * 0.25)];
            const q3 = numericValues.sort((a, b) => a - b)[Math.floor(numericValues.length * 0.75)];
            const iqr = q3 - q1;
            const lowerBound = q1 - 1.5 * iqr;
            const upperBound = q3 + 1.5 * iqr;
            const outliers = numericValues.filter(v => v < lowerBound || v > upperBound).length;
            report.outlierCount[mapping.targetField] = outliers;
          }
        }
      }
    });

    setDataQualityReport(report);
  }, [processData, columnMappings]);

  const handleImport = useCallback(() => {
    if (file && processData.length > 0) {
      const newEntry: ImportHistoryEntry = {
        id: Date.now().toString(),
        fileName: file.name,
        importDate: new Date().toLocaleString(),
        status: 'success',
        processedRows: processData.length,
        originalColumns: columnMappings.length,
      };
      setImportHistory(prev => [newEntry, ...prev]);
      setDataQualityReport(null); // Clear report after import
      setFile(null);
      setParsedData([]);
      setColumnMappings([]);
      setActiveTab('history');
    }
  }, [file, processData, columnMappings]);

  const dataPreviewTable = useMemo(() => {
    if (!parsedData.length) return null;
    const headers = Object.keys(parsedData[0]);
    return (
      <div className="overflow-auto max-h-[300px] mt-4 border border-gray-700 rounded-md">
        <table className="w-full text-sm text-left text-gray-400">
          <thead className="text-xs text-gray-200 uppercase bg-gray-800 sticky top-0">
            <tr>
              {headers.map(header => <th key={header} scope="col" className="px-6 py-3">{header}</th>)}
            </tr>
          </thead>
          <tbody>
            {parsedData.slice(0, 20).map((row, rowIndex) => (
              <tr key={rowIndex} className="bg-gray-900 border-b border-gray-700 hover:bg-gray-800">
                {headers.map((header, colIndex) => (
                  <td key={`${rowIndex}-${colIndex}`} className="px-6 py-4">
                    {String(row[header]).length > 50 ? String(row[header]).substring(0, 47) + '...' : String(row[header])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }, [parsedData]);

  const priceDataForChart = useMemo(() => {
    const priceMapping = columnMappings.find(m => m.targetField === 'price');
    if (!processData.length || !priceMapping) return [];
    return processData.map(d => ({
      date: (d as any).date,
      price: typeof (d as any).price === 'number' ? (d as any).price : parseFloat((d as any).price),
    }));
  }, [processData, columnMappings]);

  const volumeDataForChart = useMemo(() => {
    const volumeMapping = columnMappings.find(m => m.targetField === 'volume');
    if (!processData.length || !volumeMapping) return [];
    return processData.map(d => ({
      date: (d as any).date,
      volume: typeof (d as any).volume === 'number' ? (d as any).volume : parseFloat((d as any).volume),
    }));
  }, [processData, columnMappings]);

  const qualityChartData = useMemo(() => {
    if (!dataQualityReport) return [];
    return Object.entries(dataQualityReport.missingValueRatio).map(([key, value]) => ({
      name: key,
      '缺失值比例': value * 100,
      '异常值数量': dataQualityReport.outlierCount[key] || 0,
    }));
  }, [dataQualityReport]);

  return (
    <Card className="w-full max-w-4xl mx-auto bg-gray-950 text-gray-100 border-gray-800 shadow-lg">
      <CardHeader className="border-b border-gray-800">
        <CardTitle className="text-2xl font-bold text-green-400">CIXXPanel - 本地数据Excel导入工具</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 bg-gray-800 text-gray-300">
            <TabsTrigger value="upload" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">文件上传</TabsTrigger>
            <TabsTrigger value="mapping" className="data-[state=active]:bg-green-600 data-[state=active]:text-white" disabled={!file}>列映射</TabsTrigger>
            <TabsTrigger value="preview" className="data-[state=active]:bg-green-600 data-[state=active]:text-white" disabled={!parsedData.length}>数据预览</TabsTrigger>
            <TabsTrigger value="quality" className="data-[state=active]:bg-green-600 data-[state=active]:text-white" disabled={!processData.length}>质量报告</TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">导入记录</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-4">
            <div
              onDrop={handleFileDrop}
              onDragOver={(e) => e.preventDefault()}
              className="flex flex-col items-center justify-center p-10 border-2 border-dashed border-green-600 rounded-lg bg-gray-900 text-gray-300 cursor-pointer hover:border-green-500 transition-colors"
            >
              <Upload className="w-12 h-12 text-green-400 mb-4" />
              <p className="text-lg font-semibold">拖拽Excel/CSV文件到此处上传</p>
              <p className="text-sm text-gray-400">或</p>
              <Input type="file" accept=".csv, .xls, .xlsx" onChange={handleFileInput} className="hidden" id="file-upload" />
              <label htmlFor="file-upload" className="mt-4 px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 cursor-pointer transition-colors">
                选择文件
              </label>
              {file && (
                <div className="mt-4 text-center">
                  <p className="font-medium">已选择文件: <span className="text-green-300">{file.name}</span></p>
                  <p className="text-sm text-gray-400">大小: {(file.size / 1024).toFixed(2)} KB</p>
                  {parsedData.length > 0 && (
                    <p className="text-sm text-gray-400">行数: {parsedData.length}, 列数: {Object.keys(parsedData[0] || {}).length}</p>
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="mapping" className="mt-4">
            <h3 className="text-xl font-semibold mb-4 text-green-300">列映射界面</h3>
            <div className="space-y-4">
              {columnMappings.map((mapping, index) => (
                <div key={index} className="flex items-center space-x-4 bg-gray-900 p-3 rounded-md border border-gray-800">
                  <Badge variant="outline" className="bg-gray-700 text-gray-200 border-gray-600">Excel 列: {mapping.excelColumn}</Badge>
                  <Select value={mapping.targetField} onValueChange={(value: 'date' | 'price' | 'volume' | 'other' | '') => handleMappingChange(index, 'targetField', value)}>
                    <SelectTrigger className="w-[180px] bg-gray-800 border-gray-700 text-gray-200">
                      <SelectValue placeholder="映射到字段" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 text-gray-200 border-gray-700">
                      <SelectItem value="date"><Calendar className="inline-block mr-2 h-4 w-4" />日期</SelectItem>
                      <SelectItem value="price"><DollarSign className="inline-block mr-2 h-4 w-4" />价格</SelectItem>
                      <SelectItem value="volume"><TrendingUp className="inline-block mr-2 h-4 w-4" />成交量</SelectItem>
                      <SelectItem value="other"><Info className="inline-block mr-2 h-4 w-4" />其他</SelectItem>
                      <SelectItem value="">不映射</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={mapping.dataType} onValueChange={(value: 'string' | 'number' | 'date' | '') => handleMappingChange(index, 'dataType', value)}>
                    <SelectTrigger className="w-[120px] bg-gray-800 border-gray-700 text-gray-200">
                      <SelectValue placeholder="数据类型" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 text-gray-200 border-gray-700">
                      <SelectItem value="string">字符串</SelectItem>
                      <SelectItem value="number">数值</SelectItem>
                      <SelectItem value="date">日期</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <Button onClick={() => setActiveTab('preview')} disabled={!columnMappings.some(m => m.targetField === 'date')} className="mt-6 bg-green-600 hover:bg-green-700 text-white">
              下一步: 数据预览
            </Button>
          </TabsContent>

          <TabsContent value="preview" className="mt-4">
            <h3 className="text-xl font-semibold mb-4 text-green-300">数据预览与时间序列对齐</h3>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">对齐频率</label>
                <Select value={alignmentFrequency} onValueChange={(value: 'daily' | 'weekly' | 'monthly') => setAlignmentFrequency(value)}>
                  <SelectTrigger className="w-full bg-gray-800 border-gray-700 text-gray-200">
                    <SelectValue placeholder="选择对齐频率" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 text-gray-200 border-gray-700">
                    <SelectItem value="daily">日</SelectItem>
                    <SelectItem value="weekly">周</SelectItem>
                    <SelectItem value="monthly">月</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">缺失值处理</label>
                <Select value={missingValueStrategy} onValueChange={(value: 'ffill' | 'bfill' | 'linear') => setMissingValueStrategy(value)}>
                  <SelectTrigger className="w-full bg-gray-800 border-gray-700 text-gray-200">
                    <SelectValue placeholder="选择处理策略" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 text-gray-200 border-gray-700">
                    <SelectItem value="ffill">前向填充</SelectItem>
                    <SelectItem value="bfill">后向填充</SelectItem>
                    <SelectItem value="linear">线性插值</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <h4 className="text-lg font-semibold mb-2 text-gray-200">前20行数据预览</h4>
            {dataPreviewTable}
            <Button onClick={() => {
              runDataQualityReport();
              setActiveTab('quality');
            }} disabled={!processData.length} className="mt-6 bg-green-600 hover:bg-green-700 text-white">
              下一步: 数据质量报告
            </Button>
          </TabsContent>

          <TabsContent value="quality" className="mt-4">
            <h3 className="text-xl font-semibold mb-4 text-green-300">数据质量报告</h3>
            {dataQualityReport ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 bg-gray-900 p-4 rounded-md border border-gray-800">
                  <div><p className="text-gray-400">总行数:</p><p className="font-bold text-green-300">{dataQualityReport.totalRows}</p></div>
                  <div><p className="text-gray-400">总列数:</p><p className="font-bold text-green-300">{dataQualityReport.totalColumns}</p></div>
                  <div><p className="text-gray-400">时间覆盖范围:</p><p className="font-bold text-green-300">{dataQualityReport.timeCoverage}</p></div>
                  <div><p className="text-gray-400">频率一致性:</p><p className="font-bold text-green-300">{dataQualityReport.frequencyConsistency}</p></div>
                </div>

                <h4 className="text-lg font-semibold mt-6 mb-2 text-gray-200">缺失值比例与异常值数量</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={qualityChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" />
                    <XAxis dataKey="name" stroke="#9CA3AF" />
                    <YAxis yAxisId="left" orientation="left" stroke="#9CA3AF" label={{ value: '缺失值比例 (%)', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }} />
                    <YAxis yAxisId="right" orientation="right" stroke="#9CA3AF" label={{ value: '异常值数量', angle: 90, position: 'insideRight', fill: '#9CA3AF' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1F2937', borderColor: '#4B5563', color: '#E5E7EB' }} />
                    <Legend />
                    <Bar dataKey="缺失值比例" yAxisId="left" fill="#10B981" />
                    <Line type="monotone" dataKey="异常值数量" yAxisId="right" stroke="#FBBF24" activeDot={{ r: 8 }} />
                  </ComposedChart>
                </ResponsiveContainer>

                <h4 className="text-lg font-semibold mt-6 mb-2 text-gray-200">导入数据时间序列预览</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={priceDataForChart} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" />
                    <XAxis dataKey="date" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip contentStyle={{ backgroundColor: '#1F2937', borderColor: '#4B5563', color: '#E5E7EB' }} />
                    <Legend />
                    <Line type="monotone" dataKey="price" stroke="#34D399" activeDot={{ r: 8 }} name="价格" />
                  </LineChart>
                </ResponsiveContainer>

                {volumeDataForChart.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-lg font-semibold mb-2 text-gray-200">成交量时间序列预览</h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={volumeDataForChart} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" />
                        <XAxis dataKey="date" stroke="#9CA3AF" />
                        <YAxis stroke="#9CA3AF" />
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', borderColor: '#4B5563', color: '#E5E7EB' }} />
                        <Area type="monotone" dataKey="volume" stroke="#6EE7B7" fill="#065F46" name="成交量" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <Button onClick={handleImport} className="mt-6 bg-green-600 hover:bg-green-700 text-white">
                  确认导入
                </Button>
              </div>
            ) : (
              <p className="text-gray-400">请先处理数据并生成报告。</p>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <h3 className="text-xl font-semibold mb-4 text-green-300">历史导入记录</h3>
            {importHistory.length > 0 ? (
              <div className="overflow-auto max-h-[400px] border border-gray-700 rounded-md">
                <table className="w-full text-sm text-left text-gray-400">
                  <thead className="text-xs text-gray-200 uppercase bg-gray-800 sticky top-0">
                    <tr>
                      <th scope="col" className="px-6 py-3">文件名</th>
                      <th scope="col" className="px-6 py-3">导入日期</th>
                      <th scope="col" className="px-6 py-3">状态</th>
                      <th scope="col" className="px-6 py-3">处理行数</th>
                      <th scope="col" className="px-6 py-3">原始列数</th>
                      <th scope="col" className="px-6 py-3">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importHistory.map((entry) => (
                      <tr key={entry.id} className="bg-gray-900 border-b border-gray-700 hover:bg-gray-800">
                        <td className="px-6 py-4 font-medium text-white">{entry.fileName}</td>
                        <td className="px-6 py-4">{entry.importDate}</td>
                        <td className="px-6 py-4">
                          <Badge className={entry.status === 'success' ? 'bg-green-600' : 'bg-red-600'}>
                            {entry.status === 'success' ? <CheckCircle className="inline-block mr-1 h-3 w-3" /> : <XCircle className="inline-block mr-1 h-3 w-3" />}
                            {entry.status === 'success' ? '成功' : '失败'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">{entry.processedRows}</td>
                        <td className="px-6 py-4">{entry.originalColumns}</td>
                        <td className="px-6 py-4">
                          <Button type="button" onClick={() => void refreshPanelData()} variant="link" className="text-green-400 hover:text-green-300 p-0 h-auto">重新加载</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-400">暂无导入记录。</p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default CIXXPanel;
