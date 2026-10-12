import { useState } from 'react';
import { X } from 'lucide-react';

interface MMCVPanelProps {
  onClose?: () => void;
}

const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'AUD', 'CAD', 'CHF'];

const mmCurveData: Record<string, { tenor: string; rate: number; chg: number; bid: number; ask: number }[]> = {
  USD: [
    { tenor: 'O/N', rate: 5.33, chg: 0.00, bid: 5.32, ask: 5.34 },
    { tenor: 'T/N', rate: 5.33, chg: 0.00, bid: 5.32, ask: 5.34 },
    { tenor: '1W', rate: 5.31, chg: -0.01, bid: 5.30, ask: 5.32 },
    { tenor: '2W', rate: 5.30, chg: -0.01, bid: 5.29, ask: 5.31 },
    { tenor: '1M', rate: 5.28, chg: -0.02, bid: 5.27, ask: 5.29 },
    { tenor: '2M', rate: 5.24, chg: -0.02, bid: 5.23, ask: 5.25 },
    { tenor: '3M', rate: 5.20, chg: -0.03, bid: 5.19, ask: 5.21 },
    { tenor: '6M', rate: 5.08, chg: -0.04, bid: 5.07, ask: 5.09 },
    { tenor: '9M', rate: 4.92, chg: -0.05, bid: 4.91, ask: 4.93 },
    { tenor: '12M', rate: 4.78, chg: -0.06, bid: 4.77, ask: 4.79 },
  ],
  EUR: [
    { tenor: 'O/N', rate: 3.90, chg: 0.00, bid: 3.89, ask: 3.91 },
    { tenor: 'T/N', rate: 3.90, chg: 0.00, bid: 3.89, ask: 3.91 },
    { tenor: '1W', rate: 3.88, chg: -0.01, bid: 3.87, ask: 3.89 },
    { tenor: '2W', rate: 3.86, chg: -0.01, bid: 3.85, ask: 3.87 },
    { tenor: '1M', rate: 3.82, chg: -0.02, bid: 3.81, ask: 3.83 },
    { tenor: '2M', rate: 3.76, chg: -0.02, bid: 3.75, ask: 3.77 },
    { tenor: '3M', rate: 3.68, chg: -0.03, bid: 3.67, ask: 3.69 },
    { tenor: '6M', rate: 3.48, chg: -0.04, bid: 3.47, ask: 3.49 },
    { tenor: '9M', rate: 3.28, chg: -0.05, bid: 3.27, ask: 3.29 },
    { tenor: '12M', rate: 3.12, chg: -0.06, bid: 3.11, ask: 3.13 },
  ],
  GBP: [
    { tenor: 'O/N', rate: 5.20, chg: 0.00, bid: 5.19, ask: 5.21 },
    { tenor: 'T/N', rate: 5.20, chg: 0.00, bid: 5.19, ask: 5.21 },
    { tenor: '1W', rate: 5.18, chg: -0.01, bid: 5.17, ask: 5.19 },
    { tenor: '2W', rate: 5.16, chg: -0.01, bid: 5.15, ask: 5.17 },
    { tenor: '1M', rate: 5.12, chg: -0.02, bid: 5.11, ask: 5.13 },
    { tenor: '2M', rate: 5.06, chg: -0.02, bid: 5.05, ask: 5.07 },
    { tenor: '3M', rate: 4.98, chg: -0.03, bid: 4.97, ask: 4.99 },
    { tenor: '6M', rate: 4.78, chg: -0.04, bid: 4.77, ask: 4.79 },
    { tenor: '9M', rate: 4.58, chg: -0.05, bid: 4.57, ask: 4.59 },
    { tenor: '12M', rate: 4.42, chg: -0.06, bid: 4.41, ask: 4.43 },
  ],
  JPY: [
    { tenor: 'O/N', rate: 0.08, chg: 0.00, bid: 0.07, ask: 0.09 },
    { tenor: 'T/N', rate: 0.08, chg: 0.00, bid: 0.07, ask: 0.09 },
    { tenor: '1W', rate: 0.10, chg: +0.01, bid: 0.09, ask: 0.11 },
    { tenor: '2W', rate: 0.12, chg: +0.01, bid: 0.11, ask: 0.13 },
    { tenor: '1M', rate: 0.16, chg: +0.01, bid: 0.15, ask: 0.17 },
    { tenor: '2M', rate: 0.20, chg: +0.02, bid: 0.19, ask: 0.21 },
    { tenor: '3M', rate: 0.24, chg: +0.02, bid: 0.23, ask: 0.25 },
    { tenor: '6M', rate: 0.34, chg: +0.02, bid: 0.33, ask: 0.35 },
    { tenor: '9M', rate: 0.42, chg: +0.03, bid: 0.41, ask: 0.43 },
    { tenor: '12M', rate: 0.52, chg: +0.03, bid: 0.51, ask: 0.53 },
  ],
  CNY: [
    { tenor: 'O/N', rate: 1.72, chg: -0.02, bid: 1.71, ask: 1.73 },
    { tenor: 'T/N', rate: 1.72, chg: -0.02, bid: 1.71, ask: 1.73 },
    { tenor: '1W', rate: 1.74, chg: -0.01, bid: 1.73, ask: 1.75 },
    { tenor: '2W', rate: 1.76, chg: -0.01, bid: 1.75, ask: 1.77 },
    { tenor: '1M', rate: 1.80, chg: 0.00, bid: 1.79, ask: 1.81 },
    { tenor: '2M', rate: 1.84, chg: 0.00, bid: 1.83, ask: 1.85 },
    { tenor: '3M', rate: 1.88, chg: +0.01, bid: 1.87, ask: 1.89 },
    { tenor: '6M', rate: 1.96, chg: +0.01, bid: 1.95, ask: 1.97 },
    { tenor: '9M', rate: 2.04, chg: +0.01, bid: 2.03, ask: 2.05 },
    { tenor: '12M', rate: 2.12, chg: +0.02, bid: 2.11, ask: 2.13 },
  ],
  AUD: [
    { tenor: 'O/N', rate: 4.35, chg: 0.00, bid: 4.34, ask: 4.36 },
    { tenor: 'T/N', rate: 4.35, chg: 0.00, bid: 4.34, ask: 4.36 },
    { tenor: '1W', rate: 4.33, chg: -0.01, bid: 4.32, ask: 4.34 },
    { tenor: '2W', rate: 4.31, chg: -0.01, bid: 4.30, ask: 4.32 },
    { tenor: '1M', rate: 4.28, chg: -0.02, bid: 4.27, ask: 4.29 },
    { tenor: '2M', rate: 4.22, chg: -0.02, bid: 4.21, ask: 4.23 },
    { tenor: '3M', rate: 4.16, chg: -0.03, bid: 4.15, ask: 4.17 },
    { tenor: '6M', rate: 3.98, chg: -0.04, bid: 3.97, ask: 3.99 },
    { tenor: '9M', rate: 3.82, chg: -0.05, bid: 3.81, ask: 3.83 },
    { tenor: '12M', rate: 3.68, chg: -0.06, bid: 3.67, ask: 3.69 },
  ],
  CAD: [
    { tenor: 'O/N', rate: 4.75, chg: 0.00, bid: 4.74, ask: 4.76 },
    { tenor: 'T/N', rate: 4.75, chg: 0.00, bid: 4.74, ask: 4.76 },
    { tenor: '1W', rate: 4.73, chg: -0.01, bid: 4.72, ask: 4.74 },
    { tenor: '2W', rate: 4.71, chg: -0.01, bid: 4.70, ask: 4.72 },
    { tenor: '1M', rate: 4.68, chg: -0.02, bid: 4.67, ask: 4.69 },
    { tenor: '2M', rate: 4.62, chg: -0.02, bid: 4.61, ask: 4.63 },
    { tenor: '3M', rate: 4.56, chg: -0.03, bid: 4.55, ask: 4.57 },
    { tenor: '6M', rate: 4.38, chg: -0.04, bid: 4.37, ask: 4.39 },
    { tenor: '9M', rate: 4.22, chg: -0.05, bid: 4.21, ask: 4.23 },
    { tenor: '12M', rate: 4.08, chg: -0.06, bid: 4.07, ask: 4.09 },
  ],
  CHF: [
    { tenor: 'O/N', rate: 1.50, chg: 0.00, bid: 1.49, ask: 1.51 },
    { tenor: 'T/N', rate: 1.50, chg: 0.00, bid: 1.49, ask: 1.51 },
    { tenor: '1W', rate: 1.48, chg: -0.01, bid: 1.47, ask: 1.49 },
    { tenor: '2W', rate: 1.46, chg: -0.01, bid: 1.45, ask: 1.47 },
    { tenor: '1M', rate: 1.42, chg: -0.02, bid: 1.41, ask: 1.43 },
    { tenor: '2M', rate: 1.36, chg: -0.02, bid: 1.35, ask: 1.37 },
    { tenor: '3M', rate: 1.30, chg: -0.03, bid: 1.29, ask: 1.31 },
    { tenor: '6M', rate: 1.14, chg: -0.04, bid: 1.13, ask: 1.15 },
    { tenor: '9M', rate: 1.00, chg: -0.05, bid: 0.99, ask: 1.01 },
    { tenor: '12M', rate: 0.88, chg: -0.06, bid: 0.87, ask: 0.89 },
  ],
};

export default function MMCVPanel({ onClose }: MMCVPanelProps) {
  const [selectedCcy, setSelectedCcy] = useState('USD');
  const data = mmCurveData[selectedCcy] || mmCurveData['USD'];

  return (
    <div className="flex flex-col h-full bg-black text-white font-mono text-xs">
      <div className="flex items-center justify-between bg-[#1a1a2a] px-3 py-1.5 border-b border-indigo-900">
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm text-indigo-300">MMCV</span>
          <span className="text-gray-300">货币市场曲线</span>
        </div>
        {onClose && <button onClick={onClose} className="text-gray-300 hover:text-white"><X className="w-4 h-4" /></button>}
      </div>

      {/* Currency tabs */}
      <div className="flex border-b border-gray-700 bg-[#0a0a0a] overflow-x-auto">
        {currencies.map(ccy => (
          <button key={ccy} onClick={() => setSelectedCcy(ccy)}
            className={`px-4 py-1.5 text-xs border-r border-gray-700 whitespace-nowrap ${
              selectedCcy === ccy ? 'bg-indigo-900/40 text-indigo-300 font-bold' : 'text-gray-400 hover:text-white'
            }`}>
            {ccy}
          </button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-[#111]">
              <tr className="border-b border-gray-700">
                <th className="text-left px-3 py-1.5 text-gray-500">期限</th>
                <th className="text-right px-3 py-1.5 text-gray-500">利率%</th>
                <th className="text-right px-3 py-1.5 text-gray-500">变动(bps)</th>
                <th className="text-right px-3 py-1.5 text-gray-500">买入</th>
                <th className="text-right px-3 py-1.5 text-gray-500">卖出</th>
                <th className="text-right px-3 py-1.5 text-gray-500">买卖差</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => {
                const chgBps = row.chg * 100;
                return (
                  <tr key={row.tenor} className={`border-b border-gray-800 hover:bg-[#111] ${i % 2 === 0 ? 'bg-[#050505]' : 'bg-black'}`}>
                    <td className="px-3 py-1.5 text-yellow-400 font-bold">{row.tenor}</td>
                    <td className="px-3 py-1.5 text-right text-white font-bold">{row.rate.toFixed(2)}</td>
                    <td className={`px-3 py-1.5 text-right font-bold ${chgBps >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {chgBps >= 0 ? '+' : ''}{chgBps.toFixed(1)}
                    </td>
                    <td className="px-3 py-1.5 text-right text-green-400">{row.bid.toFixed(2)}</td>
                    <td className="px-3 py-1.5 text-right text-red-400">{row.ask.toFixed(2)}</td>
                    <td className="px-3 py-1.5 text-right text-gray-500">{((row.ask - row.bid) * 100).toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mini curve chart */}
        <div className="w-48 border-l border-gray-700 p-3 flex flex-col">
          <div className="text-gray-400 mb-2 text-[10px]">{selectedCcy} 货币市场曲线</div>
          <div className="flex-1 flex items-end gap-0.5">
            {data.map((row, i) => {
              const maxR = Math.max(...data.map(d => d.rate));
              const minR = Math.min(...data.map(d => d.rate));
              const h = ((row.rate - minR) / (maxR - minR + 0.01)) * 70 + 15;
              return (
                <div key={row.tenor} className="flex-1 flex flex-col items-center gap-0.5">
                  <div className="w-full bg-indigo-600/60 hover:bg-indigo-400 transition-colors rounded-t-sm"
                    style={{ height: `${h}%` }} title={`${row.tenor}: ${row.rate.toFixed(2)}%`} />
                  {i % 3 === 0 && <div className="text-[8px] text-gray-600 truncate w-full text-center">{row.tenor}</div>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-3 py-1 border-t border-gray-800 bg-[#0a0a0a] text-gray-600 text-xs">
        <span>MMCV — {selectedCcy} 货币市场曲线</span>
        <span>{new Date().toLocaleTimeString('zh-CN')}</span>
      </div>
    </div>
  );
}
