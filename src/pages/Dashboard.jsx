import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  getDashboardTotals,
  getOrders
} from "../db/database";

function Dashboard() {
  const [totals, setTotals] = useState({
    totalOrders: 0,
    totalProducts: 0,
    revenue: 0,
    expenses: 0,
    profit: 0
  });

  const [orders, setOrders] = useState([]);

  const monthlyGoal = 5000;

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const [savedTotals, savedOrders] =
        await Promise.all([
          getDashboardTotals(),
          getOrders()
        ]);

      const newestOrders = [...savedOrders].sort(
        (a, b) =>
          getOrderTimestamp(b) -
          getOrderTimestamp(a)
      );

      setTotals(savedTotals);
      setOrders(newestOrders);
    } catch (error) {
      console.error(
        "Could not load dashboard:",
        error
      );
    }
  }

  function getOrderTimestamp(order) {
    const value =
      order.orderDate ||
      order.createdAt ||
      order.created_at;

    if (!value) return 0;

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? 0
      : date.getTime();
  }

  function isDateInCurrentMonth(dateValue) {
    if (!dateValue) return false;

    const dateText = String(dateValue)
      .slice(0, 10);

    const match = dateText.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

    if (!match) return false;

    const orderYear = Number(match[1]);
    const orderMonth = Number(match[2]);

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth =
      today.getMonth() + 1;

    return (
      orderYear === currentYear &&
      orderMonth === currentMonth
    );
  }

  const monthlyOrders = useMemo(() => {
    return orders.filter((order) =>
      isDateInCurrentMonth(order.orderDate)
    );
  }, [orders]);

  const monthlyProfit = useMemo(() => {
    return monthlyOrders.reduce(
      (total, order) =>
        total +
        (Number(order.profit) || 0),
      0
    );
  }, [monthlyOrders]);

  const goalPercentage = Math.min(
    100,
    monthlyGoal > 0
      ? (monthlyProfit / monthlyGoal) * 100
      : 0
  );

  const platformTotals = useMemo(() => {
    const totalsByPlatform = {
      Etsy: 0,
      Depop: 0,
      Mercari: 0
    };

    orders.forEach((order) => {
      const platform =
        order.platform || "Other";

      if (!(platform in totalsByPlatform)) {
        totalsByPlatform[platform] = 0;
      }

      totalsByPlatform[platform] +=
        Number(order.revenue) || 0;
    });

    return totalsByPlatform;
  }, [orders]);

  const topProducts = useMemo(() => {
    const productSales = {};

    orders.forEach((order) => {
      const items = Array.isArray(order.items)
        ? order.items
        : [];

      const totalQuantity = items.reduce(
        (sum, item) =>
          sum +
          (Number(item.quantity) || 0),
        0
      );

      items.forEach((item) => {
        const productId =
          item.productId ||
          item.productName;

        if (!productId) return;

        const itemQuantity =
          Number(item.quantity) || 0;

        const itemProfit =
          totalQuantity > 0
            ? (Number(order.profit) || 0) *
              (itemQuantity / totalQuantity)
            : 0;

        if (!productSales[productId]) {
          productSales[productId] = {
            id: productId,
            name:
              item.productName ||
              "Unnamed product",
            image:
              item.productImage || null,
            quantity: 0,
            profit: 0
          };
        }

        productSales[productId].quantity +=
          itemQuantity;

        productSales[productId].profit +=
          itemProfit;

        if (
          !productSales[productId].image &&
          item.productImage
        ) {
          productSales[productId].image =
            item.productImage;
        }
      });
    });

    return Object.values(productSales)
      .sort(
        (a, b) =>
          b.quantity - a.quantity ||
          b.profit - a.profit
      )
      .slice(0, 3);
  }, [orders]);

  return (
    <main className="app dashboard-page">
      <header className="dashboard-hero">
        <div>
          <p className="brand">
            🌷 Made with Love, Maria 💌
          </p>

          <h1>Dashboard</h1>

          <p className="welcome">
            Welcome back, Maria! 🧚
          </p>
        </div>
      </header>

      <section className="dashboard-panel goal-panel">
        <div className="panel-heading">
          <div>
            <p className="section-eyebrow">
              🐚 Monthly profit goal
            </p>

            <h2>
              ${monthlyProfit.toFixed(2)} of $
              {monthlyGoal.toLocaleString()}
            </h2>
          </div>

          <strong className="goal-percent">
            {goalPercentage.toFixed(0)}%
          </strong>
        </div>

        <div className="goal-track">
          <div
            className="goal-fill"
            style={{
              width: `${goalPercentage}%`
            }}
          />
        </div>

        <p className="goal-message">
          {goalPercentage >= 100
            ? "You reached your monthly profit goal! 🤍"
            : `$${Math.max(
                0,
                monthlyGoal - monthlyProfit
              ).toFixed(
                2
              )} left to reach your monthly profit goal.`}
        </p>
      </section>

      <section className="summary-grid">
        <article className="summary-card featured-summary">
          <span>💌 Revenue</span>

          <strong>
            ${Number(
              totals.revenue
            ).toFixed(2)}
          </strong>

          <small>
            From {totals.totalOrders} orders
          </small>
        </article>

        <article className="summary-card">
          <span>🤍 Profit</span>

          <strong>
            ${Number(
              totals.profit
            ).toFixed(2)}
          </strong>

          <small>
            After business expenses
          </small>
        </article>

        <article className="summary-card">
          <span>🌷 Orders</span>

          <strong>
            {totals.totalOrders}
          </strong>

          <small>
            All selling platforms
          </small>
        </article>

        <article className="summary-card">
          <span>🩰 Products</span>

          <strong>
            {totals.totalProducts}
          </strong>

          <small>
            Active catalog products
          </small>
        </article>
      </section>

      <section className="dashboard-columns">
        <article className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <p className="section-eyebrow">
                💌 Latest activity
              </p>

              <h2>Recent Orders</h2>
            </div>

            <Link
              className="panel-link"
              to="/new-order"
            >
              Add order
            </Link>
          </div>

          {orders.length === 0 ? (
            <div className="dashboard-empty">
              <span>💌</span>

              <p>
                Your next happy customer is waiting.
              </p>
            </div>
          ) : (
            <div className="recent-order-list">
              {orders
                .slice(0, 4)
                .map((order) => {
                  const firstItem =
                    order.items?.[0];

                  return (
                    <div
                      className="recent-order-row"
                      key={order.id}
                    >
                      <div className="order-avatar">
                        {firstItem?.productImage ? (
                          <img
                            src={
                              firstItem.productImage
                            }
                            alt={
                              firstItem.productName ||
                              "Order product"
                            }
                          />
                        ) : (
                          <span>🌷</span>
                        )}
                      </div>

                      <div className="recent-order-info">
                        <strong>
                          {order.customer ||
                            `Order #${
                              order.orderNumber ||
                              "—"
                            }`}
                        </strong>

                        <span>
                          {order.platform} ·{" "}
                          {order.items?.length ||
                            0}{" "}
                          product
                          {order.items?.length ===
                          1
                            ? ""
                            : "s"}
                        </span>
                      </div>

                      <div className="recent-order-money">
                        <strong>
                          $
                          {Number(
                            order.revenue
                          ).toFixed(2)}
                        </strong>

                        <span>
                          $
                          {Number(
                            order.profit
                          ).toFixed(2)}{" "}
                          profit
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </article>

        <article className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <p className="section-eyebrow">
                🩰 Product performance
              </p>

              <h2>Top Products</h2>
            </div>

            <Link
              className="panel-link"
              to="/products"
            >
              View catalog
            </Link>
          </div>

          {topProducts.length === 0 ? (
            <div className="dashboard-empty">
              <span>🩰</span>

              <p>
                Product sales will appear here after
                you save orders.
              </p>
            </div>
          ) : (
            <div className="top-product-list">
              {topProducts.map(
                (product, index) => (
                  <div
                    className="top-product-row"
                    key={product.id}
                  >
                    <div className="product-rank">
                      {index + 1}
                    </div>

                    <div className="top-product-image">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={`${product.name} mockup`}
                        />
                      ) : (
                        <span>🌷</span>
                      )}
                    </div>

                    <div className="top-product-info">
                      <strong>
                        {product.name}
                      </strong>

                      <span>
                        {product.quantity} sold
                      </span>
                    </div>

                    <strong className="top-product-revenue">
                      $
                      {product.profit.toFixed(
                        2
                      )}

                      <small> profit</small>
                    </strong>
                  </div>
                )
              )}
            </div>
          )}
        </article>
      </section>

      <section className="dashboard-panel">
        <div className="panel-heading">
          <div>
            <p className="section-eyebrow">
              🧚 Sales channels
            </p>

            <h2>Revenue by Platform</h2>
          </div>

          <Link
            className="panel-link"
            to="/analytics"
          >
            Analytics
          </Link>
        </div>

        <div className="platform-grid">
          {Object.entries(
            platformTotals
          ).map(([platform, revenue]) => (
            <div
              className="platform-card"
              key={platform}
            >
              <span>{platform}</span>

              <strong>
                $
                {Number(
                  revenue
                ).toFixed(2)}
              </strong>
            </div>
          ))}
        </div>
      </section>

      <p className="dashboard-footer">
        🌷 Made with love for your small
        business 🤍
      </p>
    </main>
  );
}

export default Dashboard;