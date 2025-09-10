import express from 'express'
import { createBrandController, getAllBrandsController, getBrandByIdController } from '~/controllers/brands.controllers'
import { createBrandValidator, idMongoParamValidator } from '~/middlewares/brand.middlewares'
import { accessTokenValidator } from '~/middlewares/users.middlewares'
import { wrapAsync } from '~/utils/handlers'

const brandRouter = express.Router()

/*desc: create a brand
method: POST
path: /brands/
Headers:{
    Authorization: Bearer <access_token>
}
Body:{
    name: string,
    hotline: string,
    address: string
}
*/
brandRouter.post(
  '/', //
  accessTokenValidator,
  createBrandValidator,
  wrapAsync(createBrandController)
)

/*desc: get infor of a brand by id
method: GET
path: /brand/:id
*/
brandRouter.get('/:id', idMongoParamValidator, wrapAsync(getBrandByIdController))

/*desc: get all brands
method: GET
path: /brands/ 
*/
brandRouter.get('/', wrapAsync(getAllBrandsController))

export default brandRouter
