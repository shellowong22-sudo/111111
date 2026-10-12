/**
 * 需求 1 兜底：前端页面不显示数据来源标签。
 * 新接入的数据在管线里就已去掉来源字段；这里处理旧面板里写死的“来源：xxx”说明行，
 * 只隐藏以“来源 / 数据来源 / Source”开头的短标签元素，不改动任何数据与交互。
 * 管理后台不启用。
 */
import { useEffect } from 'react';

const LABEL = /^\s*(数据来源|資料來源|来源|出处|Data\s*sources?|Sources?)\s*[:：]/i;
const MARK = 'data-uc-veiled';

function veil(root: ParentNode) {
  const candidates = root.querySelectorAll<HTMLElement>('span, p, div, small, li, td, dd, footer, figcaption, label');
  for (const el of candidates) {
    if (el.hasAttribute(MARK) || el.closest('[data-uc-module]')) continue;
    if (el.children.length > 4) continue;
    const text = el.textContent ?? '';
    if (text.length > 220 || !LABEL.test(text)) continue;
    // 只处理“标签本身”：父元素若同样以来源开头，交给父元素处理
    const parent = el.parentElement;
    if (parent && parent.children.length <= 4 && (parent.textContent ?? '').length <= 220 && LABEL.test(parent.textContent ?? '')) continue;
    el.setAttribute(MARK, '1');
    el.style.display = 'none';
  }
}

export default function SourceVeil() {
  useEffect(() => {
    let scheduled = false;
    const run = () => {
      scheduled = false;
      veil(document.body);
    };
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      window.setTimeout(run, 120);
    };
    run();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
