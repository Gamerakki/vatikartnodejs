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

export type FcmMulticastResult = {
  successCount: number;
  failureCount: number;
  totalTokens: number;
  invalidTokens: string[];
  mock: boolean;
};

/**
 * Send an FCM multicast (batched in chunks of 500) and collect unregistered tokens for cleanup.
 */
export async function sendFcmMulticast(params: {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<FcmMulticastResult> {
  const tokens = [...new Set((params.tokens || []).filter(Boolean))];
  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(params.data || {})) {
    data[key] = String(value);
  }

  if (tokens.length === 0) {
    return { successCount: 0, failureCount: 0, totalTokens: 0, invalidTokens: [], mock: !isFirebaseInitialized };
  }

  if (!isFirebaseInitialized) {
    logger.info(
      `[firebase] [MOCK MULTICAST] tokens=${tokens.length} | Title: ${params.title} | Body: ${params.body} | Data: ${JSON.stringify(data)}`,
    );
    return {
      successCount: tokens.length,
      failureCount: 0,
      totalTokens: tokens.length,
      invalidTokens: [],
      mock: true,
    };
  }

  const messaging = getMessaging();
  let successCount = 0;
  let failureCount = 0;
  const invalidTokens: string[] = [];
  const INVALID_CODES = new Set([
    'messaging/invalid-registration-token',
    'messaging/registration-token-not-registered',
  ]);

  const CHUNK = 500;
  for (let i = 0; i < tokens.length; i += CHUNK) {
    const chunk = tokens.slice(i, i + CHUNK);
    const response = await messaging.sendEachForMulticast({
      tokens: chunk,
      notification: {
        title: params.title,
        body: params.body,
      },
      data,
    });

    successCount += response.successCount;
    failureCount += response.failureCount;

    response.responses.forEach((res, idx) => {
      if (res.success) return;
      const code = (res.error as { code?: string } | undefined)?.code;
      if (code && INVALID_CODES.has(code)) {
        invalidTokens.push(chunk[idx]);
      }
    });
  }

  logger.info(
    `[firebase] Multicast done: success=${successCount} failure=${failureCount} invalid=${invalidTokens.length}`,
  );

  return {
    successCount,
    failureCount,
    totalTokens: tokens.length,
    invalidTokens,
    mock: false,
  };
}
