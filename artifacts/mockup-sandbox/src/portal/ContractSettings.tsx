import { useEffect, useState } from "react";
const fields = [
  ["chancellor", "Chancellor name and academic credentials"],
  ["chancellor_id", "Chancellor ID number"],
  ["hrmo_director", "HRMO director"],
  ["finance_director", "Finance director"],
  ["contract_date", "Contract signing date"],
];
export default function ContractSettings({
  request,
  run,
  busy,
  notice,
}: {
  request: <T>(path: string, method?: string, body?: unknown) => Promise<T>;
  run: (action: () => Promise<void>) => Promise<void>;
  busy: boolean;
  notice: (s: string) => void;
}) {
  const [settings, setSettings] = useState<{
    details: Record<string, string>;
    revision: number;
  } | null>(null);
  const load = async () =>
    setSettings(await request("/admin/contract-settings"));
  useEffect(() => {
    void run(load);
  }, []);
  return (
    <section className="p-card p-section">
      <div className="p-title-row">
        <h1>Contract settings</h1>
        <button disabled={busy} onClick={() => void run(load)}>
          Refresh
        </button>
      </div>
      <p className="p-muted">
        Shared university details for contracts generated from the revised
        renewal form. Applicants enter their own personnel details and immediate
        supervisor.
      </p>
      <p className="p-muted">
        Enter only names and academic credentials, without designations or ID
        labels. Changes apply when a contract is next generated; downloaded
        documents and legacy applications keep their saved details.
      </p>
      {settings && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              setSettings(
                await request("/admin/contract-settings", "PUT", settings),
              );
              notice("Contract settings saved.");
            });
          }}
        >
          <fieldset disabled={busy}>
            <div className="p-form-grid">
              {fields.map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    required
                    type={key === "contract_date" ? "date" : "text"}
                    maxLength={key === "contract_date" ? 10 : 120}
                    value={settings.details[key] || ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        details: { ...settings.details, [key]: e.target.value },
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </fieldset>
          <button className="p-primary" disabled={busy}>
            Save contract settings
          </button>
        </form>
      )}
    </section>
  );
}
