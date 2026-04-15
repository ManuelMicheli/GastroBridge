export type EditorRow = {
  id: string;
  price_list_id: string;
  product_id: string;
  sales_unit_id: string;
  price: number;
  product_name: string;
  product_brand: string | null;
  sales_unit_label: string;
  sales_unit_is_base: boolean;
};
