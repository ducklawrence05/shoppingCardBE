import express from 'express'
import {
  changePasswordController,
  forgotPasswordController,
  getMeController,
  loginController,
  logoutController,
  refreshTokenController,
  registerController,
  resendVerifyEmailController,
  resetPasswordController,
  updateMeController,
  verifyEmailTokenController,
  verifyForgotPasswordTokenController
} from '~/controllers/users.controllers'
import { filterMiddleware } from '~/middlewares/common.middlewares'
import {
  accessTokenValidator,
  changePasswordValidator,
  emailVerifyTokenValidator,
  forgotPasswordTokenValidator,
  forgotPasswordValidator,
  loginValidator,
  refreshTokenValidator,
  registerValidator,
  resetPasswordValidator,
  updateMeValidator
} from '~/middlewares/users.middlewares'
import { UpdateMeReqBody } from '~/models/requests/users.requests'
import { wrapAsync } from '~/utils/handlers'
//dựng userRouter
const userRouter = express.Router()

//handler: hàm nhận req trả res
//  các req và res giữa middleware và controller là 1

/*desc: Register a new user
path: users/register
method: post
body:{
    name: string,
    email: string,
    password: string,
    confirm_password: string,
    date_of_birth: string có cấu trúc ISO8601
}
*/
userRouter.post('/register', registerValidator, wrapAsync(registerController))

/*desc: login
path: users/login
method: post
body:{
    email: string,
    password: string
}
*/
userRouter.post('/login', loginValidator, wrapAsync(loginController))

/*desc: logout
path: users/logout
method: post
headers:{
    Authorization: 'Bearer <access_token>'
}
body:{
    refresh_token: string
}
*/
userRouter.post('/logout', accessTokenValidator, refreshTokenValidator, wrapAsync(logoutController))

/*desc: verify email
khi người dùng nhấn vào link có trong email của họ
thì email_verify_token sẽ đc gửi lên server BE thông qua req.query
path: users/verify-email/?email_verify_token=string
method: get
*/
userRouter.get(
  '/verify-email/', //
  emailVerifyTokenValidator, //chỗ này check validate thôi
  wrapAsync(verifyEmailTokenController) //chỗ này mới check email
)

/*desc: resend email verify token
người dùng sẽ dùng chức năng này khi làm mất, lạc email
phải đăng nhập thì mới cho verify
headers{
    Authorization: 'Bearer <access_token>'
}
method: post
*/
userRouter.post(
  '/resend-verify-email', //
  accessTokenValidator,
  wrapAsync(resendVerifyEmailController)
)

/*desc: forgot password
khi quên mật khẩu thì dùng chức năng này
path: users/forgot-password
method: post
body:{
    email: string
}
*/
userRouter.post(
  '/forgot-password', //
  forgotPasswordValidator,
  wrapAsync(forgotPasswordController)
)

/*desc: Verify forgot password token
kiểm tra mã forgot password token có còn hiệu lực không
path: users/verify-forgot-password
method: POST
header: không cần, vì  ngta quên mật khẩu rồi, thì sao mà đăng nhập để có authen đc
body: {
  forgot_password_token: string
}
*/
userRouter.post(
  '/verify-forgot-password', //
  forgotPasswordTokenValidator,
  wrapAsync(verifyForgotPasswordTokenController)
)

/*desc: reset password
path: 'users/reset-password'
method: POST
header: không cần, vì  ngta quên mật khẩu rồi, thì sao mà đăng nhập để có authen đc
body: {
  password: string, 
  confirm_password: string,
  forgot_password_token: string
}
*/
userRouter.post(
  '/reset-password', //
  forgotPasswordTokenValidator, //kiểm tra forgot_password_token
  resetPasswordValidator, //kiểm tra password, confirm_password
  wrapAsync(resetPasswordController) //xử lý logic
)

/*desc: get me
lấy thông tin của chính mình
path: 'users/me'
method: post
header: {
  Authorization: 'Bearer <access_token>'
}
*/
userRouter.post(
  '/me', //
  accessTokenValidator,
  wrapAsync(getMeController)
)

/*des: update profile của user
path: '/me'
method: patch
Header: {Authorization: Bearer <access_token>}
body: {
  name?: string
  date_of_birth?: Date
  bio?: string // optional
  location?: string // optional
  website?: string // optional
  username?: string // optional
  avatar?: string // optional
  cover_photo?: string // optional
}
*/
userRouter.patch(
  '/me',
  filterMiddleware<UpdateMeReqBody>([
    'name',
    'date_of_birth',
    'bio',
    'location',
    'website',
    'avatar',
    'username',
    'cover_photo'
  ]), //cần 1 hàm sàng lọc req.body
  accessTokenValidator,
  updateMeValidator,
  wrapAsync(updateMeController)
)

/*desc: change-password
đổi mật khẩu
patch: users/change-password
method: put
headers:{
  Authorization: 'Bearer <access_token>'
}
body:{
  old_password: string,
  password: string,
  confirm_password: string
}
*/
userRouter.put(
  '/change-password', //
  accessTokenValidator,
  changePasswordValidator,
  wrapAsync(changePasswordController)
)

/*desc: refresh-token
chức năng này dùng khi ac hết hạn, cần lấy về ac mới (kèm rf mới)
path: users/refresh-token
method: post
body:{
  refresh_token: string
}
*/
userRouter.post(
  '/refresh-token', //
  refreshTokenValidator,
  wrapAsync(refreshTokenController)
)

export default userRouter

/*so sánh throw và next
    throw và next(Error) đều chạy trong hàm bth được
    Riêng trong hàm async, throw đi nhanh hơn hàm (ko kịp catch) nên sẽ bị bug, 
        next(E) thì trong async đc
    fix1: throw trong async bằng try throw rồi catch chứa next(error) =)))
    fix2: Promise.reject(new Error('Rớt mạng')).catch((value) => {console.log(value)})
                                            or .catch(next)
    Tại sao phải dùng throw do server chỉ throw nếu lỗi 
*/
