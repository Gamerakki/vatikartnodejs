import { S3Client, PutObjectCommand, DeleteObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import path from 'path';
import { generateRandomToken } from './common';
import { logger } from '../config/logger';

const bucketName = process.env.BUCKET || 'vatikart-bucket';
const accessKeyId = process.env.ACCESS_KEY_ID || '';
const secretAccessKey = process.env.SECRET_ACCESS_KEY || '';
const s3Endpoint = process.env.S3_ENDPOINT || '';

// Configure S3 Client (R2 compatible)
const s3Client = new S3Client({
  endpoint: s3Endpoint || undefined,
  region: 'auto',
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

export interface FileValidations {
  folderName: string;
  uploadLocation: 'local' | 'r2';
  maxFileSize?: number; // In bytes
  allowedExtensions?: Record<string, boolean>;
  allowedMimeTypes?: Record<string, boolean>;
}

export function getBucketName(): string {
  return process.env.BUCKET || bucketName;
}

export function isValidFileType(
  fileName: string,
  mimeType: string,
  allowedExtensions: Record<string, boolean>,
  allowedMimeTypes: Record<string, boolean>
): boolean {
  const ext = path.extname(fileName).toLowerCase();
  if (!allowedExtensions[ext]) {
    return false;
  }
  return !!allowedMimeTypes[mimeType];
}

export async function uploadToR2(
  folderName: string,
  fileBuffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<string> {
  const ext = path.extname(originalName).toLowerCase();
  const randomFileName = generateRandomToken() + ext;
  const key = folderName ? `${folderName}/${randomFileName}` : randomFileName;

  const command = new PutObjectCommand({
    Bucket: getBucketName(),
    Key: key,
    Body: fileBuffer,
    ContentType: mimeType,
  });

  await s3Client.send(command);
  // Return just the generated random filename (matching Go behavior where uploadToR2 returns randomFileName)
  return randomFileName;
}

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export async function uploadFile(
  file: MulterFile,
  validations: FileValidations
): Promise<string> {
  if (validations.uploadLocation !== 'local' && validations.uploadLocation !== 'r2') {
    throw new Error("upload location should be either 'local' or 'r2'");
  }

  if (validations.maxFileSize && file.size > validations.maxFileSize) {
    throw new Error('exceeding file size');
  }

  if (validations.allowedExtensions && validations.allowedMimeTypes) {
    const valid = isValidFileType(
      file.originalname,
      file.mimetype,
      validations.allowedExtensions,
      validations.allowedMimeTypes
    );
    if (!valid) {
      throw new Error('invalid extension');
    }
  }

  if (validations.uploadLocation === 'r2') {
    return await uploadToR2(validations.folderName, file.buffer, file.originalname, file.mimetype);
  }

  throw new Error('Local uploads are not supported yet');
}

export async function uploadMultipleParallelToR2(
  folderName: string,
  files: MulterFile[]
): Promise<string[]> {
  const uploadPromises = files.map((file) =>
    uploadToR2(folderName, file.buffer, file.originalname, file.mimetype)
  );
  return Promise.all(uploadPromises);
}

export async function deleteFromR2(fileName: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: getBucketName(),
    Key: fileName,
  });
  await s3Client.send(command);
}

export async function deleteMultipleFromR2(fileNames: string[]): Promise<void> {
  if (fileNames.length === 0) {
    throw new Error('no file names provided');
  }

  const objects = fileNames.map((name) => ({ Key: name }));
  const command = new DeleteObjectsCommand({
    Bucket: getBucketName(),
    Delete: {
      Objects: objects,
      Quiet: false,
    },
  });

  const response = await s3Client.send(command);
  
  if (response.Errors && response.Errors.length > 0) {
    const failed = response.Errors.map((err) => `${err.Key} - ${err.Message}`);
    throw new Error(`some deletions failed: ${failed.join(', ')}`);
  }
}

export async function uploadQRCodeToR2(
  qrCodeBytes: Buffer,
  folderName: string
): Promise<string> {
  const randomFileName = generateRandomToken() + '.png';
  const key = folderName ? `${folderName}/${randomFileName}` : randomFileName;

  const command = new PutObjectCommand({
    Bucket: getBucketName(),
    Key: key,
    Body: qrCodeBytes,
    ContentType: 'image/png',
  });

  await s3Client.send(command);
  return key; // Returns full path (matching Go)
}

export async function generatePresignedUploadURL(
  key: string,
  contentType: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: getBucketName(),
    Key: key,
    ContentType: contentType,
  });

  // Expire in 10 minutes (600 seconds)
  return getSignedUrl(s3Client, command, { expiresIn: 600 });
}
