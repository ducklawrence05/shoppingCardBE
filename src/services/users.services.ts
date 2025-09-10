import User from '~/models/schemas/User.schema'
import databaseServices from './database.services'
import { LoginReqBody, RegisterReqBody, UpdateMeReqBody } from '~/models/requests/users.requests'
import { hashPassword } from '~/utils/crypto'
import { signToken, verifyToken } from '~/utils/jwt'
import { TokenType, UserVerifyStatus } from '~/constants/enums'
import dotenv from 'dotenv'
import { ErrorWithStatus } from '~/models/Errors'
import { USERS_MESSAGES } from '~/constants/messages'
import HTTP_STATUS from '~/constants/httpStatus'
import RefreshToken from '~/models/schemas/RefreshToken.schema'
import { ObjectId } from 'mongodb'
dotenv.config()

class UsersServices {
  private signAccessToken(user_id: string) {
    return signToken({
      payLoad: { user_id, token_type: TokenType.AccessToken },
      privateKey: process.env.JWT_SECRET_ACCESS_TOKEN as string,
      options: { expiresIn: process.env.ACCESS_TOKEN_EXPIRE_IN }
    })
  }

  private signRefreshToken(user_id: string, exp?: number) {
    if (exp) {
      return signToken({
        payLoad: { user_id, token_type: TokenType.RefreshToken, exp },
        privateKey: process.env.JWT_SECRET_REFRESH_TOKEN as string
      })
    } else {
      return signToken({
        payLoad: { user_id, token_type: TokenType.RefreshToken },
        privateKey: process.env.JWT_SECRET_REFRESH_TOKEN as string,
        options: { expiresIn: process.env.REFRESH_TOKEN_EXPIRE_IN }
      })
    }
  }

  private signEmailVerifyToken(user_id: string) {
    return signToken({
      payLoad: { user_id, token_type: TokenType.EmailVerificationToken },
      privateKey: process.env.JWT_SECRET_EMAIL_VERIFY_TOKEN as string,
      options: { expiresIn: process.env.EMAIL_VERIFY_TOKEN_EXPIRE_IN }
    })
  }

  private signForgotPasswordToken(user_id: string) {
    return signToken({
      payLoad: { user_id, token_type: TokenType.ForgotPasswordToken },
      privateKey: process.env.JWT_SECRET_FORGOT_PASSWORD_TOKEN as string,
      options: { expiresIn: process.env.FORGOT_PASSWORD_TOKEN_EXPIRE_IN }
    })
  }

  private decodeRefreshToken(refresh_token: string) {
    return verifyToken({
      token: refresh_token,
      privateKey: process.env.JWT_SECRET_REFRESH_TOKEN as string
    })
  }

  async checkEmailExist(email: string) {
    //dùng email lên database tìm user sở hữu email đó
    const user = await databaseServices.users.findOne({ email })
    return Boolean(user)
  }

  async checkRefreshToken({
    user_id,
    refresh_token
  }: {
    user_id: string //
    refresh_token: string
  }) {
    const refreshToken = await databaseServices.refresh_tokens.findOne({
      user_id: new ObjectId(user_id),
      token: refresh_token
    })
    if (!refreshToken) {
      throw new ErrorWithStatus({
        status: HTTP_STATUS.UNAUTHORIZED, //401
        message: USERS_MESSAGES.REFRESH_TOKEN_IS_INVALID
      })
    }
    return refreshToken
  }

  async checkEmailVerifyToken({
    user_id,
    email_verify_token
  }: {
    user_id: string //
    email_verify_token: string
  }) {
    //tìm user bằng user_id và email_verify_token
    const user = await databaseServices.users.findOne({
      _id: new ObjectId(user_id),
      email_verify_token
    })
    if (!user) {
      throw new ErrorWithStatus({
        status: HTTP_STATUS.NOT_FOUND, //404
        message: USERS_MESSAGES.USER_NOT_FOUND
      })
    }
    return user
  }

  async checkForgotPasswordToken({
    user_id, //
    forgot_password_token
  }: {
    user_id: string
    forgot_password_token: string
  }) {
    const user = await databaseServices.users.findOne({
      _id: new ObjectId(user_id),
      forgot_password_token
    })
    //nếu với 2 thông tin mà ko có user thì
    if (!user) {
      throw new ErrorWithStatus({
        status: HTTP_STATUS.UNAUTHORIZED, //401
        message: USERS_MESSAGES.FORGOT_PASSWORD_TOKEN_IS_INVALID
      })
    }
    //nếu có thì trả ra user cho ai cần dùng
    return user
  }

  async checkEmailVerified(user_id: string) {
    const user = await databaseServices.users.findOne({
      _id: new ObjectId(user_id),
      verify: UserVerifyStatus.Verified
    })
    //nếu ko có thằng user nào là user_id và đã verify thì
    if (!user) {
      throw new ErrorWithStatus({
        status: HTTP_STATUS.FORBIDDEN, //403
        message: USERS_MESSAGES.USER_NOT_VERIFIED
      })
    }
    //ném ra user đó cho ai cần dùng
    return user
  }

  async findUserById(user_id: string) {
    return await databaseServices.users.findOne({ _id: new ObjectId(user_id) })
  }

  async findUserByEmail(email: string) {
    return await databaseServices.users.findOne({ email })
  }

  async register(payLoad: RegisterReqBody) {
    const user_id = new ObjectId()
    const email_verify_token = await this.signEmailVerifyToken(user_id.toString())
    //
    const result = await databaseServices.users.insertOne(
      new User({
        _id: user_id,
        username: `user${user_id.toString()}`,
        email_verify_token,
        ...payLoad,
        password: hashPassword(payLoad.password),
        date_of_birth: new Date(payLoad.date_of_birth)
      })
    )
    //tạo access và refresh token
    const [access_token, refresh_token] = await Promise.all([
      this.signAccessToken(user_id.toString()),
      this.signRefreshToken(user_id.toString())
    ])

    //gửi qua email (mô phỏng bằng log tại nghèo)
    console.log(`
      Nội dung Email xác thực Email gồm:
        http://localhost:3000/users/verify-email/?email_verify_token=${email_verify_token}
    `)
    //lưu refreshToken lại
    const { iat, exp } = await this.decodeRefreshToken(refresh_token)
    await databaseServices.refresh_tokens.insertOne(
      new RefreshToken({
        token: refresh_token,
        user_id: new ObjectId(user_id),
        iat,
        exp
      })
    )
    return {
      access_token,
      refresh_token
    }
  }

  async login({ email, password }: LoginReqBody) {
    //dùng email và password để tìm user
    const user = await databaseServices.users.findOne({
      email,
      password: hashPassword(password)
    })
    if (!user) {
      throw new ErrorWithStatus({
        status: HTTP_STATUS.UNPROCESSABLE_ENTITY, //422
        message: USERS_MESSAGES.EMAIL_OR_PASSWORD_IS_INCORRECT
      })
    }
    //nếu có user thì tạo ac và rf
    const user_id = user._id.toString()
    const [access_token, refresh_token] = await Promise.all([
      this.signAccessToken(user_id),
      this.signRefreshToken(user_id)
    ])
    //lưu refreshToken lại
    const { iat, exp } = await this.decodeRefreshToken(refresh_token)
    await databaseServices.refresh_tokens.insertOne(
      new RefreshToken({
        token: refresh_token,
        user_id: new ObjectId(user_id),
        iat,
        exp
      })
    )
    return {
      access_token,
      refresh_token
    }
  }

  async logout(refresh_token: string) {
    await databaseServices.refresh_tokens.deleteOne({ token: refresh_token })
  }

  async verifyEmail(user_id: string) {
    //dùng user_id tìm và cập nhật
    await databaseServices.users.updateOne(
      //filter
      { _id: new ObjectId(user_id) },
      //update
      [
        {
          $set: {
            verify: UserVerifyStatus.Verified,
            email_verify_token: '',
            updated_at: '$$NOW'
            //ghi vậy thì khi Mongo lưu vào db thì lấy time ngay lúc đó
            //  còn dùng new Date() thì lấy time lúc code chạy
          }
        }
      ]
    )
    //sau khi verify xong thì tự động login giùm người dùng
    //tạo at và rf
    const [access_token, refresh_token] = await Promise.all([
      this.signAccessToken(user_id),
      this.signRefreshToken(user_id)
    ])
    //lưu refreshToken lại
    const { iat, exp } = await this.decodeRefreshToken(refresh_token)
    await databaseServices.refresh_tokens.insertOne(
      new RefreshToken({
        token: refresh_token,
        user_id: new ObjectId(user_id),
        iat,
        exp
      })
    )
    return {
      access_token,
      refresh_token
    }
  }

  async resendVerifyEmail(user_id: string) {
    //ký
    const email_verify_token = await this.signEmailVerifyToken(user_id)
    //lưu | update
    await databaseServices.users.updateOne(
      { _id: new ObjectId(user_id) }, //
      [
        {
          $set: {
            email_verify_token,
            updated_at: '$$NOW'
          }
        }
      ]
    )
    //gửi qua email (mô phỏng bằng log tại nghèo)
    console.log(`
      Nội dung Email xác thực Email gồm:
        http://localhost:3000/users/verify-email/?email_verify_token=${email_verify_token}
    `)
  }

  async forgotPassword(email: string) {
    const user = await databaseServices.users.findOne({ email })
    if (user) {
      const user_id = user._id
      const forgot_password_token = await this.signForgotPasswordToken(user_id.toString())
      await databaseServices.users.updateOne(
        { _id: user_id }, //
        [
          {
            $set: {
              forgot_password_token,
              updated_at: '$$NOW'
            }
          }
        ]
      )
      //gửi mail
      console.log(`
        Bấm vô đây để đổi mật khẩu:
          http://localhost:8000/reset-password/?forgot_password_token=${forgot_password_token}
      `)
    }
  }

  async resetPassword({ user_id, password }: { user_id: string; password: string }) {
    //tìm user thông qua user_id và cập nhật lại password và forgot_password_token
    //tất nhiên là lưu password đã hash rồi
    //ta không cần phải kiểm tra user có tồn tại không, vì ta đã làm trước đó ở controller đã làm rồi
    databaseServices.users.updateOne(
      { _id: new ObjectId(user_id) }, //
      [
        {
          $set: {
            password: hashPassword(password),
            forgot_password_token: '',
            updated_at: '$$NOW'
          }
        }
      ]
    )
    //nếu bạn muốn ngta đổi mk xong tự động đăng nhập luôn thì trả về access_token và refresh_token
    //ở đây mình chỉ cho ngta đổi mk thôi, sau đó họ nhận thông báo thành công và tự đăng nhập bằng mật khẩu mới
  }

  async getMe(user_id: string) {
    const userInfor = await databaseServices.users.findOne(
      { _id: new ObjectId(user_id) },
      {
        projection: {
          password: 0,
          email_verify_token: 0,
          forgot_password_token: 0
        }
      }
    )
    return userInfor // sẽ k có những thuộc tính nêu trên, tránh bị lộ thông tin
  }

  async updateMe({ user_id, payload }: { user_id: string; payload: UpdateMeReqBody }) {
    //payload này là những gì người dùng muốn update
    //  nhưng trong payload này có 2 vấn đề
    //1. nếu người dùng update date_of_birth là string cần chuyển về Date
    const _payload = payload.date_of_birth //
      ? { ...payload, date_of_birth: new Date(payload.date_of_birth) }
      : payload
    //2. nếu người dùng update username thì nó nên là unique
    if (_payload.username) {
      const user = await databaseServices.users.findOne({ username: payload.username })
      if (user) {
        //nếu tìm được là bị trùng
        throw new ErrorWithStatus({
          status: HTTP_STATUS.UNPROCESSABLE_ENTITY, //422
          message: USERS_MESSAGES.USERNAME_ALREADY_EXISTS
        })
      }
    }
    //vượt qua hết thì tiến hành cập nhật
    const userInfor = await databaseServices.users.findOneAndUpdate(
      { _id: new ObjectId(user_id) }, //
      [
        {
          $set: {
            ..._payload,
            updated_at: '$$NOW'
          }
        }
      ],
      {
        returnDocument: 'after',
        projection: {
          password: 0,
          email_verify_token: 0,
          forgot_password_token: 0
        }
      }
    )
    return userInfor // cho controller gửi cho người dùng
  }

  async changePassword({
    user_id,
    old_password,
    password
  }: {
    user_id: string
    old_password: string
    password: string
  }) {
    //dùng user_id và old_password để tìm user => biết đc người dùng có thực sự
    //  sở hữu acccount hay ko
    const user = await databaseServices.users.findOne({
      _id: new ObjectId(user_id),
      password: hashPassword(old_password)
    })
    //nếu tìm ko ra thì nghĩa là thằng client ko phải chủ acc
    if (!user) {
      throw new ErrorWithStatus({
        status: HTTP_STATUS.NOT_FOUND, //404
        message: USERS_MESSAGES.USER_NOT_FOUND
      })
    }
    //nếu mà có thì mình tiến hành cập nhật password mới
    await databaseServices.users.updateOne(
      { _id: new ObjectId(user_id) }, //
      [
        {
          $set: {
            password: hashPassword(password),
            updated_at: '$$NOW'
          }
        }
      ]
    )
  }

  async refreshToken({
    user_id, //
    refresh_token,
    exp
  }: {
    user_id: string
    refresh_token: string
    exp: number
  }) {
    //tạo 2 mã mới
    const [acccess_token, new_refresh_token] = await Promise.all([
      this.signAccessToken(user_id), //
      this.signRefreshToken(user_id, exp)
    ])
    //lưu rf mới vào db
    const { iat } = await this.decodeRefreshToken(refresh_token)
    await databaseServices.refresh_tokens.insertOne(
      new RefreshToken({
        token: new_refresh_token,
        user_id: new ObjectId(user_id),
        iat,
        exp
      })
    )

    //xoá rf token cũ để ko ai dùng nữa
    await databaseServices.refresh_tokens.deleteOne({ token: refresh_token })
    //gửi cặp mã mới cho người dùng
    return {
      acccess_token,
      refresh_token: new_refresh_token
    }
  }
}
//trong dó projection(phép chiếu pi) giúp ta loại bỏ lấy về các thuộc tính như password, email_verify_token, forgot_password_token

//tạo instance
const usersServices = new UsersServices()
export default usersServices
