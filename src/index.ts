import express from 'express'
import userRouter from './routes/users.routers'
import mediaRouter from './routes/medias.routers'
import staticRouter from './routes/static.routers'
import brandRouter from './routes/brands.routers'
import databaseServices from './services/database.services'
import { defaultErrorHandler } from './middlewares/error.middlewares'
import { initFolder } from './utils/file'
import dotenv from 'dotenv'
dotenv.config()

//dùng express tạo server(app)
const app = express()
const PORT = process.env.PORT || 3000
databaseServices.connect().then(() => {
  databaseServices.indexUsers()
  databaseServices.indexRefreshTokens()
}) //kết nối với mongoDB
initFolder()

//global scope: luôn chạy, biến chuỗi json nhận đc thành object
app.use(express.json()) //server dùng middleware biến đổi các chuỗi json đc gửi lên

//app dùng userRoute
app.use('/users', userRouter)
app.use('/medias', mediaRouter)
app.use('/static', staticRouter)
app.use('/brands', brandRouter)

//lỗi của toàn bộ hệ thống dồn về đây
app.use(defaultErrorHandler)

//server mở ở PORT 3000
app.listen(PORT, () => {
  console.log('SERVER BE đang mở ở port: ' + PORT)
})
