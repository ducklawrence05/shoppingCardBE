import { createHash } from 'crypto'
import dotenv from 'dotenv'
dotenv.config()
//tạo hàm nhận vào content mã hoá thành sha256
function sha256(content: string) {
  return createHash('sha256').update(content).digest('hex')
}

//tạo hàm nhận vào password và mã hoá sha256
export function hashPassword(password: string) {
  return sha256(password + process.env.PASSWORD_SECRET)
}
