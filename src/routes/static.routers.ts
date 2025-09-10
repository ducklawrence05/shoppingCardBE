import express, { Router } from 'express'
import { UPLOAD_VIDEO_DIR } from '~/constants/dir'
import { serveImageController, serveVideoController } from '~/controllers/static.controllers'
const staticRouter = Router()

//:namefile là params
// staticRouter.use('/image', express.static(UPLOAD_IMAGE_DIR))
staticRouter.get('/image/:namefile', serveImageController)

// staticRouter.use('/video', express.static(UPLOAD_VIDEO_DIR))
staticRouter.get('/video/:namefile', serveVideoController)

export default staticRouter
