import { adminProcedure, router } from '../_core/trpc';
import { getMortgageGovernanceAdminAudit } from '../db';

export const mortgageGovernanceAdminRouter = router({
  // 管理员仅获得跨模块对象计数、协作授权、审阅积压和时效分层，不读取或导出台账正文。
  audit: adminProcedure.query(() => getMortgageGovernanceAdminAudit()),
});
