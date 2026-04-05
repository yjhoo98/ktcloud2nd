import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { fetchOperatorVehicleDashboard } from '../../api/operatorVehicleDashboard';

const REFRESH_INTERVAL_MS = 1 * 1000;
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
  { value: 'engine_off', label: '시동 꺼짐' }
];

const operatorTabs = [
  { label: '이상 탐지', path: '/operator/anomaly' },
  { label: '차량 현황', path: '/operator/vehicle' },
  { label: '인프라 모니터링', path: '/operator/infra-service' }
];

const KPI_ITEMS = [
  {
    key: 'totalVehicles',
    label: '전체 차량 수',
    helper: '최근 수집 기준 전체 추적 차량'
  },
  {
    key: 'drivingVehicles',
    label: '운행 중 차량 수',
    helper: '주행 데이터가 확인된 차량'
  },
  {
    key: 'engineOffVehicles',
    label: '시동 꺼짐 차량 수',
    helper: '엔진 OFF 상태 차량'
  },
  {
    key: 'stoppedVehicles',
    label: '정차 차량 수',
    helper: '엔진 ON 상태 정차 차량'
  }
];

const INITIAL_STATUS_ITEMS = [
  { key: 'driving', label: '운행 중', value: 0, ratio: 0, color: '#2f6b8a' },
  { key: 'engine_off', label: '시동 꺼짐', value: 0, ratio: 0, color: '#8fd2ee' },
  { key: 'stopped', label: '정차', value: 0, ratio: 0, color: '#f3a145' },
  { key: 'offline', label: '오프라인', value: 0, ratio: 0, color: '#d054bf' },
  { key: 'no_data', label: '데이터 없음', value: 0, ratio: 0, color: '#c9d3e3' }
];

const INITIAL_FUEL_ITEMS = [
  { key: 'ample', label: '여유', value: 0, ratio: 0, color: '#8fd2ee' },
  { key: 'normal', label: '보통', value: 0, ratio: 0, color: '#7fb069' },
  { key: 'low', label: '주의', value: 0, ratio: 0, color: '#f3c15d' },
  { key: 'critical', label: '위험', value: 0, ratio: 0, color: '#e06b5f' }
];

const INITIAL_DASHBOARD = {
  generatedAt: '-',
  latestVehicleUpdatedAt: '-',
  refreshIntervalSeconds: 1,
  thresholds: {
    delayedSeconds: 15,
    offlineSeconds: 60,
    idleSeconds: 60
  },
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
  fuelSummary: {
    totalTrackedVehicles: 0,
    items: INITIAL_FUEL_ITEMS
  },
  drivingTrend: [],
  vehicleTable: [],
  delayedVehicles: [],
  idleVehicles: []
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

function VehicleStatusDonut({ totalVehicles, items }) {
  const radius = 78;
  const segments = buildDonutSegments(items, radius);
  const trackedTotal = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <article className="card operator-vehicle-chart-card">
      <div className="operator-vehicle-chart-head">
        <div>
          <p className="operator-vehicle-section-label">차량 상태 분포</p>
          <h2>차량 상태 비율</h2>
          <p>실시간 상태가 확인된 차량만 기준으로 운영 비율을 집계합니다.</p>
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
          {items.map((item) => (
            <li key={item.key} className="operator-vehicle-legend-item">
              <span
                className="operator-vehicle-legend-swatch"
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
              <span className="operator-vehicle-legend-label">{item.label}</span>
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

function DrivingTrendCardSafe({ points }) {
  const normalizedPoints = useMemo(
    () => points.map((point) => ({ value: Number(point.value || 0), label: point.label || '--:--' })),
    [points]
  );
  const linePath = useMemo(() => buildTrendLinePath(normalizedPoints, 420, 150), [normalizedPoints]);
  const areaPath = useMemo(() => buildTrendAreaPath(normalizedPoints, 420, 150), [normalizedPoints]);
  const latestValue = normalizedPoints.length ? normalizedPoints[normalizedPoints.length - 1].value : 0;
  const axisLabels = useMemo(() => {
    if (!normalizedPoints.length) {
      return [];
    }

    return normalizedPoints.filter((_, index) => (
      index === 0 ||
      index === normalizedPoints.length - 1 ||
      index === Math.floor((normalizedPoints.length - 1) / 2)
    ));
  }, [normalizedPoints]);
  const values = normalizedPoints.map((point) => point.value);
  const minValue = values.length ? Math.min(...values) : 0;
  const maxValue = values.length ? Math.max(...values) : 0;
  const range = maxValue - minValue || 1;

  return (
    <article className="card operator-vehicle-trend-card">
      <div className="operator-vehicle-panel-head operator-vehicle-trend-head">
        <div>
          <p className="operator-vehicle-section-label">운행 추이</p>
          <h2>시간별 운행 차량 수</h2>
        </div>
      </div>

      {linePath ? (
        <div className="operator-vehicle-trend-chart-wrap">
          <svg viewBox="0 0 420 190" className="operator-vehicle-trend-chart" preserveAspectRatio="none">
            <defs>
              <linearGradient id="operatorDrivingTrendFill" x1="0%" x2="0%" y1="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(63, 95, 134, 0.26)" />
                <stop offset="100%" stopColor="rgba(238, 243, 251, 0.05)" />
              </linearGradient>
            </defs>
            <path className="operator-vehicle-trend-area" d={areaPath} fill="url(#operatorDrivingTrendFill)" />
            <path className="operator-vehicle-trend-line" d={linePath} />
            {normalizedPoints.map((point, index) => {
              if (!(index === 0 || index === normalizedPoints.length - 1 || index % 4 === 0)) {
                return null;
              }

              const x = normalizedPoints.length === 1 ? 210 : (index / (normalizedPoints.length - 1)) * 420;
              const y = 150 - ((point.value - minValue) / range) * 150;

              return (
                <circle
                  key={`driving-point-${index}`}
                  className="operator-vehicle-trend-dot"
                  cx={x}
                  cy={y}
                  r="4"
                />
              );
            })}
          </svg>
          <div className="operator-vehicle-trend-meta">
            <strong>{formatCount(latestValue)}대</strong>
            <span>최근 시점 운행 차량</span>
          </div>
          <div className="operator-vehicle-trend-axis">
            {axisLabels.map((point, index) => (
              <span key={`driving-axis-${index}`}>{point.label}</span>
            ))}
          </div>
        </div>
      ) : (
        <div className="operator-vehicle-trend-empty">최근 운행 차량 추이 데이터가 없습니다.</div>
      )}
    </article>
  );
}

function FuelSummaryCard({ fuelSummary }) {
  return (
    <article className="card operator-vehicle-fuel-card">
      <div className="operator-vehicle-panel-head">
        <div>
          <p className="operator-vehicle-section-label">연료 상태 요약</p>
          <h2>연료 상태 분포</h2>
        </div>
        <span
          className="operator-vehicle-panel-badge operator-vehicle-panel-badge-compact"
          data-count={`${formatCount(rows.length)}대`}
        >
          {formatCount(fuelSummary.totalTrackedVehicles)}대 기준
        </span>
      </div>

      <div className="operator-vehicle-fuel-stack">
        {fuelSummary.items.map((item) => (
          <div key={item.key} className="operator-vehicle-fuel-row">
            <div className="operator-vehicle-fuel-meta">
              <span
                className="operator-vehicle-legend-swatch"
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
              <strong>{item.label}</strong>
            </div>
            <div className="operator-vehicle-fuel-bar-track">
              <div
                className="operator-vehicle-fuel-bar-fill"
                style={{
                  width: `${item.ratio}%`,
                  backgroundColor: item.color
                }}
              />
            </div>
            <div className="operator-vehicle-fuel-values">
              <strong>{formatCount(item.value)}</strong>
              <span>{item.ratio.toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>
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
        <span
          className="operator-vehicle-panel-badge operator-vehicle-panel-badge-compact"
          data-count={`${formatCount(rows.length)}대`}
        >
          {formatCount(rows.length)}대 표시
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
              <th>최근 수신</th>
              <th>위치</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={row.vehicleId}>
                  <td>{row.vehicleId}</td>
                  <td>
                    <span
                      className={`operator-vehicle-status-badge is-${row.status}`}
                      style={{ '--badge-color': row.statusColor }}
                    >
                      {row.statusLabel}
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

function DelayedVehiclesTable({ rows, delayedSeconds }) {
  return (
    <article className="card operator-vehicle-side-card">
      <div className="operator-vehicle-panel-head">
        <div>
          <p className="operator-vehicle-section-label">갱신 지연</p>
          <h2>업데이트 지연 차량</h2>
        </div>
        <span className="operator-vehicle-panel-badge">{delayedSeconds}s 이상</span>
      </div>

      <div className="table-wrap operator-vehicle-side-table-wrap">
        <table className="operator-vehicle-side-table">
          <thead>
            <tr>
              <th>차량 ID</th>
              <th>상태</th>
              <th>지연</th>
              <th>최근 수신</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={`${row.vehicleId}-${row.delaySeconds}`}>
                  <td>{row.vehicleId}</td>
                  <td>{row.statusLabel}</td>
                  <td>{row.delayLabel}</td>
                  <td>{row.lastUpdatedAt}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="operator-vehicle-empty-cell">
                  현재 지연 상태 차량이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function IdleVehiclesTable({ rows, idleSeconds }) {
  return (
    <article className="card operator-vehicle-side-card">
      <div className="operator-vehicle-panel-head">
        <div>
          <p className="operator-vehicle-section-label">운영 체크</p>
          <h2>공회전 의심 차량</h2>
        </div>
        <span className="operator-vehicle-panel-badge">{idleSeconds}s 이상</span>
      </div>

      <div className="table-wrap operator-vehicle-side-table-wrap">
        <table className="operator-vehicle-side-table">
          <thead>
            <tr>
              <th>차량 ID</th>
              <th>공회전 시간</th>
              <th>연료</th>
              <th>최근 수신</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={`${row.vehicleId}-${row.idleSeconds}`}>
                  <td>{row.vehicleId}</td>
                  <td>{row.idleMinutes.toFixed(1)}분</td>
                  <td>{formatFuelLevel(row.fuelLevel)}</td>
                  <td>{row.lastUpdatedAt}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="operator-vehicle-empty-cell">
                  현재 공회전 의심 차량이 없습니다.
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
  const orderedKpiItems = KPI_DISPLAY_ORDER.map((key) =>
    KPI_ITEMS.find((item) => item.key === key)
  ).filter(Boolean);
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
          fuelSummary: {
            ...INITIAL_DASHBOARD.fuelSummary,
            ...result.fuelSummary,
            items: result.fuelSummary?.items?.length
              ? result.fuelSummary.items
              : INITIAL_DASHBOARD.fuelSummary.items
          }
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
              <option value="all">전체</option>
              <option value="driving">운행 중</option>
              <option value="stopped">정차</option>
              <option value="engine_off">시동 꺼짐</option>
            </select>
          </label>
          <div className="operator-vehicle-toolbar-meta">
            최근 갱신 시간 {dashboard.generatedAt}
          </div>
        </div>
      }
      tabs={operatorTabs}
    >
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
                {orderedKpiItems.map((item) => (
                  <article key={item.key} className="card operator-vehicle-kpi-card">
                    <p className="operator-vehicle-kpi-label">
                      {KPI_LABELS[item.key] || item.label}
                    </p>
                    <strong className="operator-vehicle-kpi-value">
                      {formatCount(dashboard.summary[item.key])}
                    </strong>
                  </article>
                ))}
              </div>

              <section className="operator-vehicle-table-section">
                <VehicleTable rows={filteredVehicleRows} />
              </section>
            </div>

            <div className="operator-vehicle-chart-column">
              <VehicleStatusDonut
                totalVehicles={dashboard.summary.totalVehicles}
                items={chartItems}
              />
              <DrivingTrendCard points={dashboard.drivingTrend} />
            </div>
          </section>

        </div>
      ) : null}
    </DashboardLayout>
  );
}

function buildTrendLinePath(points, width, height) {
  if (!points.length) {
    return '';
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return points
    .map((point, index) => {
      const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
      const y = height - ((point.value - min) / range) * height;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

function buildTrendAreaPath(points, width, height) {
  if (!points.length) {
    return '';
  }

  return `${buildTrendLinePath(points, width, height)} L ${width} ${height} L 0 ${height} Z`;
}

function DrivingTrendCard({ points }) {
  const normalizedPoints = useMemo(
    () => points.map((point) => ({ value: Number(point.value || 0), label: point.label || '--:--' })),
    [points]
  );
  const linePath = useMemo(() => buildTrendLinePath(normalizedPoints, 420, 150), [normalizedPoints]);
  const areaPath = useMemo(() => buildTrendAreaPath(normalizedPoints, 420, 150), [normalizedPoints]);
  const latestValue = normalizedPoints.length ? normalizedPoints[normalizedPoints.length - 1].value : 0;
  const axisLabels = useMemo(() => {
    if (!normalizedPoints.length) {
      return [];
    }

    return normalizedPoints.filter((_, index) => (
      index === 0 ||
      index === normalizedPoints.length - 1 ||
      index === Math.floor((normalizedPoints.length - 1) / 2)
    ));
  }, [normalizedPoints]);

  const values = normalizedPoints.map((point) => point.value);
  const minValue = values.length ? Math.min(...values) : 0;
  const maxValue = values.length ? Math.max(...values) : 0;
  const range = maxValue - minValue || 1;

  return (
    <article className="card operator-vehicle-trend-card">
      <div className="operator-vehicle-panel-head operator-vehicle-trend-head">
        <div>
          <p className="operator-vehicle-section-label">{'운행 추이'}</p>
          <h2>{'시간별 운행 차량 수'}</h2>
        </div>
      </div>

      {linePath ? (
        <div className="operator-vehicle-trend-chart-wrap">
          <svg viewBox="0 0 420 190" className="operator-vehicle-trend-chart" preserveAspectRatio="none">
            <defs>
              <linearGradient id="operatorDrivingTrendFillSafe" x1="0%" x2="0%" y1="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(63, 95, 134, 0.26)" />
                <stop offset="100%" stopColor="rgba(238, 243, 251, 0.05)" />
              </linearGradient>
            </defs>
            <path
              className="operator-vehicle-trend-area"
              d={areaPath}
              fill="url(#operatorDrivingTrendFillSafe)"
            />
            <path className="operator-vehicle-trend-line" d={linePath} />
            {normalizedPoints.map((point, index) => {
              if (!(index === 0 || index === normalizedPoints.length - 1 || index % 4 === 0)) {
                return null;
              }

              const x = normalizedPoints.length === 1 ? 210 : (index / (normalizedPoints.length - 1)) * 420;
              const y = 150 - ((point.value - minValue) / range) * 150;

              return (
                <circle
                  key={`driving-point-safe-${index}`}
                  className="operator-vehicle-trend-dot"
                  cx={x}
                  cy={y}
                  r="4"
                />
              );
            })}
          </svg>
          <div className="operator-vehicle-trend-meta">
            <strong>{`${formatCount(latestValue)}대`}</strong>
            <span>{'최근 시점 운행 차량'}</span>
          </div>
          <div className="operator-vehicle-trend-axis">
            {axisLabels.map((point, index) => (
              <span key={`driving-axis-safe-${index}`}>{point.label}</span>
            ))}
          </div>
        </div>
      ) : (
        <div className="operator-vehicle-trend-empty">{'최근 운행 차량 추이 데이터가 없습니다.'}</div>
      )}
    </article>
  );
}

export default OperatorVehiclePage;
