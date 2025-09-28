DROP DATABASE IF EXISTS chamados;
CREATE DATABASE chamados CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE chamados;

-- 1) TABELAS BASE
CREATE TABLE roles (
  role_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  role_name VARCHAR(32) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE permissions (
  perm_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  perm_code VARCHAR(64) NOT NULL UNIQUE,
  description VARCHAR(255) NULL
) ENGINE=InnoDB;

CREATE TABLE users (
  user_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  -- senha baseada em SHA2 (256) + SALT + ITERATIONS (protótipo)
  password_hash VARBINARY(64) NOT NULL,
  password_salt VARBINARY(16) NOT NULL,
  password_iterations INT NOT NULL DEFAULT 10000,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE user_roles (
  user_id BIGINT UNSIGNED NOT NULL,
  role_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (user_id, role_id),
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Grants adicionais (por usuário, além do papel)
CREATE TABLE user_permissions (
  user_id BIGINT UNSIGNED NOT NULL,
  perm_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (user_id, perm_id),
  CONSTRAINT fk_user_permissions_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_user_permissions_perm FOREIGN KEY (perm_id) REFERENCES permissions(perm_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Permissões por papel (role)
CREATE TABLE role_permissions (
  role_id BIGINT UNSIGNED NOT NULL,
  perm_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (role_id, perm_id),
  CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE,
  CONSTRAINT fk_role_permissions_perm FOREIGN KEY (perm_id) REFERENCES permissions(perm_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 2) TABELAS DE CHAMADOS
CREATE TABLE tickets (
  ticket_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  subject VARCHAR(200) NOT NULL,
  description TEXT NULL,
  status ENUM('Aberto','Em andamento','Fechado','Cancelado') NOT NULL DEFAULT 'Aberto',
  priority ENUM('Baixa','Média','Alta','Crítica') DEFAULT 'Média',
  opened_by BIGINT UNSIGNED NOT NULL,
  assigned_to BIGINT UNSIGNED NULL,
  opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tickets_opened_by FOREIGN KEY (opened_by) REFERENCES users(user_id),
  CONSTRAINT fk_tickets_assigned_to FOREIGN KEY (assigned_to) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE ticket_comments (
  comment_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  ticket_id BIGINT UNSIGNED NOT NULL,
  author_id BIGINT UNSIGNED NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_comments_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(ticket_id) ON DELETE CASCADE,
  CONSTRAINT fk_comments_author FOREIGN KEY (author_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE ticket_history (
  hist_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  ticket_id BIGINT UNSIGNED NOT NULL,
  actor_id BIGINT UNSIGNED NOT NULL,
  action VARCHAR(64) NOT NULL, -- e.g. CREATED, ASSIGNED, STATUS_CHANGE
  from_status VARCHAR(32) NULL,
  to_status VARCHAR(32) NULL,
  from_assignee BIGINT UNSIGNED NULL,
  to_assignee BIGINT UNSIGNED NULL,
  note VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_hist_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(ticket_id) ON DELETE CASCADE,
  CONSTRAINT fk_hist_actor FOREIGN KEY (actor_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

-- 3) ÍNDICES ÚTEIS
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_assigned ON tickets(assigned_to);
CREATE INDEX idx_tickets_opened_by ON tickets(opened_by);

-- 4) DADOS INICIAIS
INSERT INTO roles (role_name) VALUES ('ADMIN'), ('AGENTE'), ('USUARIO');

INSERT INTO permissions (perm_code, description) VALUES
  ('ASSIGN_OTHERS', 'Atribuir chamados a outros agentes'),
  ('RESPOND_OTHERS', 'Responder chamados atribuídos a outros agentes'),
  ('REASSIGN_TICKETS', 'Desatribuir/Reatribuir chamados entre agentes'),
  ('MANAGE_USERS', 'Criar/Excluir usuários'),
  ('CHANGE_ROLES', 'Alterar papéis de usuários');

-- Admin por padrão tem todas as permissões
INSERT INTO role_permissions (role_id, perm_id)
SELECT r.role_id, p.perm_id FROM roles r CROSS JOIN permissions p WHERE r.role_name = 'ADMIN';

-- 5) FUNÇÃO DE HASH (SHA2 + SALT + ITERAÇÕES) - Protótipo
DROP FUNCTION IF EXISTS fn_hash_password;
DELIMITER //
CREATE FUNCTION fn_hash_password(p_plain VARCHAR(1024), p_salt VARBINARY(16), p_iterations INT)
RETURNS VARBINARY(64)
DETERMINISTIC
BEGIN
  DECLARE i INT DEFAULT 0;
  DECLARE dig VARBINARY(64);
  SET dig = SHA2(CONCAT(p_salt, p_plain), 256);
  WHILE i < p_iterations DO
    SET dig = SHA2(CONCAT(p_salt, dig), 256);
    SET i = i + 1;
  END WHILE;
  RETURN dig;
END//
DELIMITER ;

-- 6) PROCEDURES (USUÁRIOS)
DROP PROCEDURE IF EXISTS sp_create_user;
DELIMITER //
CREATE PROCEDURE sp_create_user(
  IN p_full_name VARCHAR(120),
  IN p_email VARCHAR(160),
  IN p_plain_password VARCHAR(1024),
  IN p_role_name VARCHAR(32) -- 'USUARIO' por default no app
)
BEGIN
  DECLARE v_salt VARBINARY(16);
  DECLARE v_iters INT DEFAULT 10000;
  DECLARE v_hash VARBINARY(64);
  DECLARE v_user_id BIGINT UNSIGNED;
  DECLARE v_role_id BIGINT UNSIGNED;

  IF EXISTS (SELECT 1 FROM users WHERE email = p_email) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'E-mail já cadastrado';
  END IF;

  SET v_salt = UNHEX(REPLACE(UUID(),'-',''));
  SET v_hash = fn_hash_password(p_plain_password, v_salt, v_iters);

  INSERT INTO users(full_name, email, password_hash, password_salt, password_iterations)
  VALUES (p_full_name, p_email, v_hash, v_salt, v_iters);

  SET v_user_id = LAST_INSERT_ID();

  SELECT role_id INTO v_role_id FROM roles WHERE role_name = COALESCE(p_role_name, 'USUARIO');
  IF v_role_id IS NULL THEN
    SELECT role_id INTO v_role_id FROM roles WHERE role_name = 'USUARIO';
  END IF;
  INSERT INTO user_roles(user_id, role_id) VALUES (v_user_id, v_role_id);
END//
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_set_password;
DELIMITER //
CREATE PROCEDURE sp_set_password(
  IN p_user_id BIGINT UNSIGNED,
  IN p_new_plain_password VARCHAR(1024)
)
BEGIN
  DECLARE v_salt VARBINARY(16);
  DECLARE v_iters INT DEFAULT 10000;
  DECLARE v_hash VARBINARY(64);

  SET v_salt = UNHEX(REPLACE(UUID(),'-',''));
  SET v_hash = fn_hash_password(p_new_plain_password, v_salt, v_iters);

  UPDATE users
     SET password_hash = v_hash,
         password_salt = v_salt,
         password_iterations = v_iters
   WHERE user_id = p_user_id;
END//
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_authenticate;
DELIMITER //
CREATE PROCEDURE sp_authenticate(
  IN  p_email          VARCHAR(160),
  IN  p_plain_password VARCHAR(1024),
  OUT p_user_id        BIGINT UNSIGNED
)
BEGIN
  DECLARE v_salt    VARBINARY(16);
  DECLARE v_iters   INT;
  DECLARE v_hash    VARBINARY(64);
  DECLARE v_stored  VARBINARY(64);
  DECLARE v_nf      BOOL DEFAULT FALSE;

  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_nf = TRUE;

  SET p_user_id = NULL;

  SELECT password_salt, password_iterations, password_hash
    INTO v_salt, v_iters, v_stored
    FROM users
    WHERE email = p_email AND is_active = 1
    LIMIT 1;

  IF v_nf OR v_salt IS NULL THEN
    SET p_user_id = NULL;
  ELSE
    SET v_hash = fn_hash_password(p_plain_password, v_salt, v_iters);
    IF v_hash = v_stored THEN
      SELECT user_id INTO p_user_id FROM users WHERE email = p_email LIMIT 1;
    END IF;
  END IF;
END//
DELIMITER ;

-- 7) PROCEDURES (PAPÉIS & PERMISSÕES)
DROP PROCEDURE IF EXISTS sp_grant_role;
DELIMITER //
CREATE PROCEDURE sp_grant_role(IN p_user_id BIGINT UNSIGNED, IN p_role_name VARCHAR(32))
BEGIN
  DECLARE v_role_id BIGINT UNSIGNED;
  SELECT role_id INTO v_role_id FROM roles WHERE role_name = p_role_name;
  IF v_role_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Papel inexistente';
  END IF;
  INSERT IGNORE INTO user_roles(user_id, role_id) VALUES (p_user_id, v_role_id);
END//
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_revoke_role;
DELIMITER //
CREATE PROCEDURE sp_revoke_role(IN p_user_id BIGINT UNSIGNED, IN p_role_name VARCHAR(32))
BEGIN
  DECLARE v_role_id BIGINT UNSIGNED;
  SELECT role_id INTO v_role_id FROM roles WHERE role_name = p_role_name;
  DELETE FROM user_roles WHERE user_id = p_user_id AND role_id = v_role_id;
END//
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_grant_permission;
DELIMITER //
CREATE PROCEDURE sp_grant_permission(IN p_user_id BIGINT UNSIGNED, IN p_perm_code VARCHAR(64))
BEGIN
  DECLARE v_perm_id BIGINT UNSIGNED;
  SELECT perm_id INTO v_perm_id FROM permissions WHERE perm_code = p_perm_code;
  IF v_perm_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Permissão inexistente';
  END IF;
  INSERT IGNORE INTO user_permissions(user_id, perm_id) VALUES (p_user_id, v_perm_id);
END//
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_revoke_permission;
DELIMITER //
CREATE PROCEDURE sp_revoke_permission(IN p_user_id BIGINT UNSIGNED, IN p_perm_code VARCHAR(64))
BEGIN
  DECLARE v_perm_id BIGINT UNSIGNED;
  SELECT perm_id INTO v_perm_id FROM permissions WHERE perm_code = p_perm_code;
  DELETE FROM user_permissions WHERE user_id = p_user_id AND perm_id = v_perm_id;
END//
DELIMITER ;

-- 8) VIEW DE PERMISSÕES EFETIVAS (papel + grants diretos)
DROP VIEW IF EXISTS v_user_effective_permissions;
CREATE VIEW v_user_effective_permissions AS
SELECT u.user_id, p.perm_code
FROM users u
JOIN user_roles ur ON ur.user_id = u.user_id
JOIN role_permissions rp ON rp.role_id = ur.role_id
JOIN permissions p ON p.perm_id = rp.perm_id
UNION
SELECT u.user_id, p.perm_code
FROM users u
JOIN user_permissions up ON up.user_id = u.user_id
JOIN permissions p ON p.perm_id = up.perm_id;

-- 9) PROCEDURES (TICKETS)
DROP PROCEDURE IF EXISTS sp_create_ticket;
DELIMITER //
CREATE PROCEDURE sp_create_ticket(
  IN p_subject VARCHAR(200),
  IN p_description TEXT,
  IN p_opened_by BIGINT UNSIGNED,
  IN p_priority ENUM('Baixa','Média','Alta','Crítica')
)
BEGIN
  INSERT INTO tickets(subject, description, opened_by, priority)
  VALUES (p_subject, p_description, p_opened_by, p_priority);
  INSERT INTO ticket_history(ticket_id, actor_id, action, note)
  VALUES (LAST_INSERT_ID(), p_opened_by, 'CREATED', 'Ticket criado');
END//
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_assign_ticket;
DELIMITER //
CREATE PROCEDURE sp_assign_ticket(
  IN p_ticket_id BIGINT UNSIGNED,
  IN p_actor_id BIGINT UNSIGNED,
  IN p_assignee_id BIGINT UNSIGNED
)
BEGIN
  DECLARE v_prev BIGINT UNSIGNED;
  SELECT assigned_to INTO v_prev FROM tickets WHERE ticket_id = p_ticket_id;
  UPDATE tickets SET assigned_to = p_assignee_id WHERE ticket_id = p_ticket_id;
  INSERT INTO ticket_history(ticket_id, actor_id, action, from_assignee, to_assignee, note)
  VALUES (p_ticket_id, p_actor_id, 'ASSIGNED', v_prev, p_assignee_id, 'Atribuição alterada');
END//
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_update_ticket_status;
DELIMITER //
CREATE PROCEDURE sp_update_ticket_status(
  IN p_ticket_id BIGINT UNSIGNED,
  IN p_actor_id BIGINT UNSIGNED,
  IN p_new_status ENUM('Aberto','Em andamento','Fechado','Cancelado')
)
BEGIN
  DECLARE v_prev VARCHAR(32);
  SELECT status INTO v_prev FROM tickets WHERE ticket_id = p_ticket_id;
  UPDATE tickets SET status = p_new_status WHERE ticket_id = p_ticket_id;
  INSERT INTO ticket_history(ticket_id, actor_id, action, from_status, to_status, note)
  VALUES (p_ticket_id, p_actor_id, 'STATUS_CHANGE', v_prev, p_new_status, 'Status alterado');
END//
DELIMITER ;

-- 10) SEED ADMIN
CALL sp_create_user('Administrador', 'admin@local', '123456', 'ADMIN');

-- volta delimitador
DELIMITER ;


use chamados;

show tables;

select * from users;
