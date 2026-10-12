/** Municipal function directory and explicitly manual, local-only analysis tools. */
import React, { useState } from 'react';
import { Shield, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props { onClose?: () => void; onNavigate: (id: string, name: string) => void; }
type Tab = 'overview' | 'curve' | 'sector' | 'flow';

const FUNCTIONS = [
  { id: 'MSRC', code: '2', name: '地方债检索', group: '检索', desc: '债券筛选与证券资料' },
  { id: 'SMUN', code: '3', name: '发行人检索', group: '检索', desc: '发行人资料与债务结构' },
  { id: 'AAA', code: '4', name: 'BVAL AAA曲线', group: '利率与指数', desc: 'AAA收益率与期限结构' },
  { id: 'BTMM', code: '5', name: '国债与货币市场', group: '利率与指数', desc: '国债与短期利率比较' },
  { id: 'PICK', code: '6', name: '地方债发行', group: '发行日程', desc: '新发行检索与日历' },
  { id: 'MBWD', code: '7', name: '买价询价', group: '交易', desc: '询价与执行工作区' },
  { id: 'CDRN', code: '8', name: '商议承销日程', group: '发行日程', desc: '商议发行与承销安排' },
  { id: 'CDRC', code: '9', name: '竞价承销日程', group: '发行日程', desc: '竞价发行与结果检索' },
  { id: 'CDRA', code: '10', name: '固定利率日历', group: '发行日程', desc: '固定利率发行安排' },
  { id: 'CNDS', code: '11', name: '短期日程', group: '发行日程', desc: '短期票据与发行安排' },
  { id: 'CDRV', code: '12', name: '可变利率日历', group: '发行日程', desc: '可变利率发行与重置安排' },
  { id: 'DEAL', code: '13', name: '交易管理', group: '交易', desc: '交易记录与操作工作区' },
  { id: 'CACT', code: '14', name: '公司大事检索', group: '检索', desc: '发行人事件与公司行动' },
  { id: 'MCAL', code: '15', name: '结构金融日历', group: '发行日程', desc: '结构化产品发行与评级事件' },
  { id: 'MBIX', code: '16', name: '地方债指数', group: '利率与指数', desc: '指数范围与成分分析' },
  { id: 'VRDN', code: '17', name: '佑诚7天VRDN', group: '利率与指数', desc: '七天可变利率需求票据' },
  { id: 'BMA', code: '18', name: 'BMA掉期指数', group: '利率与指数', desc: '掉期指数与基差比较' },
  { id: 'BOOM', code: '19', name: 'BOOM VRDN库存', group: '交易', desc: 'VRDN库存与交易范围' },
  { id: 'MSRB', code: '20', name: 'MSRB统计数据', group: '统计与税务', desc: '成交统计与监管资料' },
  { id: 'SLGS', code: '21', name: 'SLGS利率', group: '统计与税务', desc: '州及地方政府系列利率' },
];
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: '功能总览' }, { id: 'curve', label: '收益率曲线' },
  { id: 'sector', label: '板块分布' }, { id: 'flow', label: '资金流向' },
];
const TERMS = ['1M', '3M', '6M', '1Y', '2Y', '3Y', '5Y', '7Y', '10Y', '15Y', '20Y', '30Y'];
const RATINGS = ['AAA', 'AA', 'A', 'BBB', 'UST'];
const SECTORS = ['一般义务', '教育', '医疗', '交通', '水务/环境', '其他'];
const PERIODS = Array.from({ length: 8 }, (_, i) => `第${i + 1}期`);
const INPUT = 'w-full min-w-16 border border-gray-700 bg-gray-950 px-2 py-1 text-xs text-gray-100 font-mono focus:border-amber-400 focus:outline-none';
const CELL = 'border-b border-gray-800 px-3 py-1.5 text-left';
const BUTTON = 'border border-gray-700 px-2 py-1 text-xs text-gray-300 hover:border-amber-400 hover:text-amber-300';

function number(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function amount(value: string | undefined): number | null {
  const parsed = number(value);
  return parsed !== null && parsed >= 0 ? parsed : null;
}
function formatted(value: number | null, suffix = '') {
  return value === null || !Number.isFinite(value) ? '—' : `${value.toFixed(2)}${suffix}`;
}

export default function MuniSecInfoPanel({ onClose, onNavigate }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('全部');
  const [yields, setYields] = useState<Record<string, string>>({});
  const [taxRate, setTaxRate] = useState('');
  const [sectors, setSectors] = useState<Record<string, string>>({});
  const [sectorUnit, setSectorUnit] = useState('亿美元');
  const [flows, setFlows] = useState<Record<string, string>>({});
  const [flowUnit, setFlowUnit] = useState('亿美元');

  const filtered = FUNCTIONS.filter(fn => (group === '全部' || fn.group === group)
    && `${fn.id} ${fn.name} ${fn.desc}`.toLowerCase().includes(query.trim().toLowerCase()));
  const tax = number(taxRate);
  const validTax = tax !== null && tax >= 0 && tax < 100;
  const yieldError = Object.values(yields).some(value => value.trim() !== '' && number(value) === null);
  const sectorAmounts = SECTORS.map(name => amount(sectors[name]));
  const sectorCount = sectorAmounts.filter(value => value !== null).length;
  const sectorTotal = sectorCount ? sectorAmounts.reduce<number>((total, value) => total + (value ?? 0), 0) : null;
  const sectorError = Object.values(sectors).some(value => value.trim() !== '' && amount(value) === null);
  const flowRows = PERIODS.map(period => {
    const inflow = amount(flows[`${period}-in`]);
    const outflow = amount(flows[`${period}-out`]);
    return { period, net: inflow !== null && outflow !== null ? inflow - outflow : null };
  });
  const completeFlows = flowRows.filter(row => row.net !== null);
  const flowTotal = completeFlows.length ? completeFlows.reduce((total, row) => total + row.net!, 0) : null;
  const flowError = Object.entries(flows).some(([key, value]) => !key.endsWith('-date') && value.trim() !== '' && amount(value) === null);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-950 text-gray-100">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-800 bg-gray-900 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Shield className="h-4 w-4 text-amber-400" />
          <span className="font-mono font-bold text-amber-400">MUNI</span>
          <h2 className="font-semibold">地方债证券与功能说明</h2>
          <span className="text-gray-400">功能导航 · 手动分析</span>
        </div>
        {onClose && <button aria-label="关闭地方债证券与功能说明" onClick={onClose} className="p-1 text-gray-400 hover:text-white"><X className="h-4 w-4" /></button>}
      </header>
      <p className="shrink-0 border-b border-gray-800 px-3 py-2 text-xs text-gray-400">
        本页不发布实时行情。功能入口保留原有工作区；分析结果仅来自您在本页输入的数值，不保存、不提交交易。子模块的数据状态请以各自来源说明为准。
      </p>
      <div role="tablist" aria-label="地方债功能与分析" className="flex shrink-0 overflow-x-auto border-b border-gray-800 bg-gray-900">
        {TABS.map(item => <button key={item.id} role="tab" aria-selected={tab === item.id}
          onClick={() => setTab(item.id)} className={cn('whitespace-nowrap border-b-2 px-4 py-2 text-xs', tab === item.id ? 'border-amber-400 text-amber-400' : 'border-transparent text-gray-400 hover:text-gray-200')}>
          {item.label}
        </button>)}
      </div>
      <div role="tabpanel" aria-label={TABS.find(item => item.id === tab)?.label} className="flex-1 overflow-auto p-3">
        {tab === 'overview' && <>
          <div className="mb-2 flex flex-wrap items-end gap-3 text-xs">
            <label className="min-w-52 flex-1 text-gray-400">查找功能
              <input aria-label="查找地方债功能" value={query} onChange={event => setQuery(event.target.value)} placeholder="输入代码、名称或用途" className={cn(INPUT, 'mt-1')} />
            </label>
            <label className="text-gray-400">功能分类
              <select aria-label="地方债功能分类" value={group} onChange={event => setGroup(event.target.value)} className={cn(INPUT, 'mt-1')}>
                {['全部', ...new Set(FUNCTIONS.map(fn => fn.group))].map(name => <option key={name}>{name}</option>)}
              </select>
            </label>
            <button onClick={() => { setQuery(''); setGroup('全部'); }} className={BUTTON}>重置筛选</button>
            <span role="status" className="py-1 text-gray-400">{filtered.length} / {FUNCTIONS.length} 个功能</span>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-gray-900 text-gray-400"><tr>
              <th className={CELL}>序号</th><th className={CELL}>功能入口</th><th className={CELL}>分类</th><th className={CELL}>用途</th>
            </tr></thead>
            <tbody>{filtered.map(fn => <tr key={fn.id} className="hover:bg-gray-900">
              <td className={cn(CELL, 'font-mono text-gray-500')}>{fn.code}</td>
              <td className={CELL}><button aria-label={`${fn.id} ${fn.name}`} onClick={() => onNavigate(fn.id, fn.name)} className="text-left hover:text-amber-300">
                <span className="mr-3 inline-block w-12 font-mono text-amber-400">{fn.id}</span>{fn.name}
              </button></td>
              <td className={cn(CELL, 'whitespace-nowrap text-gray-400')}>{fn.group}</td>
              <td className={cn(CELL, 'text-gray-400')}>{fn.desc}</td>
            </tr>)}</tbody>
          </table>
          {filtered.length === 0 && <p className="py-4 text-xs text-gray-400">没有匹配的功能，请更改关键词或分类。</p>}
        </>}

        {tab === 'curve' && <>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div className="text-xs"><h3 className="mb-1 font-semibold">收益率期限表 · 手动输入</h3>
              <p className="text-gray-400">请使用同一观察时点、同一口径的数据。空白为未输入，不代表零；本表不是BVAL或其他供应商行情。</p>
            </div>
            <button className={BUTTON} onClick={() => { setYields({}); setTaxRate(''); }}>清空收益率输入</button>
          </div>
          <label className="mb-3 flex max-w-sm items-center gap-2 text-xs text-gray-400">边际税率（%，可选）
            <input aria-label="边际税率（%）" inputMode="decimal" value={taxRate} onChange={event => setTaxRate(event.target.value)} className={cn(INPUT, 'max-w-28')} />
          </label>
          {((taxRate.trim() !== '' && !validTax) || yieldError) && <p role="alert" className="mb-2 text-xs text-amber-300">收益率须为有限数值；边际税率须大于等于0且小于100。</p>}
          <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-xs">
            <thead className="bg-gray-900 text-gray-400"><tr><th className={CELL}>期限</th>
              {RATINGS.map(rating => <th key={rating} className={CELL}>{rating}（%）</th>)}
              <th className={CELL}>AAA−UST（bp）</th><th className={CELL}>AAA税等价（%）</th>
            </tr></thead>
            <tbody>{TERMS.map(term => {
              const aaa = number(yields[`${term}-AAA`]);
              const ust = number(yields[`${term}-UST`]);
              return <tr key={term}><th className={cn(CELL, 'font-mono font-normal')}>{term}</th>
                {RATINGS.map(rating => <td key={rating} className={CELL}>
                  <input aria-label={`${term} ${rating} 收益率（%）`} inputMode="decimal" value={yields[`${term}-${rating}`] ?? ''}
                    onChange={event => setYields(previous => ({ ...previous, [`${term}-${rating}`]: event.target.value }))} className={INPUT} />
                </td>)}
                <td className={cn(CELL, 'font-mono')}><output aria-label={`${term} AAA与UST利差`}>{formatted(aaa !== null && ust !== null ? (aaa - ust) * 100 : null)}</output></td>
                <td className={cn(CELL, 'font-mono')}><output aria-label={`${term} AAA税等价收益率`}>{formatted(aaa !== null && validTax ? aaa / (1 - tax! / 100) : null)}</output></td>
              </tr>;
            })}</tbody>
          </table></div>
          
        </>}

        {tab === 'sector' && <>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3 text-xs">
            <div><h3 className="mb-1 font-semibold">板块分布 · 手动输入</h3><p className="text-gray-400">输入同一期间、同一统计口径的金额。占比仅覆盖已输入金额，不代表全市场分布。</p></div>
            <button className={BUTTON} onClick={() => setSectors({})}>清空板块输入</button>
          </div>
          <label className="mb-3 flex max-w-xs items-center gap-2 text-xs text-gray-400">金额单位
            <select aria-label="板块金额单位" value={sectorUnit} onChange={event => setSectorUnit(event.target.value)} className={INPUT}>
              {['亿美元', '百万美元', '亿元人民币'].map(unit => <option key={unit}>{unit}</option>)}
            </select>
          </label>
          {sectorError && <p role="alert" className="mb-2 text-xs text-amber-300">板块金额须为大于等于0的有限数值；无效项不参与合计。</p>}
          <table className="w-full text-xs"><thead className="bg-gray-900 text-gray-400"><tr>
            <th className={CELL}>板块</th><th className={CELL}>输入金额（{sectorUnit}）</th><th className={CELL}>已输入金额占比</th>
          </tr></thead><tbody>{SECTORS.map((name, index) => <tr key={name}>
            <th className={cn(CELL, 'font-normal')}>{name}</th>
            <td className={CELL}><input aria-label={`${name}发行金额`} inputMode="decimal" value={sectors[name] ?? ''}
              onChange={event => setSectors(previous => ({ ...previous, [name]: event.target.value }))} className={INPUT} /></td>
            <td className={cn(CELL, 'font-mono')}><output aria-label={`${name}占比`}>{formatted(sectorTotal !== null && sectorTotal > 0 && sectorAmounts[index] !== null ? sectorAmounts[index]! / sectorTotal * 100 : null, '%')}</output></td>
          </tr>)}</tbody><tfoot><tr><th className={CELL}>已输入合计（{sectorCount} / {SECTORS.length} 项）</th>
            <td className={cn(CELL, 'font-mono')}><output aria-label="已输入板块合计">{formatted(sectorTotal)} {sectorUnit}</output></td><td className={CELL} /></tr></tfoot></table>
          <p className="mt-3 text-xs text-gray-500">更改单位只更改标注，不进行汇率或数量换算。未输入项与总额为零时不计算占比。</p>
        </>}

        {tab === 'flow' && <>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3 text-xs">
            <div><h3 className="mb-1 font-semibold">资金流向 · 手动输入</h3><p className="text-gray-400">按时间从早到晚输入最多8期流入、流出及期末日期。仅在两项金额都有效时计算该期净流入。</p></div>
            <button className={BUTTON} onClick={() => setFlows({})}>清空资金流输入</button>
          </div>
          <label className="mb-3 flex max-w-xs items-center gap-2 text-xs text-gray-400">金额单位
            <select aria-label="资金流金额单位" value={flowUnit} onChange={event => setFlowUnit(event.target.value)} className={INPUT}>
              {['亿美元', '百万美元', '亿元人民币'].map(unit => <option key={unit}>{unit}</option>)}
            </select>
          </label>
          {flowError && <p role="alert" className="mb-2 text-xs text-amber-300">流入、流出须为大于等于0的有限数值；无效或不完整记录不参与累计。</p>}
          <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-xs"><thead className="bg-gray-900 text-gray-400"><tr>
            <th className={CELL}>期间</th><th className={CELL}>期末日期（可选）</th><th className={CELL}>流入（{flowUnit}）</th><th className={CELL}>流出（{flowUnit}）</th><th className={CELL}>净流入（{flowUnit}）</th>
          </tr></thead><tbody>{flowRows.map(({ period, net }) => <tr key={period}>
            <th className={cn(CELL, 'font-normal')}>{period}</th>
            <td className={CELL}><input aria-label={`${period}期末日期`} type="date" value={flows[`${period}-date`] ?? ''}
              onChange={event => setFlows(previous => ({ ...previous, [`${period}-date`]: event.target.value }))} className={INPUT} /></td>
            {(['in', 'out'] as const).map(direction => <td key={direction} className={CELL}>
              <input aria-label={`${period}${direction === 'in' ? '流入' : '流出'}`} inputMode="decimal" value={flows[`${period}-${direction}`] ?? ''}
                onChange={event => setFlows(previous => ({ ...previous, [`${period}-${direction}`]: event.target.value }))} className={INPUT} />
            </td>)}
            <td className={cn(CELL, 'font-mono')}><output aria-label={`${period}净流入`}>{formatted(net)}</output></td>
          </tr>)}</tbody><tfoot><tr><th colSpan={4} className={CELL}>完整金额记录累计（{completeFlows.length} / {PERIODS.length} 期）</th>
            <td className={cn(CELL, 'font-mono')}><output aria-label="完整记录累计净流入">{formatted(flowTotal)}</output></td>
          </tr></tfoot></table></div>
          
        </>}
      </div>
    </div>
  );
}
