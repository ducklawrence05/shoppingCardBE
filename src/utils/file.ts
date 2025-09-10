import { Request } from 'express'
import formidable, { File } from 'formidable'
import fs from 'fs' //module chứa các method xử lý file
import { UPLOAD_IMAGE_TEMP_DIR, UPLOAD_VIDEO_DIR } from '~/constants/dir'

export const initFolder = () => {
  //nếu mà tìm ko đc thì tạo mới thư mục
  ;[UPLOAD_IMAGE_TEMP_DIR, UPLOAD_VIDEO_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, {
        recursive: true //cho phép tạo lồng các thư mục
      })
    }
  })
}

//tạo hàm handleUploadImage: hàm nhận vào req
//  ép req phải đi qua tấm lưới lọc formidable
//  từ đó lấy được các file cho req, chỉ chọn ra các file là image
//  return các file đó ra ngoài
export const handleUploadImage = async (req: Request) => {
  //tạo lưới lọc từ formidable
  const form = formidable({
    uploadDir: UPLOAD_IMAGE_TEMP_DIR,
    maxFiles: 4, //tối đa 4 file
    maxFileSize: 300 * 1024, //300KB
    maxTotalFileSize: 300 * 1024 * 4,
    keepExtensions: true, //giữ lại đuôi file
    filter: ({ name, originalFilename, mimetype }) => {
      //name: là field đc gửi thông qua form, thẻ <input name = 'fileNe' />
      //originalFilename: tên gốc của file
      //mimetype: kiểu định dạng file 'video/mp4' 'video/mkv' 'image/png' 'image/jpeg'
      const valid = name === 'image' && Boolean(mimetype?.includes('image'))
      if (!valid) {
        form.emit('error' as any, new Error('File Type invalid!') as any)
      }
      return valid //true
    }
  })
  //có lưới ròi thì ép req vào
  return new Promise<File[]>((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err)
      if (!files.image) return reject(new Error('Image is empty'))
      return resolve(files.image)
    })
  })
}

export const handleUploadVideo = async (req: Request) => {
  //tạo lưới lọc từ formidable
  const form = formidable({
    uploadDir: UPLOAD_VIDEO_DIR,
    maxFiles: 1, //tối đa 1 file
    maxFileSize: 50 * 1024 * 1024, //50MB
    keepExtensions: true, //giữ lại đuôi file
    filter: ({ name, originalFilename, mimetype }) => {
      //name: là field đc gửi thông qua form, thẻ <input name = 'fileNe' />
      //originalFilename: tên gốc của file
      //mimetype: kiểu định dạng file 'video/mp4' 'video/mkv' 'image/png' 'image/jpeg'
      const valid = name === 'video' && Boolean(mimetype?.includes('video'))
      if (!valid) {
        form.emit('error' as any, new Error('File Type invalid!') as any)
      }
      return valid //true
    }
  })
  //có lưới ròi thì ép req vào
  return new Promise<File[]>((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err)
      if (!files.video) return reject(new Error('Video is empty'))
      return resolve(files.video)
    })
  })
}

//viết hàm nhận vào fullFileName và chỉ lấy tên bỏ đuôi
//  sang.anh1.png -> sang-anh1
export const getNameFromFileName = (filename: string) => {
  const nameArr = filename.split('.')
  nameArr.pop()
  return nameArr.join('-')
}
