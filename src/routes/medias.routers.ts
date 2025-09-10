import { Router } from 'express'
import { uploadImageController, uploadVideoController } from '~/controllers/medias.controllers'
import { wrapAsync } from '~/utils/handlers'
const mediaRouter = Router()

//route giúp người dùng upload các bức ảnh
mediaRouter.post('/upload-image', wrapAsync(uploadImageController))
//route giúp người dùng upload các video
mediaRouter.post('/upload-video', wrapAsync(uploadVideoController))

export default mediaRouter
