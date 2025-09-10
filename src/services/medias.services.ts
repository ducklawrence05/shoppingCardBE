import { Request } from 'express'
import sharp from 'sharp'
import { UPLOAD_IMAGE_DIR } from '~/constants/dir'
import { getNameFromFileName, handleUploadImage, handleUploadVideo } from '~/utils/file'
import fs from 'fs'
import { Media } from '~/models/Other'
import { MediaType } from '~/constants/enums'
import { isProduction } from '~/constants/config'
class MediasServices {
  async handleUploadImage(req: Request) {
    const files = await handleUploadImage(req)
    /*
    Mỗi lần lặp là một async, tụi nó chạy ko đợi nhau, nghĩa là return result; sẽ chạy trước khi map hoàn thành 
    => đưa vào Promise.all()
    */
    const result = await Promise.all(
      files.map(async (file) => {
        const newFileName = getNameFromFileName(file.newFilename) + '.jpg'
        //đường dẫn đến file mới sẽ là
        const newPath = UPLOAD_IMAGE_DIR + '/' + newFileName
        //dùng sharp để nén file lại và lưu vào newPath
        await sharp(file.filepath).jpeg().toFile(newPath)
        //setup đường link
        fs.unlinkSync(file.filepath) //xoá hình cũ
        const url: Media = {
          url: isProduction //
            ? `${process.env.HOST}/static/image/${newFileName}`
            : `http://localhost:${process.env.PORT}/static/image/${newFileName}`,
          type: MediaType.Image
        }
        return url
      })
    )
    return result
  }

  async handleUploadVideo(req: Request) {
    const files = await handleUploadVideo(req)
    /*
    Mỗi lần lặp là một async, tụi nó chạy ko đợi nhau, nghĩa là return result; sẽ chạy trước khi map hoàn thành 
    => đưa vào Promise.all()
    */
    const result = await Promise.all(
      files.map(async (file) => {
        const url: Media = {
          url: isProduction //
            ? `${process.env.HOST}/static/video/${file.newFilename}`
            : `http://localhost:${process.env.PORT}/static/video/${file.newFilename}`,
          type: MediaType.Video
        }
        return url
      })
    )
    return result
  }
}

const mediasServices = new MediasServices()
export default mediasServices
