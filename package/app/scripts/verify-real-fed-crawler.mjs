import { syncAdminNewsSource } from '../server/adminNewsIngestion.ts';

const result = await syncAdminNewsSource(540004, 1, 10);
console.log(JSON.stringify(result, null, 2));
