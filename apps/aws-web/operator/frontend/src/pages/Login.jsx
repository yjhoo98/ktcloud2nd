import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const s = {
  page: {
    minHeight: '100vh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: '2rem',
    background: '#0f172a',
  },
  header: { textAlign: 'center' },
  title: { fontSize: '1.5rem', fontWeight: 700, color: '#f1f5f9' },
  subtitle: { marginTop: '0.4rem', fontSize: '0.9rem', color: '#64748b' },
  card: {
    width: '360px', padding: '2rem', borderRadius: '12px',
    background: '#1e293b', border: '1px solid #334155',
  },
  label: { display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.4rem' },
  input: {
    width: '100%', padding: '0.6rem 0.8rem', borderRadius: '6px',
    background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9',
    fontSize: '0.95rem', outline: 'none', marginBottom: '1rem',
  },
  btn: {
    width: '100%', padding: '0.7rem', borderRadius: '6px',
    background: '#f59e0b', border: 'none', color: '#fff',
    fontSize: '1rem', fontWeight: 600, cursor: 'pointer', marginTop: '0.5rem',
  },
  error: {
    marginTop: '0.8rem', padding: '0.6rem 0.8rem', borderRadius: '6px',
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
    color: '#f87171', fontSize: '0.85rem',
  },
}

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/operator/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message)
        return
      }
      localStorage.setItem('op_token', data.token)
      navigate('/dashboard')
    } catch {
      setError('서버에 연결할 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.title}>운영자 로그인</div>
        <div style={s.subtitle}>인프라 모니터링 대시보드</div>
      </div>

      <div style={s.card}>
        <form onSubmit={handleSubmit}>
          <label style={s.label}>아이디</label>
          <input
            style={s.input}
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="운영자 아이디"
            required
          />
          <label style={s.label}>비밀번호</label>
          <input
            style={s.input}
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="비밀번호"
            required
          />
          <button style={s.btn} type="submit" disabled={loading}>
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
        {error && <div style={s.error}>{error}</div>}
      </div>
    </div>
  )
}
