import { useState } from "react";
export default function ResetPassword({
  token,
  onDone,
}: {
  token: string;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  return (
    <section className="p-card p-auth">
      <h1>{done ? "Password updated" : "Choose a new password"}</h1>
      {done ? (
        <>
          <p>Your password is saved. Sign in again to continue.</p>
          <button className="p-primary" onClick={onDone}>
            Back to sign in
          </button>
        </>
      ) : (
        <>
          <p>
            This link can be used once and expires 30 minutes after it was sent.
          </p>
          {error && (
            <p role="alert" className="p-alert p-error">
              {error}
            </p>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              if (data.get("password") !== data.get("confirm")) {
                setError("Passwords do not match.");
                return;
              }
              setBusy(true);
              setError("");
              try {
                const response = await fetch("/api/auth/reset-password", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "X-Requested-With": "USTP-Portal",
                  },
                  body: JSON.stringify({
                    token,
                    password: data.get("password"),
                  }),
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error);
                setDone(true);
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Unable to reset password.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              New password
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
                disabled={busy}
              />
            </label>
            <label>
              Confirm password
              <input
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
                disabled={busy}
              />
            </label>
            <p className="p-muted">Use 12–128 characters.</p>
            <button className="p-primary" disabled={busy}>
              {busy ? "Saving…" : "Save new password"}
            </button>
          </form>
        </>
      )}
    </section>
  );
}
