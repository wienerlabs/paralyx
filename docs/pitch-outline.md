# Pitch outline (Lounge Day, Scale track)

Use the official template. Five minutes, then questions. Keep the demo on screen from slide three on.

1. **Problem.** Turkish crypto holders need lira but do not want to sell. Today the only path is an exchange sell order and a bank withdrawal. Volatile asset gone, upside gone.
2. **Product.** Paralyx: post XLM, borrow USDC on Blend, cash out lira through an anchor, repay in lira. One screen, three actions. Non-custodial, the pool is the lender, the anchor is the regulated party.
3. **Live demo.** Connect Freighter, open a line (100 XLM, 10 USDC), cash out 10 USDC, show the bank reference the anchor returns, then repay with 600 lira and watch the collateral come back. Activity page at the end: lines opened, lira paid out. Then the same actions on mainnet: collateral posted, USDC to Paribu as XLM with memo, payout recorded.
4. **How it is built.** credit_line contract composes Blend v2 with nested authorization; SEP-10, SEP-38 and SEP-6 exchange flows against the TR anchor; Stellar Wallets Kit; strict-receive path payments for the testnet USDC seam. Show the Mermaid diagram from the README.
5. **Why Stellar wins here.** Blend already runs the credit engine, anchors already speak SEP-6, fees are cents, settlement is seconds. This product cannot be built this cheaply anywhere else.
6. **Traction.** Wallets onboarded during the hackathon (from the stats page), lines opened, lira paid out, plus the feedback collected at the venue.
7. **Next.** Licensed TRY anchor, an audit of credit_line and borrowing resuming on Blend mainnet where the contract is already live, DeFindex yield on idle collateral, CCTP and USDT0 entry, private payouts with Stellar Private Payments. SCF Build, Integration track, is the immediate application.

Numbers to verify before the deck: Türkiye's rank in the Chainalysis adoption index, the current USD/TRY rate, Blend testnet pool sizes.
