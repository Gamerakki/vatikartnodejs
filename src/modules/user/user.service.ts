import bcrypt from 'bcryptjs';
import { userRepository } from './user.repository';
import { companyRepository } from '../company/company.repository';
import { generateToken } from '../../config/jwt';
import { redis } from '../../config/redis';
import { RegisterUserRequest, LoginUser, UserLoginResponse } from './user.interface';
import { logger } from '../../config/logger';

export class UserService {
  private getS3PublicUrlPrefix(): string {
    const url = process.env.PUBLIC_BUCKET_URL || '';
    return url ? `${url}/` : '';
  }

  private formatProfilePic(path: string | null | undefined): string {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${this.getS3PublicUrlPrefix()}${path}`;
  }

  async register(req: RegisterUserRequest): Promise<UserLoginResponse> {
    const passwordHash = await bcrypt.hash(req.password, 10);

    const savedUser = await userRepository.registerUser({
      ...req,
      passwordHash,
    });

    const userId = Number(savedUser.userId);

    // Save default company matching Go logic: "FirstName's Store"
    await companyRepository.saveCompanyDirect({
      companyName: `${req.first_name}'s Store`,
      addedBy: userId,
    });

    const token = generateToken({ user_id: userId, role: 'OWNER' });

    // Background last active update
    await this.createOrUpdateLastActive(userId);

    return {
      user_basic_data: {
        first_name: savedUser.firstName,
        last_name: savedUser.lastName,
        profile_pic_path: '',
      },
      token,
      role: 'OWNER',
    };
  }

  async login(req: LoginUser): Promise<UserLoginResponse> {
    const user = await userRepository.fetchUserDataViaEmailMobile(req.username);
    if (!user) {
      throw new Error('User not found');
    }

    const isValidPassword = await bcrypt.compare(req.password, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid password');
    }

    const userId = Number(user.userId);
    const token = generateToken({ user_id: userId, role: user.role ?? 'OWNER' });

    // Background last active update
    await this.createOrUpdateLastActive(userId);

    return {
      user_basic_data: {
        first_name: user.firstName,
        last_name: user.lastName,
        profile_pic_path: this.formatProfilePic(user.profilePicPath),
      },
      token,
      role: user.role ?? 'OWNER',
    };
  }

  async checkExistingEmailAddress(emailId: string, userId: number): Promise<boolean> {
    return await userRepository.checkExistingEmailAddress(emailId, userId);
  }

  async checkExistingEmailMobile(username: string, userId: number): Promise<boolean> {
    return await userRepository.checkExistingEmailMobile(username, userId);
  }

  async isUserActive(userId: number): Promise<boolean> {
    if (!redis) return false;
    const key = `user:active:${userId}`;
    const exists = await redis.exists(key);
    return exists === 1;
  }

  async updateUserActivity(userId: number): Promise<void> {
    if (!redis) return;
    const key = `user:active:${userId}`;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    // 20 minutes expiry = 1200 seconds
    await redis.set(key, timestamp, 'EX', 1200);
  }

  async createOrUpdateLastActive(userId: number): Promise<void> {
    await userRepository.updateLastActive(userId, new Date());
  }

  async ensureUserActive(userId: number): Promise<void> {
    try {
      const existsInRedis = await this.isUserActive(userId);
      if (!existsInRedis) {
        // Not active in Redis -> write to DB
        await this.createOrUpdateLastActive(userId);
        // Set Redis key
        await this.updateUserActivity(userId);
      }
    } catch (err) {
      logger.error('Error updating user activity in Redis/DB', err);
    }
  }

  async fetchTeam(ownerUserId: number) {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(ownerUserId);
    if (!companyId) throw new Error('Company not found');
    const members = await userRepository.fetchTeamMembers(companyId);
    return members.map((m) => ({
      user_id: Number(m.userId),
      first_name: m.firstName,
      last_name: m.lastName,
      email: m.emailId,
      mobile: m.mobileNo,
      role: m.role,
      added_date: m.addedDate,
    }));
  }

  async inviteTeamMember(ownerUserId: number, data: {
    first_name: string;
    last_name?: string;
    username: string;
    password: string;
  }) {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(ownerUserId);
    if (!companyId) throw new Error('Company not found');

    const duplicate = await userRepository.checkExistingEmailMobile(data.username, 0);
    if (duplicate) throw new Error('A user with this username already exists');

    const passwordHash = await bcrypt.hash(data.password, 10);
    const newUser = await userRepository.inviteTeamMember({
      firstName: data.first_name,
      lastName: data.last_name,
      username: data.username,
      passwordHash,
      companyId,
    });
    return { user_id: Number(newUser.userId), role: 'SALES_PERSON' };
  }

  async removeTeamMember(ownerUserId: number, memberId: number) {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(ownerUserId);
    if (!companyId) throw new Error('Company not found');
    const removed = await userRepository.removeTeamMember(memberId, companyId);
    if (!removed) throw new Error('Team member not found or does not belong to your company');
  }
}

export const userService = new UserService();
