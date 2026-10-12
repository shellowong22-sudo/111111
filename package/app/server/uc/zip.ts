/**
 * 无第三方依赖的 zip 读取器（支持 stored / deflate，支持 Zip64 大小字段）。
 * 只用于管理后台“zip 工作台”：读出压缩包里的 csv / json / xlsx 等文件。
 */
import { inflateRawSync } from "node:zlib";

export type ZipEntry = {
  name: string;
  size: number;
  compressedSize: number;
  isDirectory: boolean;
  read: () => Buffer;
};

const EOCD_SIG = 0x06054b50;
const ZIP64_EOCD_LOCATOR_SIG = 0x07064b50;
const ZIP64_EOCD_SIG = 0x06064b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;

function decodeName(raw: Buffer, utf8Flag: boolean): string {
  if (utf8Flag) return raw.toString("utf8");
  // Windows 下中文文件名常为 GBK；先试 UTF-8，失败再用 GBK。
  const utf8 = raw.toString("utf8");
  if (!utf8.includes("�")) return utf8;
  try {
    return new TextDecoder("gbk").decode(raw);
  } catch {
    return raw.toString("latin1");
  }
}

function findEocd(buf: Buffer): number {
  const min = Math.max(0, buf.length - 0xffff - 22);
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) return i;
  }
  throw new Error("不是有效的 zip 文件（找不到目录结尾）");
}

export function readZip(buf: Buffer): ZipEntry[] {
  const eocd = findEocd(buf);
  let total = buf.readUInt16LE(eocd + 10);
  let cdSize = buf.readUInt32LE(eocd + 12);
  let cdOffset = buf.readUInt32LE(eocd + 16);

  // Zip64
  if (cdOffset === 0xffffffff || total === 0xffff) {
    const locator = eocd - 20;
    if (locator >= 0 && buf.readUInt32LE(locator) === ZIP64_EOCD_LOCATOR_SIG) {
      const z64 = Number(buf.readBigUInt64LE(locator + 8));
      if (buf.readUInt32LE(z64) === ZIP64_EOCD_SIG) {
        total = Number(buf.readBigUInt64LE(z64 + 32));
        cdSize = Number(buf.readBigUInt64LE(z64 + 40));
        cdOffset = Number(buf.readBigUInt64LE(z64 + 48));
      }
    }
  }
  if (cdOffset + cdSize > buf.length) throw new Error("zip 目录损坏");

  const entries: ZipEntry[] = [];
  let p = cdOffset;
  for (let i = 0; i < total; i++) {
    if (buf.readUInt32LE(p) !== CENTRAL_SIG) throw new Error("zip 目录项损坏");
    const flags = buf.readUInt16LE(p + 8);
    const method = buf.readUInt16LE(p + 10);
    let compressedSize = buf.readUInt32LE(p + 20);
    let size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    let localOffset = buf.readUInt32LE(p + 42);
    const name = decodeName(buf.subarray(p + 46, p + 46 + nameLen), (flags & 0x800) !== 0);

    // Zip64 extra field
    let e = p + 46 + nameLen;
    const extraEnd = e + extraLen;
    while (e + 4 <= extraEnd) {
      const id = buf.readUInt16LE(e);
      const len = buf.readUInt16LE(e + 2);
      if (id === 0x0001) {
        let q = e + 4;
        if (size === 0xffffffff) { size = Number(buf.readBigUInt64LE(q)); q += 8; }
        if (compressedSize === 0xffffffff) { compressedSize = Number(buf.readBigUInt64LE(q)); q += 8; }
        if (localOffset === 0xffffffff) { localOffset = Number(buf.readBigUInt64LE(q)); }
      }
      e += 4 + len;
    }

    const isDirectory = name.endsWith("/");
    const offset = localOffset;
    const csize = compressedSize;
    entries.push({
      name,
      size,
      compressedSize,
      isDirectory,
      read: () => {
        if (buf.readUInt32LE(offset) !== LOCAL_SIG) throw new Error(`zip 文件头损坏：${name}`);
        if (flags & 0x1) throw new Error(`不支持加密的 zip：${name}`);
        const ln = buf.readUInt16LE(offset + 26);
        const le = buf.readUInt16LE(offset + 28);
        const start = offset + 30 + ln + le;
        const data = buf.subarray(start, start + csize);
        if (method === 0) return Buffer.from(data);
        if (method === 8) return inflateRawSync(data);
        throw new Error(`不支持的压缩方式 ${method}：${name}`);
      },
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}
