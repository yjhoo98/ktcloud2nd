import { query } from './db.js';

const REFRESH_INTERVAL_SECONDS = 5;
const DELAY_WARNING_SECONDS = 15;
const OFFLINE_THRESHOLD_SECONDS = 60;
const IDLE_WARNING_SECONDS = 60;

const STATUS_META = {
  driving: {
    key: 'driving',
    label: '운행 중',
    color: '#2f6b8a'
  },
  engine_off: {
    key: 'engine_off',
    label: '시동 꺼짐',
    color: '#8fd2ee'
  },
  stopped: {
    key: 'stopped',
    label: '정차',
    color: '#f3a145'
  },
  offline: {
    key: 'offline',
    label: '오프라인',
    color: '#d054bf'
  },
  no_data: {
    key: 'no_data',
    label: '데이터 없음',
    color: '#c9d3e3'
  }
};

const FUEL_BUCKETS = [
  { key: 'ample', label: '여유', color: '#8fd2ee', min: 60, max: Number.POSITIVE_INFINITY },
  { key: 'normal', label: '보통', color: '#7fb069', min: 30, max: 60 },
  { key: 'low', label: '주의', color: '#f3c15d', min: 10, max: 30 },
  { key: 'critical', label: '위험', color: '#e06b5f', min: Number.NEGATIVE_INFINITY, max: 10 }
];

function formatDateTime(epochSeconds) {
  if (!epochSeconds) {
    return '-';
  }

  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
    .format(new Date(Number(epochSeconds) * 1000))
    .replace(',', '');
}

function toEpochSeconds(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return null;
  }

  return numeric > 10_000_000_000 ? Math.floor(numeric / 1000) : Math.floor(numeric);
}

function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function formatCoordinate(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(5) : '-';
}

function formatLocationLabel(lat, lon) {
  if (lat === null || lat === undefined || lon === null || lon === undefined) {
    return '위치 정보 없음';
  }

  const latValue = Number(lat);
  const lonValue = Number(lon);

  if (!Number.isFinite(latValue) || !Number.isFinite(lonValue)) {
    return '위치 정보 없음';
  }

  return `${formatCoordinate(latValue)}, ${formatCoordinate(lonValue)}`;
}

function compareVehicleIds(left, right) {
  return String(left).localeCompare(String(right), 'en', {
    numeric: true,
    sensitivity: 'base'
  });
}

function resolveVehicleStatus(row, nowSeconds) {
  const timestampSeconds = toEpochSeconds(row.timestamp);
  const delaySeconds =
    timestampSeconds === null ? null : Math.max(0, nowSeconds - timestampSeconds);
  const engineOn = Boolean(row.engineOn);
  const speed = Math.max(0, Math.round(toFiniteNumber(row.speed)));
  const mode = Number(row.mode);

  if (timestampSeconds === null) {
    return {
      ...STATUS_META.no_data,
      delaySeconds,
      timestampSeconds
    };
  }

  if (delaySeconds >= OFFLINE_THRESHOLD_SECONDS) {
    return {
      ...STATUS_META.offline,
      delaySeconds,
      timestampSeconds
    };
  }

  if (!engineOn || mode === 3) {
    return {
      ...STATUS_META.engine_off,
      delaySeconds,
      timestampSeconds
    };
  }

  if (speed > 0 || mode === 1) {
    return {
      ...STATUS_META.driving,
      delaySeconds,
      timestampSeconds
    };
  }

  return {
    ...STATUS_META.stopped,
    delaySeconds,
    timestampSeconds
  };
}

function buildFuelSummary(rows) {
  const counts = new Map(FUEL_BUCKETS.map((bucket) => [bucket.key, 0]));
  let trackedVehicles = 0;

  rows.forEach((row) => {
    const fuelLevel = toFiniteNumber(row.fuelLevel, NaN);

    if (!Number.isFinite(fuelLevel)) {
      return;
    }

    trackedVehicles += 1;

    const bucket = FUEL_BUCKETS.find(
      (candidate) => fuelLevel >= candidate.min && fuelLevel < candidate.max
    );

    if (bucket) {
      counts.set(bucket.key, counts.get(bucket.key) + 1);
    }
  });

  const totalTrackedVehicles = trackedVehicles;

  return {
    totalTrackedVehicles,
    items: FUEL_BUCKETS.map((bucket) => {
      const value = counts.get(bucket.key) || 0;

      return {
        key: bucket.key,
        label: bucket.label,
        value,
        color: bucket.color,
        ratio: totalTrackedVehicles ? Number(((value / totalTrackedVehicles) * 100).toFixed(1)) : 0
      };
    })
  };
}

function buildStatusBreakdown(rows) {
  const counts = {
    driving: 0,
    engine_off: 0,
    stopped: 0,
    offline: 0,
    no_data: 0
  };

  rows.forEach((row) => {
    counts[row.status] += 1;
  });

  const totalTrackedVehicles =
    counts.driving + counts.engine_off + counts.stopped;

  return {
    totalTrackedVehicles,
    items: Object.values(STATUS_META).map((meta) => {
      const value = counts[meta.key] || 0;

      return {
        key: meta.key,
        label: meta.label,
        value,
        color: meta.color,
        ratio: totalTrackedVehicles ? Number(((value / totalTrackedVehicles) * 100).toFixed(1)) : 0
      };
    })
  };
}

function formatVehicleRow(row, nowSeconds) {
  const status = resolveVehicleStatus(row, nowSeconds);
  const hasTelemetry = status.timestampSeconds !== null;
  const fuelLevel =
    row.fuelLevel === null || row.fuelLevel === undefined
      ? null
      : Number(toFiniteNumber(row.fuelLevel, 0).toFixed(1));
  const speed =
    row.speed === null || row.speed === undefined
      ? null
      : Math.max(0, Math.round(toFiniteNumber(row.speed, 0)));

  return {
    vehicleId: row.vehicleId,
    status: status.key,
    statusLabel: status.label,
    statusColor: status.color,
    speed,
    fuelLevel,
    engineOn: hasTelemetry ? Boolean(row.engineOn) : null,
    mode: row.mode === null || row.mode === undefined ? null : Number(row.mode),
    lastUpdatedAt: formatDateTime(status.timestampSeconds),
    timestampSeconds: status.timestampSeconds,
    delaySeconds: status.delaySeconds,
    locationLabel: formatLocationLabel(row.lat, row.lon),
    isDelayed:
      status.timestampSeconds !== null &&
      status.delaySeconds >= DELAY_WARNING_SECONDS &&
      status.key !== 'offline'
  };
}

function buildSummary(rows) {
  return rows.reduce(
    (summary, row) => {
      summary.totalVehicles += 1;

      if (row.status === 'driving') {
        summary.drivingVehicles += 1;
      } else if (row.status === 'engine_off') {
        summary.engineOffVehicles += 1;
      } else if (row.status === 'stopped') {
        summary.stoppedVehicles += 1;
      } else if (row.status === 'offline') {
        summary.offlineVehicles += 1;
      } else if (row.status === 'no_data') {
        summary.noDataVehicles += 1;
      }

      return summary;
    },
    {
      totalVehicles: 0,
      drivingVehicles: 0,
      engineOffVehicles: 0,
      stoppedVehicles: 0,
      offlineVehicles: 0,
      noDataVehicles: 0
    }
  );
}

function buildDelayedVehicles(rows) {
  return rows
    .filter(
      (row) =>
        row.status !== 'no_data' &&
        row.delaySeconds !== null &&
        row.delaySeconds >= DELAY_WARNING_SECONDS
    )
    .sort((left, right) => {
      const diff = (right.delaySeconds || 0) - (left.delaySeconds || 0);
      return diff !== 0 ? diff : compareVehicleIds(left.vehicleId, right.vehicleId);
    })
    .slice(0, 12)
    .map((row) => ({
      vehicleId: row.vehicleId,
      status: row.status,
      statusLabel: row.statusLabel,
      statusColor: row.statusColor,
      delaySeconds: row.delaySeconds,
      delayLabel:
        row.delaySeconds === null ? '-' : `${Math.floor(row.delaySeconds / 60)}m ${row.delaySeconds % 60}s`,
      fuelLevel: row.fuelLevel,
      lastUpdatedAt: row.lastUpdatedAt
    }));
}

function buildIdleVehicles(rows, latestByVehicleId, nowSeconds) {
  const idleVehicles = [];

  rows.forEach((row) => {
    const latest = latestByVehicleId.get(row.vehicleId);

    if (!latest || !latest.length) {
      return;
    }

    const latestVehicle = latest[0];
    const latestStatus = resolveVehicleStatus(latestVehicle, nowSeconds);

    if (latestStatus.key === 'offline' || latestStatus.key === 'engine_off') {
      return;
    }

    let streakStart = null;

    for (const record of latest) {
      if (!record.engineOn || toFiniteNumber(record.speed, 0) > 0) {
        break;
      }

      streakStart = toEpochSeconds(record.timestamp);
    }

    if (streakStart === null || latestStatus.timestampSeconds === null) {
      return;
    }

    const idleSeconds = Math.max(0, latestStatus.timestampSeconds - streakStart);

    if (idleSeconds < IDLE_WARNING_SECONDS) {
      return;
    }

    idleVehicles.push({
      vehicleId: row.vehicleId,
      idleSeconds,
      idleMinutes: Number((idleSeconds / 60).toFixed(1)),
      fuelLevel: row.fuelLevel,
      lastUpdatedAt: row.lastUpdatedAt,
      locationLabel: row.locationLabel
    });
  });

  return idleVehicles
    .sort((left, right) => {
      const diff = right.idleSeconds - left.idleSeconds;
      return diff !== 0 ? diff : compareVehicleIds(left.vehicleId, right.vehicleId);
    })
    .slice(0, 8);
}

export async function loadOperatorVehicleDashboard() {
  const nowSeconds = Math.floor(Date.now() / 1000);

  const [latestVehiclesResult, recentStatsResult] = await Promise.all([
    query(`
      WITH vehicle_ids AS (
        SELECT vehicle_id FROM vehicle_master
        UNION
        SELECT DISTINCT vehicle_id FROM vehicle_stats
      ),
      latest_stats AS (
        SELECT
          vehicle_id AS "vehicleId",
          timestamp,
          lat,
          lon,
          speed,
          engine_on AS "engineOn",
          fuel_level AS "fuelLevel",
          event_type AS "eventType",
          mode,
          ROW_NUMBER() OVER (
            PARTITION BY vehicle_id
            ORDER BY timestamp DESC, id DESC
          ) AS row_number
        FROM vehicle_stats
      )
      SELECT
        ids.vehicle_id AS "vehicleId",
        stats.timestamp,
        stats.lat,
        stats.lon,
        stats.speed,
        stats."engineOn",
        stats."fuelLevel",
        stats."eventType",
        stats.mode
      FROM vehicle_ids ids
      LEFT JOIN latest_stats stats
        ON stats."vehicleId" = ids.vehicle_id
       AND stats.row_number = 1
      ORDER BY ids.vehicle_id ASC
    `),
    query(`
      WITH ranked_stats AS (
        SELECT
          vehicle_id AS "vehicleId",
          timestamp,
          speed,
          engine_on AS "engineOn",
          ROW_NUMBER() OVER (
            PARTITION BY vehicle_id
            ORDER BY timestamp DESC, id DESC
          ) AS row_number
        FROM vehicle_stats
      )
      SELECT
        "vehicleId",
        timestamp,
        speed,
        "engineOn"
      FROM ranked_stats
      WHERE row_number <= 24
      ORDER BY "vehicleId" ASC, timestamp DESC
    `)
  ]);

  const latestRows = latestVehiclesResult.rows.map((row) => formatVehicleRow(row, nowSeconds));
  const latestByVehicleId = new Map();

  recentStatsResult.rows.forEach((row) => {
    if (!latestByVehicleId.has(row.vehicleId)) {
      latestByVehicleId.set(row.vehicleId, []);
    }

    latestByVehicleId.get(row.vehicleId).push(row);
  });

  const sortedVehicleTable = [...latestRows].sort((left, right) => {
    const statusPriority = {
      no_data: 0,
      offline: 1,
      driving: 2,
      stopped: 3,
      engine_off: 4
    };
    const priorityDiff = statusPriority[left.status] - statusPriority[right.status];

    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return compareVehicleIds(left.vehicleId, right.vehicleId);
  });

  return {
    generatedAt: formatDateTime(nowSeconds),
    refreshIntervalSeconds: REFRESH_INTERVAL_SECONDS,
    thresholds: {
      delayedSeconds: DELAY_WARNING_SECONDS,
      offlineSeconds: OFFLINE_THRESHOLD_SECONDS,
      idleSeconds: IDLE_WARNING_SECONDS
    },
    summary: buildSummary(latestRows),
    statusBreakdown: buildStatusBreakdown(latestRows),
    fuelSummary: buildFuelSummary(latestRows),
    vehicleTable: sortedVehicleTable,
    delayedVehicles: buildDelayedVehicles(latestRows),
    idleVehicles: buildIdleVehicles(latestRows, latestByVehicleId, nowSeconds)
  };
}
