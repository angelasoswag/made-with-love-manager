import { useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

function Login({ session }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  if (session) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!email.trim() || !password) {
      setMessage("Enter your email and password.");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password
        });

        if (error) {
          throw error;
        }

        setMessage(
          "Account created. Check your email if Supabase asks you to confirm it."
        );
      } else {
        const { error } =
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password
          });

        if (error) {
          throw error;
        }
      }
    } catch (error) {
      setMessage(
        error.message || "Something went wrong."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <p className="brand">
          🌷 Made with Love, Maria 💌
        </p>

        <h1>
          {mode === "login"
            ? "Welcome Back"
            : "Create Your Account"}
        </h1>

        <p className="login-subtitle">
          Sign in to access your products, orders,
          expenses, and business data on any device.
        </p>

        <form onSubmit={handleSubmit}>
          <label className="field-label">
            Email

            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>

          <label className="field-label">
            Password

            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="At least 6 characters"
              autoComplete={
                mode === "login"
                  ? "current-password"
                  : "new-password"
              }
            />
          </label>

          {message && (
            <p className="login-message">
              {message}
            </p>
          )}

          <button
            type="submit"
            className="save-button"
            disabled={isLoading}
          >
            {isLoading
              ? "Please wait..."
              : mode === "login"
                ? "Sign In"
                : "Create Account"}
          </button>
        </form>

        <button
          type="button"
          className="login-switch-button"
          onClick={() => {
            setMode((currentMode) =>
              currentMode === "login"
                ? "signup"
                : "login"
            );

            setMessage("");
          }}
        >
          {mode === "login"
            ? "Need an account? Sign up"
            : "Already have an account? Sign in"}
        </button>
      </section>
    </main>
  );
}

export default Login;