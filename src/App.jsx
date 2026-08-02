import { useEffect, useState } from "react";
import {
  NavLink,
  Navigate,
  Route,
  Routes
} from "react-router-dom";

import { supabase } from "./lib/supabase";

import Dashboard from "./pages/Dashboard";
import NewOrder from "./pages/NewOrder";
import ProductCatalog from "./pages/ProductCatalog";
import Expenses from "./pages/Expenses";
import Analytics from "./pages/Analytics";
import OrderHistory from "./pages/OrderHistory";
import Login from "./pages/Login";

import "./App.css";

function ProtectedRoute({ session, children }) {
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function App() {
  const [session, setSession] = useState(null);
  const [isLoadingSession, setIsLoadingSession] =
    useState(true);

  useEffect(() => {
    async function loadSession() {
      const {
        data: { session: savedSession }
      } = await supabase.auth.getSession();

      setSession(savedSession);
      setIsLoadingSession(false);
    }

    loadSession();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(
      (_event, updatedSession) => {
        setSession(updatedSession);
        setIsLoadingSession(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (isLoadingSession) {
    return (
      <main className="login-page">
        <section className="login-card">
          <p className="brand">
            🌷 Made with Love, Maria 💌
          </p>

          <p>Loading your business data...</p>
        </section>
      </main>
    );
  }

  return (
    <>
      <Routes>
        <Route
  path="/orders"
  element={
    <ProtectedRoute session={session}>
      <OrderHistory />
    </ProtectedRoute>
  }
/>
        <Route
          path="/login"
          element={<Login session={session} />}
        />

        <Route
          path="/"
          element={
            <ProtectedRoute session={session}>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/new-order"
          element={
            <ProtectedRoute session={session}>
              <NewOrder />
            </ProtectedRoute>
          }
        />

        <Route
          path="/products"
          element={
            <ProtectedRoute session={session}>
              <ProductCatalog />
            </ProtectedRoute>
          }
        />

        <Route
          path="/expenses"
          element={
            <ProtectedRoute session={session}>
              <Expenses />
            </ProtectedRoute>
          }
        />

        <Route
          path="/analytics"
          element={
            <ProtectedRoute session={session}>
              <Analytics />
            </ProtectedRoute>
          }
        />

        <Route
          path="*"
          element={
            <Navigate
              to={session ? "/" : "/login"}
              replace
            />
          }
        />
      </Routes>

      {session && (
      <nav className="dashboard-shortcuts">
  <NavLink to="/" end>
    🏠
    <span>Home</span>
  </NavLink>

  <NavLink to="/new-order">
    🌷
    <span>New Order</span>
  </NavLink>

  <NavLink to="/orders">
    📦
    <span>Orders</span>
  </NavLink>

  <NavLink to="/products">
    🩰
    <span>Products</span>
  </NavLink>

  <NavLink to="/expenses">
    💌
    <span>Expenses</span>
  </NavLink>

  <NavLink to="/analytics">
    🧚
    <span>Analytics</span>
  </NavLink>
</nav>
      )}
    </>
  );
}

export default App;