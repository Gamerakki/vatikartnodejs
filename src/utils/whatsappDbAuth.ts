import {
  initAuthCreds,
  BufferJSON,
  type AuthenticationCreds,
  type AuthenticationState,
  type SignalDataTypeMap,
} from '@whiskeysockets/baileys';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

async function readKey(key: string): Promise<unknown | null> {
  try {
    const row = await prisma.whatsAppBotAuth.findUnique({ where: { key } });
    if (!row) return null;
    return JSON.parse(row.value, BufferJSON.reviver);
  } catch (err) {
    logger.warn(`[WhatsApp DB Auth] Read failed for ${key}`, err);
    return null;
  }
}

async function writeKey(key: string, data: unknown): Promise<void> {
  try {
    if (data === null || data === undefined) {
      await prisma.whatsAppBotAuth.delete({ where: { key } }).catch(() => undefined);
      return;
    }

    const value = JSON.stringify(data, BufferJSON.replacer);
    await prisma.whatsAppBotAuth.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  } catch (err) {
    console.warn('[WhatsApp DB Auth] Write failed:', err);
    logger.warn(`[WhatsApp DB Auth] Write failed for ${key}`, err);
  }
}

/**
 * Baileys auth state backed by PostgreSQL (`whatsapp_bot_auth`).
 * Survives Render redeploys — no ephemeral filesystem required.
 */
export async function usePrismaAuthState(): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}> {
  const creds: AuthenticationCreds =
    ((await readKey('creds')) as AuthenticationCreds | null) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data: { [id: string]: SignalDataTypeMap[typeof type] } = {};
          await Promise.all(
            ids.map(async (id) => {
              const val = await readKey(`${type}-${id}`);
              if (val) {
                data[id] = val as SignalDataTypeMap[typeof type];
              }
            }),
          );
          return data;
        },
        set: async (data) => {
          const tasks: Promise<void>[] = [];
          for (const category in data) {
            const categoryData = data[category as keyof typeof data];
            if (!categoryData) continue;
            for (const id in categoryData) {
              const value = categoryData[id as keyof typeof categoryData];
              tasks.push(writeKey(`${category}-${id}`, value));
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: async () => {
      await writeKey('creds', creds);
    },
  };
}
