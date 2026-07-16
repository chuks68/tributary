import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  readClient,
  recipientLabel,
  fromStroops,
  SplitView,
  TOKENS,
  EXPLORER,
} from "../lib/tributary";
import { CopyButton } from "./CopyButton";

function Detail({ split }: { split: SplitView }) {
  const [balances, setBalances] = useState<{ code: string; amount: bigint }[]>([]);

  useEffect(() => {
    let active = true;
    Promise.all(
      TOKENS.map(async (t) => {
        const { result } = await readClient().balance({
          id: split.id,
          token: t.contract,
        });
        return { code: t.code, amount: result };
      }),
    ).then((all) => {
      if (active) setBalances(all.filter((b) => b.amount > 0n));
    });
    return () => {
      active = false;
    };
  }, [split.id]);

  return (
    <motion.div
      className="detail"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      style={{ overflow: "hidden" }}
    >
      {split.recipients.map((r, i) => (
        <div className="detail-row" key={i}>
          <span className="mono">
            {r.tag === "Account" ? r.values[0] : `split #${String(r.values[0])}`}
          </span>
          <span>{(split.shares[i] / 100).toFixed(2).replace(/\.?0+$/, "")}%</span>
        </div>
      ))}
      {split.controller && (
        <div className="detail-row">
          <span className="mono">controller: {split.controller}</span>
        </div>
      )}
      {balances.map((b) => (
        <div className="detail-row" key={b.code}>
          <span>escrow</span>
          <span>
            {fromStroops(b.amount)} {b.code}
          </span>
        </div>
      ))}
    </motion.div>
  );
}

export default function SplitList({
  splits,
  loading,
  mine,
}: {
  splits: SplitView[];
  loading: boolean;
  mine: Set<string>;
}) {
  const [open, setOpen] = useState<string | null>(null);

  if (loading) return <p className="note">Loading splits…</p>;
  if (splits.length === 0) {
    return (
      <div className="empty">
        <p>No splits on this contract yet.</p>
        <p className="note">
          Connect Freighter on testnet, open the Create tab and register the
          first one. Testnet XLM is free from friendbot, so it costs nothing to
          try.
        </p>
      </div>
    );
  }

  return (
    <section>
      <h2>Recent splits</h2>
      <div className="splits">
        {splits.map((s, index) => {
          const key = String(s.id);
          return (
            <motion.div
              className="split"
              key={key}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.3) }}
              whileHover={{ y: -2 }}
              onClick={() => setOpen(open === key ? null : key)}
            >
              <div className="split-head">
                <span className="split-id">#{key}</span>
                <CopyButton text={String(key)}>
                  Copy
                </CopyButton>
                <span>
                  {mine.has(key) && <span className="badge own">yours</span>}
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
                        onClick={(e) => e.stopPropagation()}
                      >
                        {recipientLabel(r)}
                      </a>
                      <CopyButton text={r.values[0]}>
                        Copy
                      </CopyButton>
                    ) : (
                      <span className="nested">{recipientLabel(r)}</span>
                    )}
                    <span>{(s.shares[i] / 100).toFixed(2).replace(/\.?0+$/, "")}%</span>
                  </li>
                ))}
              </ul>
              <AnimatePresence>
                {open === key && <Detail split={s} />}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
