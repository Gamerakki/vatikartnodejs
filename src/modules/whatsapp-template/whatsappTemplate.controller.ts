import { Request, Response } from 'express';
import { whatsappTemplateService } from './whatsappTemplate.service';

export class WhatsAppTemplateController {
  async fetchSettings(req: Request, res: Response): Promise<void> {
    const loggedInUserId = res.locals.userId || 0;

    try {
      const data = await whatsappTemplateService.fetchForUser(loggedInUserId);
      res.status(200).json({ status: true, data });
    } catch (err) {
      res.status(500).json({ status: false, msg: 'An error occurred', error: (err as Error).message });
    }
  }

  async saveSettings(req: Request, res: Response): Promise<void> {
    const loggedInUserId = res.locals.userId || 0;
    const { catalog_share_text, order_confirm_text } = req.body as {
      catalog_share_text?: string;
      order_confirm_text?: string;
    };

    try {
      const data = await whatsappTemplateService.saveForUser(loggedInUserId, {
        catalog_share_text,
        order_confirm_text,
      });
      res.status(200).json({ status: true, msg: 'WhatsApp template settings saved', data });
    } catch (err) {
      res.status(500).json({ status: false, msg: 'An error occurred', error: (err as Error).message });
    }
  }

  async compile(req: Request, res: Response): Promise<void> {
    const { template, vars } = req.body as {
      template?: string;
      vars?: Record<string, string | number | null | undefined>;
    };

    if (!template || typeof template !== 'string') {
      res.status(400).json({ status: false, msg: 'template is required' });
      return;
    }

    const compiled = whatsappTemplateService.compile(template, vars || {});
    res.status(200).json({ status: true, data: { compiled } });
  }
}

export const whatsappTemplateController = new WhatsAppTemplateController();
