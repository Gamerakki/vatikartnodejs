import { Request, Response } from 'express';
import { customerGroupService } from './customerGroup.service';

export class CustomerGroupController {
  async fetchGroups(req: Request, res: Response): Promise<void> {
    const loggedInUserId = res.locals.userId || 0;
    try {
      const groups = await customerGroupService.fetchGroups(loggedInUserId);
      res.status(200).json({ status: true, data: groups });
    } catch (err) {
      res.status(500).json({ status: false, msg: 'An error occurred', error: (err as Error).message });
    }
  }

  async saveGroup(req: Request, res: Response): Promise<void> {
    const loggedInUserId = res.locals.userId || 0;
    const { id, name, description } = req.body as { id?: number; name?: string; description?: string };

    if (!name || !String(name).trim()) {
      res.status(400).json({ status: false, msg: 'name is required' });
      return;
    }

    try {
      const saved = await customerGroupService.saveGroup(loggedInUserId, {
        id: id ? Number(id) : undefined,
        name: String(name).trim(),
        description: description ?? null,
      });
      res.status(200).json({ status: true, msg: 'Customer group saved successfully', data: saved });
    } catch (err) {
      const message = (err as Error).message;
      const status = message === 'Customer group not found' ? 404 : 500;
      res.status(status).json({ status: false, msg: message, error: message });
    }
  }

  async deleteGroup(req: Request, res: Response): Promise<void> {
    const loggedInUserId = res.locals.userId || 0;
    const groupId = Number(req.params.group_id);

    if (!Number.isFinite(groupId) || groupId <= 0) {
      res.status(400).json({ status: false, msg: 'Invalid group_id' });
      return;
    }

    try {
      await customerGroupService.deleteGroup(loggedInUserId, groupId);
      res.status(200).json({ status: true, msg: 'Customer group deleted successfully' });
    } catch (err) {
      const message = (err as Error).message;
      const status = message === 'Customer group not found' ? 404 : 500;
      res.status(status).json({ status: false, msg: message, error: message });
    }
  }

  async fetchGroupMembers(req: Request, res: Response): Promise<void> {
    const loggedInUserId = res.locals.userId || 0;
    const groupId = Number(req.params.group_id);

    if (!Number.isFinite(groupId) || groupId <= 0) {
      res.status(400).json({ status: false, msg: 'Invalid group_id' });
      return;
    }

    try {
      const members = await customerGroupService.fetchGroupMembers(loggedInUserId, groupId);
      res.status(200).json({ status: true, data: members });
    } catch (err) {
      const message = (err as Error).message;
      const status = message === 'Customer group not found' ? 404 : 500;
      res.status(status).json({ status: false, msg: message, error: message });
    }
  }

  async addGroupMember(req: Request, res: Response): Promise<void> {
    const loggedInUserId = res.locals.userId || 0;
    const { group_id, customer_phone, customer_name } = req.body as {
      group_id?: number;
      customer_phone?: string;
      customer_name?: string;
    };

    if (!group_id || !customer_phone) {
      res.status(400).json({ status: false, msg: 'group_id and customer_phone are required' });
      return;
    }

    try {
      const member = await customerGroupService.addGroupMember(loggedInUserId, {
        group_id: Number(group_id),
        customer_phone,
        customer_name,
      });
      res.status(200).json({ status: true, msg: 'Group member saved successfully', data: member });
    } catch (err) {
      const message = (err as Error).message;
      const status = message === 'Customer group not found' ? 404 : 500;
      res.status(status).json({ status: false, msg: message, error: message });
    }
  }

  async deleteGroupMember(req: Request, res: Response): Promise<void> {
    const loggedInUserId = res.locals.userId || 0;
    const memberId = Number(req.params.member_id);

    if (!Number.isFinite(memberId) || memberId <= 0) {
      res.status(400).json({ status: false, msg: 'Invalid member_id' });
      return;
    }

    try {
      await customerGroupService.deleteGroupMember(loggedInUserId, memberId);
      res.status(200).json({ status: true, msg: 'Group member deleted successfully' });
    } catch (err) {
      const message = (err as Error).message;
      const status = message === 'Group member not found' ? 404 : 500;
      res.status(status).json({ status: false, msg: message, error: message });
    }
  }

  async saveGroupPricing(req: Request, res: Response): Promise<void> {
    const loggedInUserId = res.locals.userId || 0;
    const { group_id, product_prices } = req.body as {
      group_id?: number;
      product_prices?: Array<{ product_id: number; custom_price: number }>;
    };

    if (!group_id || !Array.isArray(product_prices)) {
      res.status(400).json({ status: false, msg: 'group_id and product_prices are required' });
      return;
    }

    try {
      await customerGroupService.saveGroupPrices(loggedInUserId, {
        group_id: Number(group_id),
        product_prices: product_prices
          .filter((item) => Number.isFinite(Number(item.product_id)) && Number.isFinite(Number(item.custom_price)))
          .map((item) => ({
            product_id: Number(item.product_id),
            custom_price: Number(item.custom_price),
          })),
      });
      res.status(200).json({ status: true, msg: 'Group pricing saved successfully' });
    } catch (err) {
      const message = (err as Error).message;
      const status = message === 'Customer group not found' ? 404 : 500;
      res.status(status).json({ status: false, msg: message, error: message });
    }
  }

  async fetchGroupPricing(req: Request, res: Response): Promise<void> {
    const loggedInUserId = res.locals.userId || 0;
    const groupId = Number(req.params.group_id);
    const catalogueId = req.query.catalogue_id ? Number(req.query.catalogue_id) : undefined;

    if (!Number.isFinite(groupId) || groupId <= 0) {
      res.status(400).json({ status: false, msg: 'Invalid group_id' });
      return;
    }

    try {
      const pricing = await customerGroupService.fetchGroupPrices(loggedInUserId, groupId, catalogueId);
      res.status(200).json({ status: true, data: pricing });
    } catch (err) {
      const message = (err as Error).message;
      const status = message === 'Customer group not found' ? 404 : 500;
      res.status(status).json({ status: false, msg: message, error: message });
    }
  }
}

export const customerGroupController = new CustomerGroupController();
