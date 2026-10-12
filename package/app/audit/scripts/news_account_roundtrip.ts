import { writeFileSync } from 'node:fs';
import { newsResearchRouter } from '../../server/routers/newsResearch';

// Local preview administrator; verify the already-existing account rather than
// creating test users or emitting a real notification.
const caller = newsResearchRouter.createCaller({ user: { id: 4110001, role: 'admin' } as any, req: {} as any, res: {} as any });
async function main() {
  const before = await caller.listSourceFreshnessRules();
  const previous = before.find(rule => rule.sourceKind === 'sec_press');
  let saved;
  try {
    saved = await caller.saveSourceFreshnessRule({ sourceKind: 'sec_press', thresholdHours: 73, isActive: false });
    const read = (await caller.listSourceFreshnessRules()).find(rule => rule.sourceKind === 'sec_press');
    if (!read || read.thresholdHours !== 73 || read.isActive) throw new Error('RULE_ROUNDTRIP_FAILED');
    const events = await caller.listSourceFreshnessEvents({ sourceKind: 'sec_press', state: 'all', limit: 160 });
    writeFileSync('recovery-evidence/news-20260919/account-roundtrip.json', JSON.stringify({checkedAt:new Date().toISOString(),ruleId:saved.id,sourceKind:read.sourceKind,thresholdHours:read.thresholdHours,isActive:read.isActive,readBackVerified:true,eventCount:events.length,notificationSent:false},null,2));
  } finally {
    if (previous) await caller.saveSourceFreshnessRule({sourceKind:'sec_press',thresholdHours:previous.thresholdHours,isActive:previous.isActive});
    else if (saved) await caller.deleteSourceFreshnessRule({sourceKind:'sec_press'});
  }
  const after = await caller.listSourceFreshnessRules();
  if (after.length !== before.length) throw new Error('RULE_RESTORE_FAILED');
  console.log(JSON.stringify({ruleRoundtrip:'passed',originalRulesRestored:true,notificationsSent:0}));
}
main().then(()=>process.exit(0)).catch(error=>{console.error(error.message);process.exit(1);});
