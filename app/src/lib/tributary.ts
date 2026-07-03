import { Client, networks, Recipient, rpc, scValToNative } from "tributary-sdk";
import {
  requestAccess,
  signTransaction,
  isConnected,
  getNetworkDetails,
} from "@stellar/freighter-api";

export type { Recipient };

export const RPC_URL = "https://soroban-testnet.stellar.org";
export const XLM_SAC = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
export const EXPLORER = "https://stellar.expert/explorer/testnet";
export const CONTRACT_ID = networks.testnet.contractId;

export interface SplitView {
  id: bigint;
  recipients: Recipient[];
  shares: number[];
  controller: string | undefined;
}

export function readClient(): Client {
  return new Client({ ...networks.testnet, rpcUrl: RPC_URL });
}

export function walletClient(publicKey: string): Client {
  return new Client({
    ...networks.testnet,
    rpcUrl: RPC_URL,
    publicKey,
    signTransaction,
  });
}

export async function connectWallet(): Promise<string> {
  const connected = await isConnected();
  if (!connected.isConnected) {
    throw new Error("Freighter is not installed. Get it at freighter.app");
  }
  const access = await requestAccess();
  if (access.error) throw new Error(access.error);
  const details = await getNetworkDetails();
  if (!details.error && details.network !== "TESTNET") {
    throw new Error(
      `Freighter is on ${details.network}. Switch it to Testnet and connect again.`,
    );
  }
  return access.address;
}

export async function fetchSplits(limit = 25): Promise<SplitView[]> {
  const client = readClient();
  const { result: count } = await client.split_count();
  const ids: bigint[] = [];
  for (let i = count - 1n; i >= 0n && ids.length < limit; i--) {
    ids.push(i);
  }
  const splits = await Promise.all(
    ids.map(async (id) => {
      const { result } = await client.get_split({ id });
      if (result.isErr()) return null;
      const split = result.unwrap();
      return {
        id,
        recipients: [...split.recipients],
        shares: [...split.shares],
        controller: split.controller,
      };
    }),
  );
  return splits.filter((s): s is SplitView => s !== null);
}

export async function fetchMineIds(creator: string): Promise<Set<string>> {
  const { result } = await readClient().splits_of({ creator });
  return new Set(result.map((id) => String(id)));
}

export async function previewPayout(
  id: bigint,
  amount: bigint,
): Promise<bigint[]> {
  const { result } = await readClient().preview_payout({ id, amount });
  return result.isErr() ? [] : [...result.unwrap()];
}

export interface ActivityItem {
  type: string;
  id: bigint | undefined;
  amount: bigint | undefined;
  ledger: number;
  txHash: string;
}

export async function fetchActivity(limit = 12): Promise<ActivityItem[]> {
  const server = new rpc.Server(RPC_URL);
  const latest = await server.getLatestLedger();

  async function query(lookback: number) {
    return server.getEvents({
      startLedger: Math.max(1, latest.sequence - lookback),
      filters: [{ type: "contract", contractIds: [CONTRACT_ID] }],
      limit: 100,
    });
  }

  let res;
  try {
    res = await query(100_000);
  } catch {
    res = await query(5_000);
  }

  const items: ActivityItem[] = [];
  for (const ev of res.events) {
    let type: unknown;
    let id: unknown;
    let amount: bigint | undefined;
    try {
      type = scValToNative(ev.topic[0]);
      id = ev.topic.length > 1 ? scValToNative(ev.topic[1]) : undefined;
      const data = scValToNative(ev.value);
      if (data && typeof data === "object" && "amount" in data) {
        amount = data.amount as bigint;
      }
    } catch {
      continue;
    }
    if (typeof type !== "string") continue;
    items.push({
      type,
      id: typeof id === "bigint" ? id : undefined,
      amount,
      ledger: ev.ledger,
      txHash: ev.txHash,
    });
  }
  return items.reverse().slice(0, limit);
}

export function recipientLabel(r: Recipient): string {
  return r.tag === "Account"
    ? shortAddress(r.values[0])
    : `split #${String(r.values[0])}`;
}

export function shortAddress(addr: string): string {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export function toStroops(xlm: string): bigint {
  const [whole, frac = ""] = xlm.split(".");
  const padded = (frac + "0000000").slice(0, 7);
  return BigInt(whole || "0") * 10_000_000n + BigInt(padded);
}

export function fromStroops(stroops: bigint): string {
  return (Number(stroops) / 10_000_000).toLocaleString(undefined, {
    maximumFractionDigits: 7,
  });
}
