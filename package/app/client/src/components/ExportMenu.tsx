import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, Image, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ExportMenuProps {
  /** 导出文件名（不含扩展名） */
  filename?: string;
  /** 要导出的容器 ref（用于截图/PDF） */
  targetRef?: React.RefObject<HTMLElement | null>;
  /** 要导出的表格数据（用于 Excel） */
  tableData?: {
    headers: string[];
    rows: (string | number)[][];
    sheetName?: string;
  };
  /** 额外的 Excel sheets */
  extraSheets?: {
    name: string;
    headers: string[];
    rows: (string | number)[][];
  }[];
  className?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  beforeExport?: (format: "pdf" | "png" | "excel") => Promise<boolean | void> | boolean | void;
  onExportCompleted?: (format: "pdf" | "png" | "excel") => void;
}

export default function ExportMenu({
  filename = "finance-hub-export",
  targetRef,
  tableData,
  extraSheets,
  className,
  variant = "outline",
  size = "sm",
  beforeExport,
  onExportCompleted,
}: ExportMenuProps) {
  const [exporting, setExporting] = useState<string | null>(null);

  const exportPNG = async () => {
    if (!targetRef?.current) {
      toast.error("无法截图：未找到目标容器");
      return;
    }
    setExporting("png");
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(targetRef.current as HTMLElement, {
        backgroundColor: "#0f172a",
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const link = document.createElement("a");
      link.download = `${filename}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("PNG 截图已导出");
    } catch (e) {
      toast.error("PNG 导出失败");
    } finally {
      setExporting(null);
    }
  };

  const exportPDF = async () => {
    if (!targetRef?.current) {
      toast.error("无法导出 PDF：未找到目标容器");
      return;
    }
    if (await beforeExport?.("pdf") === false) return;
    setExporting("pdf");
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(targetRef.current as HTMLElement, {
        backgroundColor: "#0f172a",
        scale: 1.5,
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? "landscape" : "portrait",
        unit: "px",
        format: [canvas.width, canvas.height],
      });
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`${filename}.pdf`);
      onExportCompleted?.("pdf");
      toast.success("PDF 已导出");
    } catch (e) {
      toast.error("PDF 导出失败");
    } finally {
      setExporting(null);
    }
  };

  const exportExcel = async () => {
    if (!tableData && !extraSheets) {
      toast.error("无表格数据可导出");
      return;
    }
    setExporting("excel");
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      if (tableData) {
        const wsData = [tableData.headers, ...tableData.rows];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        // 设置列宽
        ws["!cols"] = tableData.headers.map(() => ({ wch: 16 }));
        XLSX.utils.book_append_sheet(wb, ws, tableData.sheetName ?? "数据");
      }

      if (extraSheets) {
        for (const sheet of extraSheets) {
          const wsData = [sheet.headers, ...sheet.rows];
          const ws = XLSX.utils.aoa_to_sheet(wsData);
          ws["!cols"] = sheet.headers.map(() => ({ wch: 16 }));
          XLSX.utils.book_append_sheet(wb, ws, sheet.name);
        }
      }

      XLSX.writeFile(wb, `${filename}.xlsx`);
      toast.success("Excel 已导出");
    } catch (e) {
      toast.error("Excel 导出失败");
    } finally {
      setExporting(null);
    }
  };

  const isLoading = exporting !== null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={className} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
          <span className="ml-1.5">导出</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700 text-slate-200">
        <DropdownMenuLabel className="text-slate-400 text-xs">选择导出格式</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-slate-700" />
        {(tableData || extraSheets) && (
          <DropdownMenuItem
            onClick={exportExcel}
            disabled={isLoading}
            className="hover:bg-slate-800 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2 text-green-400" />
            导出为 Excel (.xlsx)
          </DropdownMenuItem>
        )}
        {targetRef && (
          <>
            <DropdownMenuItem
              onClick={exportPDF}
              disabled={isLoading}
              className="hover:bg-slate-800 cursor-pointer"
            >
              <FileText className="w-4 h-4 mr-2 text-red-400" />
              导出为 PDF (.pdf)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={exportPNG}
              disabled={isLoading}
              className="hover:bg-slate-800 cursor-pointer"
            >
              <Image className="w-4 h-4 mr-2 text-blue-400" />
              导出为图片 (.png)
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
