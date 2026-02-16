export interface Category {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  sortOrder: number;
  /** null = main category, string = subcategory of that parent */
  parentId?: string | null;
  /** default true; hide from storefront when false */
  isVisible?: boolean;
}
