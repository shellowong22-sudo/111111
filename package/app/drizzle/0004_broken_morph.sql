ALTER TABLE `research_ledger_entries` ADD `approval_due_at` timestamp NULL;
UPDATE `research_ledger_entries`
SET `approval_due_at` = DATE_ADD(`submitted_at`, INTERVAL 24 HOUR)
WHERE `approval_due_at` IS NULL;
ALTER TABLE `research_ledger_entries` MODIFY `approval_due_at` timestamp NOT NULL;
