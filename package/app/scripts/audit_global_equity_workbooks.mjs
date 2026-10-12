import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';

const uploadDir = '/home/ubuntu/upload';
const rows = fs.readdirSync(uploadDir)
  .filter((name) => name.toLowerCase().endsWith('.xlsx'))
  .sort((left, right) => left.localeCompare(right, 'zh-CN'))
  .flatMap((fileName) => {
    const workbook = XLSX.readFile(path.join(uploadDir, fileName), { raw: true, cellText: true });
    return workbook.SheetNames.map((sheetName) => {
      const values = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: true, defval: null, blankrows: false });
      return { fileName, sheetName, rowCount: Math.max(values.length - 1, 0), header: values[0]?.slice(0, 4) ?? [] };
    });
  });

console.log(JSON.stringify(rows, null, 2));
