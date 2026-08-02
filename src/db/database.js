import { supabase } from "../lib/supabase";

const IMAGE_BUCKET = "product-images";

/* ---------- HELPERS ---------- */

async function getUser() {
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error) throw error;

  if (!user) {
    throw new Error("You must be signed in.");
  }

  return user;
}

function mapOrder(order) {
  return {
    id: order.id,
    orderNumber: order.order_number,
    orderDate:
      order.order_date ||
      order.created_at?.slice(0, 10),
    deductInventory:
      order.deduct_inventory !== false,
    customer: order.customer,
    platform: order.platform,
    items: order.items || [],
    revenue: Number(order.revenue) || 0,
    fees: Number(order.fees) || 0,
    discount: Number(order.discount) || 0,
    profit: Number(order.profit) || 0,
    createdAt: order.created_at,
    updatedAt:
      order.updated_at || order.created_at
  };
}

function mapExpense(expense) {
  return {
    id: expense.id,
    date: expense.date,
    vendor: expense.vendor || "",
    category: expense.category || "Other",
    description: expense.description || "",
    amount: Number(expense.amount) || 0,
    createdAt: expense.created_at,
    updatedAt:
      expense.updated_at || expense.created_at
  };
}

function cleanFileName(name) {
  return String(name || "product-image")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-");
}

async function uploadImage(file, userId, productId) {
  if (!file) return null;

  if (typeof file === "string") {
    return file;
  }

  const extension =
    file.name?.split(".").pop() || "png";

  const fileName = cleanFileName(
    file.name?.replace(/\.[^/.]+$/, "") ||
      "product-image"
  );

  const path =
    `${userId}/${productId}-${Date.now()}` +
    `-${fileName}.${extension}`;

  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, file, {
      contentType: file.type || "image/png",
      upsert: false
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from(IMAGE_BUCKET)
    .getPublicUrl(path);

  return data.publicUrl;
}

function getImagePath(url) {
  const marker =
    `/storage/v1/object/public/${IMAGE_BUCKET}/`;

  if (
    typeof url !== "string" ||
    !url.includes(marker)
  ) {
    return null;
  }

  return decodeURIComponent(
    url.split(marker)[1]?.split("?")[0] || ""
  );
}

async function removeImage(url) {
  const path = getImagePath(url);

  if (!path) return;

  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .remove([path]);

  if (error) {
    console.warn("Could not remove image:", error);
  }
}

/* ---------- PRODUCTS ---------- */

export async function getProducts() {
  const user = await getUser();

  const { data, error } = await supabase
    .from("products")
    .select(`
      id,
      name,
      category,
      price,
      cost,
      stock,
      low_stock_threshold,
      image,
      active,
      created_at
    `)
    .eq("user_id", user.id)
    .order("name");

  if (error) throw error;

  return data || [];
}

export async function getActiveProducts() {
  const products = await getProducts();

  return products.filter(
    (product) => product.active !== false
  );
}

export async function getProduct(productId) {
  const user = await getUser();

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .eq("user_id", user.id)
    .single();

  if (error) throw error;

  return data;
}

export async function addProduct(product) {
  const user = await getUser();
  const productId = crypto.randomUUID();

  const image = await uploadImage(
    product.image,
    user.id,
    productId
  );

  const newProduct = {
    id: productId,
    user_id: user.id,
    name: String(product.name || "").trim(),
    category: product.category || "Sticker",
    price: Number(product.price) || 0,
    cost: Number(product.cost) || 0,
    stock: Math.max(
      0,
      Number(product.stock) || 0
    ),
    low_stock_threshold: 2,
    active: product.active !== false,
    image
  };

  const { data, error } = await supabase
    .from("products")
    .insert(newProduct)
    .select()
    .single();

  if (error) {
    await removeImage(image);
    throw error;
  }

  return data;
}

export async function updateProduct(
  productId,
  updates
) {
  const user = await getUser();

  const {
    data: oldProduct,
    error: loadError
  } = await supabase
    .from("products")
    .select("image")
    .eq("id", productId)
    .eq("user_id", user.id)
    .single();

  if (loadError) throw loadError;

  const prepared = { ...updates };
  let newImage = null;
  let replaceImage = false;

  if (updates.image !== undefined) {
    if (
      updates.image instanceof File ||
      updates.image instanceof Blob
    ) {
      newImage = await uploadImage(
        updates.image,
        user.id,
        productId
      );

      prepared.image = newImage;
      replaceImage = true;
    } else if (updates.image === null) {
      prepared.image = null;
      replaceImage = true;
    }
  }

  if (updates.price !== undefined) {
    prepared.price =
      Number(updates.price) || 0;
  }

  if (updates.cost !== undefined) {
    prepared.cost =
      Number(updates.cost) || 0;
  }

  if (updates.stock !== undefined) {
    prepared.stock = Math.max(
      0,
      Number(updates.stock) || 0
    );
  }

  prepared.low_stock_threshold = 2;

  delete prepared.id;
  delete prepared.user_id;
  delete prepared.created_at;

  const { data, error } = await supabase
    .from("products")
    .update(prepared)
    .eq("id", productId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    if (newImage) {
      await removeImage(newImage);
    }

    throw error;
  }

  if (
    replaceImage &&
    oldProduct.image !== prepared.image
  ) {
    await removeImage(oldProduct.image);
  }

  return data;
}

export function archiveProduct(productId) {
  return updateProduct(productId, {
    active: false
  });
}

export function reactivateProduct(productId) {
  return updateProduct(productId, {
    active: true
  });
}

export async function deleteProduct(productId) {
  const user = await getUser();

  const {
    data: product,
    error: loadError
  } = await supabase
    .from("products")
    .select("image")
    .eq("id", productId)
    .eq("user_id", user.id)
    .single();

  if (loadError) throw loadError;

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("user_id", user.id);

  if (error) throw error;

  await removeImage(product.image);
}

/* ---------- STOCK ---------- */

async function changeStock(items, direction) {
  const user = await getUser();
  const quantities = new Map();

  for (const item of items || []) {
    if (!item.productId) continue;

    const oldQuantity =
      quantities.get(item.productId) || 0;

    quantities.set(
      item.productId,
      oldQuantity +
        (Number(item.quantity) || 0)
    );
  }

  for (const [productId, quantity] of quantities) {
    const {
      data: product,
      error
    } = await supabase
      .from("products")
      .select("name, stock")
      .eq("id", productId)
      .eq("user_id", user.id)
      .single();

    if (error) throw error;

    const stock = Number(product.stock) || 0;

    const newStock =
      stock + direction * quantity;

    if (newStock < 0) {
      throw new Error(
        `${product.name} only has ${stock} in stock.`
      );
    }

    const { error: updateError } =
      await supabase
        .from("products")
        .update({ stock: newStock })
        .eq("id", productId)
        .eq("user_id", user.id);

    if (updateError) throw updateError;
  }
}

/* ---------- ORDERS ---------- */

export async function getOrders() {
  const user = await getUser();

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", user.id)
    .order("order_date", {
      ascending: false
    })
    .order("created_at", {
      ascending: false
    });

  if (error) throw error;

  return (data || []).map(mapOrder);
}

export async function getOrder(orderId) {
  const user = await getUser();

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .single();

  if (error) throw error;

  return mapOrder(data);
}

export async function addOrder(order) {
  const user = await getUser();

  const items = (order.items || []).map(
    (item) => ({
      productId: item.productId,
      productName: String(
        item.productName || ""
      ).trim(),
      productImage:
        item.productImage || null,
      quantity: Math.max(
        1,
        Number(item.quantity) || 1
      ),
      priceAtSale:
        Number(item.priceAtSale) || 0,
      lineRevenue:
        Number(item.lineRevenue) || 0
    })
  );

  const revenue = Number(order.revenue) || 0;
  const fees = Number(order.fees) || 0;
  const discount =
    Number(order.discount) || 0;

  const shouldDeductInventory =
    order.deductInventory !== false;

  const newOrder = {
    user_id: user.id,
    order_number:
      order.orderNumber || null,
    order_date:
      order.orderDate ||
      new Date().toISOString().slice(0, 10),
    deduct_inventory:
      shouldDeductInventory,
    customer: String(
      order.customer || ""
    ).trim(),
    platform:
      order.platform || "Etsy",
    items,
    revenue,
    fees,
    discount,
    profit:
      revenue - fees - discount
  };

  if (shouldDeductInventory) {
    await changeStock(items, -1);
  }

  const { data, error } = await supabase
    .from("orders")
    .insert(newOrder)
    .select()
    .single();

  if (error) {
    if (shouldDeductInventory) {
      await changeStock(items, 1);
    }

    throw error;
  }

  return mapOrder(data);
}

export async function updateOrder(
  orderId,
  updates
) {
  const user = await getUser();
  const prepared = { ...updates };

  if (updates.orderNumber !== undefined) {
    prepared.order_number =
      updates.orderNumber;

    delete prepared.orderNumber;
  }

  if (updates.orderDate !== undefined) {
    prepared.order_date =
      updates.orderDate;

    delete prepared.orderDate;
  }

  if (
    updates.deductInventory !== undefined
  ) {
    prepared.deduct_inventory =
      updates.deductInventory;

    delete prepared.deductInventory;
  }

  if (
    updates.revenue !== undefined ||
    updates.fees !== undefined ||
    updates.discount !== undefined
  ) {
    const currentOrder =
      await getOrder(orderId);

    const revenue =
      updates.revenue !== undefined
        ? Number(updates.revenue) || 0
        : currentOrder.revenue;

    const fees =
      updates.fees !== undefined
        ? Number(updates.fees) || 0
        : currentOrder.fees;

    const discount =
      updates.discount !== undefined
        ? Number(updates.discount) || 0
        : currentOrder.discount;

    prepared.profit =
      revenue - fees - discount;
  }

  delete prepared.id;
  delete prepared.createdAt;
  delete prepared.updatedAt;

  const { data, error } = await supabase
    .from("orders")
    .update(prepared)
    .eq("id", orderId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw error;

  return mapOrder(data);
}

export async function deleteOrder(orderId) {
  const user = await getUser();
  const order = await getOrder(orderId);

  if (order.deductInventory !== false) {
    await changeStock(order.items, 1);
  }

  const { error } = await supabase
    .from("orders")
    .delete()
    .eq("id", orderId)
    .eq("user_id", user.id);

  if (error) {
    if (order.deductInventory !== false) {
      await changeStock(order.items, -1);
    }

    throw error;
  }
}

/* ---------- EXPENSES ---------- */

export async function getExpenses() {
  const user = await getUser();

  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("user_id", user.id)
    .order("date", {
      ascending: false
    });

  if (error) throw error;

  return (data || []).map(mapExpense);
}

export async function addExpense(expense) {
  const user = await getUser();

  const newExpense = {
    user_id: user.id,
    date:
      expense.date ||
      new Date().toISOString().slice(0, 10),
    vendor: String(
      expense.vendor || ""
    ).trim(),
    category:
      expense.category || "Other",
    description: String(
      expense.description || ""
    ).trim(),
    amount:
      Number(expense.amount) || 0
  };

  const { data, error } = await supabase
    .from("expenses")
    .insert(newExpense)
    .select()
    .single();

  if (error) throw error;

  return mapExpense(data);
}

export async function updateExpense(
  expenseId,
  updates
) {
  const user = await getUser();
  const prepared = { ...updates };

  if (updates.amount !== undefined) {
    prepared.amount =
      Number(updates.amount) || 0;
  }

  delete prepared.id;
  delete prepared.user_id;
  delete prepared.createdAt;
  delete prepared.updatedAt;

  const { data, error } = await supabase
    .from("expenses")
    .update(prepared)
    .eq("id", expenseId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw error;

  return mapExpense(data);
}

export async function deleteExpense(
  expenseId
) {
  const user = await getUser();

  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", expenseId)
    .eq("user_id", user.id);

  if (error) throw error;
}

/* ---------- DASHBOARD ---------- */

export async function getDashboardTotals() {
  const [products, orders, expenses] =
    await Promise.all([
      getProducts(),
      getOrders(),
      getExpenses()
    ]);

  const total = (list, field) =>
    list.reduce(
      (sum, item) =>
        sum + (Number(item[field]) || 0),
      0
    );

  const revenue =
    total(orders, "revenue");

  const fees =
    total(orders, "fees");

  const discounts =
    total(orders, "discount");

  const expenseTotal =
    total(expenses, "amount");

  return {
    totalOrders: orders.length,
    totalProducts: products.filter(
      (product) =>
        product.active !== false
    ).length,
    revenue,
    platformFees: fees,
    discounts,
    expenses: expenseTotal,
    profit:
      revenue -
      fees -
      discounts -
      expenseTotal
  };
}