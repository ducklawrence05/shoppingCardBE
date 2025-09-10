// viết hàm validate nhận vào checkSchema
// hàm sẽ trả ra middleware xử lý lỗi

import { ValidationChain, validationResult } from 'express-validator'
import { RunnableValidationChains } from 'express-validator/lib/middlewares/schema'
import { Request, Response, NextFunction } from 'express'
import { EntityError, ErrorWithStatus } from '~/models/Errors'
import HTTP_STATUS from '~/constants/httpStatus'

// ai gọi validate(checkSchema) nhận được middleware
export const validate = (validation: RunnableValidationChains<ValidationChain>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    //chờ ghi lỗi vào request
    await validation.run(req)
    //lấy lỗi trong req
    const errors = validationResult(req)
    if (errors.isEmpty()) {
      return next()
    } else {
      const errorObject = errors.mapped()
      const entityError = new EntityError({ errors: {} })
      for (const key in errorObject) {
        const { msg } = errorObject[key]
        if (msg instanceof ErrorWithStatus && msg.status != HTTP_STATUS.UNPROCESSABLE_ENTITY) {
          return next(msg)
        }
        entityError.errors[key] = msg
      }
      next(entityError)
    }
  }
}
