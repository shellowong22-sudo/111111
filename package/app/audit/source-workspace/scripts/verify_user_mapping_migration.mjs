import mysql from "mysql2/promise";

const SOURCE_DUMP_SHA256 = "829b54ca0a17b667317ece71dac4ad4ddedfe168ce618698af5c9e8ada5093d9";
const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [[mapping]] = await connection.query("SELECT COUNT(*) AS count, COUNT(DISTINCT `source_user_id`) AS sourceDistinct, COUNT(DISTINCT `target_user_id`) AS targetDistinct, SUM(`source_user_id` = 1 AND `target_user_id` = 1890001) AS expectedRemapCount FROM `recovery_user_id_mappings` WHERE `source_dump_sha256` = ?", [SOURCE_DUMP_SHA256]);
  const [[mappedUsers]] = await connection.query("SELECT COUNT(*) AS count FROM `recovery_user_id_mappings` AS m INNER JOIN `users` AS u ON u.`id` = m.`target_user_id` WHERE m.`source_dump_sha256` = ?", [SOURCE_DUMP_SHA256]);
  const [[usage]] = await connection.query("SELECT COUNT(*) AS count FROM `money_market_module_usage_events` AS e INNER JOIN `recovery_user_id_mappings` AS m ON e.`user_id` = m.`target_user_id` WHERE m.`source_dump_sha256` = ?", [SOURCE_DUMP_SHA256]);
  const [[security]] = await connection.query("SELECT COUNT(*) AS count FROM `terminal_security_events` AS e INNER JOIN `recovery_user_id_mappings` AS m ON e.`user_id` = m.`target_user_id` WHERE m.`source_dump_sha256` = ?", [SOURCE_DUMP_SHA256]);
  const [[currentUser]] = await connection.query("SELECT COUNT(*) AS count FROM `users` WHERE `id` = 1");
  const [[currentUserMapped]] = await connection.query("SELECT COUNT(*) AS count FROM `recovery_user_id_mappings` WHERE `target_user_id` = 1");
  const result = {
    mappingRows: Number(mapping.count),
    sourceDistinct: Number(mapping.sourceDistinct),
    targetDistinct: Number(mapping.targetDistinct),
    mappedUsersPresent: Number(mappedUsers.count),
    mappedUsageEventsPresent: Number(usage.count),
    mappedSecurityEventsPresent: Number(security.count),
    expectedRemapCount: Number(mapping.expectedRemapCount ?? 0),
    currentUserIdOnePresent: Number(currentUser.count),
    currentUserIdOneMapped: Number(currentUserMapped.count),
    differenceCount: (5512 - Number(mapping.count)) + (5512 - Number(mapping.sourceDistinct)) + (5512 - Number(mapping.targetDistinct)) + (5512 - Number(mappedUsers.count)) + (3 - Number(usage.count)) + (2 - Number(security.count)) + (1 - Number(mapping.expectedRemapCount)) + (1 - Number(currentUser.count)) + Number(currentUserMapped.count),
  };
  console.log(JSON.stringify(result, null, 2));
} finally {
  await connection.end();
}
