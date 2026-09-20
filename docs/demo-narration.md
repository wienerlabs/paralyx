# Demo anlatım metni

Video 4:10 sürüyor; 2x oynatıldığında 2:05. Aşağıdaki zamanlar 2x oynatmaya göre, yanında videonun kendi zamanı. Her satır o an ekranda ne varsa ona göre yazıldı. Satır bitince sonraki işarete kadar sus, ekran konuşsun. Türkçe metin 220 kelime, İngilizce 270 kelime civarı; ikisi de 2x'te sığar, İngilizce tempolu okunur. 1x oynatırsan aynı satırlar, aralarda daha uzun bekleme. Video yeniden çekilirse zamanları yeni kurguya göre kaydır, satırlar aynı kalır.

Jüri sormadan kapatılacak iki itiraz:

- 0:47'de "Borrowing closed" ve "Pool on ice" ekrana gelir. Anlatım bunu kendisi söyler: Blend durdurdu, sözleşme durumu okuyor, borçlanma Blend açınca otomatik açılır.
- 0:37'de anchor sayfasında "simulated" yazar. Testnet bankası sandbox; mainnet perdesinde para gerçek.

Sessiz bırakılacak üç an: 0:23 ile 0:33 arası adımlar dolarken, 0:57 ile 1:02 arası Freighter onayı, 1:19 ile 1:28 arası gönderim. Bu anlarda ekranın kendisi kanıt.

## Türkçe

| 2x | Video | Ekranda | Söylenecek |
|---|---|---|---|
| 0:00 | 0:00 | Panel, testnet, cüzdan bağlı | Paralyx: XLM'ini satmadan lira. Sağda cüzdan bağlı, üstte testnet seçili. Canlı kartta dolar/lira Reflector'dan, XLM fiyatı Stellar DEX'ten. |
| 0:05 | 0:10 | Hat aç, 100 XLM / 10 USDC | Hat açıyoruz: 100 XLM teminat, 10 USDC borç. Tek imza; bizim sözleşme Blend havuzuna teminatı koyup borcu çekiyor. |
| 0:15 | 0:30 | Teminat çekme kartı | Aynı sayfadan teminat geri de çekiliyor. |
| 0:18 | 0:36 | Takas, 4 USDC, ₺194,16 | Şimdi lira. 4 USDC giriyoruz; kur anchor'ın SEP-38 teklifi, karşılığı 194 lira. |
| 0:23 | 0:46 | Yedi adım dolarken | SEP-10 giriş, SEP-38 kur, SEP-6 çekim talimatı, USDC anchor'a, anchor işliyor, ödeme sözleşmeye yazılıyor. Banka referansı geldi. |
| 0:33 | 1:06 | Makbuz, stellar.expert, anchor sayfası | İşlem explorer'da, ödeme anchor'ın SEP-6 kaydında: lira IBAN'a ödendi. Banka sandbox, Stellar tarafı gerçek. |
| 0:40 | 1:20 | Mainnet'e geçiş | Aynı uygulama, mainnet. Gerçek XLM, gerçek USDC, aynı sözleşme Blend'in Fixed havuzunda. |
| 0:47 | 1:34 | Hat aç, "Pool on ice" | Blend, Ağustos'taki backstop olayından beri yeni borçlanmayı durdurdu. Sözleşme havuz durumunu okuyor ve borç alanını kapatıyor. Teminat açık: 50 XLM, Freighter onayı, havuzda. |
| 1:02 | 2:04 | Takas turu, üç sekme | Mainnet takas sayfası üç iş yapar: borsaya gönder, USDT0 ile öde, USDC ile öde. USDT0 LayerZero üzerinden geliyor, DEX'te USDC'ye dönüp borcu kapatıyor. |
| 1:08 | 2:16 | Paribu, memo, 4,73 USDC | Lira bacağı lisanslı borsa. Paribu'nun yatırma cüzdanı ve memo hazır; adres Horizon'da doğrulanıyor, memo zorunluluğu SEP-29'dan. 4,73 USDC tek path payment ile XLM olarak gidiyor. |
| 1:19 | 2:38 | Freighter onayı, gönderim | Freighter memo'yu gösteriyor. Onay, gönderim, ardından ödeme sözleşmeye lira karşılığıyla yazılıyor. |
| 1:28 | 2:56 | Makbuz, explorer | 24 XLM Paribu'da, memo'lu. Explorer aynı işlemi gösteriyor. Borsada sat, lirayı IBAN'a çek. |
| 1:35 | 3:10 | Activity, Market, Panel | Activity zincirden okunuyor: hat, teminat, lira. Market'te Blend havuzunun gerçek büyüklüğü ve bizim kümülatif lira grafiğimiz, hepsi sözleşme eventlerinden. |
| 1:53 | 3:46 | stellar.expert sözleşme sayfası | Sözleşme sayfası: open_line, repay_line, record_payout çağrıları ve eventleri açıkta. |
| 2:00 | 4:00 | Testnet Activity, eventler | Testnet'te aynı sözleşme: dört hat, sekiz bin XLM, iki bin USDC. Kod açık, adresler README'de. Teşekkürler. |

## English

| 2x | Video | On screen | Say |
|---|---|---|---|
| 0:00 | 0:00 | Dashboard, testnet, wallet connected | Paralyx: lira without selling your XLM. Wallet connected, testnet selected. Live rates from Reflector and the Stellar DEX. |
| 0:05 | 0:10 | Open page, 100 XLM / 10 USDC | Opening a line: 100 XLM collateral, 10 USDC borrowed, one signature. Our contract posts collateral to Blend and draws the debt. |
| 0:15 | 0:30 | Withdraw card | Collateral comes back from the same page. |
| 0:18 | 0:36 | Exchange, 4 USDC, ₺194,16 | Now lira. 4 USDC in, the anchor's SEP-38 quote, 194 lira out. |
| 0:23 | 0:46 | Seven steps filling | SEP-10 login, SEP-38 quote, SEP-6 withdrawal, USDC to the anchor, anchor processing, payout recorded. Bank reference is in. |
| 0:33 | 1:06 | Receipt, stellar.expert, anchor page | Explorer shows the transaction, the anchor's SEP-6 record shows lira paid to the IBAN. Sandbox bank, real Stellar side. |
| 0:40 | 1:20 | Switch to mainnet | Same app, mainnet. Real XLM, real USDC, same contract on Blend's Fixed pool. |
| 0:47 | 1:34 | Open page, "Pool on ice" | Blend paused new borrowing after the August backstop incident. The contract reads the pool status and closes the borrow field. Collateral stays open: 50 XLM, Freighter confirms, done. |
| 1:02 | 2:04 | Exchange tour, three tabs | Three tabs on mainnet: send to an exchange, repay with USDT0, repay with USDC. USDT0 arrives over LayerZero and converts on the DEX. |
| 1:08 | 2:16 | Paribu, memo, 4.73 USDC | The lira leg is a licensed exchange. Paribu's deposit wallet and memo are preset, the address verified on Horizon, memo required from SEP-29. 4.73 USDC leaves as XLM in one path payment. |
| 1:19 | 2:38 | Freighter confirm, sending | Freighter shows the memo. Confirm, submit, payout recorded with its lira value. |
| 1:28 | 2:56 | Receipt, explorer | 24 XLM at Paribu, with the memo. Same transaction on the explorer. Sell there, withdraw lira to the IBAN. |
| 1:35 | 3:10 | Activity, Market, Dashboard | Activity reads from chain. Market shows the real Blend pool and our cumulative lira chart, all from contract events. |
| 1:53 | 3:46 | stellar.expert contract page | The contract page: open_line, repay_line, record_payout calls and their events. |
| 2:00 | 4:00 | Testnet Activity, events | Same contract on testnet: four lines, eight thousand XLM, two thousand USDC. Code public, addresses in the README. Thank you. |
