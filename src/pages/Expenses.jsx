import { useEffect, useMemo, useState } from "react";

import {
  addExpense,
  deleteExpense,
  getExpenses
} from "../db/database";

function getToday() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const year = parts.find(
    (part) => part.type === "year"
  )?.value;

  const month = parts.find(
    (part) => part.type === "month"
  )?.value;

  const day = parts.find(
    (part) => part.type === "day"
  )?.value;

  return `${year}-${month}-${day}`;
}

function formatExpenseDate(dateValue) {
  if (!dateValue) return "";

  const [year, month, day] = dateValue.split("-");

  if (!year || !month || !day) {
    return dateValue;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(
    new Date(
      Number(year),
      Number(month) - 1,
      Number(day)
    )
  );
}

function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [date, setDate] = useState(getToday);
  const [vendor, setVendor] = useState("");
  const [category, setCategory] =
    useState("Supplies");
  const [description, setDescription] =
    useState("");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadInitialExpenses() {
      try {
        setLoading(true);

        const savedExpenses = await getExpenses();

        if (!isMounted) return;

        const sortedExpenses = [
          ...(savedExpenses || [])
        ].sort((a, b) =>
          String(b.date || "").localeCompare(
            String(a.date || "")
          )
        );

        setExpenses(sortedExpenses);
      } catch (error) {
        console.error(
          "Could not load expenses:",
          error
        );

        if (isMounted) {
          alert("The expenses could not be loaded.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadInitialExpenses();

    return () => {
      isMounted = false;
    };
  }, []);

  async function loadExpenses() {
    try {
      const savedExpenses = await getExpenses();

      const sortedExpenses = [
        ...(savedExpenses || [])
      ].sort((a, b) =>
        String(b.date || "").localeCompare(
          String(a.date || "")
        )
      );

      setExpenses(sortedExpenses);
    } catch (error) {
      console.error(
        "Could not reload expenses:",
        error
      );

      throw error;
    }
  }

  const expenseTotals = useMemo(() => {
    const currentMonth = getToday().slice(0, 7);

    return expenses.reduce(
      (totals, expense) => {
        const expenseAmount =
          Number(expense.amount) || 0;

        totals.allTime += expenseAmount;

        if (
          String(expense.date || "").slice(0, 7) ===
          currentMonth
        ) {
          totals.thisMonth += expenseAmount;
        }

        return totals;
      },
      {
        thisMonth: 0,
        allTime: 0
      }
    );
  }, [expenses]);

  const currentMonthLabel = useMemo(() => {
    const [year, month] = getToday().split("-");

    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric"
    }).format(
      new Date(
        Number(year),
        Number(month) - 1,
        1
      )
    );
  }, []);

  async function saveExpense() {
    if (saving) return;

    if (!date) {
      alert("Choose an expense date.");
      return;
    }

    if (!description.trim()) {
      alert("Enter a description.");
      return;
    }

    if (
      amount === "" ||
      !Number.isFinite(Number(amount)) ||
      Number(amount) <= 0
    ) {
      alert("Enter a valid amount.");
      return;
    }

    try {
      setSaving(true);

      await addExpense({
        date,
        vendor: vendor.trim(),
        category,
        description: description.trim(),
        amount: Number(amount)
      });

      setDate(getToday());
      setVendor("");
      setCategory("Supplies");
      setDescription("");
      setAmount("");

      await loadExpenses();
    } catch (error) {
      console.error(
        "Could not save expense:",
        error
      );

      alert(
        `The expense could not be saved.\n\n${
          error.message || "Unknown error"
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeExpense(expenseId) {
    if (deletingId) return;

    const confirmed = window.confirm(
      "Delete this expense?"
    );

    if (!confirmed) return;

    try {
      setDeletingId(expenseId);

      await deleteExpense(expenseId);
      await loadExpenses();
    } catch (error) {
      console.error(
        "Could not delete expense:",
        error
      );

      alert(
        `The expense could not be deleted.\n\n${
          error.message || "Unknown error"
        }`
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="app expenses-page">
      <header className="page-header">
        <div>
          <h1>Expenses</h1>

          <p className="page-description">
            Track every business expense.
          </p>
        </div>
      </header>

      <section className="expense-totals-grid">
        <article className="expense-total-card">
          <span>🌷 This Month</span>

          <strong>
            ${expenseTotals.thisMonth.toFixed(2)}
          </strong>

          <small>{currentMonthLabel}</small>
        </article>

        <article className="expense-total-card">
          <span>🤍 All-Time Expenses</span>

          <strong>
            ${expenseTotals.allTime.toFixed(2)}
          </strong>

          <small>
            {expenses.length}{" "}
            {expenses.length === 1
              ? "expense"
              : "expenses"}
          </small>
        </article>
      </section>

      <section className="expense-form">
        <h2>🌷 Add Expense</h2>

        <label className="field-label">
          Date

          <input
            type="date"
            value={date}
            onChange={(event) =>
              setDate(event.target.value)
            }
          />
        </label>

        <label className="field-label">
          Category

          <select
            value={category}
            onChange={(event) =>
              setCategory(event.target.value)
            }
          >
            <option value="Supplies">
              Supplies
            </option>

            <option value="Platform Fees">
              Platform Fees
            </option>

            <option value="Packaging">
              Packaging
            </option>

            <option value="Postage">
              Postage
            </option>

            <option value="Printer Ink">
              Printer Ink
            </option>

            <option value="Advertising">
              Advertising
            </option>

            <option value="Equipment">
              Equipment
            </option>

            <option value="Software">
              Software
            </option>

            <option value="Other">
              Other
            </option>
          </select>
        </label>

        <label className="field-label">
          Vendor

          <input
            type="text"
            value={vendor}
            onChange={(event) =>
              setVendor(event.target.value)
            }
            placeholder="Amazon, Michaels, Etsy..."
          />
        </label>

        <label className="field-label">
          Description

          <input
            type="text"
            value={description}
            onChange={(event) =>
              setDescription(event.target.value)
            }
            placeholder="Sticker paper, laminate..."
          />
        </label>

        <label className="field-label">
          Amount

          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(event) =>
              setAmount(event.target.value)
            }
            placeholder="0.00"
          />
        </label>

        <button
          type="button"
          className="save-button"
          onClick={saveExpense}
          disabled={saving || loading}
        >
          {saving
            ? "Saving..."
            : "💌 Save Expense"}
        </button>
      </section>

      <section className="expense-history">
        <h2>🐚 Expense History</h2>

        {loading ? (
          <div className="dashboard-empty">
            <p>Loading expenses...</p>
          </div>
        ) : expenses.length === 0 ? (
          <div className="dashboard-empty">
            <span>🐚</span>

            <p>No expenses have been added yet.</p>
          </div>
        ) : (
          <div className="expense-list">
            {expenses.map((expense) => (
              <article
                className="expense-card"
                key={expense.id}
              >
                <div>
                  <strong>
                    {expense.description}
                  </strong>

                  <p>
                    {expense.category}

                    {expense.vendor
                      ? ` · ${expense.vendor}`
                      : ""}
                  </p>

                  <small>
                    {formatExpenseDate(
                      expense.date
                    )}
                  </small>
                </div>

                <div className="expense-card-right">
                  <strong>
                    $
                    {Number(
                      expense.amount || 0
                    ).toFixed(2)}
                  </strong>

                  <button
                    type="button"
                    onClick={() =>
                      removeExpense(expense.id)
                    }
                    disabled={
                      deletingId === expense.id
                    }
                  >
                    {deletingId === expense.id
                      ? "Deleting..."
                      : "Delete"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default Expenses;