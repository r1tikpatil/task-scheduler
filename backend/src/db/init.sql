CREATE TABLE api_clients (
    api_key VARCHAR(255) PRIMARY KEY,
    client_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tasks (
    id CHAR(36) PRIMARY KEY,

    client_id VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    priority TINYINT NOT NULL CHECK (priority BETWEEN 1 AND 5),
    payload JSON,

    status ENUM(
        'QUEUED',
        'RUNNING',
        'COMPLETED',
        'FAILED',
        'CANCELLED',
        'DEAD_LETTER'
    ) NOT NULL DEFAULT 'QUEUED',

    retries INT NOT NULL DEFAULT 0,
    error_message TEXT NULL,
    worker_id VARCHAR(64) NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_status_created (status, created_at),
    INDEX idx_client_created (client_id, created_at),
    INDEX idx_type_status (type, status),
    INDEX idx_priority_created (priority, created_at),
    INDEX idx_created_at (created_at),

    CONSTRAINT fk_tasks_client
        FOREIGN KEY (client_id) REFERENCES api_clients(api_key)
);

CREATE TABLE dead_letter_tasks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    task_id CHAR(36) NOT NULL,
    reason TEXT NOT NULL,
    retry_count INT NOT NULL DEFAULT 0,

    failed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_task_id (task_id),

    CONSTRAINT fk_dlq_task
        FOREIGN KEY (task_id) REFERENCES tasks(id)
        ON DELETE CASCADE
);

INSERT INTO api_clients (api_key, client_name) VALUES
    ('ak_client_alpha_001', 'Alpha Corp'),
    ('ak_client_beta_002', 'Beta Analytics'),
    ('ak_client_gamma_003', 'Gamma Labs'),
    ('ak_client_delta_004', 'Delta Systems'),
    ('ak_client_epsilon_005', 'Epsilon Media');
