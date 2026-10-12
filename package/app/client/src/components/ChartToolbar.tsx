/**
 * ChartToolbar - 全局图表工具栏组件
 * 提供时间维度筛选（1W/1M/3M/6M/1Y/ALL）和数据导出（CSV/PDF）功能
 */
import { useState } from 'react';
import { Download, FileText, Clock } from 'lucide-react';
import { toast } from 'sonner';

export type Timeframe = '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

interface ChartToolbarProps {
  title?: string;
  timeframe?: Timeframe;
  onTimeframeChange?: (t: Timeframe) => void;
  onExportCSV?: () => void;
  onExportPDF?: () => void;
  chartId?: string;
  className?: string;
}

const TIMEFRAMES: Timeframe[] = ['1W', '1M', '3M', '6M', '1Y', 'ALL'];

export function ChartToolbar({
  title,
  timeframe = '1M',
  onTimeframeChange,
  onExportCSV,
  onExportPDF,
  chartId,
  className = '',
}: ChartToolbarProps) {
  const [exporting, setExporting] = useState(false);
  const timeframeAvailable = Boolean(onTimeframeChange);
  const csvAvailable = Boolean(onExportCSV);
  const pdfAvailable = Boolean(onExportPDF || chartId);

  const handleExportCSV = () => {
    if (onExportCSV) {
      onExportCSV();
      toast.success('CSV 文件已下载');
    }
  };

  const handleExportPDF = async () => {
    if (onExportPDF) {
      setExporting(true);
      try {
        onExportPDF();
        toast.success('PDF 导出成功');
      } finally {
        setExporting(false);
      }
    } else if (chartId) {
      // 使用浏览器打印 API 导出 PDF
      setExporting(true);
      try {
        const el = document.getElementById(chartId);
        if (el) {
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.write(`
              <html><head><title>${title || '图表'}</title>
              <style>body{margin:0;padding:20px;font-family:sans-serif;background:#111827;color:#fff;}
              * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              </style></head><body>${el.outerHTML}</body></html>
            `);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
            toast.success('PDF 打印对话框已打开');
          }
        }
      } finally {
        setExporting(false);
      }
    }
  };

  return (
    <div className={`flex items-center justify-between gap-2 ${className}`}>
      {title && (
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs font-medium text-gray-300">{title}</span>
        </div>
      )}
      <div className="flex items-center gap-1 ml-auto">
        {/* 时间维度筛选器 */}
        <div className="flex items-center bg-gray-800 rounded p-0.5 gap-0.5">
          {TIMEFRAMES.map(t => (
            <button
              key={t}
              onClick={() => onTimeframeChange?.(t)}
              disabled={!timeframeAvailable}
              title={timeframeAvailable ? `切换至 ${t}` : '时间筛选未接入此图表'}
              className={`px-2 py-0.5 text-xs rounded transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                timeframe === t
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        {/* 导出按钮 */}
        <button
          onClick={handleExportCSV}
          disabled={!csvAvailable}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-gray-800 text-green-400 hover:bg-gray-700 hover:text-green-300 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          title={csvAvailable ? '导出 CSV' : 'CSV 导出未接入此图表'}
        >
          <Download className="w-3 h-3" />
          {csvAvailable ? 'CSV' : 'CSV 未接入'}
        </button>
        <button
          onClick={handleExportPDF}
          disabled={exporting || !pdfAvailable}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-gray-800 text-orange-400 hover:bg-gray-700 hover:text-orange-300 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          title={pdfAvailable ? '导出 PDF' : 'PDF 导出未接入此图表'}
        >
          <FileText className="w-3 h-3" />
          {exporting ? '...' : pdfAvailable ? 'PDF' : 'PDF 未接入'}
        </button>
      </div>
    </div>
  );
}

/**
 * 通用 CSV 导出工具函数
 */
export function exportToCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default ChartToolbar;
