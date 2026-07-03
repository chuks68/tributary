# Tributary dashboard

Web client for the splitter contract. Create splits, pay through them, park funds in escrow and distribute, all against Stellar testnet.

Live at https://tributary-omega.vercel.app.

## Run locally

You need the sdk built first, then:

```
cd sdk && npm install && npm run build
cd ../app && npm install
npm run dev
```

Transactions require the [Freighter](https://freighter.app) browser extension switched to Testnet. Reading splits works without a wallet.

## Stack

Vite, React and TypeScript. Contract access goes through the `tributary-sdk` package in this repo, wallet signing through `@stellar/freighter-api`. No other runtime dependencies, no CSS framework.
