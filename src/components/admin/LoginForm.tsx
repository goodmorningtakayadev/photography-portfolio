"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const body = await res.json();

      if (body.error) {
        setError(body.error);
        setPassword("");
      } else {
        router.push("/admin/dashboard");
      }
    } catch {
      setError("Unable to connect. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "calc(100vh - var(--header-h) - 200px)",
        padding: "var(--s-page)",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: "360px",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
        }}
      >
        {/* Heading */}
        <div style={{ textAlign: "center", marginBottom: "0.5rem" }}>
          <h1
            style={{
              fontFamily: "var(--f-display)",
              fontSize: "0.75rem",
              fontWeight: 500,
              letterSpacing: "0.35em",
              textTransform: "uppercase",
              color: "var(--white-ghost)",
              marginBottom: "0.5rem",
            }}
          >
            Admin
          </h1>
          <div
            style={{
              width: "24px",
              height: "1px",
              background: "var(--ember)",
              margin: "0 auto",
              opacity: 0.6,
            }}
          />
        </div>

        {/* Password field */}
        <div>
          <label
            htmlFor="password"
            style={{
              display: "block",
              fontFamily: "var(--f-mono)",
              fontSize: "0.625rem",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "var(--white-ghost)",
              marginBottom: "0.5rem",
            }}
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            autoComplete="current-password"
            required
            disabled={loading}
            style={{
              width: "100%",
              padding: "0.75rem 1rem",
              fontFamily: "var(--f-mono)",
              fontSize: "0.875rem",
              letterSpacing: "0.08em",
              color: "var(--white)",
              background: "var(--black-surface)",
              border: "1px solid var(--border)",
              borderRadius: "2px",
              outline: "none",
              transition: "border-color var(--t-fast) var(--ease-out)",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--ember)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
            }}
          />
        </div>

        {/* Error message */}
        {error && (
          <p
            role="alert"
            style={{
              fontFamily: "var(--f-mono)",
              fontSize: "0.6875rem",
              letterSpacing: "0.05em",
              color: "#e85d5d",
              textAlign: "center",
              margin: "-0.5rem 0",
            }}
          >
            {error}
          </p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !password}
          style={{
            padding: "0.75rem 1rem",
            fontFamily: "var(--f-mono)",
            fontSize: "0.6875rem",
            fontWeight: 500,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: loading ? "var(--white-ghost)" : "var(--black)",
            background: loading ? "var(--black-elevated)" : "var(--ember)",
            border: "none",
            borderRadius: "2px",
            cursor: loading ? "wait" : "pointer",
            transition: `all var(--t-fast) var(--ease-out)`,
            opacity: !password && !loading ? 0.4 : 1,
          }}
        >
          {loading ? "..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
