import { useEffect, useMemo, useState } from "react";

import {
  deleteOrder,
  getOrders
} from "../db/database";

function formatMoney(value) {
  return `$${(Number(value) || 0).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) {
    return "No date recorded";
  }

  const text = String(value).slice(0, 10);
  const parts = text.split("-").map(Number);

  if (
    parts.length !== 3 ||
    !parts[0] ||
    !parts[1] ||
    !parts[2]
  ) {
    return "No date recorded";
  }

  const [year, month, day] = parts;

  const date = new Date(
    year,
    month - 1,
    day
  );

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function getOrderTimestamp(order) {
  if (!order.orderDate) {
    return 0;
  }

  const parts = String(order.orderDate)
    .slice(0, 10)
    .split("-")
    .map(Number);

  if (
    parts.length !== 3 ||
    !parts[0] ||
    !parts[1] ||
    !parts[2]
  ) {
    return 0;
  }

  const [year, month, day] = parts;

  return new Date(
    year,
    month - 1,
    day
  ).getTime();
}

function getUnitsSold(order) {
  return (order.items || []).reduce(
    (total, item) =>
      total + (Number(item.quantity) || 0),
    0
  );
}

function OrderHistory() {
  const [orders, setOrders] = useState([]);
  const [searchText, setSearchText] = useState("");

  const [platformFilter, setPlatformFilter] =
    useState("All");

  const [isLoading, setIsLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [selectedOrder, setSelectedOrder] =
    useState(null);

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const savedOrders = await getOrders();
      setOrders(savedOrders);
    } catch (error) {
      console.error(
        "Could not load orders:",
        error
      );

      setErrorMessage(
        error.message ||
          "Your orders could not be loaded."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteOrder(order) {
    const confirmed = window.confirm(
      `Delete order #${
        order.orderNumber || "—"
      } for ${
        order.customer || "this customer"
      }?\n\nThis cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await deleteOrder(order.id);

      if (selectedOrder?.id === order.id) {
        setSelectedOrder(null);
      }

      await loadOrders();

      alert("💌 Order deleted.");
    } catch (error) {
      console.error(
        "Could not delete order:",
        error
      );

      alert(
        `The order could not be deleted.\n\n${
          error.message || "Unknown error"
        }`
      );
    }
  }

  const filteredOrders = useMemo(() => {
    const search =
      searchText.trim().toLowerCase();

    return orders
      .filter((order) => {
        const productNames = (
          order.items || []
        )
          .map(
            (item) =>
              item.productName || ""
          )
          .join(" ")
          .toLowerCase();

        const matchesSearch =
          !search ||
          String(order.customer || "")
            .toLowerCase()
            .includes(search) ||
          String(order.orderNumber || "")
            .toLowerCase()
            .includes(search) ||
          productNames.includes(search);

        const matchesPlatform =
          platformFilter === "All" ||
          order.platform === platformFilter;

        return (
          matchesSearch &&
          matchesPlatform
        );
      })
      .sort(
        (a, b) =>
          getOrderTimestamp(b) -
          getOrderTimestamp(a)
      );
  }, [
    orders,
    searchText,
    platformFilter
  ]);

  const totalRevenue = filteredOrders.reduce(
    (total, order) =>
      total +
      (Number(order.revenue) || 0),
    0
  );

  const totalProfit = filteredOrders.reduce(
    (total, order) =>
      total +
      (Number(order.profit) || 0),
    0
  );

  return (
    <main className="app order-history-page">
      <header className="page-header">
        <h1>Orders</h1>

        <p className="page-description">
          View and manage every order.
        </p>
      </header>

      <section className="order-history-summary">
        <article>
          <span>🛍️ Orders</span>
          <strong>
            {filteredOrders.length}
          </strong>
        </article>

        <article>
          <span>💰 Revenue</span>
          <strong>
            {formatMoney(totalRevenue)}
          </strong>
        </article>

        <article>
          <span>🌷 Profit</span>
          <strong>
            {formatMoney(totalProfit)}
          </strong>
        </article>
      </section>

      <section className="order-history-tools">
        <label className="order-history-search">
          <span>🔍</span>

          <input
            type="search"
            value={searchText}
            onChange={(event) =>
              setSearchText(
                event.target.value
              )
            }
            placeholder="Search customer, order number, or product..."
          />
        </label>

        <select
          value={platformFilter}
          onChange={(event) =>
            setPlatformFilter(
              event.target.value
            )
          }
          aria-label="Filter orders by platform"
        >
          <option value="All">
            All platforms
          </option>

          <option value="Etsy">
            Etsy
          </option>

          <option value="Depop">
            Depop
          </option>

          <option value="Mercari">
            Mercari
          </option>
        </select>
      </section>

      {isLoading ? (
        <section className="dashboard-empty">
          <span>🩰</span>
          <p>Loading orders...</p>
        </section>
      ) : errorMessage ? (
        <section className="dashboard-empty">
          <span>💌</span>

          <p>{errorMessage}</p>

          <button
            type="button"
            className="analytics-retry-button"
            onClick={loadOrders}
          >
            Try Again
          </button>
        </section>
      ) : filteredOrders.length === 0 ? (
        <section className="dashboard-empty">
          <span>🌷</span>

          <p>
            {orders.length === 0
              ? "No orders have been saved yet."
              : "No orders match your search."}
          </p>
        </section>
      ) : (
        <section className="order-history-list">
          {filteredOrders.map((order) => {
            const items = Array.isArray(
              order.items
            )
              ? order.items
              : [];

            const unitsSold =
              getUnitsSold(order);

            return (
              <article
                className="order-history-card"
                key={order.id}
                onClick={() =>
                  setSelectedOrder(order)
                }
              >
                <div className="order-history-card-top">
                  <div className="order-history-main">
                    <span className="order-number">
                      Order #
                      {order.orderNumber ||
                        "—"}
                    </span>

                    <h2>
                      {order.customer ||
                        "No customer name"}
                    </h2>

                    <p>
                      {order.platform ||
                        "Unknown platform"}{" "}
                      ·{" "}
                      {formatDate(
                        order.orderDate
                      )}
                    </p>
                  </div>

                  <div className="order-history-money">
                    <strong>
                      {formatMoney(
                        order.revenue
                      )}
                    </strong>

                    <span>
                      {formatMoney(
                        order.profit
                      )}{" "}
                      profit
                    </span>
                  </div>
                </div>

                <div className="order-history-items">
                  {items.map(
                    (item, index) => (
                      <div
                        className="order-history-item"
                        key={`${order.id}-${index}`}
                      >
                        {item.productImage ? (
                          <img
                            className="order-history-item-image"
                            src={
                              item.productImage
                            }
                            alt={
                              item.productName ||
                              "Order product"
                            }
                          />
                        ) : null}

                        <div className="order-history-item-info">
                          <strong>
                            {item.productName ||
                              "Unnamed product"}
                          </strong>

                          <span>
                            Qty{" "}
                            {Number(
                              item.quantity
                            ) || 0}
                          </span>
                        </div>

                        <strong className="order-history-item-total">
                          {formatMoney(
                            item.lineRevenue
                          )}
                        </strong>
                      </div>
                    )
                  )}
                </div>

                <div className="order-history-card-footer">
                  <span>
                    {unitsSold} item
                    {unitsSold === 1
                      ? ""
                      : "s"}
                  </span>

                  <button
                    type="button"
                    className="delete-order-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteOrder(
                        order
                      );
                    }}
                  >
                    Delete Order
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {selectedOrder && (
        <div
          className="receipt-overlay"
          onClick={() =>
            setSelectedOrder(null)
          }
        >
          <section
            className="receipt-card"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <button
              type="button"
              className="receipt-close"
              onClick={() =>
                setSelectedOrder(null)
              }
              aria-label="Close receipt"
            >
              ×
            </button>

            <div className="receipt-header">
              <p>
                🌷 Made with Love, Maria
              </p>

              <h2>Order Receipt</h2>

              <span>
                Order #
                {selectedOrder.orderNumber ||
                  "—"}
              </span>
            </div>

            <div className="receipt-meta">
              <div>
                <span>Customer</span>

                <strong>
                  {selectedOrder.customer ||
                    "No customer name"}
                </strong>
              </div>

              <div>
                <span>Date ordered</span>

                <strong>
                  {formatDate(
                    selectedOrder.orderDate
                  )}
                </strong>
              </div>

              <div>
                <span>Platform</span>

                <strong>
                  {selectedOrder.platform ||
                    "Unknown"}
                </strong>
              </div>
            </div>

            <div className="receipt-items">
              {(selectedOrder.items || []).map(
                (item, index) => (
                  <div
                    className="receipt-item"
                    key={`${selectedOrder.id}-${index}`}
                  >
                    <div>
                      <strong>
                        {item.productName ||
                          "Unnamed product"}
                      </strong>

                      <span>
                        {Number(
                          item.quantity
                        ) || 0}{" "}
                        ×{" "}
                        {formatMoney(
                          item.priceAtSale
                        )}
                      </span>
                    </div>

                    <strong>
                      {formatMoney(
                        item.lineRevenue
                      )}
                    </strong>
                  </div>
                )
              )}
            </div>

            <div className="receipt-totals">
              <div>
                <span>Revenue</span>

                <strong>
                  {formatMoney(
                    selectedOrder.revenue
                  )}
                </strong>
              </div>

              <div className="receipt-profit">
                <span>Profit</span>

                <strong>
                  {formatMoney(
                    selectedOrder.profit
                  )}
                </strong>
              </div>
            </div>

            <p className="receipt-footer">
              Thank you for supporting my
              small business 💌
            </p>
          </section>
        </div>
      )}
    </main>
  );
}

export default OrderHistory;