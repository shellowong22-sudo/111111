import { adminProcedure, router } from '../_core/trpc';
import { getCreditGovernanceAdminAudit } from '../db';

/** 管理员专用：不读取台账记录正文，仅提供使用、协作、审阅和时效汇总。 */
export const creditGovernanceAdminRouter = router({
  audit: adminProcedure.query(() => getCreditGovernanceAdminAudit()),
});
