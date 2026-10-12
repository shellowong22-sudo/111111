import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TERM_DIMENSIONS, type TermDimension } from '@/lib/termRateTraderData';
import { Link } from 'wouter';

const termLabels: Record<TermDimension, string> = {
  '0-1y': '0-1 年',
  '1-3y': '1-3 年',
  '3-5y': '3-5 年',
  '5-7y': '5-7 年',
  '7-10y': '7-10 年',
  '10-20y': '10-20 年',
  '20y+': '20 年+'
};

export default function MultiTermDashboard() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-50 mb-2">利率交易员 - 多期限维度</h1>
          <p className="text-slate-400">选择期限维度查看详细的交易数据和分析</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {TERM_DIMENSIONS.map((term) => (
            <Link key={term} href={`/rate-trader-by-term?term=${term}`}>
              <Card className="bg-slate-900 border-slate-700 p-6 hover:border-slate-500 hover:bg-slate-800 transition-all cursor-pointer h-full">
                <div className="flex flex-col items-center text-center">
                  <div className="text-3xl font-bold text-blue-400 mb-2">{termLabels[term]}</div>
                  <p className="text-slate-400 text-sm mb-4">期限矩阵 · 交易数据 · 标的分析</p>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white w-full">
                    查看详情
                  </Button>
                </div>
              </Card>
            </Link>
          ))}
        </div>

        {/* 快速统计 */}
        <Card className="bg-slate-900 border-slate-700 mt-8 p-6">
          <h2 className="text-2xl font-bold text-slate-50 mb-6">期限维度统计</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <div className="text-slate-400 text-sm">总期限数</div>
              <div className="text-3xl font-bold text-slate-100">{TERM_DIMENSIONS.length}</div>
            </div>
            <div>
              <div className="text-slate-400 text-sm">标的数量</div>
              <div className="text-3xl font-bold text-slate-100">7</div>
            </div>
            <div>
              <div className="text-slate-400 text-sm">矩阵规模</div>
              <div className="text-3xl font-bold text-slate-100">11x11</div>
            </div>
            <div>
              <div className="text-slate-400 text-sm">数据点</div>
              <div className="text-3xl font-bold text-slate-100">847+</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
