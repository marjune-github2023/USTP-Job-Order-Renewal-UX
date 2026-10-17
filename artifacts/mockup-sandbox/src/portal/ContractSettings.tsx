import { useEffect, useState } from "react";

const signatoryFields = [
  ["chancellor", "Chancellor name and academic credentials"],
  ["chancellor_id", "Chancellor ID number"],
  ["hrmo_director", "HRMO director"],
  ["finance_director", "Finance director"],
  ["contract_date", "Contract signing date"],
];

const contractFields = [
  ["contract_title", "Contract title"],
  ["university_name", "University name"],
  ["university_address", "University address"],
  ["university_ra", "Republic Act number"],
  ["whereas_1", "WHEREAS clause 1"],
  ["whereas_2", "WHEREAS clause 2"],
  ["whereas_3", "WHEREAS clause 3"],
  ["clause_4", "Clause 4"],
  ["clause_5", "Clause 5"],
  ["clause_6", "Clause 6"],
  ["clause_7", "Clause 7"],
  ["clause_8", "Clause 8"],
  ["clause_9", "Clause 9"],
  ["clause_10", "Clause 10"],
  ["clause_11", "Clause 11"],
  ["witness_whereof", "Witness WHEREOF text"],
  ["signing_location", "Signing location"],
  ["acknowledgment_text", "Acknowledgment text"],
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
  const [settings, setSettings] = useState<any>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoKey, setLogoKey] = useState(0);

  const load = async () => setSettings(await request("/admin/contract-settings"));
  useEffect(() => {
    void run(load);
  }, []);

  async function uploadLogo() {
    if (!logoFile) return;
    if (logoFile.size > 2 * 1024 * 1024)
      throw new Error("Logo must be under 2 MB.");
    const response = await fetch(`/api/admin/contract-settings/logo`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Requested-With": "USTP-Portal",
        "X-File-Name": encodeURIComponent(logoFile.name),
      },
      body: logoFile,
    });
    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || "Upload failed.");
    }
    await load();
    setLogoFile(null);
    setLogoKey((k) => k + 1);
    notice("Logo uploaded.");
  }

  async function removeLogo() {
    await request("/admin/contract-settings/logo", "DELETE", { revision: settings.revision });
    await load();
    notice("Logo removed.");
  }

  return (
    <section className="p-card p-section">
      <div className="p-title-row">
        <h1>Contract settings</h1>
        <button disabled={busy} onClick={() => void run(load)}>
          Refresh
        </button>
      </div>
      <p className="p-muted">
        Customize contract content, wordings, and header. Changes apply when a
        contract is next generated; downloaded documents keep their saved
        details.
      </p>
      {settings && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              setSettings(await request("/admin/contract-settings", "PUT", settings));
              notice("Contract settings saved.");
            });
          }}
        >
          <fieldset disabled={busy}>
            <h3>Signatory Information</h3>
            <div className="p-form-grid">
              {signatoryFields.map(([key, label]) => (
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

            <h3>Contract Header</h3>
            <div className="p-form-grid">
              {contractFields.slice(0, 4).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={settings[key] || ""}
                    onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                  />
                </label>
              ))}
            </div>

            <h3>Header Logo</h3>
            {settings.header_logo ? (
              <div className="p-upload">
                <img
                  src={`data:image/png;base64,${typeof settings.header_logo === 'string' ? settings.header_logo : ''}`}
                  alt="Current logo"
                  style={{ maxWidth: "200px", maxHeight: "100px" }}
                />
                <p>{settings.header_logo_name}</p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(removeLogo)}
                >
                  Remove logo
                </button>
              </div>
            ) : (
              <div className="p-upload">
                <label>
                  Upload logo (PNG/JPEG, max 2MB)
                  <input
                    key={logoKey}
                    type="file"
                    accept=".png,.jpg,.jpeg"
                    onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                  />
                </label>
                <button
                  type="button"
                  disabled={busy || !logoFile}
                  onClick={() => void run(uploadLogo)}
                >
                  Upload logo
                </button>
              </div>
            )}

            <h3>WHEREAS Clauses</h3>
            <div className="p-form-grid">
              {contractFields.slice(4, 7).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <textarea
                    rows={3}
                    maxLength={1000}
                    value={settings[key] || ""}
                    onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                  />
                </label>
              ))}
            </div>

            <h3>Legal Clauses</h3>
            <div className="p-form-grid">
              {contractFields.slice(7, 18).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <textarea
                    rows={4}
                    maxLength={2000}
                    value={settings[key] || ""}
                    onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                  />
                </label>
              ))}
            </div>

            <h3>Footer/Acknowledgment</h3>
            <div className="p-form-grid">
              {contractFields.slice(18).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={settings[key] || ""}
                    onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
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
