import type { Product } from "@prisma/client";
import type { FastifyInstance } from "fastify";

import { HttpError } from "../../common/http.js";

export type ProductReferenceInput = {
  productId?: number | undefined;
  productName?: string | undefined;
};

export async function resolveProduct(
  app: FastifyInstance,
  input: ProductReferenceInput
): Promise<Product> {
  if (input.productId !== undefined) {
    const product = await app.prisma.product.findUnique({
      where: { id: input.productId }
    });

    if (!product) {
      throw new HttpError(404, "PRODUCT_NOT_FOUND", "Product not found");
    }

    return product;
  }

  const productName = input.productName;
  if (!productName) {
    throw new HttpError(400, "PRODUCT_REQUIRED", "productId or productName is required");
  }

  const existing = await app.prisma.product.findFirst({
    where: { name: productName },
    orderBy: { id: "asc" }
  });

  if (existing) {
    return existing;
  }

  return app.prisma.product.create({
    data: {
      name: productName,
      isActive: true
    }
  });
}
