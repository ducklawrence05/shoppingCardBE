import { NextFunction, Request, Response } from 'express'
import { pick } from 'lodash'

//làm mod lại req.body theo mãng các key mình muốn
export const filterMiddleware = <T>(filterKeys: Array<keyof T>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    req.body = pick(req.body, filterKeys)
    next()
  }
}
