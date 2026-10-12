// 通讯与社区板块本地数据 store —— 确定性种子数据 + localStorage 持久化。
// 邮件 / 即时短信 / 联系人 / 笔记 均为本地客户端数据，不依赖后端。
import { seededRand } from './marketDerive';

export type MailFolder = 'inbox' | 'sent' | 'deleted' | 'draft' | 'delayed';
export interface Mail {
  id: string;
  folder: MailFolder;
  from: string;
  fromEmail: string;
  to: string;
  subject: string;
  body: string;
  ts: number;
  read: boolean;
  starred: boolean;
  tag?: string;
}

export interface Contact {
  id: string;
  name: string;
  firm: string;
  title: string;
  email: string;
  phone: string;
  region: string;
  fav: boolean;
}

export interface ChatMsg { id: string; self: boolean; text: string; ts: number; }
export interface ChatThread {
  id: string;
  name: string;
  firm: string;
  online: boolean;
  unread: number;
  msgs: ChatMsg[];
}

export interface Note { id: string; title: string; body: string; ts: number; shared: boolean; }

const LS = {
  mail: 'fh_comms_mail_v1',
  contact: 'fh_comms_contact_v1',
  chat: 'fh_comms_chat_v1',
  note: 'fh_comms_note_v1',
};

const FIRMS = ['Goldman Sachs', 'Morgan Stanley', 'J.P. Morgan', 'BlackRock', 'Citadel', 'Bridgewater', 'PIMCO', 'UBS', 'Barclays', 'HSBC'];
const FIRST = ['James', 'Sarah', 'Michael', 'Emily', 'David', 'Laura', 'Robert', 'Anna', 'Wei', 'Yuki', 'Carlos', 'Sophie'];
const LAST = ['Chen', 'Smith', 'Johnson', 'Williams', 'Tanaka', 'Müller', 'Garcia', 'Rossi', 'Kim', 'Patel', 'Nguyen', 'Brown'];
const TITLES = ['首席策略师', '固收交易员', '股票分析师', '宏观经济学家', '投资组合经理', '量化研究员', '风险主管', '销售交易'];
const REGIONS = ['纽约', '伦敦', '香港', '新加坡', '东京', '法兰克福', '上海'];

function pick<T>(arr: T[], seed: string, i: number): T {
  return arr[Math.floor(seededRand(seed, i) * arr.length) % arr.length];
}

function seedContacts(): Contact[] {
  return Array.from({ length: 24 }, (_, i) => {
    const name = `${pick(FIRST, 'cf', i)} ${pick(LAST, 'cl', i + 3)}`;
    const firm = pick(FIRMS, 'cfirm', i);
    return {
      id: `c${i}`,
      name,
      firm,
      title: pick(TITLES, 'ct', i),
      email: `${name.toLowerCase().replace(/\s/g, '.')}@${firm.split(' ')[0].toLowerCase()}.com`,
      phone: `+1 ${200 + Math.floor(seededRand('cp', i) * 700)} ${100 + Math.floor(seededRand('cp2', i) * 800)} ${1000 + Math.floor(seededRand('cp3', i) * 8000)}`,
      region: pick(REGIONS, 'cr', i),
      fav: i < 4,
    };
  });
}

const SUBJECTS = [
  '关于美债收益率曲线倒挂的最新观点', 'Q2 板块配置建议：超配科技与能源', 'FOMC 会议纪要解读', '原油供需平衡表更新',
  'EUR/USD 技术面分析与交易策略', '半导体行业深度：AI 需求拉动', '黄金避险逻辑与仓位建议', '新兴市场债券机会扫描',
  '本周宏观日历与重点数据', '信用利差走阔的风险提示', '量化因子月报', '关于贵司持仓的对冲方案',
];

function seedMail(contacts: Contact[]): Mail[] {
  const folders: MailFolder[] = ['inbox', 'inbox', 'inbox', 'sent', 'draft', 'deleted', 'delayed'];
  return Array.from({ length: 28 }, (_, i) => {
    const c = contacts[i % contacts.length];
    const folder = pick(folders, 'mf', i);
    return {
      id: `m${i}`,
      folder,
      from: folder === 'sent' ? '我' : c.name,
      fromEmail: folder === 'sent' ? 'me@terminal.com' : c.email,
      to: folder === 'sent' ? c.name : '我',
      subject: pick(SUBJECTS, 'ms', i),
      body: `${pick(SUBJECTS, 'ms', i)}\n\n详见附件分析。核心观点：基于近期市场数据，我们维持此前判断，并建议关注流动性与利差变化对组合的影响。如需进一步沟通可随时联系。\n\n${c.name}\n${c.firm} · ${c.title}`,
      ts: Date.now() - i * 3600_000 * (1 + seededRand('mt', i) * 6),
      read: folder !== 'inbox' || i % 3 !== 0,
      starred: i % 7 === 0,
      tag: i % 4 === 0 ? '研究' : i % 4 === 1 ? '交易' : undefined,
    };
  }).sort((a, b) => b.ts - a.ts);
}

function seedChats(contacts: Contact[]): ChatThread[] {
  return contacts.slice(0, 8).map((c, i) => {
    const n = 3 + Math.floor(seededRand('cn', i) * 5);
    const msgs: ChatMsg[] = Array.from({ length: n }, (_, j) => ({
      id: `cm${i}-${j}`,
      self: j % 2 === 1,
      text: pick(['看到 EUR/USD 突破了吗？', '是的，量能配合得不错', '我这边客户在问黄金仓位', '建议先观望非农', '收到，谢谢', '行情数据已发你邮箱', '稍后电话沟通', '这单我报你 1.0842'], `chatm${i}`, j),
      ts: Date.now() - (n - j) * 600_000,
    }));
    return { id: `t${i}`, name: c.name, firm: c.firm, online: i % 3 !== 0, unread: i % 4 === 0 ? 1 + (i % 3) : 0, msgs };
  });
}

function seedNotes(): Note[] {
  return [
    { id: 'n0', title: '本周交易计划', body: '1. 关注 FOMC 利率决议\n2. 原油区间操作 75-82\n3. 减持高估值科技股', ts: Date.now() - 3600_000, shared: false },
    { id: 'n1', title: '客户会议纪要', body: 'PIMCO 关注久期管理，倾向缩短至 4 年以内；对 IG 信用债维持中性。', ts: Date.now() - 86400_000, shared: true },
    { id: 'n2', title: '研究待办', body: '- 半导体产业链梳理\n- 新能源金属供给侧\n- 美元流动性指标跟踪', ts: Date.now() - 2 * 86400_000, shared: false },
  ];
}

function load<T>(key: string, seed: () => T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch { /* ignore */ }
  const v = seed();
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ }
  return v;
}

function save<T>(key: string, v: T) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ }
}

// 公共 API
let _contacts: Contact[] | null = null;
export function getContacts(): Contact[] {
  if (!_contacts) _contacts = load(LS.contact, seedContacts);
  return _contacts;
}
export function saveContacts(list: Contact[]) { _contacts = list; save(LS.contact, list); }

export function getMail(): Mail[] { return load(LS.mail, () => seedMail(getContacts())); }
export function saveMail(list: Mail[]) { save(LS.mail, list); }

export function getChats(): ChatThread[] { return load(LS.chat, () => seedChats(getContacts())); }
export function saveChats(list: ChatThread[]) { save(LS.chat, list); }

export function getNotes(): Note[] { return load(LS.note, seedNotes); }
export function saveNotes(list: Note[]) { save(LS.note, list); }
