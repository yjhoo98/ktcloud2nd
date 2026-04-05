import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { fetchOperatorVehicleDashboard } from '../../api/operatorVehicleDashboard';

const REFRESH_INTERVAL_MS = 1000;
const numberFormatter = new Intl.NumberFormat('ko-KR');

const KPI_DISPLAY_ORDER = [
  'totalVehicles',
  'drivingVehicles',
  'stoppedVehicles',
  'engineOffVehicles'
];

const KPI_LABELS = {
  totalVehicles: '전체 차량',
  drivingVehicles: '운행 중 차량',
  stoppedVehicles: '정차 차량',
  engineOffVehicles: '시동 OFF 차량'
};

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: 'driving', label: '운행 중' },
  { value: 'stopped', label: '정차' },
  { value: 'engine_off', label: '시동 OFF' }
];

const STATUS_COLOR_MAP = {
  driving: '#57c2ff',
  stopped: '#6c72ff',
  engine_off: '#cb3cff',
  offline: '#8b5cf6',
  no_data: '#8ea0c7'
};

const operatorTabs = [
  { label: '이상 탐지', path: '/operator/anomaly' },
  { label: '차량 현황', path: '/operator/vehicle' },
  { label: '인프라 모니터링', path: '/operator/infra-service' }
];

const INITIAL_STATUS_ITEMS = [
  { key: 'driving', label: '운행 중', value: 0, ratio: 0, color: '#57c2ff' },
  { key: 'engine_off', label: '시동 OFF', value: 0, ratio: 0, color: '#cb3cff' },
  { key: 'stopped', label: '정차', value: 0, ratio: 0, color: '#6c72ff' },
  { key: 'offline', label: '오프라인', value: 0, ratio: 0, color: '#8b5cf6' },
  { key: 'no_data', label: '데이터 없음', value: 0, ratio: 0, color: '#8ea0c7' }
];

const INITIAL_DASHBOARD = {
  generatedAt: '-',
  latestVehicleUpdatedAt: '-',
  refreshIntervalSeconds: 1,
  summary: {
    totalVehicles: 0,
    drivingVehicles: 0,
    engineOffVehicles: 0,
    stoppedVehicles: 0,
    offlineVehicles: 0,
    noDataVehicles: 0
  },
  statusBreakdown: {
    totalTrackedVehicles: 0,
    items: INITIAL_STATUS_ITEMS
  },
  vehicleTable: [],
  drivingTrend: []
};

function formatCount(value) {
  return numberFormatter.format(Number(value || 0));
}

function formatFuelLevel(value) {
  if (value === null || value === undefined) {
    return '-';
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${numeric.toFixed(1)}%` : '-';
}

function formatSpeed(value) {
  if (value === null || value === undefined) {
    return '-';
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${Math.round(numeric)} km/h` : '-';
}

function getStatusDisplayLabel(statusKey, fallbackLabel) {
  const labelMap = {
    driving: '운행 중',
    stopped: '정차',
    engine_off: '시동 OFF',
    offline: '오프라인',
    no_data: '데이터 없음'
  };

  return labelMap[statusKey] || fallbackLabel;
}

function buildDonutSegments(items, radius) {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  if (!total) {
    return [];
  }

  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return items
    .filter((item) => item.value > 0)
    .map((item) => {
      const length = (circumference * item.value) / total;
      const segment = {
        ...item,
        dashArray: `${length} ${circumference}`,
        dashOffset: -offset
      };

      offset += length;
      return segment;
    });
}

function buildTimeAxisLabels(series, count = 4) {
  if (!series.length) {
    return [];
  }

  return Array.from({ length: count }, (_, index) => {
    const position = count === 1 ? 0 : index / (count - 1);
    const seriesIndex = Math.min(
      Math.round(position * Math.max(series.length - 1, 0)),
      series.length - 1
    );

    return series[seriesIndex]?.label || '-';
  });
}

function buildValueAxisLabels(maxValue) {
  const safeMax = Math.max(0, Number(maxValue) || 0);
  const midpoint = safeMax / 2;

  return [safeMax, midpoint, 0].map((value) =>
    numberFormatter.format(Math.round(value))
  );
}

function buildLinePath(points, width, height, minValue = 0, maxValue = 0) {
  if (points.length === 0) {
    return '';
  }

  const range = Math.max(maxValue - minValue, 1);

  return points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width;
      const clampedValue = Math.min(Math.max(point.value, minValue), maxValue);
      const y = height - ((clampedValue - minValue) / range) * height;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

function buildAreaPath(points, width, height, minValue = 0, maxValue = 0) {
  if (points.length === 0) {
    return '';
  }

  const linePath = buildLinePath(points, width, height, minValue, maxValue);
  return `${linePath} L ${width} ${height} L 0 ${height} Z`;
}

function VehicleStatusDonut({ items }) {
  const radius = 78;
  const coloredItems = items.map((item) => ({
    ...item,
    color: STATUS_COLOR_MAP[item.key] || item.color
  }));
  const segments = buildDonutSegments(coloredItems, radius);
  const trackedTotal = coloredItems.reduce((sum, item) => sum + item.value, 0);
  const orderedItems = [...coloredItems].sort((left, right) => {
    const order = {
      driving: 0,
      stopped: 1,
      engine_off: 2,
      offline: 3,
      no_data: 4
    };

    return (order[left.key] ?? 99) - (order[right.key] ?? 99);
  });

  return (
    <article className="card operator-vehicle-chart-card">
      <div className="operator-vehicle-chart-head">
        <div>
          <p className="operator-vehicle-section-label">차량 상태 분포</p>
        </div>
        <span className="operator-vehicle-chart-total">
          상태 집계 {formatCount(trackedTotal)}대
        </span>
      </div>

      <div className="operator-vehicle-chart-body">
        <div className="operator-vehicle-chart-visual">
          <svg
            viewBox="0 0 220 220"
            className="operator-vehicle-donut"
            role="img"
            aria-label="차량 상태 분포 도넛 차트"
          >
            <circle
              cx="110"
              cy="110"
              r={radius}
              fill="none"
              stroke="rgba(31, 53, 90, 0.10)"
              strokeWidth="30"
            />
            {segments.map((segment) => (
              <circle
                key={segment.key}
                cx="110"
                cy="110"
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth="30"
                strokeDasharray={segment.dashArray}
                strokeDashoffset={segment.dashOffset}
                transform="rotate(-90 110 110)"
              />
            ))}
          </svg>

          <div className="operator-vehicle-donut-center">
            <strong>{formatCount(trackedTotal)}</strong>
            <span>상태 집계</span>
          </div>
        </div>

        <ul className="operator-vehicle-legend">
          {orderedItems.map((item) => (
            <li key={item.key} className="operator-vehicle-legend-item">
              <span
                className="operator-vehicle-legend-swatch"
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
              <span className="operator-vehicle-legend-label">
                {getStatusDisplayLabel(item.key, item.label)}
              </span>
              <div className="operator-vehicle-legend-values">
                <strong>{formatCount(item.value)}</strong>
                <span>{item.ratio.toFixed(1)}%</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

function DrivingTrendCard({ series, maxValue }) {
  const xLabels = useMemo(() => buildTimeAxisLabels(series), [series]);
  const chartMaxValue = Math.max(0, Number(maxValue) || 0);
  const yLabels = useMemo(() => buildValueAxisLabels(chartMaxValue), [chartMaxValue]);
  const points = useMemo(() => {
    if (!series.length) {
      return [];
    }

    const source = series.slice(-60).map((item) => Number(item.value || 0));
    const targetCount = 72;
    const interpolated = Array.from({ length: targetCount }, (_, index) => {
      const position = (index / Math.max(targetCount - 1, 1)) * Math.max(source.length - 1, 0);
      const leftIndex = Math.floor(position);
      const rightIndex = Math.min(leftIndex + 1, source.length - 1);
      const mix = position - leftIndex;
      const leftValue = source[leftIndex] ?? 0;
      const rightValue = source[rightIndex] ?? leftValue;

      return leftValue + (rightValue - leftValue) * mix;
    });

    return interpolated.map((numericValue) => ({ value: numericValue }));
  }, [series]);
  const linePath = useMemo(
    () => buildLinePath(points, 420, 188, 0, chartMaxValue),
    [chartMaxValue, points]
  );
  const areaPath = useMemo(
    () => buildAreaPath(points, 420, 188, 0, chartMaxValue),
    [chartMaxValue, points]
  );

  return (
    <article className="card operator-vehicle-trend-card">
      <div className="operator-vehicle-trend-header">
        <p
          className="operator-vehicle-section-label"
          style={{
            color: '#5a6c88',
            fontSize: '14px',
            fontWeight: 700,
            letterSpacing: '0.03em',
            lineHeight: 1.6,
            margin: 0
          }}
        >
          시간별 운행 차량
        </p>
      </div>
      {linePath ? (
        <div className="user-chart-shell operator-vehicle-trend-shell">
          <div className="user-chart-y-axis operator-vehicle-trend-y-axis-alt">
            {yLabels.map((label, index) => (
              <span key={`driving-y-${label}-${index}`}>{label}</span>
            ))}
          </div>
          <div className="user-chart-main">
            <svg
              viewBox="0 0 420 216"
              className="user-line-chart user-line-chart-fuel-soft operator-vehicle-trend-svg"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="operatorTrendFuelAreaFill" x1="0%" x2="0%" y1="0%" y2="100%">
                  <stop offset="0%" stopColor="#57c2ff" stopOpacity="0.34" />
                  <stop offset="58%" stopColor="#57c2ff" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#151f3a" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <path
                className="operator-vehicle-trend-area"
                d={areaPath}
                style={{ fill: 'url(#operatorTrendFuelAreaFill)', stroke: 'none' }}
              />
              <path
                className="operator-vehicle-trend-line"
                d={linePath}
                style={{ strokeWidth: 1.5 }}
              />
            </svg>
            <div className="user-chart-x-axis">
              {xLabels.map((label, index) => (
                <span key={`driving-x-${index}`}>{label}</span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="user-chart-placeholder">No driving telemetry yet.</div>
      )}
    </article>
  );
}

function VehicleTable({ rows }) {
  return (
    <article className="card operator-vehicle-table-card">
      <div className="operator-vehicle-panel-head">
        <div>
          <p className="operator-vehicle-section-label">운영 현황</p>
          <h2>전체 차량 목록</h2>
        </div>
        <span className="operator-vehicle-panel-badge operator-vehicle-panel-badge-compact">
          {formatCount(rows.length)}대
        </span>
      </div>

      <div className="table-wrap operator-vehicle-table-wrap">
        <table className="operator-vehicle-table">
          <thead>
            <tr>
              <th>차량 ID</th>
              <th>상태</th>
              <th>속도</th>
              <th>연료</th>
              <th>최종 수신</th>
              <th>위치</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={row.vehicleId}>
                  <td>{row.vehicleId}</td>
                  <td>
                    <span className={`operator-vehicle-status-badge is-${row.status}`}>
                      {getStatusDisplayLabel(row.status, row.statusLabel)}
                    </span>
                  </td>
                  <td>{formatSpeed(row.speed)}</td>
                  <td>{formatFuelLevel(row.fuelLevel)}</td>
                  <td>{row.lastUpdatedAt}</td>
                  <td>{row.locationLabel}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="operator-vehicle-empty-cell">
                  아직 표시할 차량 데이터가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function OperatorVehiclePage() {
  const [dashboard, setDashboard] = useState(INITIAL_DASHBOARD);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [vehicleSearchTerm, setVehicleSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const chartItems = dashboard.statusBreakdown.items.filter(
    (item) => item.key !== 'offline' && item.key !== 'no_data'
  );

  const orderedKpiKeys = KPI_DISPLAY_ORDER.filter((key) => key in dashboard.summary);

  const filteredVehicleRows = dashboard.vehicleTable.filter((row) => {
    const matchesSearch = String(row.vehicleId || '')
      .toLowerCase()
      .includes(vehicleSearchTerm.trim().toLowerCase());
    const matchesStatus = statusFilter === 'all' || row.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        const result = await fetchOperatorVehicleDashboard();

        if (cancelled) {
          return;
        }

        setDashboard({
          ...INITIAL_DASHBOARD,
          ...result,
          generatedAt: result.latestVehicleUpdatedAt || result.generatedAt || '-',
          summary: {
            ...INITIAL_DASHBOARD.summary,
            ...result.summary
          },
          statusBreakdown: {
            ...INITIAL_DASHBOARD.statusBreakdown,
            ...result.statusBreakdown,
            items: result.statusBreakdown?.items?.length
              ? result.statusBreakdown.items
              : INITIAL_DASHBOARD.statusBreakdown.items
          },
          vehicleTable: result.vehicleTable?.length ? result.vehicleTable : INITIAL_DASHBOARD.vehicleTable,
          drivingTrend: result.drivingTrend?.length ? result.drivingTrend : INITIAL_DASHBOARD.drivingTrend
        });
        setErrorMessage('');
      } catch (error) {
        if (cancelled) {
          return;
        }

        setErrorMessage(error.message);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadDashboard();
    const intervalId = window.setInterval(loadDashboard, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <DashboardLayout
      role="OPERATOR"
      title="차량 현황 대시보드"
      description=""
      metaContent={
        <div className="operator-vehicle-toolbar">
          <label className="operator-vehicle-toolbar-field is-search">
            차량 ID 검색
            <input
              type="text"
              value={vehicleSearchTerm}
              onChange={(event) => setVehicleSearchTerm(event.target.value)}
              placeholder="예: car_1"
            />
          </label>
          <label className="operator-vehicle-toolbar-field is-filter">
            상태 필터
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              {STATUS_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="operator-vehicle-toolbar-meta">
            데이터 수신 시각 {dashboard.generatedAt}
          </div>
        </div>
      }
      tabs={operatorTabs}
    >
      {errorMessage ? <div className="auth-message error">{errorMessage}</div> : null}

      {isLoading ? (
        <article className="card operator-vehicle-loading-card">
          차량 운영 현황 데이터를 불러오는 중입니다...
        </article>
      ) : null}

      {!isLoading ? (
        <div className="operator-vehicle-shell">
          <section className="operator-vehicle-top-grid">
            <div className="operator-vehicle-kpi-column">
              <div className="operator-vehicle-kpi-grid">
                {orderedKpiKeys.map((key) => (
                  <article key={key} className="card operator-vehicle-kpi-card">
                    <p className="operator-vehicle-kpi-label">{KPI_LABELS[key]}</p>
                    <strong className="operator-vehicle-kpi-value">
                      {formatCount(dashboard.summary[key])}
                    </strong>
                  </article>
                ))}
              </div>

              <section className="operator-vehicle-table-section">
                <VehicleTable rows={filteredVehicleRows} />
              </section>
            </div>

            <div className="operator-vehicle-chart-column">
              <VehicleStatusDonut items={chartItems} />
              <DrivingTrendCard
                series={dashboard.drivingTrend}
                maxValue={dashboard.summary.totalVehicles}
              />
            </div>
          </section>
        </div>
      ) : null}
    </DashboardLayout>
  );
}

export default OperatorVehiclePage;
