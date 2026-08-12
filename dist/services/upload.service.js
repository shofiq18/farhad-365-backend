"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadService = void 0;
const cloudinary_config_1 = __importDefault(require("../config/cloudinary.config"));
exports.uploadService = {
    /**
     * Uploads an image buffer directly to Cloudinary, forcing optimization & conversion to WebP format.
     */
    async uploadSingleImage(fileBuffer, folder = "pristto") {
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary_config_1.default.uploader.upload_stream({
                folder,
                format: "webp", // Automatically compress and output in WebP format
                transformation: [
                    { width: 1200, height: 1200, crop: "limit", quality: "auto:good" },
                ],
            }, (error, result) => {
                if (error) {
                    return reject(error);
                }
                if (!result) {
                    return reject(new Error("Cloudinary upload failed: result is empty."));
                }
                resolve(result);
            });
            uploadStream.end(fileBuffer);
        });
    },
};
exports.default = exports.uploadService;
