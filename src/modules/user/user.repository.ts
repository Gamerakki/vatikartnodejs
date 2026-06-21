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

  async fetchTeamMembers(companyId: number) {
    return await prisma.user.findMany({
      where: {
        companyId: BigInt(companyId),
        isDeleted: false,
      },
      select: {
        userId: true,
        firstName: true,
        lastName: true,
        emailId: true,
        mobileNo: true,
        role: true,
        addedDate: true,
      },
      orderBy: { addedDate: 'asc' },
    });
  }

  async inviteTeamMember(data: {
    firstName: string;
    lastName?: string;
    username: string;
    passwordHash: string;
    companyId: number;
  }) {
    const isEmail = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(data.username);
    return await prisma.user.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName || null,
        password: data.passwordHash,
        emailId: isEmail ? data.username : null,
        mobileNo: !isEmail ? data.username : null,
        role: 'SALES_PERSON',
        companyId: BigInt(data.companyId),
      },
    });
  }

  async removeTeamMember(memberId: number, companyId: number): Promise<boolean> {
    const user = await prisma.user.findFirst({
      where: { userId: BigInt(memberId), companyId: BigInt(companyId), isDeleted: false },
    });
    if (!user) return false;
    await prisma.user.update({
      where: { userId: BigInt(memberId) },
      data: { isDeleted: true, companyId: null },
    });
    return true;
  }
}

export const userRepository = new UserRepository();
