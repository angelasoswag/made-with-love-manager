import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  addOrder,
  getActiveProducts,
  getOrders
} from "../db/database";

function createBlankItem() {
  return {
    rowId: crypto.randomUUID(),
    productId: "",
    quantity: 1
  };
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function getProductImage(image) {
  if (!image) return "";

  if (typeof image === "string") {
    return image;
  }

  return URL.createObjectURL(image);
}

function NewOrder() {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);

  const [orderDate, setOrderDate] = useState(getToday());
  const [deductInventory, setDeductInventory] =
    useState(true);

  const [customer, setCustomer] = useState("");
  const [platform, setPlatform] = useState("Etsy");
  const [fees, setFees] = useState("");
  const [discount, setDiscount] = useState("");

  const [orderItems, setOrderItems] = useState([
    createBlankItem()
  ]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [savedProducts, savedOrders] =
        await Promise.all([
          getActiveProducts(),
          getOrders()
        ]);

      savedProducts.sort((a, b) =>
        a.name.localeCompare(b.name)
      );

      setProducts(savedProducts);
      setOrders(savedOrders);
    } catch (error) {
      console.error("Could not load order data:", error);

      alert(
        `The order form could not be loaded.\n\n${
          error.message || "Unknown error"
        }`
      );
    }
  }

  const calculatedItems = useMemo(() => {
    return orderItems.map((item) => {
      const product = products.find(
        (catalogProduct) =>
          catalogProduct.id === item.productId
      );

      const quantity = Math.max(
        1,
        Number(item.quantity) || 1
      );

      return {
        ...item,
        product,
        quantity,
        lineRevenue: product
          ? Number(product.price) * quantity
          : 0
      };
    });
  }, [orderItems, products]);

  const orderRevenue = calculatedItems.reduce(
    (total, item) => total + item.lineRevenue,
    0
  );

  const feeAmount = Number(fees) || 0;
  const discountAmount = Number(discount) || 0;

  const orderProfit =
    orderRevenue - feeAmount - discountAmount;

  function updateItem(rowId, field, value) {
    setOrderItems((currentItems) =>
      currentItems.map((item) =>
        item.rowId === rowId
          ? {
              ...item,
              [field]: value
            }
          : item
      )
    );
  }

  function addProductRow() {
    setOrderItems((currentItems) => [
      ...currentItems,
      createBlankItem()
    ]);
  }

  function removeProductRow(rowId) {
    setOrderItems((currentItems) => {
      if (currentItems.length === 1) {
        return currentItems;
      }

      return currentItems.filter(
        (item) => item.rowId !== rowId
      );
    });
  }

  async function saveOrder() {
    if (!orderDate) {
      alert("Choose the date ordered.");
      return;
    }

    if (!customer.trim()) {
      alert("Enter the customer name.");
      return;
    }

    const validItems = calculatedItems.filter(
      (item) => item.product
    );

    if (validItems.length === 0) {
      alert("Add at least one product.");
      return;
    }

    if (validItems.length !== calculatedItems.length) {
      alert("Choose a product for every product row.");
      return;
    }

    try {
      await addOrder({
        orderNumber: orders.length + 1,
        orderDate,
        deductInventory,
        customer: customer.trim(),
        platform,
        revenue: orderRevenue,
        fees: feeAmount,
        discount: discountAmount,
        items: validItems.map((item) => ({
          productId: item.product.id,
          productName: item.product.name,
          productImage:
            typeof item.product.image === "string"
              ? item.product.image
              : null,
          quantity: item.quantity,
          priceAtSale: Number(item.product.price),
          lineRevenue: item.lineRevenue
        }))
      });

      alert("💌 Order saved!");

      navigate("/");
    } catch (error) {
      console.error("Could not save order:", error);

      alert(
        `The order could not be saved.\n\n${
          error.message || "Unknown error"
        }`
      );
    }
  }

  return (
    <div className="app">
      <header className="page-header">
        <div>
          <h1>New Order</h1>

          <p className="page-description">
            Create a new customer order.
          </p>
        </div>
      </header>

      <section className="order-form">
        <label className="field-label">
          Date ordered

          <input
            type="date"
            value={orderDate}
            onChange={(event) =>
              setOrderDate(event.target.value)
            }
          />
        </label>

        <label className="field-label">
          Customer name

          <input
            type="text"
            value={customer}
            onChange={(event) =>
              setCustomer(event.target.value)
            }
            placeholder="Customer name"
          />
        </label>

        <label className="field-label">
          Platform

          <select
            value={platform}
            onChange={(event) =>
              setPlatform(event.target.value)
            }
          >
            <option value="Etsy">Etsy</option>
            <option value="Depop">Depop</option>
            <option value="Mercari">Mercari</option>
          </select>
        </label>

        <label className="archive-toggle">
          <input
            type="checkbox"
            checked={deductInventory}
            onChange={(event) =>
              setDeductInventory(event.target.checked)
            }
          />

          Deduct products from inventory
        </label>

        {!deductInventory && (
          <div className="empty-catalog">
            Inventory quantities will not change when
            this order is saved.
          </div>
        )}

        <div className="items-heading">
          <h3>Products in this order</h3>

          <button
            type="button"
            className="add-item-button"
            onClick={addProductRow}
          >
            + Add product
          </button>
        </div>

        {products.length === 0 && (
          <div className="empty-catalog">
            Add products to your Product Catalog first.
          </div>
        )}

        <div className="order-items-list">
          {calculatedItems.map((item, index) => (
            <article
              className="order-item-card"
              key={item.rowId}
            >
              <div className="order-item-top">
                <strong>Product {index + 1}</strong>

                {orderItems.length > 1 && (
                  <button
                    type="button"
                    className="remove-item-button"
                    onClick={() =>
                      removeProductRow(item.rowId)
                    }
                  >
                    Remove
                  </button>
                )}
              </div>

              <label className="field-label">
                Product

                <select
                  value={item.productId}
                  onChange={(event) =>
                    updateItem(
                      item.rowId,
                      "productId",
                      event.target.value
                    )
                  }
                >
                  <option value="">
                    Choose a product
                  </option>

                  {products.map((product) => (
                    <option
                      key={product.id}
                      value={product.id}
                    >
                      {product.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-label">
                Quantity

                <input
                  type="number"
                  min="1"
                  step="1"
                  value={item.quantity}
                  onChange={(event) =>
                    updateItem(
                      item.rowId,
                      "quantity",
                      event.target.value
                    )
                  }
                />
              </label>

              {item.product && (
                <div className="product-preview">
                  {item.product.image ? (
                    <img
                      src={getProductImage(
                        item.product.image
                      )}
                      alt={`${item.product.name} mockup`}
                    />
                  ) : (
                    <div className="product-image-box">
                      No photo
                    </div>
                  )}

                  <div>
                    <strong>{item.product.name}</strong>

                    <p>
                      $
                      {Number(
                        item.product.price
                      ).toFixed(2)}{" "}
                      each
                    </p>

                    <p>
                      Line total: $
                      {item.lineRevenue.toFixed(2)}
                    </p>

                    <p>
                      Current stock:{" "}
                      {Number(item.product.stock) || 0}
                    </p>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>

        <label className="field-label">
          Platform fees

          <input
            type="number"
            min="0"
            step="0.01"
            value={fees}
            onChange={(event) =>
              setFees(event.target.value)
            }
            placeholder="0.00"
          />
        </label>

        <label className="field-label">
          Discount or coupon

          <input
            type="number"
            min="0"
            step="0.01"
            value={discount}
            onChange={(event) =>
              setDiscount(event.target.value)
            }
            placeholder="0.00"
          />
        </label>

        <div className="order-summary">
          <div>
            <span>Order revenue</span>
            <strong>${orderRevenue.toFixed(2)}</strong>
          </div>

          <div>
            <span>Platform fees</span>
            <strong>${feeAmount.toFixed(2)}</strong>
          </div>

          <div>
            <span>Discount</span>
            <strong>
              ${discountAmount.toFixed(2)}
            </strong>
          </div>

          <div>
            <span>Inventory</span>
            <strong>
              {deductInventory
                ? "Will be deducted"
                : "Will not change"}
            </strong>
          </div>

          <div className="profit-row">
            <span>Order profit</span>
            <strong>${orderProfit.toFixed(2)}</strong>
          </div>
        </div>

        <button
          type="button"
          className="save-button"
          onClick={saveOrder}
          disabled={products.length === 0}
        >
          Save Order
        </button>
      </section>
    </div>
  );
}

export default NewOrder;