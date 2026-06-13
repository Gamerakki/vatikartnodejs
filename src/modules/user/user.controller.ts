import { Request, Response } from 'express';
import { userService } from './user.service';
import { registerUserSchema, loginUserSchema } from './user.validation';

export class UserController {
  async register(req: Request, res: Response): Promise<void> {
    const parseResult = registerUserSchema.safeParse(req.body);

    if (!parseResult.success) {
      const formattedErrors: Record<string, string> = {};
      parseResult.error.issues.forEach((issue) => {
        const fieldPath = issue.path.join('.');
        formattedErrors[fieldPath] = issue.message;
      });

      res.status(501).json({
        status: false,
        msg: 'Validation errors',
        error: formattedErrors,
      });
      return;
    }

    try {
      const savedUser = await userService.register(parseResult.data);
      res.status(200).json({
        status: true,
        msg: 'User registered successfully',
        data: savedUser,
      });
    } catch (err) {
      const msg = (err as Error).message;
      if (msg === 'The field username must be either Email ID or Mobile No.') {
        res.status(400).json({ status: false, msg, error: msg });
        return;
      }

      res.status(500).json({
        status: false,
        msg: 'An error occurred',
        error: msg,
      });
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    const parseResult = loginUserSchema.safeParse(req.body);

    if (!parseResult.success) {
      const formattedErrors: Record<string, string> = {};
      parseResult.error.issues.forEach((issue) => {
        const fieldPath = issue.path.join('.');
        formattedErrors[fieldPath] = issue.message;
      });

      res.status(501).json({
        status: false,
        msg: 'Validation errors',
        error: formattedErrors,
      });
      return;
    }

    try {
      const loggedInUserData = await userService.login(parseResult.data);
      res.status(200).json({
        status: true,
        msg: 'Logged in successfully!',
        data: loggedInUserData,
      });
    } catch (err) {
      const msg = (err as Error).message;
      let httpStatus = 500;

      if (msg === 'User not found') {
        httpStatus = 404;
      } else if (msg === 'Invalid password') {
        httpStatus = 403;
      }

      res.status(httpStatus).json({
        status: false,
        msg,
        error: msg,
      });
    }
  }

  validateToken(req: Request, res: Response): void {
    res.status(200).json({ status: true, msg: 'Valid token' });
  }

  async checkEmailAddress(req: Request, res: Response): Promise<void> {
    const emailId = req.query.email_id as string;

    if (!emailId) {
      res.status(501).json({ status: false, msg: 'email_id field is required' });
      return;
    }

    const loggedInUserId = res.locals.userId || 0;

    try {
      const existingEmailId = await userService.checkExistingEmailAddress(emailId, loggedInUserId);

      if (existingEmailId) {
        res.status(409).json({ status: false, msg: 'Email Id already exists' });
        return;
      }

      res.status(200).json({ status: true, msg: 'No conflicts' });
    } catch (err) {
      res.status(500).json({
        status: false,
        msg: 'An error occurred',
        error: (err as Error).message,
      });
    }
  }

  async checkDuplicateUsername(req: Request, res: Response): Promise<void> {
    const username = req.query.username as string;

    if (!username) {
      res.status(501).json({ status: false, msg: 'username field is required' });
      return;
    }

    const loggedInUserId = res.locals.userId || 0;

    try {
      const existingEmailMobile = await userService.checkExistingEmailMobile(username, loggedInUserId);

      if (existingEmailMobile) {
        res.status(409).json({
          status: false,
          msg: 'An error occurred',
          error: 'This Email/Mobile No. already exists in our database',
        });
        return;
      }

      res.status(200).json({ status: true, msg: 'No duplicates found' });
    } catch (err) {
      res.status(500).json({
        status: false,
        msg: 'An error occurred',
        error: (err as Error).message,
      });
    }
  }

  async savePushToken(req: Request, res: Response): Promise<void> {
    const userId: bigint = BigInt(res.locals.userId || 0);
    const { pushToken } = req.body as { pushToken?: string };

    if (!pushToken || typeof pushToken !== 'string' || !pushToken.startsWith('ExponentPushToken')) {
      res.status(400).json({ status: false, msg: 'Invalid or missing pushToken' });
      return;
    }

    try {
      await (await import('../../config/database')).prisma.user.update({
        where: { userId },
        data: { pushToken },
      });
      res.status(200).json({ status: true, msg: 'Push token saved.' });
    } catch (err) {
      res.status(500).json({ status: false, msg: 'An error occurred', error: (err as Error).message });
    }
  }
}

export const userController = new UserController();
