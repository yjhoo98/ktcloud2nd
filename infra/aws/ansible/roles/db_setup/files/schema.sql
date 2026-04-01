CREATE TABLE IF NOT EXISTS model_codes (
    code INT PRIMARY KEY,
    model_name VARCHAR(50) NOT NULL,
    image_url TEXT
);

INSERT INTO model_codes (code, model_name, image_url) VALUES
(1, 'Avante', '/models/avante.png'),
(2, 'Grandeur', '/models/grandeur.png'),
(3, 'Santafe', '/models/santafe.png'),
(4, 'Tucson', '/models/tucson.png')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'operator')),
    user_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vehicle_master (
    id SERIAL PRIMARY KEY,
    vehicle_id VARCHAR(50) NOT NULL UNIQUE,
    model_code INT REFERENCES model_codes(code)
);

CREATE TABLE IF NOT EXISTS user_vehicle_mapping (
    id SERIAL PRIMARY KEY,
    account_id INT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    vehicle_id VARCHAR(50) NOT NULL REFERENCES vehicle_master(vehicle_id) ON DELETE CASCADE,
    UNIQUE (account_id, vehicle_id)
);

INSERT INTO accounts (user_id, password_hash, role, user_name) VALUES
('user01', 'pass01!', 'user', '강동훈'),
('user02', 'pass02!', 'user', '이정수'),
('user03', 'pass03!', 'user', '박서현'),
('user04', 'pass04!', 'user', '최윤지'),
('admin01', 'admin01!', 'operator', '최민수')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO vehicle_master (vehicle_id, model_code) VALUES
('car_1', 1),
('car_2', 2),
('car_3', 3),
('car_4', 4)
ON CONFLICT (vehicle_id) DO NOTHING;

INSERT INTO user_vehicle_mapping (account_id, vehicle_id)
SELECT a.id, 'car_1'
FROM accounts a
WHERE a.user_id = 'user01'
ON CONFLICT DO NOTHING;

INSERT INTO user_vehicle_mapping (account_id, vehicle_id)
SELECT a.id, 'car_2'
FROM accounts a
WHERE a.user_id = 'user02'
ON CONFLICT DO NOTHING;

INSERT INTO user_vehicle_mapping (account_id, vehicle_id)
SELECT a.id, 'car_3'
FROM accounts a
WHERE a.user_id = 'user03'
ON CONFLICT DO NOTHING;

INSERT INTO user_vehicle_mapping (account_id, vehicle_id)
SELECT a.id, 'car_4'
FROM accounts a
WHERE a.user_id = 'user04'
ON CONFLICT DO NOTHING;

-- 정제 데이터 테이블 (기존과 동일, 호환 완료)
CREATE TABLE IF NOT EXISTS vehicle_stats (
    id SERIAL PRIMARY KEY,
    vehicle_id VARCHAR(50) NOT NULL,
    timestamp BIGINT NOT NULL,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    speed INT,
    engine_on BOOLEAN,
    fuel_level NUMERIC(5, 2),
    event_type INT,
    mode INT
);

CREATE INDEX IF NOT EXISTS idx_vehicle_timestamp ON vehicle_stats(vehicle_id, timestamp DESC);

-- 이상 탐지 알람 테이블 (프로세서 코드의 'evidence' 필드와 호환되도록 수정)
CREATE TABLE IF NOT EXISTS vehicle_anomaly_alerts (
    id SERIAL PRIMARY KEY,
    alert_time BIGINT NOT NULL,       -- 서버 감지 시각 (alert_time)
    vehicle_id VARCHAR(50) NOT NULL,  -- 대상 차량 (vehicle_id)
    anomaly_type VARCHAR(100),        -- 이상 종류 (anomaly_type)
    description TEXT,                 -- 상황 제목 (description)
    evidence VARCHAR(255),            -- 핵심 수치 증거 (evidence)
    occurred_at BIGINT                -- 실제 발생 시각 (occurred_at)
);

CREATE INDEX IF NOT EXISTS idx_anomaly_type ON vehicle_anomaly_alerts(anomaly_type);
