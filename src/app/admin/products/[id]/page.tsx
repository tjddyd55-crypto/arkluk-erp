import { AdminProductTranslationEditor } from "@/components/portal/admin-product-translation-editor";

export default async function AdminProductTranslationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const productId = Number(id);

  if (Number.isNaN(productId)) {
    return <p className="text-sm text-red-600">유효하지 않은 상품 ID입니다.</p>;
  }

  return <AdminProductTranslationEditor productId={productId} />;
}
