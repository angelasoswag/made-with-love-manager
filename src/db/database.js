import { supabase } from "../lib/supabase";

/* ---------- HELPERS ---------- */

async function getSignedInUser() {
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

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);

    reader.onerror = () =>
      reject(
        new Error(
          "The product photo could not be read."
        )
      );

    reader.readAsDataURL(file);
  });
}

async function prepareProductImage(image) {
  if (!image) return null;

  if (typeof image === "string") {
    return image;
  }

  if (image instanceof File || image instanceof Blob) {
    return fileToDataUrl(image);
  }

  return null;
}

function mapOrder(order) {
  return {
    id: order.id,
    orderNumber: order.order_number,
    customer: order.customer,
    platform: order.platform,
    items: order.items ?? [],
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

function groupItemQuantities(items) {
  const quantities = new Map();

  items.forEach((item) => {
    if (!item.productId) return;

    const current =
      quantities.get(item.productId) || 0;

    quantities.set(
      item.productId,
      current + (Number(item.quantity) || 0)
    );
  });

  return quantities;
}

async function changeOrderStock(items, direction) {
  const user = await getSignedInUser();
  const quantities = groupItemQuantities(items);

  for (const [productId, quantity] of quantities) {
    const { data: product, error: loadError } =
      await supabase
        .from("products")
        .select("id, name, stock")
        .eq("id", productId)
        .eq("user_id", user.id)
        .single();

    if (loadError) throw loadError;

    const currentStock =
      Number(product.stock) || 0;

    const newStock =
      currentStock + direction * quantity;

    if (newStock < 0) {
      throw new Error(
        `${product.name} only has ${currentStock} in stock.`
      );
    }

    const { error: updateError } = await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("id", productId)
      .eq("user_id", user.id);

    if (updateError) throw updateError;
  }
}

/* ---------- PRODUCTS ---------- */

export async function getProducts() {
  const user = await getSignedInUser();

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("user_id", user.id)
    .order("name");

  if (error) throw error;

  return data ?? [];
}

export async function getActiveProducts() {
  const products = await getProducts();

  return products.filter(
    (product) => product.active !== false
  );
}

export async function getProduct(productId) {
  const user = await getSignedInUser();

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
  const user = await getSignedInUser();

  const newProduct = {
    user_id: user.id,
    name: String(product.name || "").trim(),
    category: String(
      product.category || "Sticker"
    ).trim(),
    price: Number(product.price) || 0,
    stock: Math.max(
      0,
      Number(product.stock) || 0
    ),
    low_stock_threshold: 2,
    image: await prepareProductImage(
      product.image
    ),
    active: product.active !== false
  };

  const { data, error } = await supabase
    .from("products")
    .insert(newProduct)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function updateProduct(
  productId,
  updates
) {
  const user = await getSignedInUser();

  const prepared = { ...updates };

  if (updates.image !== undefined) {
    prepared.image = await prepareProductImage(
      updates.image
    );
  }

  if (updates.price !== undefined) {
    prepared.price =
      Number(updates.price) || 0;
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

  if (error) throw error;

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
  const user = await getSignedInUser();

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("user_id", user.id);

  if (error) throw error;
}

/* ---------- ORDERS ---------- */

export async function getOrders() {
  const user = await getSignedInUser();

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", {
      ascending: false
    });

  if (error) throw error;

  return (data ?? []).map(mapOrder);
}

export async function getOrder(orderId) {
  const user = await getSignedInUser();

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
  const user = await getSignedInUser();

  const items = Array.isArray(order.items)
    ? order.items.map((item) => ({
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
      }))
    : [];

  const revenue = Number(order.revenue) || 0;
  const fees = Number(order.fees) || 0;
  const discount =
    Number(order.discount) || 0;

  const newOrder = {
    user_id: user.id,
    order_number: order.orderNumber || null,
    customer: String(
      order.customer || ""
    ).trim(),
    platform: String(
      order.platform || "Etsy"
    ).trim(),
    items,
    revenue,
    fees,
    discount,
    profit: revenue - fees - discount
  };

  await changeOrderStock(items, -1);

  const { data, error } = await supabase
    .from("orders")
    .insert(newOrder)
    .select()
    .single();

  if (error) {
    await changeOrderStock(items, 1);
    throw error;
  }

  return mapOrder(data);
}

export async function updateOrder(
  orderId,
  updates
) {
  const user = await getSignedInUser();
  const prepared = { ...updates };

  if (updates.orderNumber !== undefined) {
    prepared.order_number =
      updates.orderNumber;
    delete prepared.orderNumber;
  }

  if (
    updates.revenue !== undefined ||
    updates.fees !== undefined ||
    updates.discount !== undefined
  ) {
    prepared.profit =
      (Number(updates.revenue) || 0) -
      (Number(updates.fees) || 0) -
      (Number(updates.discount) || 0);
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
  const user = await getSignedInUser();
  const order = await getOrder(orderId);

  await changeOrderStock(order.items, 1);

  const { error } = await supabase
    .from("orders")
    .delete()
    .eq("id", orderId)
    .eq("user_id", user.id);

  if (error) {
    await changeOrderStock(order.items, -1);
    throw error;
  }
}

/* ---------- EXPENSES ---------- */

export async function getExpenses() {
  const user = await getSignedInUser();

  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("user_id", user.id)
    .order("date", {
      ascending: false
    });

  if (error) throw error;

  return (data ?? []).map(mapExpense);
}

export async function addExpense(expense) {
  const user = await getSignedInUser();

  const newExpense = {
    user_id: user.id,
    date:
      expense.date ||
      new Date().toISOString().slice(0, 10),
    vendor: String(
      expense.vendor || ""
    ).trim(),
    category: String(
      expense.category || "Other"
    ).trim(),
    description: String(
      expense.description || ""
    ).trim(),
    amount: Number(expense.amount) || 0
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
  const user = await getSignedInUser();
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

export async function deleteExpense(expenseId) {
  const user = await getSignedInUser();

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

  const revenue = total(orders, "revenue");
  const platformFees = total(orders, "fees");
  const discounts = total(
    orders,
    "discount"
  );
  const operatingExpenses = total(
    expenses,
    "amount"
  );

  return {
    totalOrders: orders.length,
    totalProducts: products.filter(
      (product) => product.active !== false
    ).length,
    revenue,
    platformFees,
    discounts,
    expenses: operatingExpenses,
    profit:
      revenue -
      platformFees -
      discounts -
      operatingExpenses
  };
}