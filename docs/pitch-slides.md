# Pitch slides, official template text

The Rise In template has five slides. Design, fonts and colors stay as they are; only the text changed, applied in the Canva copy on 20 September 2026. Each slide keeps the template's own text budget: one title, one sentence, the same number of bullets, every line fitting on one line. Speaker notes carry short Turkish talking points per slide.

## Slide 1, cover

Big title, two lines: `PARALYX` / `LIRA LINE`

Small line, bottom right, unchanged: `19-20 September, 2026`

## Slide 2, The Solution

Sentence: Paralyx: Turkish lira liquidity without selling your XLM.

- Post XLM on Blend v2, borrow USDC, cash out lira to your IBAN via SEP-6.
- Repay in lira and the collateral comes back. One screen, three actions.
- Non-custodial: Blend lends, the anchor pays out, Paralyx holds nothing.
- Full loop live on testnet; same contract live on mainnet with real funds.

## Slide 3, PMF

Sentence: Holders in Türkiye who need lira today have one option: sell.

- Stablecoin buying equals 4.3% of GDP, the world's highest (Chainalysis 2024).
- Selling loses the position and two spreads; a lira line keeps the XLM.

## Slide 4, Technical Workflow

Sentence: One small Soroban contract composes Blend v2; the SEPs carry the lira leg.

- One signature: post XLM collateral, borrow USDC on Blend v2 via nested auth.
- Lira: SEP-10, SEP-38, SEP-6 anchor, Reflector rate; USDT0 or USDC repays.

## Slide 5, The Team

Sentence: Wiener Labs, Istanbul. Two people, one weekend, a contract live on both networks.

- Baturalp Güvenç, founder: Soroban contract, app, Blend and anchor work.
- Abdullah Valisoy: product, pitch, go-to-market.
- github.com/wienerlabs/paralyx · paralyx.vercel.app

## Speech, one breath per slide

Also stored in the deck's speaker notes. Turkish first, English below it.

### 1. Cover

Merhaba, biz Paralyx. Türkiye'deki kripto sahibi için tek cümle: XLM'ini satmadan liraya ulaş. Teminat koy, USDC borçlan, lira IBAN'ına gelsin, lirayla kapat.

We are Paralyx. Turkish lira liquidity without selling your XLM: post collateral, borrow USDC, lira lands in your IBAN, repay in lira.

### 2. The Solution

Ürün tek ekran, üç eylem: hat aç, lira çek, lirayla geri öde. Krediyi Blend v2 havuzu veriyor, lirayı anchor ödüyor; Paralyx hiçbir noktada fon tutmuyor. Bu döngü testnet'te uçtan uca çalışıyor, aynı sözleşme mainnet'te gerçek XLM ve USDC ile canlı.

One screen, three actions: open a line, cash out lira, repay in lira. Blend v2 is the lender and the anchor pays the lira; Paralyx never holds funds. The full loop runs on testnet, and the same contract is live on mainnet with real XLM and USDC.

### 3. PMF

Türkiye, milli gelirine oranla dünyada en çok stablecoin alan ülke: yüzde 4,3. Bu insanlar liraya ihtiyaç duyduğunda tek seçenekleri satmak; satınca pozisyon gidiyor, makas iki kez ödeniyor. Biz olgun her piyasada olan ikinci seçeneği getiriyoruz: varlığını satmadan borçlan.

Türkiye buys more stablecoins relative to GDP than any country in the world, 4.3 percent. When these holders need lira, the only option is to sell: the position is gone and they pay the spread twice. We bring the second option every mature market has: borrow against the asset instead of selling it.

### 4. Technical Workflow

Sözleşmemiz iki yüz satırın altında ve Blend'in üstüne kurulu: kullanıcı bir kez imzalıyor, sözleşme iç içe yetkiyle teminatı koyup borcu çekiyor. Lira bacağı Stellar standartları: SEP-10 giriş, SEP-38 kur, SEP-6 çekim ve yatırma; kur Reflector'dan, her ödeme zincire yazılıyor. Lisanslı TRY anchor'ı açıldığında tek değişiklik home domain.

Our contract is under two hundred lines and sits on top of Blend: the user signs once, and nested authorization posts the collateral and draws the debt. The lira leg is pure Stellar standards, SEP-10 login, SEP-38 quote, SEP-6 in and out, with Reflector rates and every payout recorded on chain. When a licensed TRY anchor opens, the only change is a home domain.

### 5. The Team

Wiener Labs, İstanbul: Baturalp sözleşmeyi, uygulamayı ve entegrasyonları yazdı; Abdullah ürün ve pazar tarafında. İki kişi, bir hafta sonu, iki ağda canlı sözleşme. Sizden iki şey istiyoruz: SCF Build başvurusu için destek ve lisanslı bir TRY anchor adayıyla tanışmak.

Wiener Labs, Istanbul: Baturalp wrote the contract, the app and the integrations; Abdullah runs product and go-to-market. Two people, one weekend, a contract live on both networks. We are asking for two things: support for an SCF Build application and an introduction to a licensed TRY anchor candidate.

## Footers, small gold lines at the bottom of each slide

Added on 20 September 2026 in the deck, same muted gold as the template's date line, 24 px.

- Cover: `paralyx.vercel.app · github.com/wienerlabs/paralyx · live on Stellar mainnet and testnet`
- The Solution: `Testnet proof: 4 USDC out, ₺194,16 to the IBAN, bank reference FAST-2HK1C18LOO, payout recorded on chain.` / `Mainnet proof: 4.73 USDC to Paribu as XLM in one path payment, tx e661cba9…bce80, recorded on chain.`
- PMF: `Source: Chainalysis, The 2024 Geography of Cryptocurrency Report.` / `The credit engine already exists: Blend v2 mainnet holds $193.7M supplied, read from chain, 20 Sep 2026.`
- Technical Workflow: both full contract IDs, `Same wasm on both networks, 8 unit tests, nested auth proven on chain before any UI.`, `Built on Blend v2, TR anchor SEP-6, Stellar Wallets Kit, Reflector, Stellar DEX, USDT0 over LayerZero.`
- The Team, between the avatars: `Next: licensed TRY anchor pilot, SCF Build Integration track, DeFindex yield on collateral, CCTP entry, Private Payments.` and `Stellar Skills used: stellar-dev-skill cross-chain, security, dapp; stellar-hackathon-turkiye anchor skill.`
