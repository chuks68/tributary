import { recipientLabel, SplitView, EXPLORER } from "../lib/tributary";

export default function SplitList({
  splits,
  loading,
  mine,
}: {
  splits: SplitView[];
  loading: boolean;
  mine: Set<string>;
}) {
  if (loading) return <p className="note">Loading splits…</p>;
  if (splits.length === 0) return <p className="note">No splits yet.</p>;

  return (
    <section>
      <h2>Recent splits</h2>
      <div className="splits">
        {splits.map((s) => (
          <div className="split" key={String(s.id)}>
            <div className="split-head">
              <span className="split-id">#{String(s.id)}</span>
              <span>
                {mine.has(String(s.id)) && <span className="badge own">yours</span>}{" "}
                <span className="badge">
                  {s.controller ? "mutable" : "locked"}
                </span>
              </span>
            </div>
            <ul>
              {s.recipients.map((r, i) => (
                <li key={i}>
                  {r.tag === "Account" ? (
                    <a
                      href={`${EXPLORER}/account/${r.values[0]}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {recipientLabel(r)}
                    </a>
                  ) : (
                    <span className="nested">{recipientLabel(r)}</span>
                  )}
                  <span>{(s.shares[i] / 100).toFixed(2).replace(/\.?0+$/, "")}%</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
