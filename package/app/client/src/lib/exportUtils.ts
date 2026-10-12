import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

/**
 * 导出图表为PDF
 */
export async function exportChartToPDF(
  elementId: string,
  fileName: string = 'chart.pdf',
  title: string = ''
): Promise<void> {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Element with id ${elementId} not found`);
    }

    // 将DOM转换为Canvas
    const canvas = await html2canvas(element, {
      backgroundColor: '#1a1a2e',
      scale: 2,
      logging: false,
    });

    // 创建PDF
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const imgData = canvas.toDataURL('image/png');
    const imgWidth = 297; // A4宽度（横向）
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    if (title) {
      pdf.setFontSize(16);
      pdf.text(title, 15, 15);
    }

    pdf.addImage(imgData, 'PNG', 10, title ? 25 : 10, imgWidth - 20, imgHeight);
    pdf.save(fileName);
  } catch (error) {
    console.error('PDF导出失败:', error);
    throw error;
  }
}

/**
 * 导出数据为Excel
 */
export function exportDataToExcel(
  data: Record<string, any>[],
  fileName: string = 'data.xlsx',
  sheetName: string = 'Sheet1'
): void {
  try {
    if (!data || data.length === 0) {
      throw new Error('No data to export');
    }

    // 创建工作簿
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // 设置列宽
    const colWidths = Object.keys(data[0]).map(() => ({ wch: 15 }));
    ws['!cols'] = colWidths;

    // 保存文件
    XLSX.writeFile(wb, fileName);
  } catch (error) {
    console.error('Excel导出失败:', error);
    throw error;
  }
}

/**
 * 导出CSV格式
 */
export function exportDataToCSV(
  data: Record<string, any>[],
  fileName: string = 'data.csv'
): void {
  try {
    if (!data || data.length === 0) {
      throw new Error('No data to export');
    }

    // 获取表头
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row =>
        headers
          .map(header => {
            const value = row[header];
            // 处理包含逗号的字段
            if (typeof value === 'string' && value.includes(',')) {
              return `"${value}"`;
            }
            return value;
          })
          .join(',')
      ),
    ].join('\n');

    // 创建Blob并下载
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('CSV导出失败:', error);
    throw error;
  }
}

/**
 * 导出多个图表为PDF
 */
export async function exportMultipleChartsToPDF(
  elementIds: string[],
  fileName: string = 'charts.pdf',
  title: string = ''
): Promise<void> {
  try {
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    let isFirstPage = true;

    for (const elementId of elementIds) {
      const element = document.getElementById(elementId);
      if (!element) {
        console.warn(`Element with id ${elementId} not found`);
        continue;
      }

      if (!isFirstPage) {
        pdf.addPage();
      }

      const canvas = await html2canvas(element, {
        backgroundColor: '#1a1a2e',
        scale: 2,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      if (isFirstPage && title) {
        pdf.setFontSize(16);
        pdf.text(title, 15, 15);
        pdf.addImage(imgData, 'PNG', 10, 25, imgWidth - 20, imgHeight);
      } else {
        pdf.addImage(imgData, 'PNG', 10, 10, imgWidth - 20, imgHeight);
      }

      isFirstPage = false;
    }

    pdf.save(fileName);
  } catch (error) {
    console.error('多图表PDF导出失败:', error);
    throw error;
  }
}
