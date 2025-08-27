SHOW CREATE EVENT delete_old_active_sessions;

 DELETE st
  FROM session_tracking st
  INNER JOIN (
      SELECT username, MAX(id) AS latest_id
      FROM session_tracking
      WHERE status = 'active'
      GROUP BY username
  ) latest ON st.username = latest.username
  WHERE st.status = 'active'
    AND st.id <> latest.latest_id;
    
CREATE TABLE `modification_logs` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `invoice_id`  INT      NULL,               -- FK to external_invoices.id
  `username`    VARCHAR(64)  NOT NULL,
  `action`      VARCHAR(255) NOT NULL,
  `timestamp`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `changes`     JSON              NULL,

  PRIMARY KEY (`id`),

  CONSTRAINT `fk_modlog_invoice`
    FOREIGN KEY (`invoice_id`)
    REFERENCES `external_invuser_macmodification_logsoices` (`id`)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
  
  ALTER TABLE radius.modification_logs DROP FOREIGN KEY FK_23a5a9979484d01b7e8fa7184c2;
  
  
  UPDATE invoices 
   SET user_profile_id = (SELECT id FROM raduserprofile LIMIT 1)
   WHERE user_profile_id NOT IN (SELECT id FROM raduserprofile);
   
   ALTER TABLE `invoices` ADD CONSTRAINT `FK_35d4fc3e4ffc64b69da20c2f50f` FOREIGN KEY (`user_profile_id`) REFERENCES `raduserprofile`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;


