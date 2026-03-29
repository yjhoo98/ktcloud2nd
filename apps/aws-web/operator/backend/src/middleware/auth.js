const jwt = require('jsonwebtoken')

module.exports = (req, res, next) => {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ message: '인증 필요' })
  }
  try {
    req.user = jwt.verify(auth.slice(7), process.env.JWT_SECRET || 'change-me-in-production')
    next()
  } catch {
    res.status(401).json({ message: '토큰 만료 또는 유효하지 않음' })
  }
}
