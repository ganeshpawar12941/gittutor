import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Create storage engine for Multer
const storage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'gittutor/courses',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 800, height: 450, crop: 'fill' }],
        quality: 'auto:good'
    }
});

export { cloudinary, storage };
