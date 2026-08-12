import cloudinary from "../config/cloudinary.config";
import { UploadApiResponse } from "cloudinary";

export const uploadService = {
  /**
   * Uploads an image buffer directly to Cloudinary, forcing optimization & conversion to WebP format.
   */
  async uploadSingleImage(
    fileBuffer: Buffer,
    folder: string = "pristto"
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          format: "webp", // Automatically compress and output in WebP format
          transformation: [
            { width: 1200, height: 1200, crop: "limit", quality: "auto:good" },
          ],
        },
        (error, result) => {
          if (error) {
            return reject(error);
          }
          if (!result) {
            return reject(new Error("Cloudinary upload failed: result is empty."));
          }
          resolve(result);
        }
      );
      
      uploadStream.end(fileBuffer);
    });
  },
};

export default uploadService;
