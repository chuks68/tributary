# Architecture

Tributary is three pieces: a Soroban contract that owns all the money movement, a generated TypeScript client, and a web dashboard. The contract is the source of truth; everything else is a view on it.

## The splitter contract

One contract instance manages every split. A split is a small record:

| Field | Type | Meaning |
| --- | --- | --- |
| `recipients` | `Vec<Recipient>` | who gets paid, max 32 entries |
| `shares` | `Vec<u32>` | basis points per recipient, sum exactly 10,000 |
| `controller` | `Option<Address>` | who may edit the split; `None` means locked forever |

A `Recipient` is either `Account(Address)` or `Split(u64)`. Split recipients let routing compose: the child's portion is credited to its escrow balance rather than transferred onward immediately, which keeps a single payment bounded no matter how deep the tree goes. Distributing the child is a separate, permissionless call. A split cannot reference itself or a split that does not exist yet; deeper cycles built through later updates are possible but harmless, since money only ever moves between balances when someone calls `distribute`.

### Storage layout

| Key | Storage | Value |
| --- | --- | --- |
| `Count` | instance | next split id (`u64`) |
| `Split(id)` | persistent | the split record |
| `Balance(id, token)` | persistent | escrowed amount per split and token (`i128`) |
| `Created(creator)` | persistent | ids created by an address (`Vec<u64>`) |

Persistent entries get their TTL extended to about 120 days whenever a split is loaded, with a 30 day threshold, so active splits never expire from the ledger.

### Money paths

Direct payment: `pay(from, id, token, amount)` transfers from the payer to every recipient inside one invocation. Nothing is held.

Escrow: `deposit(from, id, token, amount)` moves funds into the contract and credits `Balance(id, token)`. `distribute(id, token)` later pays the whole credited balance out following the split's shares. Distribution is permissionless because the routing table alone decides where funds go.

Both paths round each recipient's amount down and give the leftover to the last recipient, so the amount in always equals the amount out.

### Errors

| Code | Name | Raised when |
| --- | --- | --- |
| 1 | NoRecipients | empty recipient list |
| 2 | LengthMismatch | recipients and shares differ in length |
| 3 | ZeroShare | a share is 0 |
| 4 | BadShareTotal | shares do not sum to 10,000 |
| 5 | SplitNotFound | unknown split id |
| 6 | SplitImmutable | edit attempted without a controller |
| 7 | InvalidAmount | amount is zero or negative |
| 8 | NothingToDistribute | escrow balance is empty |
| 9 | TooManyRecipients | more than 32 recipients |
| 10 | BadChildSplit | split recipient is unknown or references itself |

### Events

`SplitCreated`, `SplitPaid`, `SplitUpdated`, `ControlTransferred`, `Deposited` and `Distributed`, each topic-keyed by split id so an indexer can follow one split cheaply.

## The sdk

`sdk/` is generated from the deployed contract spec with `stellar contract bindings typescript`. It is regenerated whenever the contract interface changes and the new deployment replaces the address embedded in `networks`.

## The app

`app/` is a Vite and React client. Reads go through RPC simulation and need no wallet. Writes build a transaction with the sdk, get signed by Freighter and are submitted to testnet.
