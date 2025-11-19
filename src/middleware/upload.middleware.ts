import multer from 'multer';
import path from 'path';
import ApiError from '../utils/ApiError';
import { FILE_UPLOAD, HTTP_STATUS } from '../constants';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = FILE_UPLOAD.ALLOWED_MIME_TYPES as readonly string[];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        'Invalid file type. Only CSV files are allowed.'
      ) as any
    );
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: FILE_UPLOAD.MAX_SIZE,
  },
});
