import { useEffect, useMemo, useState } from "react";

import {
  getExpenses,
  getOrders
} from "../db/database";

function parseDate(dateValue) {
  if (!dateValue) return null;

  const text = String(dateValue).trim();

  const dateMatch = text.match(
    /^(\d{4})-(\d{2})-(\d{2})/
  );

  if (dateMatch) {
    const year = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const day = Number(dateMatch[3]);

    return new Date(year, month - 1, day);
  }

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function getStartOfWeek(date) {
  const start = new Date(date);
  const day = start.getDay();
  const daysSinceMonday =
    day === 0 ? 6 : day - 1;

  start.setDate(
    start.getDate() - daysSinceMonday
  );

  start.setHours(0, 0, 0, 0);

  return start;
}

function getPeriodBounds(period, offset) {
  const now = new Date();

  if (period === "weekly") {
    const start = getStartOfWeek(now);

    start.setDate(
      start.getDate() + offset * 7
    );

    const end = new Date(start);

    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return {
      start,
      end: offset === 0 ? now : end
    };
  }

  if (period === "yearly") {
    const selectedYear =
      now.getFullYear() + offset;

    const start = new Date(
      selectedYear,
      0,
      1,
      0,
      0,
      0,
      0
    );

    const end = new Date(
      selectedYear,
      11,
      31,
      23,
      59,
      59,
      999
    );

    return {
      start,
      end: offset === 0 ? now : end
    };
  }

  const start = new Date(
    now.getFullYear(),
    now.getMonth() + offset,
    1,
    0,
    0,
    0,
    0
  );

  const end = new Date(
    now.getFullYear(),
    now.getMonth() + offset + 1,
    0,
    23,
    59,
    59,
    999
  );

  return {
    start,
    end: offset === 0 ? now : end
  };
}

function isWithinPeriod(dateValue, start, end) {
  const date = parseDate(dateValue);

  if (!date) return false;

  return date >= start && date <= end;
}

function getPeriodLabel(period, offset) {
  const { start, end } = getPeriodBounds(
    period,
    offset
  );

  if (period === "weekly") {
    const startText = start.toLocaleDateString(
      "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric"
      }
    );

    const endText = end.toLocaleDateString(
      "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric"
      }
    );

    return `${startText} – ${endText}`;
  }

  if (period === "yearly") {
    return String(start.getFullYear());
  }

  return start.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric"
  });
}

function Analytics() {
  const [period, setPeriod] =
    useState("monthly");

  const [periodOffset, setPeriodOffset] =
    useState(0);

  const [orders, setOrders] = useState([]);
  const [expenses, setExpenses] = useState([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const [
        savedOrders,
        savedExpenses
      ] = await Promise.all([
        getOrders(),
        getExpenses()
      ]);

      setOrders(savedOrders);
      setExpenses(savedExpenses);
    } catch (error) {
      console.error(
        "Could not load analytics:",
        error
      );

      setErrorMessage(
        error.message ||
          "Your analytics could not be loaded."
      );
    } finally {
      setIsLoading(false);
    }
  }

  function changePeriod(newPeriod) {
    setPeriod(newPeriod);
    setPeriodOffset(0);
  }

  function viewPreviousPeriod() {
    setPeriodOffset(
      (currentOffset) => currentOffset - 1
    );
  }

  function viewNextPeriod() {
    setPeriodOffset((currentOffset) =>
      Math.min(0, currentOffset + 1)
    );
  }

  const analytics = useMemo(() => {
    const { start, end } = getPeriodBounds(
      period,
      periodOffset
    );

    /*
     * Only use the actual Date ordered.
     * Do not use createdAt as a fallback.
     */
    const filteredOrders = orders.filter(
      (order) =>
        isWithinPeriod(
          order.orderDate,
          start,
          end
        )
    );

    const filteredExpenses = expenses.filter(
      (expense) =>
        isWithinPeriod(
          expense.date,
          start,
          end
        )
    );

    const revenue = filteredOrders.reduce(
      (total, order) =>
        total +
        (Number(order.revenue) || 0),
      0
    );

    /*
     * Use the manually entered profit saved
     * with each order.
     */
    const orderProfit = filteredOrders.reduce(
      (total, order) =>
        total +
        (Number(order.profit) || 0),
      0
    );

    const businessExpenses =
      filteredExpenses.reduce(
        (total, expense) =>
          total +
          (Number(expense.amount) || 0),
        0
      );

    const productsSold =
      filteredOrders.reduce(
        (orderTotal, order) => {
          const items = Array.isArray(
            order.items
          )
            ? order.items
            : [];

          const unitsInOrder = items.reduce(
            (itemTotal, item) =>
              itemTotal +
              (Number(item.quantity) || 0),
            0
          );

          return orderTotal + unitsInOrder;
        },
        0
      );

    const netProfit =
      orderProfit - businessExpenses;

    const averageOrderValue =
      filteredOrders.length > 0
        ? revenue / filteredOrders.length
        : 0;

    const averageProfitPerOrder =
      filteredOrders.length > 0
        ? orderProfit /
          filteredOrders.length
        : 0;

    const profitMargin =
      revenue > 0
        ? (netProfit / revenue) * 100
        : 0;

    return {
      revenue,
      orderProfit,
      businessExpenses,
      netProfit,
      totalOrders: filteredOrders.length,
      productsSold,
      averageOrderValue,
      averageProfitPerOrder,
      profitMargin
    };
  }, [
    orders,
    expenses,
    period,
    periodOffset
  ]);

  return (
    <main className="app analytics-page">
      <header className="page-header analytics-header">
        <h1>Analytics</h1>

        <p className="page-description">
          See how your business is performing.
        </p>
      </header>

      <section
        className="analytics-period-toggle"
        aria-label="Analytics time period"
      >
        <button
          type="button"
          className={
            period === "weekly"
              ? "active"
              : ""
          }
          onClick={() =>
            changePeriod("weekly")
          }
        >
          Weekly
        </button>

        <button
          type="button"
          className={
            period === "monthly"
              ? "active"
              : ""
          }
          onClick={() =>
            changePeriod("monthly")
          }
        >
          Monthly
        </button>

        <button
          type="button"
          className={
            period === "yearly"
              ? "active"
              : ""
          }
          onClick={() =>
            changePeriod("yearly")
          }
        >
          Yearly
        </button>
      </section>

      <section className="analytics-date-navigation">
        <button
          type="button"
          onClick={viewPreviousPeriod}
          aria-label={`View previous ${period} period`}
        >
          ←
        </button>

        <div>
          <span>
            {period === "weekly"
              ? "Selected week"
              : period === "monthly"
                ? "Selected month"
                : "Selected year"}
          </span>

          <strong>
            {getPeriodLabel(
              period,
              periodOffset
            )}
          </strong>
        </div>

        <button
          type="button"
          onClick={viewNextPeriod}
          disabled={periodOffset === 0}
          aria-label={`View next ${period} period`}
        >
          →
        </button>
      </section>

      {periodOffset < 0 && (
        <button
          type="button"
          className="return-current-period"
          onClick={() => setPeriodOffset(0)}
        >
          Return to current{" "}
          {period === "weekly"
            ? "week"
            : period === "monthly"
              ? "month"
              : "year"}
        </button>
      )}

      {isLoading ? (
        <section className="dashboard-empty">
          <span>🩰</span>
          <p>Loading analytics...</p>
        </section>
      ) : errorMessage ? (
        <section className="dashboard-empty">
          <span>💌</span>

          <p>{errorMessage}</p>

          <button
            type="button"
            className="analytics-retry-button"
            onClick={loadAnalytics}
          >
            Try Again
          </button>
        </section>
      ) : (
        <>
          <section className="analytics-summary-grid">
            <article className="summary-card">
              <span>💰 Revenue</span>

              <strong>
                ${analytics.revenue.toFixed(2)}
              </strong>

              <small>
                Total customer payments
              </small>
            </article>

            <article className="summary-card featured-summary">
              <span>🌷 Order Profit</span>

              <strong>
                $
                {analytics.orderProfit.toFixed(
                  2
                )}
              </strong>

              <small>
                Your manually recorded profit
              </small>
            </article>

            <article className="summary-card">
              <span>🤍 Net Profit</span>

              <strong>
                ${analytics.netProfit.toFixed(2)}
              </strong>

              <small>
                Order profit minus expenses
              </small>
            </article>

            <article className="summary-card">
              <span>💌 Business Expenses</span>

              <strong>
                $
                {analytics.businessExpenses.toFixed(
                  2
                )}
              </strong>

              <small>
                Supplies and other costs
              </small>
            </article>

            <article className="summary-card">
              <span>🛍️ Orders</span>

              <strong>
                {analytics.totalOrders}
              </strong>

              <small>
                Orders placed
              </small>
            </article>

            <article className="summary-card">
              <span>📦 Products Sold</span>

              <strong>
                {analytics.productsSold}
              </strong>

              <small>
                Total units sold
              </small>
            </article>

            <article className="summary-card">
              <span>🩰 Average Order</span>

              <strong>
                $
                {analytics.averageOrderValue.toFixed(
                  2
                )}
              </strong>

              <small>
                Revenue per order
              </small>
            </article>

            <article className="summary-card">
              <span>💎 Average Profit</span>

              <strong>
                $
                {analytics.averageProfitPerOrder.toFixed(
                  2
                )}
              </strong>

              <small>
                Profit per order
              </small>
            </article>

            <article className="summary-card">
              <span>📈 Profit Margin</span>

              <strong>
                {analytics.profitMargin.toFixed(
                  1
                )}
                %
              </strong>

              <small>
                Net profit divided by revenue
              </small>
            </article>
          </section>

          <section className="dashboard-panel money-breakdown">
            <div className="panel-heading">
              <div>
                <p className="section-eyebrow">
                  Money flow
                </p>

                <h2>Profit Breakdown</h2>
              </div>
            </div>

            <div className="money-breakdown-row">
              <span>Revenue</span>

              <strong>
                ${analytics.revenue.toFixed(2)}
              </strong>
            </div>

            <div className="money-breakdown-row subtotal">
              <span>
                Manually recorded order profit
              </span>

              <strong>
                $
                {analytics.orderProfit.toFixed(
                  2
                )}
              </strong>
            </div>

            <div className="money-breakdown-row deduction">
              <span>Business expenses</span>

              <strong>
                −$
                {analytics.businessExpenses.toFixed(
                  2
                )}
              </strong>
            </div>

            <div className="money-breakdown-row net-total">
              <span>Net profit</span>

              <strong>
                ${analytics.netProfit.toFixed(2)}
              </strong>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

export default Analytics;