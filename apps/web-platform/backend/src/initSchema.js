import { query } from './db.js';
import { hashPassword, readTrimmedEnv } from './authSecurity.js';

const defaultModelCodes = [
  { code: 1, modelName: 'Avante', imageUrl: '/models/avante.png' },
  { code: 2, modelName: 'Grandeur', imageUrl: '/models/grandeur.png' },
  { code: 3, modelName: 'Santafe', imageUrl: '/models/santafe.png' },
  { code: 4, modelName: 'Tucson', imageUrl: '/models/tucson.png' }
];

const defaultAccounts = [
  { userId: 'user01', password: 'pass01!', role: 'user', userName: '강동훈', vehicleId: 'car_1', modelCode: 1 },
  { userId: 'user02', password: 'pass02!', role: 'user', userName: '이정수', vehicleId: 'car_2', modelCode: 2 },
  { userId: 'user03', password: 'pass03!', role: 'user', userName: '박서현', vehicleId: 'car_3', modelCode: 3 },
  { userId: 'user04', password: 'pass04!', role: 'user', userName: '최윤지', vehicleId: 'car_4', modelCode: 4 },
  { userId: 'admin01', password: 'admin01!', role: 'operator', userName: '최민수', vehicleId: null, modelCode: null }
];

function isTruthy(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

function shouldSeedDefaultAccounts() {
  const explicitSetting = readTrimmedEnv('ENABLE_DEV_SEED_ACCOUNTS');

  if (explicitSetting) {
    return isTruthy(explicitSetting);
  }

  return readTrimmedEnv('NODE_ENV', 'development').toLowerCase() !== 'production';
}

export async function initSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS model_codes (
      code INT PRIMARY KEY,
      model_name VARCHAR(50) NOT NULL,
      image_url TEXT
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS accounts (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(50) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'operator')),
      user_name VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS vehicle_master (
      id SERIAL PRIMARY KEY,
      vehicle_id VARCHAR(50) NOT NULL UNIQUE,
      model_code INT REFERENCES model_codes(code)
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS user_vehicle_mapping (
      id SERIAL PRIMARY KEY,
      account_id INT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      vehicle_id VARCHAR(50) NOT NULL REFERENCES vehicle_master(vehicle_id) ON DELETE CASCADE,
      UNIQUE (account_id, vehicle_id)
    );
  `);

  await query(`
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
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_vehicle_timestamp
    ON vehicle_stats (vehicle_id, timestamp DESC);
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS vehicle_anomaly_alerts (
      id BIGSERIAL PRIMARY KEY,
      vehicle_id VARCHAR(50) NOT NULL,
      anomaly_type VARCHAR(50) NOT NULL,
      description VARCHAR(255),
      evidence VARCHAR(255),
      occurred_at BIGINT NOT NULL
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_vehicle_anomaly_alerts_occurred_at
    ON vehicle_anomaly_alerts (occurred_at DESC);
  `);

  await query(`
    INSERT INTO accounts (user_id, password_hash, role, user_name)
    SELECT user_id, password_hash, 'user', user_name
    FROM user_accounts
    ON CONFLICT (user_id) DO NOTHING;
  `).catch(() => {});

  await query(`
    INSERT INTO accounts (user_id, password_hash, role, user_name)
    SELECT user_id, password_hash, 'operator', user_name
    FROM operator_accounts
    ON CONFLICT (user_id) DO NOTHING;
  `).catch(() => {});

  await query(`
    ALTER TABLE user_vehicle_mapping
    ADD COLUMN IF NOT EXISTS account_id INT;
  `);

  await query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'user_vehicle_mapping'
          AND column_name = 'user_account_id'
      ) THEN
        UPDATE user_vehicle_mapping uvm
        SET account_id = a.id
        FROM user_accounts ua
        JOIN accounts a ON a.user_id = ua.user_id
        WHERE uvm.user_account_id = ua.id
          AND uvm.account_id IS NULL;
      END IF;
    END $$;
  `);

  await query(`
    DELETE FROM user_vehicle_mapping uvm
    WHERE NOT EXISTS (
      SELECT 1
      FROM accounts a
      WHERE a.id = uvm.account_id
    );
  `);

  await query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'user_vehicle_mapping'
          AND column_name = 'user_account_id'
      ) THEN
        ALTER TABLE user_vehicle_mapping DROP CONSTRAINT IF EXISTS user_vehicle_mapping_user_account_id_fkey;
        ALTER TABLE user_vehicle_mapping DROP COLUMN user_account_id;
      END IF;
    END $$;
  `);

  await query(`
    ALTER TABLE user_vehicle_mapping
    ALTER COLUMN account_id SET NOT NULL;
  `);

  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'user_vehicle_mapping_account_id_fkey'
      ) THEN
        ALTER TABLE user_vehicle_mapping
        ADD CONSTRAINT user_vehicle_mapping_account_id_fkey
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;
      END IF;
    END $$;
  `);

  await query(`
    ALTER TABLE user_vehicle_mapping
    DROP CONSTRAINT IF EXISTS user_vehicle_mapping_user_account_id_vehicle_id_key;
  `);

  await query(`
    ALTER TABLE user_vehicle_mapping
    DROP CONSTRAINT IF EXISTS user_vehicle_mapping_account_id_vehicle_id_key;
  `);

  await query(`
    ALTER TABLE user_vehicle_mapping
    ADD CONSTRAINT user_vehicle_mapping_account_id_vehicle_id_key
    UNIQUE (account_id, vehicle_id);
  `);

  for (const model of defaultModelCodes) {
    await query(
      `
        INSERT INTO model_codes (code, model_name, image_url)
        VALUES ($1, $2, $3)
        ON CONFLICT (code) DO UPDATE
        SET model_name = EXCLUDED.model_name,
            image_url = EXCLUDED.image_url;
      `,
      [model.code, model.modelName, model.imageUrl]
    );
  }

  if (shouldSeedDefaultAccounts()) {
    for (const account of defaultAccounts) {
      await query(
        `
          INSERT INTO accounts (user_id, password_hash, role, user_name)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (user_id) DO NOTHING;
        `,
        [account.userId, hashPassword(account.password), account.role, account.userName]
      );

      if (account.role !== 'user') {
        continue;
      }

      await query(
        `
          INSERT INTO vehicle_master (vehicle_id, model_code)
          VALUES ($1, $2)
          ON CONFLICT (vehicle_id) DO NOTHING;
        `,
        [account.vehicleId, account.modelCode]
      );

      await query(
        `
          INSERT INTO user_vehicle_mapping (account_id, vehicle_id)
          SELECT id, $2
          FROM accounts
          WHERE user_id = $1
          ON CONFLICT DO NOTHING;
        `,
        [account.userId, account.vehicleId]
      );
    }
  }
}
