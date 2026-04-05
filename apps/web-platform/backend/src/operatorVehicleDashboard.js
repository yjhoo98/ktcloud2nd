import { query } from './db.js';

const REFRESH_INTERVAL_SECONDS = 5;
const OFFLINE_THRESHOLD_SECONDS = 60;
const DRIVING_TREND_BUCKET_SECONDS = 10;
const DRIVING_TREND_POINTS = 12;
const STATUS_META = {
  driving: {
    key: 'driving',
    label: '운행 중',
    color: '#2f6b8a'
  },
  engine_off: {
    key: 'engine_off',
    label: '시동 OFF',
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

function formatTimeLabel(epochSeconds) {
  if (!epochSeconds) {
    return '-';
  }

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(new Date(Number(epochSeconds) * 1000));
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

function resolveShortLocationLabel(lat, lon) {
  const fallbackLabel = formatLocationLabel(lat, lon);

  if (lat === null || lat === undefined || lon === null || lon === undefined) {
    return fallbackLabel;
  }

  const latValue = Number(lat);
  const lonValue = Number(lon);

  if (!Number.isFinite(latValue) || !Number.isFinite(lonValue)) {
    return fallbackLabel;
  }

  if (latValue < 37.44) {
    if (lonValue < 126.86) return '경기도 김포시 고촌읍';
    if (lonValue < 126.92) return '서울특별시 구로구 오류동';
    if (lonValue < 126.98) return '서울특별시 금천구 가산동';
    if (lonValue < 127.06) return '서울특별시 서초구 양재동';
    if (lonValue < 127.12) return '서울특별시 송파구 문정동';
    return '경기도 성남시 수정구 복정동';
  }

  if (latValue < 37.49) {
    if (lonValue < 126.82) return '서울특별시 강서구 마곡동';
    if (lonValue < 126.88) return '서울특별시 양천구 목동';
    if (lonValue < 126.94) return '서울특별시 영등포구 여의도동';
    if (lonValue < 127.0) return '서울특별시 동작구 사당동';
    if (lonValue < 127.06) return '서울특별시 강남구 역삼동';
    if (lonValue < 127.12) return '서울특별시 송파구 잠실동';
    return '경기도 성남시 분당구 서현동';
  }

  if (latValue < 37.54) {
    if (lonValue < 126.84) return '서울특별시 강서구 화곡동';
    if (lonValue < 126.9) return '서울특별시 영등포구 당산동';
    if (lonValue < 126.96) return '서울특별시 용산구 한강로동';
    if (lonValue < 127.02) return '서울특별시 서초구 서초동';
    if (lonValue < 127.08) return '서울특별시 강남구 삼성동';
    if (lonValue < 127.14) return '서울특별시 송파구 방이동';
    return '경기도 하남시 감일동';
  }

  if (latValue < 37.59) {
    if (lonValue < 126.86) return '서울특별시 마포구 합정동';
    if (lonValue < 126.92) return '서울특별시 서대문구 연희동';
    if (lonValue < 126.98) return '서울특별시 중구 을지로동';
    if (lonValue < 127.04) return '서울특별시 성동구 성수동';
    if (lonValue < 127.1) return '서울특별시 광진구 자양동';
    return '서울특별시 강동구 천호동';
  }

  if (latValue < 37.64) {
    if (lonValue < 126.88) return '서울특별시 은평구 불광동';
    if (lonValue < 126.94) return '서울특별시 서대문구 홍제동';
    if (lonValue < 127.0) return '서울특별시 종로구 혜화동';
    if (lonValue < 127.06) return '서울특별시 성북구 길음동';
    if (lonValue < 127.12) return '서울특별시 중랑구 면목동';
    return '경기도 구리시 인창동';
  }

  if (lonValue < 126.9) return '경기도 고양시 덕양구 행신동';
  if (lonValue < 126.96) return '서울특별시 은평구 진관동';
  if (lonValue < 127.02) return '서울특별시 강북구 수유동';
  if (lonValue < 127.08) return '서울특별시 노원구 상계동';
  if (lonValue < 127.14) return '서울특별시 도봉구 창동';
  return '경기도 남양주시 별내동';
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

  const totalTrackedVehicles = counts.driving + counts.engine_off + counts.stopped;

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
    locationLabel: resolveShortLocationLabel(row.lat, row.lon)
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

async function buildDrivingTrend(nowSeconds) {
  const bucketSize = DRIVING_TREND_BUCKET_SECONDS;
  const bucketEnd = Math.floor(nowSeconds / bucketSize) * bucketSize;
  const bucketStart = bucketEnd - bucketSize * (DRIVING_TREND_POINTS - 1);

  const result = await query(
    `
      WITH buckets AS (
        SELECT generate_series($1::bigint, $2::bigint, $3::bigint) AS bucket_start
      ),
      normalized_stats AS (
        SELECT
          vehicle_id,
          engine_on,
          speed,
          mode,
          CASE
            WHEN timestamp IS NULL THEN NULL
            WHEN timestamp > 10000000000 THEN FLOOR(timestamp / 1000.0)::bigint
            ELSE timestamp::bigint
          END AS ts_seconds
        FROM vehicle_stats
      ),
      bucketed_counts AS (
        SELECT
          (
            FLOOR((ts_seconds - $1::bigint)::numeric / $3::bigint) * $3::bigint
            + $1::bigint
          )::bigint AS bucket_start,
          COUNT(DISTINCT vehicle_id) FILTER (
            WHERE engine_on = TRUE
              AND (COALESCE(speed, 0) > 0 OR mode = 1)
          ) AS driving_count
        FROM normalized_stats
        WHERE ts_seconds IS NOT NULL
          AND ts_seconds >= $1::bigint
          AND ts_seconds < ($2::bigint + $3::bigint)
        GROUP BY 1
      )
      SELECT
        buckets.bucket_start AS "bucketStart",
        COALESCE(bucketed_counts.driving_count, 0) AS "drivingCount"
      FROM buckets
      LEFT JOIN bucketed_counts
        ON bucketed_counts.bucket_start = buckets.bucket_start
      ORDER BY buckets.bucket_start ASC
    `,
    [bucketStart, bucketEnd, bucketSize]
  );

  return result.rows.map((row) => ({
    timestamp: Number(row.bucketStart),
    label: formatTimeLabel(row.bucketStart),
    value: Number(row.drivingCount || 0)
  }));
}

export async function loadOperatorVehicleDashboard() {
  const nowSeconds = Math.floor(Date.now() / 1000);

  const [latestVehiclesResult, drivingTrend] = await Promise.all([
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
            ORDER BY timestamp DESC
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
    buildDrivingTrend(nowSeconds)
  ]);

  const latestRows = latestVehiclesResult.rows.map((row) => formatVehicleRow(row, nowSeconds));

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

  const latestVehicleTimestamp = latestRows.reduce((latest, row) => {
    if (row.timestampSeconds === null || row.timestampSeconds === undefined) {
      return latest;
    }

    return latest === null || row.timestampSeconds > latest
      ? row.timestampSeconds
      : latest;
  }, null);

  return {
    generatedAt: formatDateTime(nowSeconds),
    latestVehicleUpdatedAt: formatDateTime(latestVehicleTimestamp),
    refreshIntervalSeconds: REFRESH_INTERVAL_SECONDS,
    summary: buildSummary(latestRows),
    statusBreakdown: buildStatusBreakdown(latestRows),
    vehicleTable: sortedVehicleTable,
    drivingTrend
  };
}
