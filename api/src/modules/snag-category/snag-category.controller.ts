import { Request, Response } from 'express';
import { currentUser } from '../../common/auth/current-user';
import { snagCategoryService } from './snag-category.service';

export class SnagCategoryController {
  async list(req: Request, res: Response) {
    const user = currentUser(req);
    const clientId = user.tenantId!;

    const categories = await snagCategoryService.list(clientId);

    res.json({
      success: true,
      data: categories,
    });
  }

  async createCategory(req: Request, res: Response) {
    const user = currentUser(req);
    const clientId = user.tenantId!;
    const { name, description } = req.body;

    const category = await snagCategoryService.createCategory(clientId, name, description);

    res.status(201).json({
      success: true,
      data: category,
    });
  }

  async updateCategory(req: Request, res: Response) {
    const user = currentUser(req);
    const clientId = user.tenantId!;
    const id = req.params.id as string;
    const { name, description, isActive } = req.body;

    await snagCategoryService.updateCategory(id, clientId, { name, description, isActive });

    res.json({
      success: true,
      message: 'Category updated',
    });
  }

  async deleteCategory(req: Request, res: Response) {
    const user = currentUser(req);
    const clientId = user.tenantId!;
    const id = req.params.id as string;

    await snagCategoryService.deleteCategory(id, clientId);

    res.json({
      success: true,
      message: 'Category deleted',
    });
  }

  async createSubCategory(req: Request, res: Response) {
    const categoryId = req.params.id as string;
    const { name, description } = req.body;

    const sub = await snagCategoryService.createSubCategory(categoryId, name, description);

    res.status(201).json({
      success: true,
      data: sub,
    });
  }

  async deleteSubCategory(req: Request, res: Response) {
    const subId = req.params.subId as string;

    await snagCategoryService.deleteSubCategory(subId);

    res.json({
      success: true,
      message: 'Sub-category deleted',
    });
  }
}

export const snagCategoryController = new SnagCategoryController();
