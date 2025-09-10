import { NextFunction, Request, Response } from 'express'
import {
  ChangePasswordReqBody,
  LoginReqBody,
  LogoutReqBody,
  RefreshTokenReqBody,
  RegisterReqBody,
  ResetPasswordReqBody,
  TokenPayLoad,
  UpdateMeReqBody,
  VerifyEmailReqQuery,
  VerifyForgotPasswordTokenReqBody
} from '~/models/requests/users.requests'
import usersServices from '~/services/users.services'
import { ParamsDictionary } from 'express-serve-static-core'
import { ErrorWithStatus } from '~/models/Errors'
import HTTP_STATUS from '~/constants/httpStatus'
import { USERS_MESSAGES } from '~/constants/messages'
import { UserVerifyStatus } from '~/constants/enums'
//controller là handler có nhiệm vụ tập kết dữ liệu từ người dùng
//  và phân phát vào các services đúng chỗ

//dễ hiểu hơn
//controller là nơi tập kết và xử lý logic cho các data nhận đc
//  trong controller các data đều phải clean

export const registerController = async (req: Request<ParamsDictionary, any, RegisterReqBody>, res: Response) => {
  const { email } = req.body
  //gọi service và tạo user từ email, password trong req.body
  //  lưu user đó vào users collection của mongoDB

  //kiểm tra email có bị trùng chưa | email có tồn tại chưa | email có ai dùng chưa
  const isDup = await usersServices.checkEmailExist(email)
  if (isDup) {
    throw new ErrorWithStatus({
      status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
      message: USERS_MESSAGES.EMAIL_ALREADY_EXISTS
    })
  }

  const result = await usersServices.register(req.body)
  res.status(HTTP_STATUS.CREATED).json({
    message: USERS_MESSAGES.REGISTER_SUCCESS,
    result
  })
}

export const loginController = async (
  req: Request<ParamsDictionary, any, LoginReqBody>,
  res: Response,
  next: NextFunction
) => {
  // cần lấy email và password để tìm xem user nào đang sở hữu
  //nếu ko có user nào thì ngừng
  //nếu có thì tại ac rf
  const { email, password } = req.body
  const result = await usersServices.login({ email, password })
  res.status(HTTP_STATUS.OK).json({
    message: USERS_MESSAGES.LOGIN_SUCCESS,
    result //ac và rf
  })
}

export const logoutController = async (
  req: Request<ParamsDictionary, any, LogoutReqBody>,
  res: Response,
  next: NextFunction
) => {
  //xem thử user_id trong payload của refresh_token và acccess_token có giống ko
  const { refresh_token } = req.body
  const { user_id: user_id_at } = req.decode_authorization as TokenPayLoad
  const { user_id: user_id_rf } = req.decode_refresh_token as TokenPayLoad
  if (user_id_at != user_id_rf) {
    throw new ErrorWithStatus({
      status: HTTP_STATUS.UNAUTHORIZED, //401
      message: USERS_MESSAGES.REFRESH_TOKEN_IS_INVALID
    })
  }
  //nếu mà trùng rồi thì mình xem thử refresh_token này có quyền dùng dịch vụ ko?
  await usersServices.checkRefreshToken({
    user_id: user_id_rf, //dùng at cx đc do trùng thì mới đc xuống đây
    refresh_token
  })
  //khi nào có mã đó trong database thì mình tiến hành logout(xoá rf khỏi hệ thống)
  await usersServices.logout(refresh_token)
  res.status(HTTP_STATUS.OK).json({
    message: USERS_MESSAGES.LOGOUT_SUCCESS
  })
}

export const verifyEmailTokenController = async (
  req: Request<ParamsDictionary, any, any, VerifyEmailReqQuery>,
  res: Response,
  next: NextFunction
) => {
  //khi họ bấm vào link, thì họ sẽ gửi email_verify_token lên thông qua
  //req.query
  const { email_verify_token } = req.query
  const { user_id } = req.decode_email_verify_token as TokenPayLoad

  //kiểm tra xem trong database có user nào sở hữu là user_id trong payload và
  //          email_verify_token
  const user = await usersServices.checkEmailVerifyToken({ user_id, email_verify_token })

  //kiểm tra xem user tìm được bị banned chưa, chưa thì mới verify
  if (user.verify == UserVerifyStatus.Banned) {
    throw new ErrorWithStatus({
      status: HTTP_STATUS.UNAUTHORIZED, //401
      message: USERS_MESSAGES.EMAIL_HAS_BEEN_BANNED
    })
  } else {
    //chưa verify thì mình verify
    const result = await usersServices.verifyEmail(user_id)
    //sau khi verify thì
    res.status(HTTP_STATUS.OK).json({
      message: USERS_MESSAGES.VERIFY_EMAIL_SUCCESS,
      result //ac và rf
    })
  }
}

export const resendVerifyEmailController = async (
  req: Request<ParamsDictionary, any, any>,
  res: Response,
  next: NextFunction
) => {
  //dùng user_id tìm user đó
  const { user_id } = req.decode_authorization as TokenPayLoad

  //kiểm tra user đó có verify hay bị banned ko ?
  const user = await usersServices.findUserById(user_id)
  if (!user) {
    throw new ErrorWithStatus({
      status: HTTP_STATUS.NOT_FOUND, //404
      message: USERS_MESSAGES.USER_NOT_FOUND
    })
  }
  if (user.verify == UserVerifyStatus.Verified) {
    throw new ErrorWithStatus({
      status: HTTP_STATUS.OK,
      message: USERS_MESSAGES.EMAIL_HAS_BEEN_VERIFIED
    })
  } else if (user.verify == UserVerifyStatus.Banned) {
    throw new ErrorWithStatus({
      status: HTTP_STATUS.UNAUTHORIZED, //401
      message: USERS_MESSAGES.EMAIL_HAS_BEEN_BANNED
    })
  } else {
    //chưa verify thì resend
    await usersServices.resendVerifyEmail(user_id)
    res.status(HTTP_STATUS.OK).json({
      message: USERS_MESSAGES.RESEND_EMAIL_VERIFY_TOKEN_SUCCESS
    })
  }
}

export const forgotPasswordController = async (
  req: Request<ParamsDictionary, any, any>,
  res: Response,
  next: NextFunction
) => {
  const { email } = req.body
  const hasUser = await usersServices.checkEmailExist(email)
  if (!hasUser) {
    throw new ErrorWithStatus({
      status: HTTP_STATUS.NOT_FOUND, //404
      message: USERS_MESSAGES.USER_NOT_FOUND
    })
  } else {
    await usersServices.forgotPassword(email)
    res.status(HTTP_STATUS.OK).json({
      message: USERS_MESSAGES.CHECK_EMAIL_TO_RESET_PASSWORD
    })
  }
}

export const verifyForgotPasswordTokenController = async (
  req: Request<ParamsDictionary, any, VerifyForgotPasswordTokenReqBody>,
  res: Response,
  next: NextFunction
) => {
  //vào được đây có nghĩa là forgot_password_token trong body là hợp lệ
  //lấy user_id từ req.decoded_forgot_password_token và forgot_password_token từ req.body
  const { forgot_password_token } = req.body
  //lấy user_id để tìm xem user có sở hữu forgot_password_token này ko
  const { user_id } = req.decode_forgot_password_token as TokenPayLoad
  //kiểm tra xem forgot_password_token còn trong db này ko?
  await usersServices.checkForgotPasswordToken({ user_id, forgot_password_token })
  //nếu qua hàm trên êm xuôi thì nghĩa là token hợp lệ
  //  trả về thông báo cho FE
  res.status(HTTP_STATUS.OK).json({
    message: USERS_MESSAGES.VERIFY_FORGOT_PASSWORD_TOKEN_SUCCESS
  })
}

export const resetPasswordController = async (
  req: Request<ParamsDictionary, any, ResetPasswordReqBody>,
  res: Response,
  next: NextFunction
) => {
  //vào được đây có nghĩa là forgot_password_token trong body là hợp lệ
  //lấy user_id từ req.decoded_forgot_password_token và forgot_password_token từ req.body
  const { forgot_password_token, password } = req.body
  //lấy user_id để tìm xem user có sở hữu forgot_password_token này ko
  const { user_id } = req.decode_forgot_password_token as TokenPayLoad
  //kiểm tra xem forgot_password_token còn trong db này ko?
  await usersServices.checkForgotPasswordToken({ user_id, forgot_password_token })
  //nếu qua hàm trên êm xuôi thì nghĩa là token hợp lệ thì mình reset password
  await usersServices.resetPassword({ user_id, password })
  //  trả về thông báo cho FE
  res.status(HTTP_STATUS.OK).json({
    message: USERS_MESSAGES.RESET_PASSWORD_SUCCESS
  })
}

export const getMeController = async (
  req: Request<ParamsDictionary, any, any>, //
  res: Response,
  next: NextFunction
) => {
  //middleware accessTokenValidator đã chạy rồi, nên ta có thể lấy đc user_id từ decoded_authorization
  const { user_id } = req.decode_authorization as TokenPayLoad
  //tìm user thông qua user_id này và trả về user đó
  //  nhưng mình ko nên đưa hết thông tin cho người ta
  const userInfor = await usersServices.getMe(user_id)
  res.status(HTTP_STATUS.OK).json({
    message: USERS_MESSAGES.GET_ME_SUCCESS,
    userInfor
  })
}

export const updateMeController = async (
  req: Request<ParamsDictionary, any, UpdateMeReqBody>, //
  res: Response,
  next: NextFunction
) => {
  // nhận access_token để biết họ đã login
  //  và cho mình biết họ là ai thông qua user_id từ payload
  const { user_id } = req.decode_authorization as TokenPayLoad
  //req.body chứa các thuộc tính mà người dùng muốn cập nhật
  const payload = req.body //payload là những gì người dùng gửi lên
  // ta muốn account phải verify thì mới đc cập nhật
  await usersServices.checkEmailVerified(user_id)
  //nếu gọi hàm trên mà ko có gì xảy ra thì nghĩa là user đã verify rồi
  //  mình tiến hành cập nhật thông tin mà người dùng cung cấp
  const userInfor = await usersServices.updateMe({ user_id, payload })
  //
  res.status(HTTP_STATUS.OK).json({
    message: USERS_MESSAGES.UPDATE_PROFILE_SUCCESS,
    userInfor
  })
}

export const changePasswordController = async (
  req: Request<ParamsDictionary, any, ChangePasswordReqBody>, //
  res: Response,
  next: NextFunction
) => {
  const { user_id } = req.decode_authorization as TokenPayLoad
  const { old_password, password } = req.body
  await usersServices.changePassword({
    user_id,
    old_password,
    password
  })
  //nếu đổi thành công thì
  res.status(HTTP_STATUS.OK).json({
    message: USERS_MESSAGES.CHANGE_PASSWORD_SUCCESS
  })
}

export const refreshTokenController = async (
  req: Request<ParamsDictionary, any, RefreshTokenReqBody>, //
  res: Response,
  next: NextFunction
) => {
  const { user_id, exp } = req.decode_refresh_token as TokenPayLoad
  const { refresh_token } = req.body
  await usersServices.checkRefreshToken({ user_id, refresh_token })
  //nếu kiểm tra rf còn hiệu lực thì tiến hành refreshToken cho người dùng
  const result = await usersServices.refreshToken({ user_id, refresh_token, exp })
  //trả cho người dùng
  res.status(HTTP_STATUS.OK).json({
    message: USERS_MESSAGES.REFRESH_TOKEN_SUCCESS,
    result //ac và rf mới
  })
}
