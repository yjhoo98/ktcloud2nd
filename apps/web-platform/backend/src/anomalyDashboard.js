import { query } from './db.js';

const ANOMALY_TYPES = [
  {
    key: 'SUDDEN_DECEL',
    label: '급감속',
    countKey: 'suddenDecelCount',
    color: '#2f6b8a'
  },
  {
    key: 'SUDDEN_ACCEL',
    label: '급가속',
    countKey: 'suddenAccelCount',
    color: '#8fd2ee'
  },
  {
    key: 'LOW_FUEL',
    label: '연료 부족',
    countKey: 'lowFuelCount',
    color: '#f3a145'
  },
  {
    key: 'ABNORMAL_GPS',
    label: 'GPS 이상',
    countKey: 'abnormalGpsCount',
    color: '#6d95e2'
  },
  {
    key: 'DATA_BURST',
    label: '데이터 폭주',
    countKey: 'dataBurstCount',
    color: '#d054bf'
  },
  {
    key: 'MISSING_DATA',
    label: '데이터 미수신',
    countKey: 'missingDataCount',
    color: '#b8de39'
  }
];

const EMPTY_SUMMARY = {
  totalAlerts: 0,
  affectedVehicles: 0,
  suddenDecelCount: 0,
  suddenAccelCount: 0,
  lowFuelCount: 0,
  abnormalGpsCount: 0,
  dataBurstCount: 0,
  missingDataCount: 0
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

function formatSummary(row) {
  const source = row || EMPTY_SUMMARY;

  return {
    totalAlerts: Number(source.totalAlerts || 0),
    affectedVehicles: Number(source.affectedVehicles || 0),
    suddenDecelCount: Number(source.suddenDecelCount || 0),
    suddenAccelCount: Number(source.suddenAccelCount || 0),
    lowFuelCount: Number(source.lowFuelCount || 0),
    abnormalGpsCount: Number(source.abnormalGpsCount || 0),
    dataBurstCount: Number(source.dataBurstCount || 0),
    missingDataCount: Number(source.missingDataCount || 0)
  };
}

function buildBreakdown(summary) {
  const totalTrackedAlerts = ANOMALY_TYPES.reduce(
    (sum, anomalyType) => sum + summary[anomalyType.countKey],
    0
  );

  return {
    totalTrackedAlerts,
    items: ANOMALY_TYPES.map((anomalyType) => {
      const value = summary[anomalyType.countKey];

      return {
        key: anomalyType.key,
        label: anomalyType.label,
        value,
        color: anomalyType.color,
        ratio: totalTrackedAlerts
          ? Number(((value / totalTrackedAlerts) * 100).toFixed(1))
          : 0
      };
    })
  };
}

function formatAlertRecord(row) {
  if (!row) {
    return null;
  }

  const anomalyType =
    ANOMALY_TYPES.find((item) => item.key === row.anomalyType) || null;

  return {
    alertId: row.alertId || null,
    vehicleId: row.vehicleId,
    anomalyType: row.anomalyType,
    anomalyLabel: anomalyType?.label || row.anomalyType || '이상 감지',
    description: row.description || anomalyType?.label || row.anomalyType || '-',
    evidence: row.evidence || '-',
    occurredAtDt: row.occurredAtDt || '-'
  };
}

export async function loadAnomalyDashboard() {
  const [summaryResult, latestAlertResult, recentAlertsResult] = await Promise.all([
    query(`
      SELECT
        COUNT(*)::int AS "totalAlerts",
        COUNT(DISTINCT vehicle_id)::int AS "affectedVehicles",
        COUNT(*) FILTER (WHERE anomaly_type = 'SUDDEN_DECEL')::int AS "suddenDecelCount",
        COUNT(*) FILTER (WHERE anomaly_type = 'SUDDEN_ACCEL')::int AS "suddenAccelCount",
        COUNT(*) FILTER (WHERE anomaly_type = 'LOW_FUEL')::int AS "lowFuelCount",
        COUNT(*) FILTER (WHERE anomaly_type = 'ABNORMAL_GPS')::int AS "abnormalGpsCount",
        COUNT(*) FILTER (WHERE anomaly_type = 'DATA_BURST')::int AS "dataBurstCount",
        COUNT(*) FILTER (WHERE anomaly_type = 'MISSING_DATA')::int AS "missingDataCount"
      FROM vehicle_anomaly_alerts
    `),
    query(`
      SELECT
        id AS "alertId",
        vehicle_id AS "vehicleId",
        anomaly_type AS "anomalyType",
        description,
        evidence,
        TO_CHAR(
          TIMEZONE('Asia/Seoul', TO_TIMESTAMP(occurred_at)),
          'YYYY-MM-DD HH24:MI:SS'
        ) AS "occurredAtDt"
      FROM vehicle_anomaly_alerts
      ORDER BY occurred_at DESC NULLS LAST, id DESC
      LIMIT 1
    `),
    query(`
      SELECT
        id AS "alertId",
        vehicle_id AS "vehicleId",
        anomaly_type AS "anomalyType",
        description,
        evidence,
        TO_CHAR(
          TIMEZONE('Asia/Seoul', TO_TIMESTAMP(occurred_at)),
          'YYYY-MM-DD HH24:MI:SS'
        ) AS "occurredAtDt"
      FROM vehicle_anomaly_alerts
      ORDER BY occurred_at DESC NULLS LAST, id DESC
      LIMIT 5
    `)
  ]);

  const summary = formatSummary(summaryResult.rows[0]);

  return {
    generatedAt: formatDateTime(Math.floor(Date.now() / 1000)),
    summary,
    breakdown: buildBreakdown(summary),
    latestAlert: formatAlertRecord(latestAlertResult.rows[0] || null),
    recentAlerts: recentAlertsResult.rows.map((row) => formatAlertRecord(row)).filter(Boolean)
  };
}
