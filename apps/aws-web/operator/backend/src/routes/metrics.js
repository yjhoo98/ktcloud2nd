const express = require('express')
const axios = require('axios')
const authMiddleware = require('../middleware/auth')
const router = express.Router()

const PROMETHEUS_URL = process.env.PROMETHEUS_URL || 'http://prometheus-operated:9090'

async function query(promql) {
  const res = await axios.get(`${PROMETHEUS_URL}/api/v1/query`, {
    params: { query: promql },
    timeout: 5000,
  })
  return res.data.data.result
}

function firstValue(result) {
  return result[0]?.value[1] ?? '0'
}

router.get('/metrics', authMiddleware, async (req, res) => {
  try {
    const [cpu, memory, running, pending, ready] = await Promise.all([
      // 클러스터 전체 CPU 사용률 (%)
      query('round(sum(rate(container_cpu_usage_seconds_total{container!=""}[5m])) * 100, 0.01)'),
      // 클러스터 전체 메모리 사용량 (MiB)
      query('round(sum(container_memory_working_set_bytes{container!=""}) / 1024 / 1024, 1)'),
      // Running 상태 파드 수
      query('count(kube_pod_status_phase{phase="Running"})'),
      // Pending 상태 파드 수
      query('count(kube_pod_status_phase{phase="Pending"}) or vector(0)'),
      // Ready 상태 파드 수
      query('count(kube_pod_status_ready{condition="true"})'),
    ])

    res.json({
      cpu:     parseFloat(firstValue(cpu)).toFixed(2),
      memory:  parseFloat(firstValue(memory)).toFixed(0),
      running: firstValue(running),
      pending: firstValue(pending),
      ready:   firstValue(ready),
    })
  } catch (err) {
    res.status(502).json({ message: 'Prometheus 조회 실패', error: err.message })
  }
})

module.exports = router
