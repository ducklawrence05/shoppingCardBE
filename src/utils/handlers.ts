import { NextFunction, Request, RequestHandler, Response } from 'express'

// file này lưu hàm wrapAsync
// wrapAsync nhận vào 'Req Handler A'
// sau đó trả ra 'Req Handler B' có cấu trúc try catch next
// và chạy 'Req Handler A' bên trong try
//  P và T được truyền vào là gì thì hãy theo thằng đó
export const wrapAsync = <P, T>(func: RequestHandler<P, any, any, T>) => {
  return async (req: Request<P, any, any, T>, res: Response, next: NextFunction) => {
    try {
      await func(req, res, next)
    } catch (error) {
      next(error)
    }
  }
}
