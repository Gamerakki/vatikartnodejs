import { prisma } from '../../config/database';
import { RegisterUserRequest } from './user.interface';

export class UserRepository {
  async registerUser(data: RegisterUserRequest & { passwordHash: string }) {
    const isEmail = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(data.username);
    
    return await prisma.user.create({
      data: {
        firstName: data.first_name,
        lastName: data.last_name || null,
        password: data.passwordHash,
        emailId: isEmail ? data.username : null,
        mobileNo: !isEmail ? data.username : null,
      },
    });
  }

  async fetchUserDataViaEmailMobile(username: string) {
    return await prisma.user.findFirst({
      where: {
        OR: [
          { emailId: username },
          { mobileNo: username },
        ],
      },
    });
  }

  async checkExistingEmailAddress(emailId: string, userId: number) {
    const count = await prisma.user.count({
      where: {
        emailId,
        userId,
      },
    });
    return count > 0;
  }

  async checkExistingEmailMobile(username: string, userId: number) {
    const count = await prisma.user.count({
      where: {
        OR: [
          { emailId: username },
          { mobileNo: username },
        ],
        NOT: {
          userId,
        },
      },
    });
    return count > 0;
  }

  async updateLastActive(userId: number, date: Date) {
    return await prisma.user.update({
      where: {
        userId,
      },
      data: {
        lastActiveTime: date,
      },
    });
  }
}

export const userRepository = new UserRepository();
