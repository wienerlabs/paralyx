# Demo senaryosu, Lounge Day

Beş dakika. İlk otuz saniye sorun, sonra doksan saniye canlı ürün, sonra kanıt, sonra traction, sonra istek. Ürün ekranda kaldığı sürece slayt azdır. Hype yalanla değil, canlı sayaçla ve gerçek işlemle gelir.

## Sahneden önce, kontrol listesi

1. Freighter'da iki testnet hesabı hazır: **Hesap A** boş hat için (XLM var, trustline'lar açık, hattı yok), **Hesap B** dolu hat için (hat açık, 10 USDC cüzdanda). Her ikisi de sunumdan önce uygulamada bir kez bağlanmış olsun.
2. Tarayıcı sekmeleri sırayla: Panel, Hat aç, Takas, Piyasa, Hareketler, stellar.expert sözleşme sayfası, anchor işlem sayfası.
3. Uygulama dili: jüride SDF ekibi varsa EN düğmesine bir kez basın, Türkçe arayüzün var olduğunu söyleyin.
4. Projektöre Hareketler sayfasını atın ve konuşmanın ilk slaydına QR koyun: `https://paralyx.vercel.app/open`. Salon siz konuşurken hat açsın, sayaç sahnede artsın.
5. Yedek: tam döngünün ekran kaydı telefonda ve bilgisayarda. Anchor cevap vermezse veya RPC yavaşlarsa kayda geçin, utanmayın, "testnet" deyin.
6. Freighter takılırsa Albedo: uzantı gerektirmez, modalde ikinci sırada.
7. Sunumdan bir saat önce tam turu bir kez daha atın; anchor sandbox'ı ve testnet RPC'yi ısıtır.

## Akış

### 0:00 Sorun, otuz saniye

"Türkiye dünyada milli gelirine oranla en çok stablecoin alan ülke. Bu insanlar liraya ihtiyaç duyduğunda tek seçenekleri satmak. Bugün ikinci seçeneği gösteriyoruz: sat**ma**, borçlan, lirayı IBAN'ına al, lirayla kapat."

Slaytta tek rakam: yüzde 4,3. Altında kaynak.

### 0:30 Canlı ürün, doksan saniye

1. **Panel.** Canlı piyasa kartını göster: dolar/lira ve XLM saniyeler önce güncellenmiş. "Bu sayılar Reflector ve Stellar DEX'ten, mainnet, canlı."
2. **Hat aç.** Hesap A ile: 100 XLM teminat, 10 USDC borç. Freighter'da tek onay. "Tek imza, üç sözleşme: bizim sözleşme, Blend havuzu, token. İç içe yetki, Soroban'ın gücü." Panel'de limit lira olarak belirir.
3. **Takas.** 10 USDC, yön USDC'den liraya, "Lira çek". Adımlar sırayla dolar: anchor girişi, kur, çekim talimatı, ödeme, anchor işliyor, kayıt. Banka referansı ekranda: "FAST-…". "Bu referans anchor'ın simüle ettiği banka ödemesinin numarası. Stellar tarafı gerçek, banka tarafı sandbox, çünkü lisanslı TRY anchor'ı henüz yok. Anchor gelince home domain değişir, kod değişmez."
4. **Yönü çevir.** Hesap B ile lirayla geri ödeme: 600 lira, "Bankayı oynat" adımı otomatik, USDC gelir, borç kapanır, teminat geri döner. Zaman darsa bu adımı yedek videodan gösterin.

### 2:00 Kanıt, yirmi saniye

stellar.expert'te az önceki ödeme işlemi, memo'suyla. Sonra Piyasa: Blend havuzunun gerçek büyüklüğü, faiz oranları, bizim hat sayacı bir arttı.

### 2:20 Traction, yirmi saniye

Hareketler sayfası projektörde: "Siz beni dinlerken salonda N kişi hat açtı, toplam şu kadar lira ödendi." Sayı ne olursa olsun söyleyin; sıfırsa QR'ı tekrar gösterip devam edin.

### 2:40 Nasıl kurulu, otuz saniye

README'deki Mermaid diyagramı tek slayt. Üç cümle: Blend kredi motoru, anchor lira rayı, bizim sözleşme 200 satırın altında ve fon tutmuyor.

### 3:10 Neden şimdi ve sonrası, kırk saniye

SPK çerçevesi lisanslı anchor adaylarını yarattı. USDT0 ve CCTP Stellar'a likidite getirdi. Sırada: lisanslı TRY anchor pilotu, mainnet'te Blend USDC havuzu, DeFindex ile teminat getirisi, USDT0 ve CCTP ile omnichain giriş, Stellar Private Payments ile gizli lira ödemeleri.

### 3:50 İstek, yirmi saniye

"İki şey istiyoruz: SCF Build entegrasyon başvurusu için destek ve lisanslı bir anchor adayıyla tanışma."

## Hype araçları, hepsi gerçek

- Canlı sayaç: QR ile açılan hatlar sahnede artar.
- Banka referansının gerçek zamanlı belirmesi: izleyici "lira gitti" hissini o anda yaşar.
- Tek imza vurgusu: Freighter penceresi bir kez açılır, üç sözleşme çalışır.
- Canlı fiyat noktası: kartlarda nabız atan nokta ve saniye damgası.
- Büyük lira rakamı: limit ve toplam her zaman ₺ ile, iki ondalık.

## Söylemeyin

- "Testnet'te gerçek lira gönderdik." Göndermedik, testnet bankası sandbox. Mainnet'te gerçek olan şu: USDC tek path payment ile Paribu yatırma cüzdanına XLM olarak gitti, lira çekimi borsada yapılıyor.
- "Mainnet'te borç aldık." Almadık. Blend havuzları Ağustos backstop olayından beri on-ice; mainnet'te teminat yatırma, geri ödeme ve çekim çalışıyor, borçlanma Blend açınca kendiliğinden açılıyor.
- "USDT0 testnet'te çalışıyor." Çalışmıyor, USDT0 sadece mainnet'te var. Mainnet takas sayfasında USDT0 ile geri ödeme entegre.
- "Blend'i yeniden yazdık." Yazmadık, üstüne kurduk; bu bir güç.
- "Denetlendi." Denetlenmedi. Mainnet sözleşmesi küçük tutarlar için, denetim planda.

## Jüri sorusu gelirse

`docs/jury-qa.md` içindeki cep kartı. En sert dört soru: regülasyon, gerekli mi, neden Stellar ve Blend, gelir modeli.
