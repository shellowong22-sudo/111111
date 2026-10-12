export type MunicipalFileRow = {
  label: string;
  price: number;
  quantity: number;
  yield: number;
};
/** Strict CSV reader: preserve quoted IDs, normalize numeric fingerprints, reject conflicts. */
export function parseMunicipalTradeFile(text: string) {
  const rows: MunicipalFileRow[] = [],
    errors: string[] = [];
  let duplicates = 0;
  if (!text.trim()) return { rows, errors, duplicates };
  if (text.length > 100000)
    return {
      rows,
      errors: ["文件超过100,000字符限制，请分批处理"],
      duplicates,
    };
  const records: string[][] = [];
  let record: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  const source = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  for (let i = 0; i <= source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (c === undefined) {
        errors.push("CSV引号未闭合");
        break;
      }
      if (c === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
        closed = true;
      } else cell += c;
    } else if (c === "," || c === "\n" || c === undefined) {
      record.push(cell.trim());
      cell = "";
      closed = false;
      if (c !== ",") {
        if (record.some(s => s !== "")) records.push(record);
        record = [];
      }
    } else if (c === '"' && !cell.trim() && !closed) {
      cell = "";
      quoted = true;
    } else if (closed && c.trim()) {
      errors.push("CSV引号后有非法字符");
      break;
    } else cell += c;
  }
  if (records[0]?.join(",") !== "id,price,quantity,yield")
    errors.push("表头必须是 id,price,quantity,yield");
  if (records.length > 1001)
    errors.push("超过1000行限制，请分批处理；未截断计算");
  const seen = new Map<string, string>();
  records
    .slice(1, 1001)
    .forEach(([id, price, quantity, yieldPct, ...extra], index) => {
      if (
        !id ||
        id.length > 120 ||
        extra.length ||
        ![price, quantity, yieldPct].every(
          x => x !== undefined && x !== "" && Number.isFinite(Number(x))
        ) ||
        Number(quantity) <= 0 ||
        Number(price) <= 0 ||
        Number(price) > 1000 ||
        Number(quantity) > 1e15 ||
        Number(yieldPct) < -100 ||
        Number(yieldPct) > 1000
      ) {
        errors.push(`第${index + 2}行字段无效`);
        return;
      }
      const fingerprint = JSON.stringify([
        Number(price),
        Number(quantity),
        Number(yieldPct),
      ]);
      if (seen.has(id)) {
        if (seen.get(id) === fingerprint) duplicates++;
        else errors.push(`第${index + 2}行标识冲突：${id}`);
        return;
      }
      seen.set(id, fingerprint);
      rows.push({
        label: id,
        price: Number(price),
        quantity: Number(quantity),
        yield: Number(yieldPct),
      });
    });
  return { rows: errors.length ? [] : rows, errors, duplicates };
}
