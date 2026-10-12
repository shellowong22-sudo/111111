ALTER TABLE `users`
  MODIFY COLUMN `role` enum('user','admin','trader','risk_manager') NOT NULL DEFAULT 'user';
