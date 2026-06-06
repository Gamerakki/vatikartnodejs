import { Request, Response } from 'express';
import { socialMediaService } from './socialMedia.service';

export class SocialMediaController {
  async fetchSocialMediaMaster(req: Request, res: Response): Promise<void> {
    try {
      const list = await socialMediaService.fetchSocialMedia();
      res.status(200).json({
        status: true,
        msg: 'Data fetched successfully!',
        data: list,
      });
    } catch (err) {
      res.status(500).json({
        status: false,
        msg: 'An error occurred',
        error: (err as Error).message,
      });
    }
  }

  async fetchCompanySocialMedia(req: Request, res: Response): Promise<void> {
    const loggedInUserId = res.locals.userId || 0;

    try {
      const list = await socialMediaService.fetchCompanySocialMedia(loggedInUserId);
      res.status(200).json({
        status: true,
        msg: 'Company social media fetched successfully!',
        data: list,
      });
    } catch (err) {
      res.status(500).json({
        status: false,
        msg: 'An error occurred',
        error: (err as Error).message,
      });
    }
  }
}

export const socialMediaController = new SocialMediaController();
