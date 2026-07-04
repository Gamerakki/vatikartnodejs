const { exec } = require('child_process');
const { initializeApp, cert } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { URL } = require('url');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env
require('dotenv').config();

// Initialize Firebase Admin
const serviceAccount = require('../firebase-service-account.json');
initializeApp({
  credential: cert(serviceAccount),
  storageBucket: 'vatikart-app.firebasestorage.app'
});

const bucket = getStorage().bucket();

// Configure S3 Client for Cloudflare R2 fallback
const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT || undefined,
  region: 'auto',
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID || '',
    secretAccessKey: process.env.SECRET_ACCESS_KEY || '',
  },
});

let dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("Error: DATABASE_URL environment variable is not defined in .env file.");
  process.exit(1);
}

// Strip query parameters like "schema" which are unsupported by pg_dump
try {
  const parsedUrl = new URL(dbUrl);
  parsedUrl.searchParams.delete('schema');
  dbUrl = parsedUrl.toString();
} catch (e) {
  console.warn("Warning: Could not parse database URL to strip unsupported parameters.");
}

const localBackupPath = path.join(__dirname, `../vatikart_backup_${Date.now()}.dump`);

console.log('Initiating database dump...');
exec(`pg_dump "${dbUrl}" -F c -b -v -f "${localBackupPath}"`, async (error, stdout, stderr) => {
  if (error) {
    console.error('Database dump failed:', error.message);
    process.exit(1);
  }
  
  console.log('Database dump complete. Attempting to upload to Firebase Storage...');
  
  const destFilename = `db_backups/vatikart_backup_${new Date().toISOString().slice(0, 10)}.dump`;
  
  try {
    const [exists] = await bucket.exists();
    if (!exists) {
      throw new Error("Firebase Storage bucket does not exist. Please enable Storage in your Firebase Console.");
    }

    await bucket.upload(localBackupPath, {
      destination: destFilename,
      metadata: { contentType: 'application/octet-stream' }
    });
    console.log(`Successfully uploaded backup to Firebase Storage as ${destFilename}`);
    fs.unlinkSync(localBackupPath);
    console.log('Temporary local dump file removed.');
    process.exit(0);

  } catch (uploadError) {
    console.warn(`\n[Firebase Upload Warning]: ${uploadError.message}`);
    console.log('Falling back to Cloudflare R2 upload...');

    try {
      const fileBuffer = fs.readFileSync(localBackupPath);
      const command = new PutObjectCommand({
        Bucket: process.env.BUCKET || 'vatikart',
        Key: destFilename,
        Body: fileBuffer,
        ContentType: 'application/octet-stream',
      });

      await s3Client.send(command);
      console.log(`Successfully uploaded backup to Cloudflare R2 as ${destFilename}`);
      fs.unlinkSync(localBackupPath);
      console.log('Temporary local dump file removed.');
      process.exit(0);
    } catch (r2Error) {
      console.error('Cloudflare R2 backup upload also failed:', r2Error.message);
      if (fs.existsSync(localBackupPath)) {
        fs.unlinkSync(localBackupPath);
      }
      process.exit(1);
    }
  }
});
