# Apartman Yönetim Sistemi - Yeni Özellikler

## Tarih: 14 Şubat 2026

### Eklenen Özellikler

#### 1. **Kullanıcı Dashboard'u (Sakinler için)**
- ✅ **Sidebar Kaldırıldı**: Sakinler için sidebar otomatik olarak gizleniyor
- ✅ **Önceki Ay Giderleri**: Bir önceki ayın işletme defteri giderleri görüntüleniyor
- ✅ **Yıllık Aidat Tablosu**: 12 aylık aidat ödemelerini gösteren detaylı tablo
- ✅ **Gecikme Cezası Hesaplama**: Ödenmeyen her ay için %5 ceza otomatik hesaplanıyor
- ✅ **Gelişmiş Görselleştirme**: 
  - Ödenen aylar: Yeşil
  - Ödenmemiş geçmiş aylar: **Koyu kırmızı** (bg-red-500, beyaz yazı)
  - Ödenmemiş gelecek aylar: Açık kırmızı
- ✅ **Excel İndirme**: Aidat tablosunu formatlanmış Excel dosyası olarak indirme

#### 2. **Aidat Çizelgesi Geliştirmeleri**
- ✅ **Aylık Aidat Düzenleme**: Aylık aidat tutarını tıklayarak düzenleyebilme
- ✅ **Gelişmiş Kırmızı Vurgulama**: 
  - Ödenmemiş geçmiş aylar artık **çok daha belirgin kırmızı** (bg-red-500)
  - Hücre çerçevesi de kırmızı (ring-2 ring-red-500)
  - Beyaz yazı ile kontrast artırıldı
- ✅ **Ay Bazında Gecikme Cezası**: Her ödenmemiş ay için ayrı ayrı %5 ceza

#### 3. **Excel Export Geliştirmeleri**
- ✅ **Gelişmiş Formatlama**: 
  - Başlık ve alt başlık desteği
  - Renkli tablolar (mavi başlıklar)
  - Negatif değerler kırmızı, pozitif değerler yeşil
  - Zebra çizgili satırlar
  - Toplam satırı vurgulaması
- ✅ **Türkçe Tarih**: Dosya adlarında Türkçe tarih formatı
- ✅ **UTF-8 Desteği**: Türkçe karakterler için BOM eklendi

#### 4. **Layout Güncellemeleri**
- ✅ **Dinamik Sidebar**: Kullanıcı rolüne göre sidebar otomatik gizleniyor
- ✅ **Tam Genişlik**: Sidebar olmayan sayfalarda içerik tam genişlikte

### Teknik Detaylar

#### Değişen Dosyalar:
1. `src/components/Layout.tsx` - Sidebar kontrolü eklendi
2. `src/lib/exportUtils.ts` - Excel export fonksiyonları geliştirildi
3. `src/pages/ResidentDashboard.tsx` - Tamamen yeniden yazıldı
4. `src/pages/DuesSchedule.tsx` - Kırmızı vurgulama ve aidat düzenleme eklendi

#### Yeni Özellikler:

**ResidentDashboard.tsx:**
- Önceki ay giderleri kartı
- Gecikme cezası uyarı kartı
- Yıllık aidat tablosu (12 ay)
- Her ay için durum göstergesi (Ödendi/Gecikmiş/Bekliyor)
- Excel export butonu
- Çıkış yap butonu

**DuesSchedule.tsx:**
- Aylık aidat tutarı düzenleme (başlığa tıklayarak)
- Gelişmiş renk kodlaması:
  - `bg-red-500 text-white font-extrabold shadow-lg` (ödenmemiş geçmiş aylar)
  - `bg-red-100 text-red-800 font-semibold` (ödenmemiş gelecek aylar)
  - `bg-emerald-200 text-emerald-900 font-bold` (ödenen aylar)

**exportUtils.ts:**
- `exportToExcel()` fonksiyonu eklendi
- HTML tablo formatı ile Excel export
- Stil desteği (renkler, yazı tipleri, kenarlıklar)
- Negatif/pozitif değer renklendirmesi

### Kullanım

#### Sakinler için:
1. `/login` sayfasından giriş yapın
2. Otomatik olarak `/resident` sayfasına yönlendirileceksiniz
3. Dashboard'da:
   - Önceki ay giderlerini görün
   - Yıllık aidat tablonuzu inceleyin
   - Gecikme cezalarınızı kontrol edin
   - Excel olarak indirin

#### Yöneticiler için:
1. Aidat çizelgesinde aylık aidat tutarını düzenleyin (başlığa tıklayın)
2. Ödenmemiş aylar artık çok daha belirgin kırmızı
3. Excel indirme ile formatlanmış raporlar alın

### Önemli Notlar

- **Asansör Ödemesi**: Yıllık tek seferde ödenir
- **Gecikme Cezası**: Sadece geçmiş ödenmemiş aylar için hesaplanır
- **Mevcut Ay**: Gecikme cezası hesaplamasına dahil değildir
- **Excel Format**: `.xls` formatında (eski Excel uyumluluğu için)

### Gelecek Geliştirmeler (Öneriler)

- [ ] SMS/Email bildirimleri
- [ ] Online ödeme entegrasyonu
- [ ] Mobil uygulama
- [ ] Otomatik aidat hatırlatıcıları
- [ ] Daha detaylı raporlama
