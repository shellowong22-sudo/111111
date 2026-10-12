/**
 * usePanelExport — 通用面板一键导出 Hook
 * 支持：
 *   - PNG 截图导出（含时间戳水印）
 *   - 复制截图到剪贴板
 *   - PDF 报告导出（含封面、图表截图、核心数据表格）
 */
import { useCallback, useRef, useState } from 'react';

export type ExportFormat = 'png' | 'pdf' | 'clipboard';

export interface ExportOptions {
  /** 面板标题（用于文件名和 PDF 封面） */
  title: string;
  /** 面板代码（如 TCON、MKTBEAT） */
  code?: string;
  /** 副标题 / 描述 */
  subtitle?: string;
  /** 核心决策信号数据（用于 PDF 表格） */
  signals?: Array<{ label: string; value: string; status?: 'bullish' | 'bearish' | 'neutral' | 'alert' }>;
  /** 额外备注 */
  notes?: string;
  /** 是否在导出图片底部添加时间戳水印（默认 true） */
  watermark?: boolean;
}

export interface UsePanelExportReturn {
  /** 指向要截图的 DOM 元素的 ref */
  panelRef: React.RefObject<HTMLDivElement | null>;
  /** 是否正在导出 */
  exporting: boolean;
  /** 最近一次操作的结果消息 */
  exportMessage: string | null;
  /** 触发导出 */
  exportPanel: (format: ExportFormat, options: ExportOptions) => Promise<void>;
}

export function usePanelExport(): UsePanelExportReturn {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const exportPanel = useCallback(async (format: ExportFormat, options: ExportOptions) => {
    if (!panelRef.current) {
      console.warn('[usePanelExport] panelRef is not attached to a DOM element');
      return;
    }

    setExporting(true);
    setExportMessage(null);
    try {
      if (format === 'png') {
        await exportAsPng(panelRef.current, options);
        setExportMessage('✓ 已保存为 PNG');
      } else if (format === 'clipboard') {
        await copyToClipboard(panelRef.current, options);
        setExportMessage('✓ 已复制到剪贴板');
      } else {
        await exportAsPdf(panelRef.current, options);
        setExportMessage('✓ 已保存为 PDF');
      }
    } catch (err) {
      console.error('[usePanelExport] Export failed:', err);
      setExportMessage('✗ 导出失败，请重试');
    } finally {
      setExporting(false);
      // 3 秒后清除消息
      setTimeout(() => setExportMessage(null), 3000);
    }
  }, []);

  return { panelRef, exporting, exportMessage, exportPanel };
}

// ─── 水印绘制 ─────────────────────────────────────────────────────────────────
function drawWatermark(canvas: HTMLCanvasElement, title: string): HTMLCanvasElement {
  const WATERMARK_H = 28;
  const newCanvas = document.createElement('canvas');
  newCanvas.width = canvas.width;
  newCanvas.height = canvas.height + WATERMARK_H * 2; // 顶部 + 底部各一条

  const ctx = newCanvas.getContext('2d')!;

  // 背景（与面板一致）
  ctx.fillStyle = '#030712';
  ctx.fillRect(0, 0, newCanvas.width, newCanvas.height);

  // 顶部水印条
  const topGrad = ctx.createLinearGradient(0, 0, newCanvas.width, 0);
  topGrad.addColorStop(0, '#0a0a1a');
  topGrad.addColorStop(0.5, '#111827');
  topGrad.addColorStop(1, '#0a0a1a');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, newCanvas.width, WATERMARK_H);

  // 顶部橙色细线
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(0, 0, newCanvas.width, 2);

  // 顶部文字：面板名称 + 系统标识
  ctx.font = `bold ${Math.round(WATERMARK_H * 0.45)}px "SF Mono", "Fira Code", monospace`;
  ctx.fillStyle = '#f59e0b';
  ctx.textBaseline = 'middle';
  ctx.fillText(`Finance Hub  ·  ${title}`, 12, WATERMARK_H / 2);

  // 顶部右侧：LIVE 标识
  const liveText = '● LIVE';
  ctx.font = `bold ${Math.round(WATERMARK_H * 0.38)}px monospace`;
  ctx.fillStyle = '#22c55e';
  const liveW = ctx.measureText(liveText).width;
  ctx.fillText(liveText, newCanvas.width - liveW - 12, WATERMARK_H / 2);

  // 原始截图
  ctx.drawImage(canvas, 0, WATERMARK_H);

  // 底部水印条
  const bottomY = WATERMARK_H + canvas.height;
  const botGrad = ctx.createLinearGradient(0, bottomY, newCanvas.width, bottomY);
  botGrad.addColorStop(0, '#0a0a1a');
  botGrad.addColorStop(0.5, '#111827');
  botGrad.addColorStop(1, '#0a0a1a');
  ctx.fillStyle = botGrad;
  ctx.fillRect(0, bottomY, newCanvas.width, WATERMARK_H);

  // 底部橙色细线
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(0, newCanvas.height - 2, newCanvas.width, 2);

  // 底部左侧：时间戳
  const now = new Date();
  const timeStr = now.toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  ctx.font = `${Math.round(WATERMARK_H * 0.4)}px "SF Mono", monospace`;
  ctx.fillStyle = '#9ca3af';
  ctx.textBaseline = 'middle';
  ctx.fillText(`导出时间：${timeStr}`, 12, bottomY + WATERMARK_H / 2);

  // 底部右侧：免责声明
  ctx.font = `${Math.round(WATERMARK_H * 0.35)}px monospace`;
  ctx.fillStyle = '#4b5563';
  const disclaimer = '仅供参考，不构成投资建议';
  const dW = ctx.measureText(disclaimer).width;
  ctx.fillText(disclaimer, newCanvas.width - dW - 12, bottomY + WATERMARK_H / 2);

  return newCanvas;
}

// ─── PNG 导出 ─────────────────────────────────────────────────────────────────
async function exportAsPng(element: HTMLElement, options: ExportOptions): Promise<void> {
  const html2canvas = (await import('html2canvas')).default;
  const rawCanvas = await html2canvas(element, {
    backgroundColor: '#030712',
    scale: 2,
    useCORS: true,
    logging: false,
    allowTaint: true,
    foreignObjectRendering: false,
  });

  const finalCanvas = (options.watermark !== false) ? drawWatermark(rawCanvas, options.title) : rawCanvas;

  const link = document.createElement('a');
  link.download = `${sanitizeFilename(options.code || options.title)}-${dateStr()}.png`;
  link.href = finalCanvas.toDataURL('image/png');
  link.click();
}

// ─── 复制到剪贴板 ─────────────────────────────────────────────────────────────
async function copyToClipboard(element: HTMLElement, options: ExportOptions): Promise<void> {
  const html2canvas = (await import('html2canvas')).default;
  const rawCanvas = await html2canvas(element, {
    backgroundColor: '#030712',
    scale: 2,
    useCORS: true,
    logging: false,
    allowTaint: true,
    foreignObjectRendering: false,
  });

  const finalCanvas = (options.watermark !== false) ? drawWatermark(rawCanvas, options.title) : rawCanvas;

  // 将 canvas 转为 Blob 并写入剪贴板
  const blob = await new Promise<Blob>((resolve, reject) => {
    finalCanvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('Canvas toBlob failed'));
    }, 'image/png');
  });

  if (!navigator.clipboard?.write) {
    // 降级：保存为 PNG
    const link = document.createElement('a');
    link.download = `${sanitizeFilename(options.code || options.title)}-${dateStr()}.png`;
    link.href = finalCanvas.toDataURL('image/png');
    link.click();
    throw new Error('Clipboard API not supported, saved as PNG instead');
  }

  await navigator.clipboard.write([
    new ClipboardItem({ 'image/png': blob }),
  ]);
}

// ─── PDF 导出 ─────────────────────────────────────────────────────────────────
async function exportAsPdf(element: HTMLElement, options: ExportOptions): Promise<void> {
  const html2canvas = (await import('html2canvas')).default;
  const { jsPDF } = await import('jspdf');

  const A4_W = 210; // mm
  const A4_H = 297; // mm
  const MARGIN = 12; // mm
  const CONTENT_W = A4_W - MARGIN * 2;

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // ── 封面 ──────────────────────────────────────────────────────────────────
  pdf.setFillColor(10, 10, 20);
  pdf.rect(0, 0, A4_W, A4_H, 'F');
  pdf.setFillColor(245, 158, 11);
  pdf.rect(0, 0, A4_W, 3, 'F');

  if (options.code) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(245, 158, 11);
    pdf.text(options.code, MARGIN, 20);
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(22);
  pdf.setTextColor(240, 240, 240);
  const titleLines = pdf.splitTextToSize(options.title, CONTENT_W);
  pdf.text(titleLines, MARGIN, 32);

  if (options.subtitle) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    pdf.setTextColor(160, 160, 170);
    const subLines = pdf.splitTextToSize(options.subtitle, CONTENT_W);
    pdf.text(subLines, MARGIN, 32 + titleLines.length * 10 + 4);
  }

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(100, 100, 110);
  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  pdf.text(`生成时间：${now}  |  Finance Hub Ucheer Terminal`, MARGIN, A4_H - 8);

  pdf.setFillColor(245, 158, 11);
  pdf.rect(0, A4_H - 3, A4_W, 3, 'F');

  // ── 第二页：图表截图（含水印） ────────────────────────────────────────────
  pdf.addPage();
  pdf.setFillColor(10, 10, 20);
  pdf.rect(0, 0, A4_W, A4_H, 'F');
  pdf.setFillColor(245, 158, 11);
  pdf.rect(0, 0, A4_W, 2, 'F');
  pdf.rect(0, A4_H - 2, A4_W, 2, 'F');

  const rawCanvas = await html2canvas(element, {
    backgroundColor: '#0a0a0f',
    scale: 1.5,
    useCORS: true,
    logging: false,
    allowTaint: true,
    foreignObjectRendering: false,
  });

  const finalCanvas = (options.watermark !== false) ? drawWatermark(rawCanvas, options.title) : rawCanvas;
  const imgData = finalCanvas.toDataURL('image/jpeg', 0.92);
  const imgW = CONTENT_W;
  const imgH = Math.min((finalCanvas.height / finalCanvas.width) * imgW, A4_H - 30);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(245, 158, 11);
  pdf.text('面板截图', MARGIN, 10);
  pdf.addImage(imgData, 'JPEG', MARGIN, 14, imgW, imgH);

  // ── 第三页：核心决策信号表格（如有） ─────────────────────────────────────
  if (options.signals && options.signals.length > 0) {
    pdf.addPage();
    pdf.setFillColor(10, 10, 20);
    pdf.rect(0, 0, A4_W, A4_H, 'F');
    pdf.setFillColor(245, 158, 11);
    pdf.rect(0, 0, A4_W, 2, 'F');
    pdf.rect(0, A4_H - 2, A4_W, 2, 'F');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(240, 240, 240);
    pdf.text('核心决策信号', MARGIN, 14);

    const COL1 = MARGIN;
    const COL2 = MARGIN + 80;
    const COL3 = MARGIN + 140;
    let y = 24;

    pdf.setFillColor(30, 30, 45);
    pdf.rect(MARGIN, y - 5, CONTENT_W, 8, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(245, 158, 11);
    pdf.text('指标名称', COL1, y);
    pdf.text('数值', COL2, y);
    pdf.text('状态', COL3, y);
    y += 6;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);

    options.signals.forEach((sig, idx) => {
      if (y > A4_H - 20) return;
      if (idx % 2 === 0) {
        pdf.setFillColor(18, 18, 28);
        pdf.rect(MARGIN, y - 4, CONTENT_W, 7, 'F');
      }
      pdf.setTextColor(200, 200, 210);
      pdf.text(sig.label, COL1, y);
      pdf.text(sig.value, COL2, y);

      const statusColors: Record<string, [number, number, number]> = {
        bullish: [34, 197, 94],
        bearish: [239, 68, 68],
        neutral: [156, 163, 175],
        alert: [245, 158, 11],
      };
      const [r, g, b] = statusColors[sig.status || 'neutral'];
      pdf.setTextColor(r, g, b);
      pdf.text(
        sig.status === 'bullish' ? '看涨' : sig.status === 'bearish' ? '看跌' : sig.status === 'alert' ? '预警' : '中性',
        COL3, y
      );
      y += 7;
    });

    if (options.notes) {
      y += 6;
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(8);
      pdf.setTextColor(120, 120, 130);
      const noteLines = pdf.splitTextToSize(`备注：${options.notes}`, CONTENT_W);
      pdf.text(noteLines, MARGIN, y);
    }

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(80, 80, 90);
    pdf.text(
      '免责声明：本报告由量化模型自动生成，仅供参考，不构成投资建议。请结合基本面分析和风险管理规则进行决策。',
      MARGIN, A4_H - 8
    );
  }

  pdf.save(`${sanitizeFilename(options.code || options.title)}-${dateStr()}.pdf`);
}

// ─── 工具函数 ─────────────────────────────────────────────────────────────────
function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '-').slice(0, 50);
}

function dateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
}
