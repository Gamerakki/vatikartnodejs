import { prisma } from '../config/database';

export const PLAN_LIMITS = {
  FREE: { maxProducts: 50, maxCategories: 5, maxUsers: 1, accessControl: false },
  SILVER: { maxProducts: 500, maxCategories: 25, maxUsers: 1, accessControl: false },
  GOLD: { maxProducts: 5000, maxCategories: 45, maxUsers: 10, accessControl: true },
  DIAMOND: { maxProducts: 15000, maxCategories: 100, maxUsers: 25, accessControl: true },
} as const;

type PlanName = keyof typeof PLAN_LIMITS;

function normalizePlanName(planName: string | null | undefined): PlanName {
  const normalized = (planName || 'FREE').toUpperCase();
  return normalized in PLAN_LIMITS ? (normalized as PlanName) : 'FREE';
}

export async function getCompanyPlanLimits(companyId: number) {
  const sub = await prisma.subscription.findFirst({
    where: { companyId: BigInt(companyId), status: 'ACTIVE' },
  });
  const plan = normalizePlanName(sub?.planName);
  const limits = PLAN_LIMITS[plan];
  const maxProducts = limits.maxProducts + (sub?.additionalProducts || 0);

  return {
    plan,
    maxProducts,
    maxCategories: limits.maxCategories,
    maxUsers: limits.maxUsers,
    accessControl: limits.accessControl,
  };
}

export async function getCompanyPlanUsage(companyId: number) {
  const limits = await getCompanyPlanLimits(companyId);
  const company = await prisma.company.findUnique({
    where: { companyId: BigInt(companyId) },
    select: { addedBy: true },
  });

  const [productsUsed, categoriesUsed, usersUsed] = await Promise.all([
    prisma.product.count({ where: { companyId: BigInt(companyId), isDeleted: false } }),
    prisma.catalogue.count({ where: { companyId: BigInt(companyId), isDeleted: false } }),
    company?.addedBy
      ? prisma.user.count({
          where: {
            isDeleted: false,
            OR: [{ userId: company.addedBy }, { addedBy: company.addedBy }],
          },
        })
      : Promise.resolve(0),
  ]);

  return {
    ...limits,
    productsUsed,
    categoriesUsed,
    usersUsed,
  };
}
