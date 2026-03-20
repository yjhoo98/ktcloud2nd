-- Vehicle status serving table
CREATE TABLE vehicle_stats (
    vehicle_id VARCHAR(50) PRIMARY KEY,
    driver_code VARCHAR(50),
    timestamp TIMESTAMP,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    speed INT,
    engine_on BOOLEAN,
    fuel NUMERIC(5,2)
);

-- Recent alert serving table
CREATE TABLE recent_alert (
    alert_id SERIAL PRIMARY KEY,
    vehicle_id VARCHAR(50),
    driver_code VARCHAR(50),
    timestamp TIMESTAMP,
    alert_type VARCHAR(50),
    message TEXT,
    CONSTRAINT recent_alert_unique UNIQUE (vehicle_id, timestamp, alert_type)
);

-- User to vehicle mapping table
CREATE TABLE user_vehicle_mapping (
    driver_code VARCHAR(50),
    vehicle_id VARCHAR(50),
    PRIMARY KEY (driver_code, vehicle_id)
);
