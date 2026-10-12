import { useState } from 'react';
import { BadgeCheck, CircleAlert, Search } from 'lucide-react';
import { trpc } from '@/lib/trpc';

export default function ExportSignatureVerification() {
  const [researchId, setResearchId] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const verify = trpc.checklistCollaboration.verifyExportSignature.useMutation();
  const result = verify.data;
  const statusTone = result?.status === 'valid'
    ? 'border-emerald-700 bg-emerald-950/40 text-emerald-200'
    : result?.status === 'expired'
      ? 'border-amber-700 bg-amber-950/40 text-amber-200'
      : 'border-rose-700 bg-rose-950/40 text-rose-200';

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-12 text-slate-100">
      <section className="mx-auto max-w-2xl rounded-xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <BadgeCheck className="mt-0.5 h-6 w-6 text-cyan-400" />
          <div>
            <h1 className="text-xl font-semibold">研究导出签名验证</h1>
            <p className="mt-1 text-sm leading-6 text-slate-400">输入研究编号和文件中的签名校验码。系统只校验服务端登记的签名载荷与有效期，不展示账户信息或研究内容。</p>
          </div>
        </div>
        <div className="mt-6 grid gap-3">
          <label className="text-xs text-slate-400">研究编号
            <input value={researchId} onChange={(event) => setResearchId(event.target.value)} placeholder="SR-COUN-T12-S41-S42" className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-cyan-500" />
          </label>
          <label className="text-xs text-slate-400">签名校验码
            <input value={verificationCode} onChange={(event) => setVerificationCode(event.target.value)} placeholder="CHK-…" className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-cyan-500" />
          </label>
          <button type="button" disabled={!researchId.trim() || !verificationCode.trim() || verify.isPending} onClick={() => verify.mutate({ researchId: researchId.trim().toUpperCase(), verificationCode: verificationCode.trim().toUpperCase() })} className="inline-flex w-fit items-center gap-2 rounded border border-cyan-700 bg-cyan-950/40 px-3 py-2 text-sm text-cyan-100 hover:bg-cyan-900/50 disabled:opacity-40">
            <Search className="h-4 w-4" />{verify.isPending ? '正在验证…' : '验证校验码'}
          </button>
        </div>
        {verify.error ? <p className="mt-4 text-sm text-rose-300">验证请求未完成：{verify.error.message}</p> : null}
        {result ? (
          <div className={`mt-5 rounded border p-4 ${statusTone}`}>
            <div className="flex items-center gap-2 font-medium">
              {result.status === 'valid' ? <BadgeCheck className="h-5 w-5" /> : <CircleAlert className="h-5 w-5" />}
              {result.status === 'valid' ? '签名有效' : result.status === 'expired' ? '签名真实但已到期' : '未通过验证'}
            </div>
            {result.record ? (
              <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                <div><dt className="text-slate-400">研究编号</dt><dd className="mt-0.5 font-mono">{result.record.researchId}</dd></div>
                <div><dt className="text-slate-400">研究模块</dt><dd className="mt-0.5">{result.record.moduleId}</dd></div>
                <div><dt className="text-slate-400">文件格式</dt><dd className="mt-0.5 uppercase">{result.record.exportFormat}</dd></div>
                <div><dt className="text-slate-400">有效期</dt><dd className="mt-0.5">{result.record.verificationExpiresAt ? new Date(result.record.verificationExpiresAt).toLocaleString() : '未设置有效期'}</dd></div>
              </dl>
            ) : <p className="mt-2 text-xs">请检查研究编号、校验码及字符大小写是否与导出文件一致。</p>}
          </div>
        ) : null}
      </section>
    </main>
  );
}
