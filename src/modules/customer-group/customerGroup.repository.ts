import { prisma } from '../../config/database';

export class CustomerGroupRepository {
  async fetchGroups(companyId: number) {
    const groups = await prisma.customerGroup.findMany({
      where: { companyId: BigInt(companyId) },
      include: {
        _count: { select: { members: true, prices: true } },
      },
      orderBy: { id: 'desc' },
    });

    return groups.map((group) => ({
      id: Number(group.id),
      name: group.name,
      description: group.description,
      members_count: group._count.members,
      prices_count: group._count.prices,
    }));
  }

  async saveGroup(companyId: number, payload: { id?: number; name: string; description?: string | null }) {
    if (payload.id) {
      const updated = await prisma.customerGroup.updateMany({
        where: { id: BigInt(payload.id), companyId: BigInt(companyId) },
        data: {
          name: payload.name,
          description: payload.description ?? null,
        },
      });

      if (updated.count === 0) {
        throw new Error('Customer group not found');
      }

      return { id: payload.id };
    }

    const created = await prisma.customerGroup.create({
      data: {
        companyId: BigInt(companyId),
        name: payload.name,
        description: payload.description ?? null,
      },
    });

    return { id: Number(created.id) };
  }

  async deleteGroup(companyId: number, groupId: number) {
    const deleted = await prisma.customerGroup.deleteMany({
      where: { id: BigInt(groupId), companyId: BigInt(companyId) },
    });

    if (deleted.count === 0) {
      throw new Error('Customer group not found');
    }
  }

  async fetchGroupMembers(companyId: number, groupId: number) {
    const group = await prisma.customerGroup.findFirst({
      where: { id: BigInt(groupId), companyId: BigInt(companyId) },
      select: { id: true },
    });

    if (!group) {
      throw new Error('Customer group not found');
    }

    const members = await prisma.customerGroupMember.findMany({
      where: { groupId: BigInt(groupId) },
      orderBy: { id: 'desc' },
    });

    return members.map((member) => ({
      id: Number(member.id),
      group_id: Number(member.groupId),
      customer_phone: member.customerPhone,
      customer_name: member.customerName,
    }));
  }

  async addGroupMember(companyId: number, payload: { group_id: number; customer_phone: string; customer_name?: string | null }) {
    const group = await prisma.customerGroup.findFirst({
      where: { id: BigInt(payload.group_id), companyId: BigInt(companyId) },
      select: { id: true },
    });

    if (!group) {
      throw new Error('Customer group not found');
    }

    const member = await prisma.customerGroupMember.upsert({
      where: {
        groupId_customerPhone: {
          groupId: BigInt(payload.group_id),
          customerPhone: payload.customer_phone,
        },
      },
      update: {
        customerName: payload.customer_name ?? null,
      },
      create: {
        groupId: BigInt(payload.group_id),
        customerPhone: payload.customer_phone,
        customerName: payload.customer_name ?? null,
      },
    });

    return {
      id: Number(member.id),
      group_id: Number(member.groupId),
      customer_phone: member.customerPhone,
      customer_name: member.customerName,
    };
  }

  async deleteGroupMember(companyId: number, memberId: number) {
    const existing = await prisma.customerGroupMember.findFirst({
      where: {
        id: BigInt(memberId),
        group: {
          companyId: BigInt(companyId),
        },
      },
      select: { id: true },
    });

    if (!existing) {
      throw new Error('Group member not found');
    }

    await prisma.customerGroupMember.delete({ where: { id: BigInt(memberId) } });
  }

  async saveGroupPrices(companyId: number, groupId: number, items: Array<{ product_id: number; custom_price: number }>) {
    const group = await prisma.customerGroup.findFirst({
      where: { id: BigInt(groupId), companyId: BigInt(companyId) },
      select: { id: true },
    });

    if (!group) {
      throw new Error('Customer group not found');
    }

    await prisma.$transaction(async (tx) => {
      await tx.groupPrice.deleteMany({ where: { groupId: BigInt(groupId) } });

      if (items.length > 0) {
        await tx.groupPrice.createMany({
          data: items.map((item) => ({
            groupId: BigInt(groupId),
            productId: BigInt(item.product_id),
            customPrice: item.custom_price,
          })),
        });
      }
    });
  }

  async fetchGroupPrices(companyId: number, groupId: number, catalogueId?: number) {
    const group = await prisma.customerGroup.findFirst({
      where: { id: BigInt(groupId), companyId: BigInt(companyId) },
      select: { id: true, name: true },
    });

    if (!group) {
      throw new Error('Customer group not found');
    }

    const prices = await prisma.groupPrice.findMany({
      where: {
        groupId: BigInt(groupId),
        ...(catalogueId
          ? {
              product: {
                catalogueId: BigInt(catalogueId),
              },
            }
          : {}),
      },
      include: {
        product: {
          select: {
            productId: true,
            product: true,
            price: true,
            catalogueId: true,
          },
        },
      },
      orderBy: { id: 'desc' },
    });

    return {
      group: {
        id: Number(group.id),
        name: group.name,
      },
      prices: prices.map((item) => ({
        id: Number(item.id),
        product_id: Number(item.productId),
        product_name: item.product.product,
        catalogue_id: Number(item.product.catalogueId),
        base_price: item.product.price != null ? Number(item.product.price) : null,
        custom_price: Number(item.customPrice),
      })),
    };
  }

  async resolveGroupByPhone(companyId: number, customerPhone: string) {
    const last10Digits = customerPhone.slice(-10);
    const member = await prisma.customerGroupMember.findFirst({
      where: {
        customerPhone: {
          endsWith: last10Digits,
        },
        group: {
          companyId: BigInt(companyId),
        },
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { id: 'desc' },
    });

    if (!member) return null;

    return {
      id: Number(member.group.id),
      name: member.group.name,
    };
  }

  async fetchPriceMapForGroup(groupId: number, productIds: number[]): Promise<Map<number, number>> {
    if (productIds.length === 0) return new Map();

    const rows = await prisma.groupPrice.findMany({
      where: {
        groupId: BigInt(groupId),
        productId: { in: productIds.map((id) => BigInt(id)) },
      },
      select: {
        productId: true,
        customPrice: true,
      },
    });

    const map = new Map<number, number>();
    rows.forEach((row) => {
      map.set(Number(row.productId), Number(row.customPrice));
    });
    return map;
  }
}

export const customerGroupRepository = new CustomerGroupRepository();
