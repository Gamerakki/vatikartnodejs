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
    const normalizedPushToken = typeof pushToken === 'string' ? pushToken.trim() : '';

    if (!normalizedPushToken) {
      res.status(400).json({ status: false, msg: 'Invalid or missing pushToken' });
      return;
    }

    try {
      await (await import('../../config/database')).prisma.user.update({
        where: { userId },
        data: { pushToken: normalizedPushToken },
      });
      res.status(200).json({ status: true, msg: 'Push token saved.' });
    } catch (err) {
      res.status(500).json({ status: false, msg: 'An error occurred', error: (err as Error).message });
    }
  }

  async updateProfile(req: Request, res: Response): Promise<void> {
    const userId = res.locals.userId;
    const { first_name, last_name } = req.body as { first_name?: string; last_name?: string };
    const firstName = (first_name || '').trim();
    const lastName = (last_name || '').trim();

    if (!userId) {
      res.status(401).json({ status: false, msg: 'Unauthorized' });
      return;
    }

    if (!firstName) {
      res.status(400).json({ status: false, msg: 'first_name is required' });
      return;
    }

    try {
      const data = await userService.updateProfile(userId, firstName, lastName);
      res.status(200).json({ status: true, msg: 'Profile updated successfully', data });
    } catch (err) {
      res.status(500).json({ status: false, msg: (err as Error).message });
    }
  }

  async fetchTeam(req: Request, res: Response): Promise<void> {
    try {
      const members = await userService.fetchTeam(res.locals.userId!);
      res.status(200).json({ status: true, msg: 'Team fetched', data: members });
    } catch (err) {
      res.status(500).json({ status: false, msg: (err as Error).message });
    }
  }

  async inviteTeamMember(req: Request, res: Response): Promise<void> {
    const { first_name, last_name, username, password } = req.body as Record<string, string>;
    if (!first_name || !username || !password) {
      res.status(400).json({ status: false, msg: 'first_name, username, and password are required' });
      return;
    }
    try {
      const result = await userService.inviteTeamMember(res.locals.userId!, { first_name, last_name, username, password });
      res.status(200).json({ status: true, msg: 'Team member invited successfully', data: result });
    } catch (err) {
      res.status(400).json({ status: false, msg: (err as Error).message });
    }
  }

  async removeTeamMember(req: Request, res: Response): Promise<void> {
    const memberId = Number(req.params.userId);
    if (!memberId) {
      res.status(400).json({ status: false, msg: 'userId param is required' });
      return;
    }
    try {
      await userService.removeTeamMember(res.locals.userId!, memberId);
      res.status(200).json({ status: true, msg: 'Team member removed' });
    } catch (err) {
      res.status(400).json({ status: false, msg: (err as Error).message });
    }
  }

  async saveCustomerPushToken(req: Request, res: Response): Promise<void> {
    const { phone, pushToken } = req.body as { phone?: string; pushToken?: string };
    const normalizedPhone = typeof phone === 'string' ? phone.trim() : '';
    const normalizedPushToken = typeof pushToken === 'string' ? pushToken.trim() : '';

    if (!normalizedPhone || !normalizedPushToken) {
      res.status(400).json({ status: false, msg: 'phone and pushToken are required' });
      return;
    }

    try {
      const { prisma } = await import('../../config/database');
      await prisma.customerPushToken.upsert({
        where: {
          phone_pushToken: {
            phone: normalizedPhone,
            pushToken: normalizedPushToken,
          },
        },
        create: {
          phone: normalizedPhone,
          pushToken: normalizedPushToken,
        },
        update: {},
      });
      res.status(200).json({ status: true, msg: 'Customer push token saved.' });
    } catch (err) {
      res.status(500).json({ status: false, msg: 'An error occurred', error: (err as Error).message });
    }
  }
}

export const userController = new UserController();
