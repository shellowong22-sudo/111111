import { useState } from 'react';
import { X } from 'lucide-react';

interface MPAYPanelProps {
  onClose?: () => void;
}

const agencies = ['FNMA', 'FHLMC', 'GNMA'];
const coupons = ['2.0', '2.5', '3.0', '3.5', '4.0', '4.5', '5.0', '5.5', '6.0', '6.5', '7.0'];
const settleDates = ['2026-06-16', '2026-07-14', '2026-08-13'];

type MatrixCell = { price: number; chg: number; oas: number };

const matrixData: Record<string, Record<string, MatrixCell>> = {
  'FNMA-2.0': { '2026-06-16': { price: 88.12, chg: -0.08, oas: 42 }, '2026-07-14': { price: 88.28, chg: -0.06, oas: 40 }, '2026-08-13': { price: 88.44, chg: -0.05, oas: 38 } },
  'FNMA-2.5': { '2026-06-16': { price: 90.24, chg: -0.10, oas: 38 }, '2026-07-14': { price: 90.42, chg: -0.08, oas: 36 }, '2026-08-13': { price: 90.60, chg: -0.07, oas: 34 } },
  'FNMA-3.0': { '2026-06-16': { price: 92.18, chg: -0.12, oas: 34 }, '2026-07-14': { price: 92.38, chg: -0.10, oas: 32 }, '2026-08-13': { price: 92.58, chg: -0.08, oas: 30 } },
  'FNMA-3.5': { '2026-06-16': { price: 94.06, chg: -0.14, oas: 30 }, '2026-07-14': { price: 94.28, chg: -0.12, oas: 28 }, '2026-08-13': { price: 94.50, chg: -0.10, oas: 26 } },
  'FNMA-4.0': { '2026-06-16': { price: 95.84, chg: -0.15, oas: 26 }, '2026-07-14': { price: 96.08, chg: -0.13, oas: 24 }, '2026-08-13': { price: 96.32, chg: -0.11, oas: 22 } },
  'FNMA-4.5': { '2026-06-16': { price: 97.52, chg: -0.16, oas: 22 }, '2026-07-14': { price: 97.78, chg: -0.14, oas: 20 }, '2026-08-13': { price: 98.04, chg: -0.12, oas: 18 } },
  'FNMA-5.0': { '2026-06-16': { price: 99.08, chg: -0.14, oas: 18 }, '2026-07-14': { price: 99.36, chg: -0.12, oas: 16 }, '2026-08-13': { price: 99.64, chg: -0.10, oas: 14 } },
  'FNMA-5.5': { '2026-06-16': { price: 100.52, chg: -0.12, oas: 14 }, '2026-07-14': { price: 100.82, chg: -0.10, oas: 12 }, '2026-08-13': { price: 101.12, chg: -0.08, oas: 10 } },
  'FNMA-6.0': { '2026-06-16': { price: 101.84, chg: -0.10, oas: 10 }, '2026-07-14': { price: 102.16, chg: -0.08, oas: 8 }, '2026-08-13': { price: 102.48, chg: -0.06, oas: 6 } },
  'FNMA-6.5': { '2026-06-16': { price: 103.02, chg: -0.08, oas: 6 }, '2026-07-14': { price: 103.36, chg: -0.06, oas: 4 }, '2026-08-13': { price: 103.70, chg: -0.04, oas: 2 } },
  'FNMA-7.0': { '2026-06-16': { price: 104.12, chg: -0.06, oas: 2 }, '2026-07-14': { price: 104.48, chg: -0.04, oas: 0 }, '2026-08-13': { price: 104.84, chg: -0.02, oas: -2 } },
};

export default function MPAYPanel({ onClose }: MPAYPanelProps) {
  const [selectedAgency, setSelectedAgency] = useState('FNMA');
  const [displayMode, setDisplayMode] = useState<'price' | 'oas' | 'chg'>('price');
  const [selectedSettle, setSelectedSettle] = useState('2026-06-16');

  return (
    <div className="flex flex-col h-full bg-black text-white font-mono text-xs">
      <div className="flex items-center justify-between bg-[#1a1a2a] px-3 py-1.5 border-b border-blue-900">
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm text-blue-300">MPAY</span>
          <span className="text-gray-300">抵押贷款溢价矩阵</span>
        </div>
        {onClose && <button onClick={onClose} className="text-gray-300 hover:text-white"><X className="w-4 h-4" /></button>}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 px-3 py-1.5 border-b border-gray-700 bg-[#0d0d0d]">
        <div className="flex items-center gap-1">
          <span className="text-gray-500">机构:</span>
          {agencies.map(a => (
            <button key={a} onClick={() => setSelectedAgency(a)}
              className={`px-2 py-0.5 text-xs border ${selectedAgency === a ? 'bg-blue-600 text-white border-blue-600 font-bold' : 'text-gray-400 border-gray-700 hover:border-blue-400'}`}>
              {a}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-500">显示:</span>
          {([['price', '价格'], ['oas', 'OAS'], ['chg', '变动']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setDisplayMode(id)}
              className={`px-2 py-0.5 text-xs border ${displayMode === id ? 'bg-orange-500 text-black border-orange-500 font-bold' : 'text-gray-400 border-gray-700 hover:border-orange-400'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-500">结算日:</span>
          {settleDates.map(d => (
            <button key={d} onClick={() => setSelectedSettle(d)}
              className={`px-2 py-0.5 text-xs border ${selectedSettle === d ? 'bg-green-700 text-white border-green-700' : 'text-gray-400 border-gray-700 hover:border-green-400'}`}>
              {d.slice(5)}
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div className="flex items-center gap-6 px-3 py-1.5 border-b border-gray-700 bg-[#080808]">
        <div className="flex items-center gap-1">
          <span className="text-gray-500">当前利率:</span>
          <span className="text-white font-bold">7.24%</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-500">30年固定:</span>
          <span className="text-cyan-400 font-bold">7.18%</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-500">15年固定:</span>
          <span className="text-cyan-400 font-bold">6.82%</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-500">再融资指数:</span>
          <span className="text-yellow-400 font-bold">284.2</span>
          <span className="text-red-400 text-[10px]">-3.2%</span>
        </div>
      </div>

      {/* Matrix table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-[#111]">
            <tr className="border-b border-gray-700">
              <th className="text-left px-3 py-1.5 text-gray-500 w-24">票息</th>
              <th className="text-right px-3 py-1.5 text-gray-500">即期</th>
              <th className="text-right px-3 py-1.5 text-gray-500">变动</th>
              <th className="text-right px-3 py-1.5 text-gray-500">OAS(bps)</th>
              <th className="text-right px-3 py-1.5 text-gray-500">久期</th>
              <th className="text-right px-3 py-1.5 text-gray-500">凸性</th>
              <th className="text-right px-3 py-1.5 text-gray-500">CPR预估</th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((coupon, i) => {
              const key = `${selectedAgency}-${coupon}`;
              const cell = matrixData[key]?.[selectedSettle];
              if (!cell) return null;
              const duration = 8.5 - parseFloat(coupon) * 0.4;
              const convexity = -2.8 + parseFloat(coupon) * 0.3;
              const cpr = Math.max(5, 45 - parseFloat(coupon) * 3);
              return (
                <tr key={coupon} className={`border-b border-gray-800 hover:bg-[#111] ${i % 2 === 0 ? 'bg-[#050505]' : 'bg-black'}`}>
                  <td className="px-3 py-1.5 text-yellow-400 font-bold">{selectedAgency} {coupon}%</td>
                  <td className="px-3 py-1.5 text-right text-white font-bold">{cell.price.toFixed(2)}</td>
                  <td className={`px-3 py-1.5 text-right font-bold ${cell.chg >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {cell.chg >= 0 ? '+' : ''}{cell.chg.toFixed(2)}
                  </td>
                  <td className="px-3 py-1.5 text-right text-cyan-400">{cell.oas}</td>
                  <td className="px-3 py-1.5 text-right text-gray-300">{duration.toFixed(2)}</td>
                  <td className={`px-3 py-1.5 text-right ${convexity >= 0 ? 'text-green-400' : 'text-orange-400'}`}>
                    {convexity.toFixed(2)}
                  </td>
                  <td className="px-3 py-1.5 text-right text-blue-400">{cpr.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-3 py-1 border-t border-gray-800 bg-[#0a0a0a] text-gray-600 text-xs">
        <span>MPAY — {selectedAgency} 抵押贷款溢价矩阵 | 结算: {selectedSettle}</span>
        <span>{new Date().toLocaleTimeString('zh-CN')}</span>
      </div>
    </div>
  );
}
