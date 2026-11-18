/*
 * Signed Cloudinary uploads. The browser uploads the photo straight to Cloudinary,
 * but only with a signature from here, and only staff can get one. The API secret
 * never leaves the server, so nobody else can upload to the hotel's Cloudinary account.
 */
import { createHash } from 'node:crypto'
import { ApiError } from './errors.js'

const FOLDER = 'monsoon-ridge/rooms'
const FORMATS = 'jpg,jpeg,png,webp,avif' // Cloudinary rejects anything else (part of the signature)

export function signRoomUpload() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const secret = process.env.CLOUDINARY_API_SECRET
  if (!cloudName || !apiKey || !secret) {
    throw new ApiError('failed-precondition', 'Photo upload is not set up yet. Add the Cloudinary keys to the server settings.')
  }

  const params = { allowed_formats: FORMATS, folder: FOLDER, timestamp: Math.floor(Date.now() / 1000) }
  // Cloudinary signature: params sorted by name, joined as a=b&c=d, then the secret, SHA-1
  const toSign = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&')
  const signature = createHash('sha1').update(toSign + secret).digest('hex')

  return { cloudName, apiKey, signature, ...params } // signature is valid for about an hour
}
