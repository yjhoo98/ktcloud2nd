import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { fetchAnomalyDashboard } from '../../api/anomalyDashboard';

const REFRESH_INTERVAL_MS = 1 * 1000;
const numberFormatter = new Intl.NumberFormat('ko-KR');

const operatorTabs = [
  { label: '이상 탐지', path: '/operator/anomaly' },
  { label: '차량 현황', path: '/operator/vehicle' },
  { label: '인프라 모니터링', path: '/operator/infra-service' }
];

const ANOMALY_COLOR_MAP = {
  SUDDEN_DECEL: '#34e7ee',
  SUDDEN_ACCEL: '#57c2ff',
  LOW_FUEL: '#2f6fed',
  ABNORMAL_GPS: '#6c72ff',
  DATA_BURST: '#cb3cff',
  MISSING_DATA: '#ff5556'
};

const KPI_ITEMS = [
  {
    key: 'totalAlerts',
    label: '총 이상 건수'
  },
  {
    key: 'affectedVehicles',
    label: '이상 차량 수'
  },
  {
    key: 'suddenDecelCount',
    label: '급감속 이상'
  },
  {
    key: 'suddenAccelCount',
    label: '급가속 이상'
  },
  {
    key: 'lowFuelCount',
    label: '연료 부족 이상'
  },
  {
    key: 'abnormalGpsCount',
    label: 'GPS 이상'
  },
  {
    key: 'dataBurstCount',
    label: '데이터 폭주'
  },
  {
    key: 'missingDataCount',
    label: '데이터 미수신'
  }
];

const INITIAL_BREAKDOWN_ITEMS = [
  { key: 'SUDDEN_DECEL', label: '급감속', value: 0, ratio: 0, color: '#2f6b8a' },
  { key: 'SUDDEN_ACCEL', label: '급가속', value: 0, ratio: 0, color: '#8fd2ee' },
  { key: 'LOW_FUEL', label: '연료 부족', value: 0, ratio: 0, color: '#f3a145' },
  { key: 'ABNORMAL_GPS', label: 'GPS 이상', value: 0, ratio: 0, color: '#6d95e2' },
  { key: 'DATA_BURST', label: '데이터 폭주', value: 0, ratio: 0, color: '#d054bf' },
  { key: 'MISSING_DATA', label: '데이터 미수신', value: 0, ratio: 0, color: '#b8de39' }
];

const INITIAL_DASHBOARD = {
  generatedAt: '-',
  summary: {
    totalAlerts: 0,
    affectedVehicles: 0,
    suddenDecelCount: 0,
    suddenAccelCount: 0,
    lowFuelCount: 0,
    abnormalGpsCount: 0,
    dataBurstCount: 0,
    missingDataCount: 0
  },
  breakdown: {
    totalTrackedAlerts: 0,
    items: INITIAL_BREAKDOWN_ITEMS
  },
  heatmap: {
    columns: [],
    maxValue: 0,
    items: INITIAL_BREAKDOWN_ITEMS.map((item) => ({
      key: item.key,
      label: item.label,
      color: item.color,
      cells: []
    }))
  },
  latestAlert: null,
  recentAlerts: []
};

function formatCount(value) {
  return numberFormatter.format(Number(value || 0));
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

function buildHeatmapCellStyle(color, value, maxValue) {
  const intensity = maxValue > 0 ? value / maxValue : 0;
  const alpha = value > 0 ? 0.14 + intensity * 0.86 : 0.06;

  return {
    backgroundColor: value > 0 ? color : 'rgba(255, 255, 255, 0.04)',
    opacity: alpha
  };
}

function AnomalyHeatmap({ heatmap }) {
  if (!heatmap?.columns?.length || !heatmap?.items?.length) {
    return null;
  }

  return (
    <article className="card operator-anomaly-heatmap-card">
      <div className="operator-anomaly-heatmap">
        <div className="operator-anomaly-heatmap-head">
          <span className="operator-anomaly-heatmap-title">이상 유형 히트맵</span>
          <div className="operator-anomaly-heatmap-columns">
            {heatmap.columns.map((column) => (
              <span key={column.bucketStart}>{column.label}</span>
            ))}
          </div>
        </div>

        <div className="operator-anomaly-heatmap-body">
          {heatmap.items.map((item) => (
            <div key={item.key} className="operator-anomaly-heatmap-row">
              <span className="operator-anomaly-heatmap-label">{item.label}</span>
              <div className="operator-anomaly-heatmap-cells">
                {item.cells.map((cell) => (
                  <span
                    key={`${item.key}-${cell.bucketStart}`}
                    className="operator-anomaly-heatmap-cell"
                    title={`${item.label} · ${cell.label} · ${cell.value}건`}
                    style={buildHeatmapCellStyle(ANOMALY_COLOR_MAP[item.key] || item.color, cell.value, heatmap.maxValue)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function DonutChart({ totalAlerts, items }) {
  const radius = 78;
  const normalizedItems = items.map((item) => ({
    ...item,
    color: ANOMALY_COLOR_MAP[item.key] || item.color
  }));
  const segments = buildDonutSegments(normalizedItems, radius);

  return (
    <article className="card operator-anomaly-chart-card">
      <div className="operator-anomaly-chart-head">
        <div>
          <h2>이상 유형 분포</h2>
        </div>
      </div>

      <div className="operator-anomaly-chart-body">
        <div className="operator-anomaly-chart-visual">
          <svg
            viewBox="0 0 220 220"
            className="operator-anomaly-donut"
            role="img"
            aria-label="이상 유형 분포 차트"
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

          <div className="operator-anomaly-donut-center">
            <strong>{formatCount(totalAlerts)}</strong>
            <span>전체 이상</span>
          </div>
        </div>

        <ul className="operator-anomaly-legend">
          {normalizedItems.map((item) => (
            <li key={item.key} className="operator-anomaly-legend-item">
              <span
                className="operator-anomaly-legend-swatch"
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
              <span className="operator-anomaly-legend-label">{item.label}</span>
              <div className="operator-anomaly-legend-values">
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

const ANOMALY_ICON_CONFIG = {
  SUDDEN_ACCEL: {
    accent: '#57c2ff',
    glow: 'rgba(87, 194, 255, 0.34)'
  },
  SUDDEN_DECEL: {
    accent: '#34e7ee',
    glow: 'rgba(52, 231, 238, 0.34)'
  },
  LOW_FUEL: {
    accent: '#2f6fed',
    glow: 'rgba(47, 111, 237, 0.34)'
  },
  ABNORMAL_GPS: {
    accent: '#6c72ff',
    glow: 'rgba(108, 114, 255, 0.34)'
  },
  DATA_BURST: {
    accent: '#cb3cff',
    glow: 'rgba(203, 60, 255, 0.34)'
  },
  MISSING_DATA: {
    accent: '#ff5556',
    glow: 'rgba(255, 85, 86, 0.34)'
  }
};

function AnomalyGlyph({ anomalyType, accent }) {
  const commonProps = {
    fill: 'none',
    stroke: accent,
    strokeWidth: '2.6',
    strokeLinecap: 'round',
    strokeLinejoin: 'round'
  };

  switch (anomalyType) {
    case 'SUDDEN_ACCEL':
      return (
        <>
          <path {...commonProps} d="M16 41 L30 27 L38 35 L50 21" />
          <path {...commonProps} d="M42 21 H50 V29" />
          <path {...commonProps} d="M14 47 H52" opacity="0.48" />
          <path {...commonProps} d="M18 34 L23 34" opacity="0.8" />
          <path {...commonProps} d="M18 29 L25 29" opacity="0.55" />
        </>
      );
    case 'SUDDEN_DECEL':
      return (
        <>
          <path {...commonProps} d="M16 22 L30 36 L38 28 L50 42" />
          <path {...commonProps} d="M42 42 H50 V34" />
          <path {...commonProps} d="M14 47 H52" opacity="0.48" />
          <path {...commonProps} d="M18 23 L25 23" opacity="0.8" />
          <path {...commonProps} d="M18 28 L23 28" opacity="0.55" />
        </>
      );
    case 'LOW_FUEL':
      return (
        <>
          <path {...commonProps} d="M21 18 H39 V46 H21 Z" />
          <path {...commonProps} d="M39 21 H44 L48 26 V37" />
          <path {...commonProps} d="M26 24 H34" opacity="0.6" />
          <path {...commonProps} d="M30 31 C33 35 35 37 35 40 A5 5 0 1 1 25 40 C25 37 27 35 30 31Z" />
        </>
      );
    case 'ABNORMAL_GPS':
      return (
        <>
          <path {...commonProps} d="M32 16 C40 16 45 22 45 29 C45 39 32 49 32 49 C32 49 19 39 19 29 C19 22 24 16 32 16 Z" />
          <circle cx="32" cy="29" r="5.5" {...commonProps} />
          <path {...commonProps} d="M18 17 L46 45" opacity="0.92" />
        </>
      );
    case 'DATA_BURST':
      return (
        <>
          <circle cx="20" cy="24" r="4.5" {...commonProps} />
          <circle cx="43" cy="20" r="4.5" {...commonProps} />
          <circle cx="44" cy="42" r="4.5" {...commonProps} />
          <circle cx="22" cy="43" r="4.5" {...commonProps} />
          <circle cx="32" cy="31" r="5" {...commonProps} />
          <path {...commonProps} d="M24 26 L28 29 M39 23 L35 27 M41 39 L36 35 M25 40 L28 35" />
        </>
      );
    case 'MISSING_DATA':
    default:
      return (
        <>
          <path {...commonProps} d="M20 42 C20 33 27 26 36 26 C42 26 47 29 50 34" />
          <path {...commonProps} d="M14 35 C18 27 26 22 36 22 C44 22 51 25 55 31" opacity="0.55" />
          <path {...commonProps} d="M32 46 H40" />
          <path {...commonProps} d="M16 16 L50 50" />
        </>
      );
  }
}

function AnomalyIconTile({ anomalyType, anomalyLabel }) {
  const config = ANOMALY_ICON_CONFIG[anomalyType] || ANOMALY_ICON_CONFIG.MISSING_DATA;

  return (
    <div className="operator-anomaly-banner-item operator-anomaly-banner-item-icon">
      <div className="operator-anomaly-icon-tile">
        <div className="operator-anomaly-icon-grid" aria-hidden="true" />
        <div
          className="operator-anomaly-icon-shell"
          style={{
            '--icon-accent': config.accent,
            '--icon-glow': config.glow
          }}
        >
          <svg
            viewBox="0 0 64 64"
            className="operator-anomaly-icon-glyph"
            role="img"
            aria-label={anomalyLabel}
          >
            <AnomalyGlyph anomalyType={anomalyType} accent={config.accent} />
          </svg>
        </div>
      </div>
    </div>
  );
}

function InlineLatestAlertBanner({ latestAlert }) {
  return (
    <article className="card operator-anomaly-banner-card operator-anomaly-banner-card-inline">
      {latestAlert ? (
        <div className="operator-anomaly-banner-inline">
          <div className="operator-anomaly-banner-inline-icon">
            <AnomalyIconTile
              anomalyType={latestAlert.anomalyType}
              anomalyLabel={latestAlert.anomalyLabel}
            />
          </div>
          <div className="operator-anomaly-banner-inline-body">
            <div className="operator-anomaly-banner-inline-main">
              <strong>{latestAlert.anomalyLabel}</strong>
              <span className="operator-anomaly-banner-inline-dot" aria-hidden="true" />
              <span>{latestAlert.vehicleId}</span>
              <span className="operator-anomaly-banner-inline-dot" aria-hidden="true" />
              <span>{latestAlert.description}</span>
            </div>
            <div className="operator-anomaly-banner-inline-meta">
              <span>{latestAlert.occurredAtDt}</span>
              <span className="operator-anomaly-banner-inline-dot" aria-hidden="true" />
              <span>{latestAlert.evidence}</span>
            </div>
          </div>
        </div>
      ) : (
        <p className="operator-anomaly-banner-empty">
          아직 적재된 이상 데이터가 없습니다.
        </p>
      )}
    </article>
  );
}

function RecentAlertsTable({ alerts }) {
  return (
    <article className="card operator-anomaly-recent-card">
      <div className="operator-anomaly-recent-head">
        <div>
          <p className="operator-anomaly-recent-label">운영 우선 확인</p>
          <h2>최근 이상 발생 차량</h2>
        </div>
        <span className="operator-anomaly-recent-badge">
          {formatCount(alerts.length)}건 표시
        </span>
      </div>

      {alerts.length ? (
        <div className="operator-anomaly-recent-table-wrap">
          <table className="operator-anomaly-recent-table">
            <thead>
              <tr>
                <th>차량 ID</th>
                <th>이상 유형</th>
                <th>설명</th>
                <th>발생 시각</th>
                <th>근거</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert, index) => (
                <tr key={alert.alertId || `${alert.vehicleId}-${alert.occurredAtDt}-${index}`}>
                  <td>{alert.vehicleId}</td>
                  <td>{alert.anomalyLabel}</td>
                  <td>{alert.description}</td>
                  <td>{alert.occurredAtDt}</td>
                  <td>{alert.evidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="operator-anomaly-recent-empty">
          아직 표시할 최근 이상 데이터가 없습니다.
        </p>
      )}
    </article>
  );
}

function OperatorAnomalyPage() {
  const [dashboard, setDashboard] = useState(INITIAL_DASHBOARD);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timeoutId;

    async function loadDashboard() {
      try {
        const result = await fetchAnomalyDashboard();

        if (cancelled) {
          return;
        }

        setDashboard({
          ...INITIAL_DASHBOARD,
          ...result,
          summary: {
            ...INITIAL_DASHBOARD.summary,
            ...result.summary
          },
          breakdown: {
            ...INITIAL_DASHBOARD.breakdown,
            ...result.breakdown,
            items: result.breakdown?.items?.length
              ? result.breakdown.items
              : INITIAL_DASHBOARD.breakdown.items
          },
          heatmap: {
            ...INITIAL_DASHBOARD.heatmap,
            ...result.heatmap,
            columns: result.heatmap?.columns?.length
              ? result.heatmap.columns
              : INITIAL_DASHBOARD.heatmap.columns,
            items: result.heatmap?.items?.length
              ? result.heatmap.items
              : INITIAL_DASHBOARD.heatmap.items
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
          timeoutId = window.setTimeout(loadDashboard, REFRESH_INTERVAL_MS);
        }
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  return (
    <DashboardLayout
      role="OPERATOR"
      title="이상 탐지 대시보드"
      tabs={operatorTabs}
    >
      {errorMessage ? <div className="auth-message error">{errorMessage}</div> : null}

      {isLoading ? (
        <article className="card operator-anomaly-loading-card">
          이상 탐지 데이터를 불러오는 중입니다...
        </article>
      ) : null}

      {!isLoading ? (
        <div className="operator-anomaly-shell">
          <section className="operator-anomaly-top-grid">
            <div className="operator-anomaly-main-column">
              <InlineLatestAlertBanner latestAlert={dashboard.latestAlert} />

              <div className="operator-anomaly-kpi-grid">
                {KPI_ITEMS.map((item) => (
                  <article key={item.key} className="card operator-anomaly-kpi-card">
                    <p className="operator-anomaly-kpi-label">{item.label}</p>
                    <strong className="operator-anomaly-kpi-value">
                      {formatCount(dashboard.summary[item.key])}
                    </strong>
                  </article>
                ))}
              </div>

              <RecentAlertsTable alerts={dashboard.recentAlerts || []} />
            </div>

            <div className="operator-anomaly-side-column">
              <DonutChart
                totalAlerts={dashboard.summary.totalAlerts}
                items={dashboard.breakdown.items}
              />
              <AnomalyHeatmap heatmap={dashboard.heatmap} />
            </div>
          </section>
        </div>
      ) : null}
    </DashboardLayout>
  );
}

export default OperatorAnomalyPage;
