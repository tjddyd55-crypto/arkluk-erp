import { Prisma, ProductStatus, SupplierProductFieldType, SupplierStatus } from "@prisma/client";

import { HttpError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import {
  listDetailFieldRows,
  resolveBuyerDisplayName,
  resolveBuyerOrderLineSnapshots,
  resolveBuyerUnitPrice,
  type BuyerFormFieldRow,
} from "@/lib/buyer-dynamic-product-display";
import { createOrder } from "@/server/services/order-service";
import { getSupplierActiveProductForm } from "@/server/services/supplier-product-form-service";

async function assertBuyerWithCountry(buyerId: number) {
  const buyer = await prisma.user.findUnique({
    where: { id: buyerId },
    include: { country: { select: { country_code: true } } },
  });
  if (!buyer?.country_id || !buyer.country) {
    throw new HttpError(400, "바이어 국가 정보가 설정되지 않았습니다.");
  }
  return { buyer, countryCode: buyer.country.country_code };
}

async function getOrCreateCartId(buyerId: number) {
  const existing = await prisma.cart.findUnique({ where: { buyer_id: buyerId } });
  if (existing) return existing.id;
  const created = await prisma.cart.create({ data: { buyer_id: buyerId } });
  return created.id;
}

function toBuyerFieldRows(
  fields: Array<{
    id: number;
    field_key: string;
    field_label: string;
    field_type: SupplierProductFieldType;
    is_enabled: boolean;
    is_primary_name: boolean;
    is_primary_price: boolean;
    sort_order: number;
  }>,
): BuyerFormFieldRow[] {
  return fields.map((f) => ({
    id: f.id,
    field_key: f.field_key,
    field_label: f.field_label,
    field_type: f.field_type,
    is_enabled: f.is_enabled,
    is_primary_name: f.is_primary_name,
    is_primary_price: f.is_primary_price,
    sort_order: f.sort_order,
  }));
}

function valueByKeyFromFieldValues(
  formFields: Array<{ id: number; field_key: string }>,
  fieldValues: Array<{ field_id: number; value_text: string | null }>,
): Record<string, string | null> {
  const byId = new Map(fieldValues.map((fv) => [fv.field_id, fv.value_text]));
  const out: Record<string, string | null> = {};
  for (const f of formFields) {
    out[f.field_key] = byId.get(f.id) ?? null;
  }
  return out;
}

export async function addBuyerCartItem(input: {
  buyerId: number;
  productId: number;
  quantity: number;
}) {
  const { buyer, countryCode } = await assertBuyerWithCountry(input.buyerId);
  const product = await prisma.product.findFirst({
    where: {
      id: input.productId,
      country_code: countryCode,
      is_active: true,
      status: ProductStatus.APPROVED,
    },
    select: {
      id: true,
      supplier_id: true,
      field_values: { select: { field_id: true, value_text: true } },
    },
  });
  if (!product) {
    throw new HttpError(404, "상품을 찾을 수 없거나 주문할 수 없습니다.");
  }

  const form = await getSupplierActiveProductForm(product.supplier_id, null);
  const rows = toBuyerFieldRows(form.fields);
  const enabledRows = rows.filter((r) => r.is_enabled);
  const valueByKey = valueByKeyFromFieldValues(form.fields, product.field_values);
  const unitPrice = resolveBuyerUnitPrice(enabledRows, valueByKey);
  if (unitPrice == null) {
    throw new HttpError(400, "상품에 유효한 가격(숫자) 필드가 없어 장바구니에 담을 수 없습니다.");
  }

  const cartId = await getOrCreateCartId(buyer.id);
  const addQty = new Prisma.Decimal(input.quantity);
  const priceDec = new Prisma.Decimal(unitPrice);

  const existing = await prisma.cartItem.findUnique({
    where: {
      cart_id_product_id: { cart_id: cartId, product_id: product.id },
    },
  });

  const nextQty = existing ? new Prisma.Decimal(existing.quantity).add(addQty) : addQty;

  const upserted = await prisma.cartItem.upsert({
    where: {
      cart_id_product_id: { cart_id: cartId, product_id: product.id },
    },
    create: {
      cart_id: cartId,
      product_id: product.id,
      supplier_id: product.supplier_id,
      quantity: addQty,
      price_snapshot: priceDec,
    },
    update: {
      quantity: nextQty,
      price_snapshot: priceDec,
      supplier_id: product.supplier_id,
    },
  });

  return upserted;
}

export async function getBuyerCartDetail(buyerId: number) {
  await assertBuyerWithCountry(buyerId);
  const cart = await prisma.cart.findUnique({
    where: { buyer_id: buyerId },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              supplier_id: true,
              field_values: { select: { field_id: true, value_text: true } },
            },
          },
          supplier: { select: { id: true, company_name: true, supplier_name: true } },
        },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!cart) {
    return { cartId: null as number | null, items: [] as CartItemOut[], grouped: [] as GroupedCart[] };
  }

  type CartItemOut = {
    id: number;
    productId: number;
    supplierId: number;
    quantity: string;
    priceSnapshot: string;
    supplierLabel: string;
    displayName: string;
    lineTotal: string;
  };
  type GroupedCart = { supplierId: number; supplierLabel: string; items: CartItemOut[] };

  const items: CartItemOut[] = [];
  const bySupplier = new Map<number, GroupedCart>();

  for (const row of cart.items) {
    const form = await getSupplierActiveProductForm(row.product.supplier_id, null);
    const enabledRows = toBuyerFieldRows(form.fields).filter((r) => r.is_enabled);
    const valueByKey = valueByKeyFromFieldValues(form.fields, row.product.field_values);
    const displayName = resolveBuyerDisplayName(enabledRows, valueByKey);
    const qty = row.quantity.toString();
    const price = row.price_snapshot.toString();
    const lineTotal = new Prisma.Decimal(price).mul(new Prisma.Decimal(qty)).toString();
    const supplierLabel =
      row.supplier.company_name?.trim() || row.supplier.supplier_name || `공급사 #${row.supplier_id}`;

    const item: CartItemOut = {
      id: row.id,
      productId: row.product_id,
      supplierId: row.supplier_id,
      quantity: qty,
      priceSnapshot: price,
      supplierLabel,
      displayName,
      lineTotal,
    };
    items.push(item);
    if (!bySupplier.has(row.supplier_id)) {
      bySupplier.set(row.supplier_id, { supplierId: row.supplier_id, supplierLabel, items: [] });
    }
    bySupplier.get(row.supplier_id)!.items.push(item);
  }

  return {
    cartId: cart.id,
    items,
    grouped: [...bySupplier.values()],
  };
}

export async function updateBuyerCartItem(input: {
  buyerId: number;
  itemId: number;
  quantity: number;
}) {
  const { buyer } = await assertBuyerWithCountry(input.buyerId);
  const cart = await prisma.cart.findUnique({ where: { buyer_id: buyer.id } });
  if (!cart) {
    throw new HttpError(404, "장바구니가 없습니다.");
  }
  const row = await prisma.cartItem.findFirst({
    where: { id: input.itemId, cart_id: cart.id },
  });
  if (!row) {
    throw new HttpError(404, "장바구니 항목을 찾을 수 없습니다.");
  }
  return prisma.cartItem.update({
    where: { id: row.id },
    data: { quantity: new Prisma.Decimal(input.quantity) },
  });
}

export async function removeBuyerCartItem(input: { buyerId: number; itemId: number }) {
  const { buyer } = await assertBuyerWithCountry(input.buyerId);
  const cart = await prisma.cart.findUnique({ where: { buyer_id: buyer.id } });
  if (!cart) {
    throw new HttpError(404, "장바구니가 없습니다.");
  }
  const row = await prisma.cartItem.findFirst({
    where: { id: input.itemId, cart_id: cart.id },
  });
  if (!row) {
    throw new HttpError(404, "장바구니 항목을 찾을 수 없습니다.");
  }
  await prisma.cartItem.delete({ where: { id: row.id } });
}

export async function checkoutBuyerCart(input: { buyerId: number; memo?: string | null }) {
  const { buyer, countryCode } = await assertBuyerWithCountry(input.buyerId);
  const cart = await prisma.cart.findUnique({
    where: { buyer_id: buyer.id },
    include: { items: true },
  });
  if (!cart || cart.items.length === 0) {
    throw new HttpError(400, "장바구니가 비어 있습니다.");
  }

  const orderItems: Array<{
    productId: number;
    qty: number;
    lineSnapshots: {
      productCode: string;
      productName: string;
      spec: string;
      unit: string;
      unitPrice: number;
    };
  }> = [];

  for (const line of cart.items) {
    const product = await prisma.product.findFirst({
      where: {
        id: line.product_id,
        supplier_id: line.supplier_id,
        country_code: countryCode,
        is_active: true,
        status: ProductStatus.APPROVED,
      },
      select: {
        id: true,
        field_values: { select: { field_id: true, value_text: true } },
      },
    });
    if (!product) {
      throw new HttpError(
        400,
        `장바구니의 상품(ID ${line.product_id})을 더 이상 주문할 수 없습니다. 제거 후 다시 시도해 주세요.`,
      );
    }

    const form = await getSupplierActiveProductForm(line.supplier_id, null);
    const enabledRows = toBuyerFieldRows(form.fields).filter((r) => r.is_enabled);
    const valueByKey = valueByKeyFromFieldValues(form.fields, product.field_values);
    const snaps = resolveBuyerOrderLineSnapshots(enabledRows, valueByKey);
    if (snaps.unitPrice == null) {
      throw new HttpError(400, `상품(ID ${line.product_id})의 가격을 확인할 수 없습니다.`);
    }
    const cartPrice = Number(line.price_snapshot);
    if (!Number.isFinite(cartPrice)) {
      throw new HttpError(400, "장바구니 가격 정보가 올바르지 않습니다.");
    }

    orderItems.push({
      productId: line.product_id,
      qty: Number(line.quantity),
      lineSnapshots: {
        productCode: snaps.productCode,
        productName: snaps.productName,
        spec: snaps.spec,
        unit: snaps.unit,
        unitPrice: cartPrice,
      },
    });
  }

  const order = await createOrder({
    buyerId: buyer.id,
    projectId: null,
    memo: input.memo ?? null,
    items: orderItems,
  });

  await prisma.cartItem.deleteMany({ where: { cart_id: cart.id } });

  return order;
}

export async function getBuyerProductsPayload(supplierId: number, buyerId: number) {
  const { countryCode } = await assertBuyerWithCountry(buyerId);

  const supplier = await prisma.supplier.findFirst({
    where: {
      id: supplierId,
      is_active: true,
      status: SupplierStatus.ACTIVE,
    },
    select: { id: true },
  });
  if (!supplier) {
    throw new HttpError(404, "공급사를 찾을 수 없습니다.");
  }

  const form = await getSupplierActiveProductForm(supplierId, null);
  const formFields = form.fields;
  const fieldRows = toBuyerFieldRows(formFields.filter((f) => f.is_enabled));

  const products = await prisma.product.findMany({
    where: {
      supplier_id: supplierId,
      country_code: countryCode,
      is_active: true,
      status: ProductStatus.APPROVED,
    },
    select: {
      id: true,
      supplier_id: true,
      category_id: true,
      image_url: true,
      thumbnail_url: true,
      product_image_url: true,
      field_values: { select: { field_id: true, value_text: true } },
    },
    orderBy: [{ sort_order: "asc" }, { id: "asc" }],
  });

  const list = products.map((p) => {
    const valueByKey = valueByKeyFromFieldValues(formFields, p.field_values);
    return {
      id: p.id,
      supplier_id: p.supplier_id,
      category_id: p.category_id,
      image_url: p.image_url ?? p.thumbnail_url ?? p.product_image_url,
      displayName: resolveBuyerDisplayName(fieldRows, valueByKey),
      unitPrice: resolveBuyerUnitPrice(fieldRows, valueByKey),
      detailRows: listDetailFieldRows(fieldRows, valueByKey),
    };
  });

  return {
    form: {
      id: form.id,
      name: form.name,
      fields: fieldRows,
    },
    products: list,
  };
}
