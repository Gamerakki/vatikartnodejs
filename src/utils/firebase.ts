import { initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../config/logger';

let isFirebaseInitialized = false;

try {
  // Check if a service account file exists in root directory
  const serviceAccountPath = path.join(process.cwd(), 'firebase-service-account.json');

  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    initializeApp({
      credential: cert(serviceAccount),
    });
    isFirebaseInitialized = true;
    logger.info('[firebase] Initialized successfully using firebase-service-account.json');
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    initializeApp({
      credential: cert(serviceAccount),
    });
    isFirebaseInitialized = true;
    logger.info('[firebase] Initialized successfully using FIREBASE_SERVICE_ACCOUNT_JSON env var');
  } else if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PROJECT_ID) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    isFirebaseInitialized = true;
    logger.info('[firebase] Initialized successfully using individual env vars');
  } else {
    logger.warn('[firebase] No service account credentials found. FCM messages will be logged in mock mode.');
  }
} catch (err) {
  logger.error('[firebase] Initialization failed', err);
}

export async function sendFcmNotification(
  token: string,
  title: string,
  body: string,
  data: Record<string, string> = {}
): Promise<boolean> {
  if (!isFirebaseInitialized) {
    logger.info(`[firebase] [MOCK SEND] Token: ${token} | Title: ${title} | Body: ${body} | Data: ${JSON.stringify(data)}`);
    return true;
  }

  try {
    const response = await getMessaging().send({
      token,
      notification: {
        title,
        body,
      },
      data,
    });
    logger.info(`[firebase] Notification sent successfully: ${response}`);
    return true;
  } catch (err) {
    logger.warn('[firebase] Failed to send notification via FCM', err);
    return false;
  }
}
