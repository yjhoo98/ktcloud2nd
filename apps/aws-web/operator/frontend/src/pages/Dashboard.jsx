import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

const REFRESH_INTERVAL = 30_000 // 30초

const s = {
  page: { minHeight: '100vh', background: '#0f172a', padding: '1.5rem 2rem' },
  nav: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '2rem',
  },
  navTitle: { fontSize: '1.2rem', fontWeight: 700, color: '#f1f5f9' },
  navRight: { display: 'flex', alignItems: 'center', gap: '1rem' },
  refreshText: { fontSize: '0.8rem', color: '#475569' },
  logoutBtn: {
    padding: '0.4rem 1rem', borderRadius: '6px', background: 'transparent',
    border: '1px solid #334155', color: '#94a3b8', fontSize: '0.85rem', cursor: 'pointer',
  },
  sectionTitle: { fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem', fontWeight: 500 },
  cards: {
    display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '1rem', marginBottom: '2rem',
  },
  card: {
    padding: '1.25rem', borderRadius: '10px',
    background: '#1e293b', border: '1px solid #334155',
  },
  cardLabel: { fontSize: '0.8rem', color: '#64748b', marginBottom: '0.5rem' },
  cardValue: { fontSize: '1.8rem', fontWeight: 700, color: '#f1f5f9' },
  cardUnit: { fontSize: '0.75rem', color: '#475569', marginTop: '0.2rem' },
  grafanaWrap: {
    borderRadius: '10px', overflow: 'hidden',
    border: '1px solid #334155', background: '#1e293b',
  },
  grafanaTitle: {
    padding: '0.75rem 1rem', fontSize: '0.85rem',
    color: '#64748b', borderBottom: '1px solid #334155',
  },
  iframe: { width: '100%', height: '600px', border: 'none', display: 'block' },
  error: {
    padding: '0.8rem 1rem', borderRadius: '8px', marginBottom: '1.5rem',
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
    color: '#f87171', fontSize: '0.85rem',
  },
}

const METRIC_CARDS = [
  { key: 'cpu',     label: 'CPU 사용률',      unit: '%'   },
  { key: 'memory',  label: '메모리 사용량',   unit: 'MiB' },
  { key: 'running', label: 'Running Pods',   unit: 'pods' },
  { key: 'ready',   label: 'Ready Pods',     unit: 'pods' },
  { key: 'pending', label: 'Pending Pods',   unit: 'pods' },
]

export default function Dashboard() {
  const [metrics, setMetrics] = useState(null)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState('')
  const navigate = useNavigate()

  const fetchMetrics = useCallback(async () => {
    const token = localStorage.getItem('op_token')
    try {
      const res = await fetch('/operator/api/metrics', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 401) {
        localStorage.removeItem('op_token')
        navigate('/login')
        return
      }
      if (!res.ok) {
        const data = await res.json()
        setError(data.message)
        return
      }
      setMetrics(await res.json())
      setError('')
      setLastUpdated(new Date().toLocaleTimeString('ko-KR'))
    } catch {
      setError('메트릭을 불러올 수 없습니다.')
    }
  }, [navigate])

  useEffect(() => {
    fetchMetrics()
    const timer = setInterval(fetchMetrics, REFRESH_INTERVAL)
    return () => clearInterval(timer)
  }, [fetchMetrics])

  function handleLogout() {
    localStorage.removeItem('op_token')
    navigate('/login')
  }

  return (
    <div style={s.page}>
      <nav style={s.nav}>
        <div style={s.navTitle}>인프라 모니터링</div>
        <div style={s.navRight}>
          {lastUpdated && <span style={s.refreshText}>마지막 갱신: {lastUpdated}</span>}
          <button style={s.logoutBtn} onClick={handleLogout}>로그아웃</button>
        </div>
      </nav>

      {error && <div style={s.error}>{error}</div>}

      <div style={s.sectionTitle}>클러스터 현황 (30초 자동 갱신)</div>
      <div style={s.cards}>
        {METRIC_CARDS.map(({ key, label, unit }) => (
          <div key={key} style={s.card}>
            <div style={s.cardLabel}>{label}</div>
            <div style={s.cardValue}>{metrics ? metrics[key] : '—'}</div>
            <div style={s.cardUnit}>{unit}</div>
          </div>
        ))}
      </div>

      <div style={s.sectionTitle}>Grafana 대시보드</div>
      <div style={s.grafanaWrap}>
        <div style={s.grafanaTitle}>Grafana</div>
        <iframe
          style={s.iframe}
          src="/grafana"
          title="Grafana 대시보드"
        />
      </div>
    </div>
  )
}
