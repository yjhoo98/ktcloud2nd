const express = require('express')
const cors = require('cors')
const authRouter = require('./routes/auth')
const metricsRouter = require('./routes/metrics')

const app = express()
app.use(express.json())
app.use(cors())

app.use('/operator/api', authRouter)
app.use('/operator/api', metricsRouter)

const PORT = process.env.PORT || 4000
app.listen(PORT, () => console.log(`operator-backend listening on port ${PORT}`))
