/**
 * exportReport.ts
 * 通用报告导出工具 — 支持 PDF（jsPDF + AutoTable + 图表）和 CSV（UTF-8 BOM）两种格式
 * 供 SOVM VAE 面板和 WIR 信号面板复用
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

export interface ChartData {
  type: 'pie' | 'bar' | 'line';
  title: string;
  data: { name: string; value: number; color?: string }[];
  width?: number;  // 默认 80mm
  height?: number; // 默认 40mm
}

export interface ReportMeta {
  title: string;           // 报告标题，如「SOVM VAE 异常检测报告」
  subtitle?: string;       // 副标题，如「VAE + Isolation Forest 联合检测」
  generatedBy?: string;    // 生成者，如「Finance Hub AI 分析引擎」
  aiSummary?: string;      // AI 分析结果文本（可选）
  statsRows?: [string, string | number][];  // 统计摘要行，如 [['高风险国家', 3], ...]
  charts?: ChartData[];    // 可视化图表（可选）
}

export interface TableSection {
  title: string;           // 表格标题
  headers: string[];       // 列标题
  rows: (string | number)[][];  // 数据行
}

// ─────────────────────────────────────────────
// 图表渲染辅助函数
// ─────────────────────────────────────────────

/**
 * 绘制饼图到 Canvas
 */
function drawPieChart(
  ctx: CanvasRenderingContext2D,
  data: { name: string; value: number; color?: string }[],
  width: number,
  height: number
): void {
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) / 2 - 10;

  const total = data.reduce((s, d) => s + d.value, 0);
  let currentAngle = -Math.PI / 2;

  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F'];

  data.forEach((item, i) => {
    const sliceAngle = (item.value / total) * 2 * Math.PI;
    const color = item.color || colors[i % colors.length];

    // 绘制扇形
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
    ctx.closePath();
    ctx.fill();

    // 绘制边框
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 绘制标签
    const labelAngle = currentAngle + sliceAngle / 2;
    const labelX = centerX + Math.cos(labelAngle) * (radius * 0.7);
    const labelY = centerY + Math.sin(labelAngle) * (radius * 0.7);
    const percentage = ((item.value / total) * 100).toFixed(0);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${percentage}%`, labelX, labelY);

    currentAngle += sliceAngle;
  });

  // 绘制图例
  let legendY = height - 20;
  ctx.font = '10px Arial';
  ctx.textAlign = 'left';
  data.forEach((item, i) => {
    const color = item.color || colors[i % colors.length];
    ctx.fillStyle = color;
    ctx.fillRect(10, legendY - 8, 12, 12);
    ctx.fillStyle = '#333';
    ctx.fillText(item.name, 28, legendY);
    legendY -= 18;
  });
}

/**
 * 绘制柱状图到 Canvas
 */
function drawBarChart(
  ctx: CanvasRenderingContext2D,
  data: { name: string; value: number; color?: string }[],
  width: number,
  height: number
): void {
  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const maxValue = Math.max(...data.map(d => d.value));
  const barWidth = chartWidth / data.length * 0.8;
  const barGap = chartWidth / data.length * 0.2;

  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F'];

  // 绘制坐标轴
  ctx.strokeStyle = '#999';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, height - padding);
  ctx.lineTo(width - padding, height - padding);
  ctx.stroke();

  // 绘制柱子
  data.forEach((item, i) => {
    const barHeight = (item.value / maxValue) * chartHeight;
    const x = padding + i * (barWidth + barGap) + barGap / 2;
    const y = height - padding - barHeight;

    const color = item.color || colors[i % colors.length];
    ctx.fillStyle = color;
    ctx.fillRect(x, y, barWidth, barHeight);

    // 绘制数值标签
    ctx.fillStyle = '#333';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(item.value.toFixed(1), x + barWidth / 2, y - 5);

    // 绘制 X 轴标签
    ctx.fillStyle = '#666';
    ctx.font = '9px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(item.name, x + barWidth / 2, height - padding + 15);
  });
}

/**
 * 绘制折线图到 Canvas
 */
function drawLineChart(
  ctx: CanvasRenderingContext2D,
  data: { name: string; value: number; color?: string }[],
  width: number,
  height: number
): void {
  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const range = maxValue - minValue || 1;

  // 绘制坐标轴
  ctx.strokeStyle = '#999';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, height - padding);
  ctx.lineTo(width - padding, height - padding);
  ctx.stroke();

  // 绘制网格线
  ctx.strokeStyle = '#eee';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 5; i++) {
    const y = padding + (chartHeight / 5) * i;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }

  // 绘制折线
  const pointSpacing = chartWidth / (data.length - 1 || 1);
  ctx.strokeStyle = '#FF6B6B';
  ctx.lineWidth = 2;
  ctx.beginPath();

  data.forEach((item, i) => {
    const x = padding + i * pointSpacing;
    const y = height - padding - ((item.value - minValue) / range) * chartHeight;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // 绘制数据点
  ctx.fillStyle = '#FF6B6B';
  data.forEach((item, i) => {
    const x = padding + i * pointSpacing;
    const y = height - padding - ((item.value - minValue) / range) * chartHeight;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, 2 * Math.PI);
    ctx.fill();
  });

  // 绘制 X 轴标签
  ctx.fillStyle = '#666';
  ctx.font = '9px Arial';
  ctx.textAlign = 'center';
  data.forEach((item, i) => {
    const x = padding + i * pointSpacing;
    ctx.fillText(item.name, x, height - padding + 15);
  });
}

/**
 * 将 Canvas 转换为图片数据 URL
 */
function canvasToImage(
  chartType: 'pie' | 'bar' | 'line',
  data: { name: string; value: number; color?: string }[],
  width: number = 80,
  height: number = 40
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width * 2;  // 2x 分辨率
  canvas.height = height * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.scale(2, 2);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);

  if (chartType === 'pie') {
    drawPieChart(ctx, data, width, height);
  } else if (chartType === 'bar') {
    drawBarChart(ctx, data, width, height);
  } else if (chartType === 'line') {
    drawLineChart(ctx, data, width, height);
  }

  return canvas.toDataURL('image/png');
}

// ─────────────────────────────────────────────
// PDF 导出
// ─────────────────────────────────────────────

/**
 * 将多段文本按指定宽度自动换行，返回行数组
 */
function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const charWidth = fontSize * 0.5;
  const charsPerLine = Math.floor(maxWidth / charWidth);
  const lines: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    lines.push(remaining.slice(0, charsPerLine));
    remaining = remaining.slice(charsPerLine);
  }
  return lines;
}

export function exportToPDF(meta: ReportMeta, sections: TableSection[]): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  // ── 标题区域 ──
  doc.setFillColor(20, 20, 30);
  doc.rect(0, 0, pageW, 28, 'F');

  doc.setTextColor(255, 200, 50);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(meta.title, margin, 12);

  doc.setTextColor(180, 180, 180);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  if (meta.subtitle) doc.text(meta.subtitle, margin, 19);
  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  doc.text(`生成时间: ${now}  |  ${meta.generatedBy ?? 'Finance Hub'}`, margin, 25);

  y = 36;

  // ── 统计摘要 ──
  if (meta.statsRows && meta.statsRows.length > 0) {
    doc.setFillColor(30, 30, 45);
    doc.roundedRect(margin, y, contentW, 8 + meta.statsRows.length * 6, 2, 2, 'F');
    doc.setTextColor(150, 200, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('统计摘要', margin + 3, y + 6);
    y += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const colW = contentW / 2;
    meta.statsRows.forEach((row, i) => {
      const col = i % 2;
      const rowY = y + Math.floor(i / 2) * 6;
      doc.setTextColor(180, 180, 180);
      doc.text(String(row[0]) + ':', margin + 3 + col * colW, rowY);
      doc.setTextColor(255, 220, 100);
      doc.text(String(row[1]), margin + 40 + col * colW, rowY);
    });
    y += Math.ceil(meta.statsRows.length / 2) * 6 + 6;
  }

  // ── 可视化图表 ──
  if (meta.charts && meta.charts.length > 0) {
    meta.charts.forEach(chart => {
      if (y > 240) { doc.addPage(); y = margin; }

      // 图表标题
      doc.setFillColor(30, 40, 60);
      doc.roundedRect(margin, y, contentW, 6, 1, 1, 'F');
      doc.setTextColor(100, 180, 255);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.text(chart.title, margin + 3, y + 4.5);
      y += 8;

      // 生成图表图片
      try {
        const imgData = canvasToImage(chart.type, chart.data, chart.width ?? 80, chart.height ?? 40);
        const chartW = chart.width ?? 80;
        const chartH = chart.height ?? 40;
        const chartX = margin + (contentW - chartW) / 2;
        doc.addImage(imgData, 'PNG', chartX, y, chartW, chartH);
        y += chartH + 4;
      } catch (e) {
        // 图表生成失败，跳过
        console.error('图表生成失败:', e);
      }
    });
  }

  // ── AI 分析结果 ──
  if (meta.aiSummary && meta.aiSummary.trim()) {
    if (y > 260) { doc.addPage(); y = margin; }

    doc.setFillColor(25, 20, 45);
    doc.setDrawColor(100, 60, 200);
    doc.setLineWidth(0.4);
    doc.roundedRect(margin, y, contentW, 6, 2, 2, 'FD');
    doc.setTextColor(180, 140, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('AI 智能分析总结', margin + 3, y + 4.5);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(210, 210, 210);

    const paragraphs = meta.aiSummary.split(/\n+/).filter(p => p.trim());
    paragraphs.forEach(para => {
      const lines = wrapText(para.trim(), contentW - 6, 8.5);
      lines.forEach(line => {
        if (y > 270) { doc.addPage(); y = margin; }
        doc.text(line, margin + 3, y);
        y += 5;
      });
      y += 2;
    });
    y += 4;
  }

  // ── 数据表格 ──
  sections.forEach(section => {
    if (y > 260) { doc.addPage(); y = margin; }

    doc.setFillColor(30, 40, 60);
    doc.roundedRect(margin, y, contentW, 7, 1, 1, 'F');
    doc.setTextColor(100, 180, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(section.title, margin + 3, y + 5);
    y += 9;

    autoTable(doc, {
      startY: y,
      head: [section.headers],
      body: section.rows.map(r => r.map(String)),
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        textColor: [220, 220, 220],
        fillColor: [22, 25, 38],
        lineColor: [50, 55, 80],
        lineWidth: 0.2,
        font: 'helvetica',
      },
      headStyles: {
        fillColor: [35, 45, 75],
        textColor: [150, 200, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [28, 32, 50],
      },
      didDrawPage: () => {
        doc.setFillColor(20, 20, 30);
        doc.rect(0, 0, pageW, 8, 'F');
        doc.setTextColor(120, 120, 120);
        doc.setFontSize(7);
        doc.text(meta.title, margin, 6);
        doc.text(`Finance Hub  |  ${now}`, pageW - margin, 6, { align: 'right' });
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 8;
  });

  // ── 页脚 ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(20, 20, 30);
    doc.rect(0, 287, pageW, 10, 'F');
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(7);
    doc.text('本报告由 Finance Hub 自动生成，仅供参考，不构成投资建议。', margin, 293);
    doc.text(`第 ${i} / ${pageCount} 页`, pageW - margin, 293, { align: 'right' });
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `${meta.title.replace(/\s+/g, '_')}_${dateStr}.pdf`;
  doc.save(filename);
}

// ─────────────────────────────────────────────
// CSV 导出（UTF-8 BOM，Excel 兼容）
// ─────────────────────────────────────────────

export function exportToCSV(
  filename: string,
  headers: string[],
  rows: (string | number)[][],
  meta?: { title: string; aiSummary?: string; statsRows?: [string, string | number][] }
): void {
  const lines: string[] = [];

  if (meta) {
    lines.push(`# ${meta.title}`);
    lines.push(`# 生成时间: ${new Date().toLocaleString('zh-CN')}`);
    if (meta.statsRows?.length) {
      lines.push(`# 统计摘要: ${meta.statsRows.map(r => `${r[0]}=${r[1]}`).join(', ')}`);
    }
    if (meta.aiSummary) {
      meta.aiSummary.split(/\n+/).filter(p => p.trim()).forEach(p => {
        lines.push(`# AI分析: ${p.trim()}`);
      });
    }
    lines.push('');
  }

  lines.push(headers.map(h => `"${h}"`).join(','));

  rows.forEach(row => {
    lines.push(row.map(cell => {
      const s = String(cell);
      return s.includes(',') || s.includes('\n') || s.includes('"')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    }).join(','));
  });

  const csvContent = '\uFEFF' + lines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
