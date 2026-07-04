const { exec } = require('child_process');
const { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const { URL } = require('url');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env using an absolute path relative to the script
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const bucketName = process.env.BUCKET || 'vatikart';
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
  console.warn("Warning: Could not parse database URL.");
}

const timestamp = Date.now();
const localBackupPath = path.join(__dirname, `../vatikart_backup_${timestamp}.dump`);

console.log('Initiating database dump...');
exec(`pg_dump "${dbUrl}" -F c -b -v -f "${localBackupPath}"`, async (error, stdout, stderr) => {
  if (error) {
    console.error('Database dump failed:', error.message);
    process.exit(1);
  }
  
  console.log('Database dump complete. Uploading to Cloudflare R2...');
  
  const destFilename = `db_backups/vatikart_backup_${timestamp}.dump`;
  
  try {
    const fileBuffer = fs.readFileSync(localBackupPath);
    const uploadCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: destFilename,
      Body: fileBuffer,
      ContentType: 'application/octet-stream',
    });

    await s3Client.send(uploadCommand);
    console.log(`Successfully uploaded backup to Cloudflare R2 as ${destFilename}`);
    
    // Clean up local temp file
    fs.unlinkSync(localBackupPath);
    console.log('Temporary local dump file removed.');

    // Now clean up old backups from Cloudflare R2: Keep only latest 4
    console.log('Checking for old backups in R2 bucket...');
    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: 'db_backups/',
    });

    const response = await s3Client.send(listCommand);
    const contents = response.Contents || [];

    // Filter to only include files matching the pattern "vatikart_backup_*.dump"
    const backupFiles = contents
      .filter(item => item.Key.match(/db_backups\/vatikart_backup_\d+\.dump/))
      .sort((a, b) => b.LastModified - a.LastModified); // Descending order (newest first)

    console.log(`Found ${backupFiles.length} backup files in Cloudflare R2.`);

    if (backupFiles.length > 4) {
      const filesToDelete = backupFiles.slice(4);
      console.log(`Deleting ${filesToDelete.length} older backup file(s) to retain only the latest 4...`);
      
      const deleteObjects = filesToDelete.map(item => ({ Key: item.Key }));
      const deleteCommand = new DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: {
          Objects: deleteObjects,
        },
      });

      await s3Client.send(deleteCommand);
      filesToDelete.forEach(item => console.log(`Deleted old backup: ${item.Key}`));
    } else {
      console.log('Retained all current backups (4 or fewer found).');
    }

    process.exit(0);

  } catch (err) {
    console.error('Backup / cleanup failed:', err.message);
    if (fs.existsSync(localBackupPath)) {
      fs.unlinkSync(localBackupPath);
    }
    process.exit(1);
  }
});
