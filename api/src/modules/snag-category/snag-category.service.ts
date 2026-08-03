import { snagCategoryRepository } from './snag-category.repository';

export class SnagCategoryService {
  list(clientId: string) {
    return snagCategoryRepository.list(clientId);
  }

  createCategory(clientId: string, name: string, description?: string) {
    return snagCategoryRepository.createCategory(clientId, name, description);
  }

  updateCategory(id: string, clientId: string, data: { name?: string; description?: string; isActive?: boolean }) {
    return snagCategoryRepository.updateCategory(id, clientId, data);
  }

  deleteCategory(id: string, clientId: string) {
    return snagCategoryRepository.deleteCategory(id, clientId);
  }

  createSubCategory(categoryId: string, name: string, description?: string) {
    return snagCategoryRepository.createSubCategory(categoryId, name, description);
  }

  deleteSubCategory(id: string) {
    return snagCategoryRepository.deleteSubCategory(id);
  }
}

export const snagCategoryService = new SnagCategoryService();
