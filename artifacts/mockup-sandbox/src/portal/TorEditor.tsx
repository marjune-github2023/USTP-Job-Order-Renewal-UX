export type TorSection = {
  title: string;
  weight: number;
  functions: { text: string; activities: string[] }[];
};
export const blankTor = (): TorSection[] => [
  {
    title: "Core Functions",
    weight: 90,
    functions: [{ text: "", activities: [""] }],
  },
  {
    title: "Mandatory Support Functions",
    weight: 10,
    functions: [{ text: "", activities: [""] }],
  },
];
function alpha(index: number): string {
  let result = "";
  do {
    result = String.fromCharCode(97 + (index % 26)) + result;
    index = Math.floor(index / 26) - 1;
  } while (index >= 0);
  return result;
}
export default function TorEditor({
  sections,
  onChange,
  disabled,
}: {
  sections: TorSection[];
  onChange: (value: TorSection[]) => void;
  disabled: boolean;
}) {
  const weight = sections.reduce((sum, s) => sum + s.weight, 0);
  function update(si: number, change: Partial<TorSection>) {
    onChange(sections.map((s, i) => (i === si ? { ...s, ...change } : s)));
  }
  const lines = sections.flatMap((s, si) => [
    `2.${si + 1} ${s.title || "Untitled section"} (${s.weight}%)`,
    ...s.functions.flatMap((f, fi) => [
      `2.${si + 1}.${fi + 1} ${f.text || "[Function]"}`,
      ...f.activities.map(
        (a, ai) => `2.${si + 1}.${fi + 1}.${alpha(ai)} ${a || "[Activity]"}`,
      ),
    ]),
  ]);
  return (
    <section className="p-tor">
      <div className="p-section-heading">
        <span>04</span>
        <div>
          <h2>Build your Terms of Reference</h2>
          <p>
            Add sections, functions and activities. These entries become clause
            2 of your contract.
          </p>
        </div>
      </div>
      <div className="p-tor-summary">
        <span>
          {sections.length} sections · {lines.length} numbered lines
        </span>
        <strong
          className={Math.abs(weight - 100) < 0.001 ? "" : "p-weight-warning"}
        >
          Total weight: {Number(weight.toFixed(2))}% / 100%
        </strong>
      </div>
      <div className="p-tor-layout">
        <div>
          {sections.map((section, si) => (
            <section className="p-tor-section" key={si}>
              <div className="p-tor-section-title">
                <strong>2.{si + 1}</strong>
                <label>
                  Section {si + 1} title
                  <input
                    disabled={disabled}
                    maxLength={160}
                    value={section.title}
                    onChange={(e) => update(si, { title: e.target.value })}
                  />
                </label>
                <label>
                  Weight (%)
                  <input
                    disabled={disabled}
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={section.weight}
                    onChange={(e) =>
                      update(si, { weight: Number(e.target.value) })
                    }
                  />
                </label>
                {!disabled && (
                  <button
                    type="button"
                    aria-label={`Remove section ${si + 1}`}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Remove section 2.${si + 1} and its entries?`,
                        )
                      )
                        onChange(sections.filter((_, i) => i !== si));
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
              {section.functions.map((fn, fi) => (
                <div className="p-tor-function" key={fi}>
                  <label>
                    Function 2.{si + 1}.{fi + 1}
                    <textarea
                      disabled={disabled}
                      maxLength={1000}
                      rows={2}
                      value={fn.text}
                      onChange={(e) =>
                        update(si, {
                          functions: section.functions.map((f, i) =>
                            i === fi ? { ...f, text: e.target.value } : f,
                          ),
                        })
                      }
                    />
                  </label>
                  {fn.activities.map((activity, ai) => (
                    <div className="p-tor-activity" key={ai}>
                      <label>
                        Activity 2.{si + 1}.{fi + 1}.{alpha(ai)}
                        <textarea
                          disabled={disabled}
                          maxLength={1000}
                          rows={2}
                          value={activity}
                          onChange={(e) =>
                            update(si, {
                              functions: section.functions.map((f, i) =>
                                i === fi
                                  ? {
                                      ...f,
                                      activities: f.activities.map((a, j) =>
                                        j === ai ? e.target.value : a,
                                      ),
                                    }
                                  : f,
                              ),
                            })
                          }
                        />
                      </label>
                      {!disabled && (
                        <button
                          type="button"
                          aria-label={`Remove activity 2.${si + 1}.${fi + 1}.${alpha(ai)}`}
                          onClick={() =>
                            update(si, {
                              functions: section.functions.map((f, i) =>
                                i === fi
                                  ? {
                                      ...f,
                                      activities: f.activities.filter(
                                        (_, j) => j !== ai,
                                      ),
                                    }
                                  : f,
                              ),
                            })
                          }
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  {!disabled && (
                    <div className="p-actions">
                      <button
                        type="button"
                        disabled={fn.activities.length >= 30}
                        onClick={() =>
                          update(si, {
                            functions: section.functions.map((f, i) =>
                              i === fi
                                ? { ...f, activities: [...f.activities, ""] }
                                : f,
                            ),
                          })
                        }
                      >
                        Add activity{" "}
                        <span className="sr-only">
                          to 2.{si + 1}.{fi + 1}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(
                              "Remove this function and its activities?",
                            )
                          )
                            update(si, {
                              functions: section.functions.filter(
                                (_, i) => i !== fi,
                              ),
                            });
                        }}
                      >
                        Remove function{" "}
                        <span className="sr-only">
                          2.{si + 1}.{fi + 1}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {!disabled && (
                <button
                  type="button"
                  disabled={section.functions.length >= 30}
                  onClick={() =>
                    update(si, {
                      functions: [
                        ...section.functions,
                        { text: "", activities: [""] },
                      ],
                    })
                  }
                >
                  Add function{" "}
                  <span className="sr-only">to section {si + 1}</span>
                </button>
              )}
            </section>
          ))}
          {!disabled && (
            <button
              type="button"
              disabled={sections.length >= 10}
              onClick={() =>
                onChange([
                  ...sections,
                  {
                    title: "",
                    weight: 0,
                    functions: [{ text: "", activities: [""] }],
                  },
                ])
              }
            >
              Add section
            </button>
          )}
        </div>
        <aside className="p-tor-preview">
          <h3>Numbered TOR output</h3>
          <p className="p-muted p-small">
            Collected in the same order as your contract.
          </p>
          <pre>{lines.join("\n\n")}</pre>
        </aside>
      </div>
    </section>
  );
}
