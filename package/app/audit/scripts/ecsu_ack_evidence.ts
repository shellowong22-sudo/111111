import { writeFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';
const db=await mysql.createConnection(process.env.DATABASE_URL||'mysql://root@127.0.0.1:3307/finance_hub');
try {
 const [rows]=await db.execute("SELECT content_key,module_id,status,content_hash,JSON_EXTRACT(target_payload,'$.deliveryReceipt') AS receipt FROM admin_data_module_content_items WHERE module_id='economic-ecsu' AND source_reference LIKE 'openbb:official_fred_%' ORDER BY id DESC LIMIT 10");
 const evidence={checkedAt:new Date().toISOString(),rows};
 await writeFile('recovery-evidence/api-expansion-20260919/ecsu-ack-db.json',JSON.stringify(evidence,null,2));
 console.log(JSON.stringify(evidence,null,2));
}finally{await db.end();}
