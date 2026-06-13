import { prisma } from '../config/database';

/**
 * Look up the merchant (user) who owns a given company and send them an
 * Expo push notification if they have a registered push token.
 *
 * Fire-and-forget: callers should NOT await this when it is used as a
 * background side-effect inside a request handler.
 */
export async function sendMerchantNotification(
  userId: bigint,
  title: string,
  body: string,
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { userId },
      select: { pushToken: true },
    });

    if (!user?.pushToken) return;

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: user.pushToken,
        sound: 'default',
        title,
        body,
      }),
    });
  } catch (err) {
    // Notification failure must never crash the main request
    console.warn('[notification] push failed', err);
  }
}

/**
 * Resolve a companyId to the BigInt userId of its owner.
 * Returns null when the company has no linked user.
 */
export async function getUserIdByCompanyId(companyId: bigint): Promise<bigint | null> {
  const company = await prisma.company.findUnique({
    where: { companyId },
    select: { addedBy: true },
  });
  return company?.addedBy ?? null;
}
