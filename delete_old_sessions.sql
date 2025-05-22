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
    REFERENCES `external_invoices` (`id`)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;


