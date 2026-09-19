# Jüri soruları ve cevaplar

Lounge Day için hazırlık. Her cevap iki katmanlı: kısa versiyon sahnede söylenir, uzun versiyon soru derinleşirse kullanılır. Rakamların kaynağı en altta.

## Bölüm 1. Gelmesi muhtemel eleştiriler

### 1. Gerçek lira işlemleri için regülasyonu mu bekleyeceksiniz?

**Kısa:** Hayır. Paralyx fon tutmaz, lira tutmaz, borç vermez. Lira bacağını lisanslı bir anchor yapar, kredi bacağını Blend havuzu yapar. Biz bu ikisini tek ekranda birleştiren yazılımız. Beklediğimiz şey regülasyon değil, Stellar üzerinde lisanslı bir TRY anchor'ının açılması.

**Uzun:** Türkiye'de çerçeve zaten var. 7518 sayılı kanun Temmuz 2024'te kripto varlık hizmet sağlayıcılarını SPK denetimine aldı; 13 Mart 2025'te iki tebliğ lisans, sermaye ve saklama kurallarını netleştirdi. Yani lisanslı platformlar bugün mevcut ve tam da anchor rolünü üstlenebilecek kurumlar bunlar. Stellar tarafında eksik olan, bu kurumlardan birinin SEP-6 veya SEP-24 konuşan bir TRY anchor'ı açması. Hackathon'un anchor atölyesi ve mock anchor'ın varlığı bu boşluğun ekosistem tarafından görüldüğünü gösteriyor. Bizim entegrasyon adaptörümüz home domain değişikliğiyle gerçek anchor'a geçer; kod aynı kalır. Geçiş süresinde iki yol daha var: TR dışı kullanıcı için Bridge ve BlindPay gibi listedeki USD ve EUR rayları, TR kullanıcısı için USDC'yi lisanslı borsasına çekip liraya çevirmek. Mainnet öncesi bir hukuki görüş alacağız: arayüzün SPK tanımındaki "platform" kapsamına girip girmediği ve pazarlama dilinin tüketici kredisi kurallarına uyumu.

### 2. Bu gerçekten gerekli mi? Kullanıcı neden satmasın?

**Kısa:** Türkiye dünyada GSYH'ye oranla en çok stablecoin alan ülke; hane halkı zaten dolarize. Bu insanlar liraya ihtiyaç duyduğunda tek seçenekleri satmak. Olgun her piyasada ikinci seçenek vardır: varlığın karşılığında borçlanmak. Biz o seçeneği Türkiye'ye getiriyoruz.

**Uzun:** Satmak iki şey kaybettirir: pozisyon ve makas. Kripto tutan kişi kısa vadeli lira ihtiyacı için satarsa hem yeniden alım riskine girer hem iki kez spread öder. Küçük işletme USDC tutuyor ama tedarikçisine lira ödüyor; her ay satmak yerine hattan çekip ay sonu kapatmak nakit yönetimi için daha rahat. Aave ve Coinbase tarzı teminatlı borçlanma dünyada milyarlarca dolarlık bir ürün; Türkiye'de zincir üstü, custody'siz ve lira çıkışlı bir versiyonu yok. Dürüst olalım: talebi hackathon'da doğrulamaya başladık, salonda açılan hat sayısı ve geri bildirimler ilk veri. Kesin cevap ilk yüz kullanıcıdan gelecek.

### 3. Neden Stellar?

**Kısa:** Çünkü fiat rayları Stellar'da eklenti değil, standart. Anchor'lar SEP protokolüyle konuşur, ücret bir sentin altında, mutabakat beş saniye. Lira çıkışlı bir ürün için bu üçlü başka yerde yok.

**Uzun:** Ethereum L2'de aynı ürünü kurmak için her ülkede ayrı off-ramp sağlayıcısına özel entegrasyon ve ayrı KYC akışı gerekir. Stellar'da SEP-1, SEP-10, SEP-6 ve SEP-38 standart olduğu için anchor değişince kod değişmez. Native USDC, CCTP ve Eylül 2026'dan beri USDT0 ile likidite girişi var. Soroban compose edilebilir olduğu için Blend'in üstüne bir sözleşmeyle kuruluyoruz. Ekosistemin kendisi ödeme odaklı, ürünle uyumlu.

### 4. Neden Blend?

**Kısa:** Stellar'da denetlenmiş, izole havuzlu, backstop sigortalı ve likidasyonu çalışan tek olgun kredi protokolü. Faiz modelini, oracle entegrasyonunu ve risk yönetimini yeniden yazmak yerine üstüne kuruyoruz.

**Uzun:** 2025'teki ilk Paralyx kendi havuzunu yazmıştı. Bir hafta sonunda yazılan bir kredi havuzu Blend'in daha güvensiz bir kopyası olur. Compose etmek üç şey kazandırıyor: gerçek faiz tahakkuku ve likidasyon, Blend'in backstop'unun sağladığı kötü borç sigortası, ve sözleşmemizin 200 satırın altında kalması. Blend'de havuz açmak izinsiz; yol haritasında sadece XLM, USDC ve EURC rezervli, Türkiye parametreli bir Paralyx havuzu var. Sözleşmemiz havuz adresini config'den okur, geçiş tek deploy.

### 5. Neden anchor? Kendiniz banka entegrasyonu yapsanız?

**Kısa:** Lira bacağı lisans, KYC ve banka erişimi ister. Anchor tam olarak bu sorumluluğu üstlenen lisanslı kurumun soyutlaması. Biz lira tutmadığımız için lisans gerektiren tarafta değiliz.

**Uzun:** Anchor modelinin gücü değiştirilebilirliği. Bugün mock, yarın lisanslı bir borsa, sonra bir ödeme kuruluşu; SEP arayüzü aynı olduğu için ürün değişmez. Kendi banka entegrasyonumuzu yapmak bizi ödeme kuruluşu lisansı ve MASAK yükümlülüğü altına sokar; küçük bir ekip için yanlış savaş.

### 6. Blend'in üstünde ince bir katman değil misiniz?

**Kısa:** Evet, bilerek. Değer kredi matematiğinde değil, döngünün tamamında: lira gir, tek imzayla hat aç, lira çek, lirayla kapat. Blend bunların hiçbirini yapmıyor.

**Uzun:** Sözleşmemiz "kredi hattı" soyutlaması: kullanıcı bir kez imzalar, teminat ve borç tek işlemde geçer, hat kayıt altına alınır, event'ler istatistik ve bildirim için yayınlanır. Üstüne gelenler: lira ile otomatik geri ödeme talimatı, sağlık faktörü düşünce tek tıkla lira ile takviye, boşta duran teminata DeFindex getirisi, kendi Blend havuzumuz. Aave'nin de üstünde çalışan onlarca ürün var; kullanıcı motoru değil deneyimi satın alıyor.

### 7. XLM düşerse ne olur? Likidasyon riski

**Kısa:** Blend sağlık faktörünü zorlar, biz limiti yüzde 97 güvenlik payıyla gösteriyoruz ve sağlık faktörü ekranda. Teminatlı borçlanmanın doğasında bu risk var, gizlemiyoruz.

**Uzun:** Testnet'te XLM için teminat oranı 0,90, USDC için borç oranı 0,95. Panel her an teminat değeri, borç ve sağlık faktörünü gösterir. Yol haritası: sağlık faktörü eşiğin altına inince bildirim ve lirayla tek tıkla borç azaltma. Piyasa sayfasında oranlar ve kullanım görünür, kullanıcı ne aldığını bilir.

### 8. Kur riski: borç dolar, gelir lira

**Kısa:** Evet, borçlu dolar/lira riskini taşır. Türkiye'de dolar cinsi her borç gibi. Çoğu kullanıcı için bu risk değil, tercih; dolarizasyonun kendisi bu.

**Uzun:** Ekranda borç her zaman hem USDC hem lira karşılığıyla gösterilir, kur canlı. Zincirde likit bir lira stablecoin'i olsaydı borcu lira cinsinden verirdik; yol haritasında Stellar'a lira stablecoin gelirse ilk entegre edeceğimiz şey bu.

### 9. Testnet'te iki farklı USDC var, bu hile değil mi?

**Kısa:** Blend'in test USDC'si ile anchor'ın Circle test USDC'si testnet'te farklı varlıklar, mainnet'te aynı. Aradaki dönüşüm gerçek bir DEX havuzu üzerinden, README'de açık.

**Uzun:** Havuz tek taraflıydı, market maker hesabımız 2.000 USDC'lik swap ile 1:1'e dengeledi, işlem hash'i README'de. Uygulama strict-receive path payment kullanır, kullanıcı fazla ödemez. Mainnet'te bu bölüm silinir.

### 10. Anchor sahte, banka yok. Bu bir demo değil mi?

**Kısa:** Stellar bacağı gerçek: gerçek testnet USDC, gerçek Blend pozisyonu, gerçek işlemler. Simüle olan sadece banka havalesi, çünkü henüz lisanslı bir TRY anchor yok. SEP adaptörü üretim biçiminde, SDF'nin anchor testlerinden geçen bir sandbox'a karşı doğrulandı.

### 11. Gelir modeli?

**Kısa:** Üç seçenek var, hiçbirini hackathon'da uygulamadık, döngüyü çalıştırmayı seçtik. Lira çıkışında küçük bir işlem ücreti, kendi Blend havuzumuzda backstop ve take rate geliri, otomatik geri ödeme ve uyarı gibi ücretli özellikler.

### 12. Rakipler kim, neden şimdi?

**Kısa:** Dünyada Aave, Coinbase Borrow, Nexo; hepsi ya lira çıkışsız ya custody'li. Türkiye'de borsalar zincir üstü, custody'siz lira kredisi sunmuyor. Stellar'da Blend'in lira kapısı yok. Kumbara tasarruf, LiraLink tahsilat; bizimle tamamlayıcı. Neden şimdi: SPK çerçevesi lisanslı anchor adaylarını yarattı, USDT0 ve CCTP Stellar'a likidite getirdi, Blend v2 ve Reflector olgunlaştı.

### 13. Güvenlik ve denetim?

**Kısa:** Sözleşme 200 satırın altında, custody yok, 8 birim test, iç içe yetki testnet'te doğrulandı. Blend denetlenmiş. Mainnet öncesi bağımsız denetim ve bug bounty; upgrade yetkisi çoklu imzaya taşınacak.

### 14. Oracle riski?

**Kısa:** Kredi tarafında Blend'in oracle'ı, mainnet'te Reflector tabanlı; lira kuru anchor'ın Reflector FX verisi artı 50 baz puan makas. Reflector Stellar'ın çok düğümlü oracle ağı. Panelde gösterdiğimiz canlı fiyatlar da aynı kaynaklardan.

### 15. Blend SCF entegrasyon listesinden geçici olarak çıkarılmış, SCF yolunuz ne?

**Kısa:** Hackathon listesinde Blend var. SCF Build entegrasyon başvurusunda listedeki ortaklarla gidiyoruz: DeFindex ile teminat getirisi, CCTP ve LayerZero ile omnichain giriş, Wallets Kit, Bridge ve BlindPay rayları. Blend kredi motoru olarak kalıyor.

### 16. Neden USDC borç, neden lira borç değil?

**Kısa:** Zincirde likit bir lira stablecoin'i yok. USDC borç artı anchor'da anlık dönüşüm aynı kullanıcı deneyimini veriyor. Lira stablecoin gelirse borcu lira cinsine çevirmek yol haritasının ilk maddesi.

## Bölüm 2. Ekibin kendine sorması gerekenler

Bunları jüri sormadan önce kendi cümlelerinizle cevaplayabiliyor olmalısınız. Taslak cevaplar var, köşeli parantezli yerler sizin.

### İlk 100 kullanıcı nereden gelecek?

Salondan başlıyor: QR ile açılan hatlar istatistik sayfasında sayılıyor. Sonra Rise In ve Türkiye Stellar topluluğu, USDC ile ödeme alan freelancer ve ihracatçılar, Türk borsalarının kripto toplulukları. [Somut kanal ve ilk ortak adı ekleyin.]

### Hackathon'dan sonra kim ne kadar zaman ayıracak?

[Baturalp: tam zamanlı mı, haftada kaç saat? Abdullah: rol?] Jüri ve yatırımcı bu soruya net rakam ister.

### Anchor ortağı kim olacak?

Hedef: SPK lisanslı bir platform veya ödeme kuruluşuyla SEP-6 pilotu. [Görüşülen kurum varsa adı, yoksa ilk üç aday.] Alternatif: SDF ve Rise In'in anchor programı üzerinden eşleşme.

### Mainnet'te ilk gün ne olur?

Sözleşme Blend mainnet USDC havuzuna bağlanır, tek USDC olduğu için seam yok, lira çıkışı gerçek anchor'a kadar Bridge ve BlindPay ile USD ve EUR olarak çalışır. Denetim ve limitli açılış: hat başına üst sınır, toplam TVL sınırı.

### Ne yanlış giderse ürün ölür?

Lisanslı TRY anchor hiç açılmazsa. O durumda B planı: USDC tutan Türk kullanıcı için borsaya çekim akışı ve TR dışı pazarlar. [Bu riski kabul ettiğinizi söyleyin, saklamayın.]

### Bu sizin için neden önemli?

[Kişisel cümle. Türkiye'de enflasyon ve dolarizasyonla ilgili kendi deneyiminiz.] Jüri ürünü değil ekibi finanse eder.

### Bir yıl sonra ne olmuş olmalı?

[Hat sayısı, ödenen lira hacmi, anchor ortağı, denetim, SCF ödülü gibi ölçülebilir üç hedef.]

## Bölüm 3. Cep kartı, otuz saniyelik cevaplar

- **Regülasyon:** Fon tutmuyoruz, lira tutmuyoruz, borç vermiyoruz. Lisanslı anchor lira bacağını, Blend kredi bacağını yapar. Beklediğimiz şey lisanslı bir TRY anchor'ı, çerçeve 2024'ten beri var.
- **Gerekli mi:** Türkiye GSYH'ye oranla dünyanın en büyük stablecoin alıcısı. Bu insanlar liraya ihtiyaç duyunca satmak zorunda. Biz ikinci seçeneği veriyoruz.
- **Neden Stellar:** Fiat rayları standart, ücret sentin altında, beş saniye mutabakat.
- **Neden Blend:** Denetlenmiş, backstop'lu, likidasyonu çalışan tek olgun kredi protokolü. Yeniden yazmak daha güvensiz bir kopya olurdu.
- **Neden anchor:** Lisans, KYC ve banka erişimi anchor'da; SEP standardı sayesinde değiştirilebilir.
- **Kanıt:** Testnet'te üç akış da zincirde: hat açma, lira çekme, lirayla kapatma. İşlem hash'leri README'de.

## Kaynaklar

- Chainalysis: Türkiye'nin stablecoin alımları yaklaşık 38 milyar dolar, GSYH'nin yüzde 4,3'ü, dünyada birinci. Türkiye 2025 küresel benimseme endeksinde 14. sırada. Not: 2025'te hacim stablecoin'den altcoin'e kaymış, sunumda "dolarizasyon" vurgusunu stablecoin alım stokuyla yapın, aylık işlem hacmiyle değil.
- SPK: 7518 sayılı kanun 2 Temmuz 2024; III-35/B.1 ve III-35/B.2 tebliğleri 13 Mart 2025; platformlar için asgari sermaye 150 milyon lira, 31 Aralık 2025'e kadar saklama kuruluşu sözleşmesi, müşteri varlıklarının yüzde 95'i saklama kuruluşunda.
- Stellar: USDT0 2 Eylül 2026'da Stellar'da, Circle CCTP canlı, Blend v2 TestnetV2 havuzu ve Reflector oracle adresleri README'de.
