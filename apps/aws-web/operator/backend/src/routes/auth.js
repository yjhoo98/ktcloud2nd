const express = require('express')
const jwt = require('jsonwebtoken')
const router = express.Router()

router.post('/login', (req, res) => {
  const { username, password } = req.body
  const validUser = process.env.OP_USERNAME || 'admin'
  const validPass = process.env.OP_PASSWORD || 'admin'

  if (username !== validUser || password !== validPass) {
    return res.status(401).json({ message: '아이디 또는 비밀번호가 올바르지 않습니다.' })
  }

  const token = jwt.sign(
    { username },
    process.env.JWT_SECRET || 'change-me-in-production',
    { expiresIn: '8h' }
  )
  res.json({ token })
})

module.exports = router
