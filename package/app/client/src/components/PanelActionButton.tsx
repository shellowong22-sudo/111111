import { useLocation } from 'wouter';
import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { refreshAllQueries } from '@/lib/queryClientRef';

/**
 * 终端面板工具栏按钮的统一实现。
 *
 * 许多行情面板沿用了彭博风格的“97) 输出 / 98) 设定 / 96) 选项 / 刷新 / 导出PDF”
 * 按钮，但原先没有绑定任何行为。这里提供真实可执行的动作，保持原按钮文字与样式：
 *  - export   导出当前面板中的表格为 CSV（无表格时导出面板可见文本，并如实提示）
 *  - pdf      将当前面板截图生成 PDF
 *  - refresh  重新请求当前页面所有后端查询（不生成任何本地数据）
 *  - settings 弹出面板菜单：刷新数据、导出 CSV、导出 PDF、全屏显示
 */
export type PanelAction = 'export' | 'pdf' | 'refresh' | 'settings' | 'fullscreen';

function findPanelRoot(from: Element): HTMLElement {
  const terminalPanel = from.closest('.terminal-panel, [data-panel-root]');
  if (terminalPanel instanceof HTMLElement) return terminalPanel;
  let node: HTMLElement | null = from.parentElement;
  while (node && node !== document.body) {
    if (node.querySelector('table, .recharts-wrapper, canvas') && node.clientHeight > 160) return node;
    node = node.parentElement;
  }
  return (document.querySelector('main') as HTMLElement | null) ?? document.body;
}

function cellText(cell: Element): string {
  return (cell as HTMLElement).innerText.replace(/\s+/g, ' ').trim();
}

function csvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function panelTitle(root: HTMLElement): string {
  const title = root.querySelector('.terminal-title, h1, h2, h3');
  const text = title ? (title as HTMLElement).innerText.trim() : document.title;
  return text.replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 40) || 'panel';
}

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportPanelCsv(from: Element) {
  const root = findPanelRoot(from);
  const tables = Array.from(root.querySelectorAll('table'));
  const stamp = new Date().toISOString().slice(0, 10);
  let lines: string[];
  if (tables.length) {
    lines = tables.flatMap((table, index) => {
      const rows = Array.from(table.querySelectorAll('tr'))
        .map(row => Array.from(row.querySelectorAll('th, td')).map(cell => csvCell(cellText(cell))).join(','))
        .filter(row => row.replace(/,/g, '').trim());
      return index === 0 ? rows : ['', ...rows];
    });
  } else {
    lines = root.innerText.split('\n').map(line => line.trim()).filter(Boolean).map(csvCell);
  }
  if (!lines.length) {
    toast.error('当前面板没有可导出的内容');
    return;
  }
  download(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }), `${panelTitle(root)}-${stamp}.csv`);
  toast.success(tables.length ? `已导出 ${tables.length} 个表格` : '面板没有表格，已导出可见文本');
}

export async function exportPanelPdf(from: Element) {
  const root = findPanelRoot(from);
  const stamp = new Date().toISOString().slice(0, 10);
  try {
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
    const canvas = await html2canvas(root, { backgroundColor: '#0a0a0a', scale: 2, logging: false });
    const pdf = new jsPDF({ orientation: canvas.width >= canvas.height ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgHeight = (canvas.height * (pageWidth - 20)) / canvas.width;
    const image = canvas.toDataURL('image/png');
    let offset = 0;
    pdf.addImage(image, 'PNG', 10, 10, pageWidth - 20, imgHeight);
    while (imgHeight - offset > pageHeight - 20) {
      offset += pageHeight - 20;
      pdf.addPage();
      pdf.addImage(image, 'PNG', 10, 10 - offset, pageWidth - 20, imgHeight);
    }
    pdf.save(`${panelTitle(root)}-${stamp}.pdf`);
    toast.success('已生成 PDF');
  } catch {
    toast.error('PDF 生成失败', { description: '浏览器无法截取当前面板。' });
  }
}

export async function refreshPanelData() {
  const ok = await refreshAllQueries();
  if (ok) toast.success('已重新读取后端数据');
  else toast.error('数据客户端尚未就绪');
}

export function togglePanelFullscreen(from: Element) {
  const root = findPanelRoot(from);
  if (document.fullscreenElement) void document.exitFullscreen();
  else void root.requestFullscreen?.().catch(() => toast.error('浏览器不允许全屏显示'));
}

interface PanelActionButtonProps {
  action: PanelAction;
  className?: string;
  children: ReactNode;
  title?: string;
  /** 允许沿用原来的按钮组件（例如 shadcn 的 Button 及其 variant/size），只附加行为。 */
  as?: React.ElementType;
  [prop: string]: unknown;
}

export default function PanelActionButton({ action, className, children, title, as, ...rest }: PanelActionButtonProps) {
  const Comp = (as ?? 'button') as React.ElementType;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const refresh = async () => {
    await queryClient.invalidateQueries();
    toast.success('已重新读取后端数据');
  };

  const run = (target: Element, kind: Exclude<PanelAction, 'settings'>) => {
    if (kind === 'export') exportPanelCsv(target);
    else if (kind === 'pdf') void exportPanelPdf(target);
    else if (kind === 'refresh') void refresh();
    else togglePanelFullscreen(target);
  };

  if (action !== 'settings') {
    return (
      <Comp {...rest} type="button" title={title} className={className} onClick={(event: React.MouseEvent<HTMLElement>) => run(event.currentTarget, action)}>
        {children}
      </Comp>
    );
  }

  const items: { kind: Exclude<PanelAction, 'settings'>; label: string }[] = [
    { kind: 'refresh', label: '刷新数据' },
    { kind: 'export', label: '导出 CSV' },
    { kind: 'pdf', label: '导出 PDF' },
    { kind: 'fullscreen', label: '全屏显示 / 退出全屏' },
  ];

  return (
    <span ref={wrapperRef} className="relative inline-flex">
      <Comp {...rest} type="button" title={title} className={className} aria-expanded={open} onClick={() => setOpen(value => !value)}>
        {children}
      </Comp>
      {open && (
        <span className="absolute right-0 top-full z-50 mt-1 flex min-w-[9rem] flex-col border border-gray-700 bg-[#111] py-1 text-left text-xs text-gray-200 shadow-xl">
          {items.map(item => (
            <button
              key={item.kind}
              type="button"
              className="px-3 py-1.5 text-left hover:bg-gray-800"
              onClick={() => {
                setOpen(false);
                if (wrapperRef.current) run(wrapperRef.current, item.kind);
              }}
            >
              {item.label}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

/**
 * 面板内跳转到另一个终端功能的按钮（如底栏的“建议功能 / MSG 邮件 / MEDI 彭博媒体”）。
 * 目标必须是已存在的真实页面或终端深链。
 */
export function PanelLinkButton({ to, className, children }: { to: string; className?: string; children: ReactNode }) {
  const [, setLocation] = useLocation();
  return (
    <button type="button" className={className} onClick={() => setLocation(to)}>
      {children}
    </button>
  );
}

/** 在浏览器中保存/删除面板设置的简单存储（用于“保存 / 删除 / 保存配置 / 另存为”）。 */
export function savePanelSetting(key: string, value: unknown, label = '设置') {
  try {
    window.localStorage.setItem(`finance-hub:${key}`, JSON.stringify({ value, savedAt: new Date().toISOString() }));
    toast.success(`已保存${label}`);
    return true;
  } catch {
    toast.error('浏览器不允许保存设置');
    return false;
  }
}

export function loadPanelSetting<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(`finance-hub:${key}`);
    return raw ? (JSON.parse(raw).value as T) : null;
  } catch {
    return null;
  }
}

export function deletePanelSetting(key: string, label = '设置') {
  try {
    const existed = window.localStorage.getItem(`finance-hub:${key}`) !== null;
    window.localStorage.removeItem(`finance-hub:${key}`);
    if (existed) toast.success(`已删除${label}`);
    else toast.info(`没有已保存的${label}`);
  } catch {
    toast.error('浏览器不允许修改设置');
  }
}

/** “修改 / 修改图表 / 添加数据”：聚焦面板里第一个可编辑输入框，进入编辑。 */
export function focusPanelInput(from: Element) {
  const root = findPanelRoot(from);
  const input = root.querySelector<HTMLInputElement | HTMLTextAreaElement>('input:not([type=checkbox]):not([type=radio]):not([disabled]), textarea');
  if (input) {
    input.focus();
    input.select?.();
  } else {
    toast.info('当前面板没有可编辑的字段');
  }
}
