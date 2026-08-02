import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  addExpense,
  deleteExpense,
  getExpenses
} from "../db/database";

function Expenses() {
  const [expenses, setExpenses] = useState([]);

  const [date, setDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const [vendor, setVendor] = useState("");
  const [category, setCategory] = useState("Supplies");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    loadExpenses();
  }, []);

  async function loadExpenses() {
    try {
      const savedExpenses = await getExpenses();

      savedExpenses.sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      );

      setExpenses(savedExpenses);
    } catch (error) {
      console.error("Could not load expenses:", error);
    }
  }

  async function saveExpense() {
    if (!description.trim()) {
      alert("Enter a description.");
      return;
    }

    if (amount === "" || Number(amount) <= 0) {
      alert("Enter a valid amount.");
      return;
    }

    try {
      await addExpense({
        date,
        vendor,
        category,
        description,
        amount: Number(amount)
      });

      setDate(new Date().toISOString().slice(0, 10));
      setVendor("");
      setCategory("Supplies");
      setDescription("");
      setAmount("");

      await loadExpenses();
    } catch (error) {
      console.error("Could not save expense:", error);
      alert("The expense could not be saved.");
    }
  }

  async function removeExpense(expenseId) {
    const confirmed = window.confirm(
      "Delete this expense?"
    );

    if (!confirmed) return;

    try {
      await deleteExpense(expenseId);
      await loadExpenses();
    } catch (error) {
      console.error("Could not delete expense:", error);
      alert("The expense could not be deleted.");
    }
  }

  const totalExpenses = expenses.reduce(
    (total, expense) =>
      total + (Number(expense.amount) || 0),
    0
  );

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

      <section className="expense-total-card">
        <span>🤍 Total Expenses</span>

        <strong>
          ${totalExpenses.toFixed(2)}
        </strong>
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
            min="0"
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
        >
          💌 Save Expense
        </button>
      </section>

      <section className="expense-history">
        <h2>🐚 Expense History</h2>

        {expenses.length === 0 ? (
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

                  <small>{expense.date}</small>
                </div>

                <div className="expense-card-right">
                  <strong>
                    ${Number(expense.amount).toFixed(2)}
                  </strong>

                  <button
                    type="button"
                    onClick={() =>
                      removeExpense(expense.id)
                    }
                  >
                    Delete
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