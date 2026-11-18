import { api } from './firebase'

const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
const MAX_MB = 8

/** Checks a file before uploading. Returns an error message or ''. */
export function checkImage(file) {
  if (!TYPES.includes(file.type)) return `"${file.name}" is not a JPG, PNG, WebP or AVIF image.`
  if (file.size > MAX_MB * 1024 * 1024) return `"${file.name}" is larger than ${MAX_MB} MB. Please use a smaller photo.`
  return ''
}

/*
 * Uploads one photo straight to Cloudinary using a signature from our API
 * (staff only), and returns an optimised https link to store on the room.
 * onProgress(0..100) is called while uploading.
 */
export async function uploadRoomPhoto(file, onProgress = () => {}) {
  const problem = checkImage(file)
  if (problem) throw new Error(problem)

  const { data: sig } = await api.signUpload()
  const form = new FormData()
  form.append('file', file)
  form.append('api_key', sig.apiKey)
  form.append('timestamp', sig.timestamp)
  form.append('signature', sig.signature)
  form.append('folder', sig.folder)
  form.append('allowed_formats', sig.allowed_formats)

  const result = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${encodeURIComponent(sig.cloudName)}/image/upload`)
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100))
    xhr.onload = () => {
      let body = {}
      try { body = JSON.parse(xhr.responseText) } catch { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300 && body.secure_url) resolve(body)
      else reject(new Error(body.error?.message ? `Upload failed: ${body.error.message}` : 'Upload failed. Please try again.'))
    }
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'))
    xhr.send(form)
  })

  // Serve a right-sized, modern-format version (Cloudinary converts on the fly)
  return result.secure_url.replace('/image/upload/', '/image/upload/f_auto,q_auto,c_limit,w_1600/')
}
