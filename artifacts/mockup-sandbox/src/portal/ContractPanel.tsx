export type ContractDetails = Record<
  | "contract_date"
  | "daily_rate"
  | "duration"
  | "chancellor"
  | "chancellor_id"
  | "supervisor_position"
  | "supervisor"
  | "hrmo_director"
  | "finance_director",
  string
>;
export const emptyContract = (): ContractDetails => ({
  contract_date: "",
  daily_rate: "",
  duration: "",
  chancellor: "",
  chancellor_id: "",
  supervisor: "",
  supervisor_position: "",
  hrmo_director: "",
  finance_director: "",
});
export default function ContractPanel({
  id,
  status,
  version,
  contract,
  hrmo,
  busy,
  run,
  reload,
  request,
  notice,
}: {
  id: string;
  status: string;
  version: number;
  contract?: { generated_at: string } | null;
  hrmo: boolean;
  busy: boolean;
  run: (action: () => Promise<void>) => Promise<void>;
  reload: () => Promise<void>;
  request: (path: string, method: string, body: unknown) => Promise<unknown>;
  notice: (message: string) => void;
}) {
  return (
    <section className="p-card p-section">
      <h2>Job Order contract</h2>
      <p className="p-muted p-small">
        Uses the uploaded USTP contract format, including your numbered TOR and
        the acknowledgment page. Signatures are completed after download.
      </p>
      {status === "approved" && hrmo && (
        <button
          className="p-primary p-wide"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await request(`/applications/${id}/contract`, "POST", {
                version,
              });
              await reload();
              notice("Contract PDF generated. It is ready to download.");
            })
          }
        >
          {busy
            ? "Please wait…"
            : contract
              ? "Regenerate contract PDF"
              : "Generate contract PDF"}
        </button>
      )}
      {contract ? (
        <div className="p-contract-download">
          <a href={`/api/applications/${id}/contract`}>Download contract PDF</a>
          <p className="p-muted p-small">
            Generated {new Date(contract.generated_at).toLocaleString()}
          </p>
        </div>
      ) : (
        <p className="p-muted p-small">
          {status === "approved"
            ? "HRMO can generate the contract from the approved application details."
            : "The contract becomes available after HRMO approval and generation."}
        </p>
      )}
    </section>
  );
}
