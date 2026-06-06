import { logger } from '../config/logger';

export interface MailSender {
  name?: string;
  email?: string;
}

export interface MailRecipient {
  name: string;
  email: string;
}

export interface BrevoMailPayload {
  sender?: MailSender;
  to: MailRecipient[];
  templateId: number;
  params: Record<string, string>;
}

export async function sendBrevoMailViaAPI(payload: BrevoMailPayload): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey) {
    throw new Error('BREVO_API_KEY is missing');
  }

  const senderName = payload.sender?.name || process.env.BREVO_MAIL_SENDER_NAME || 'Vatikart';
  const senderEmail = payload.sender?.email || process.env.BREVO_MAIL_SENDER_EMAIL;

  if (!senderEmail) {
    throw new Error('brevo mail sender email id is required');
  }

  const formattedPayload = {
    sender: { name: senderName, email: senderEmail },
    to: payload.to,
    templateId: payload.templateId,
    params: payload.params,
  };

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(formattedPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Brevo API returned error: ${response.status} - ${errorText}`);
    }

    logger.info(`Email sent successfully via Brevo template ${payload.templateId}`);
  } catch (err) {
    logger.error('Error sending Brevo email', err);
    throw err;
  }
}
