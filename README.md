# 🚀 Lunke Bot - Minecraft Multi-Account AFK Client & Web Panel

[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/Node.js-v18+-6a0dad.svg)](https://nodejs.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows-0078d7.svg)](https://microsoft.com/windows)
[![Minecraft Version](https://img.shields.io/badge/Minecraft-1.20.1--1.21.11-green.svg)](https://minecraft.net/)

Minecraft sunucularında hesaplarınızı bilgisayarınızı yormadan, tamamen bağımsız bir masaüstü penceresi üzerinden 7/24 AFK bırakabilmeniz ve yönetebilmeniz için tasarlanmış açık kaynak kodlu (Open-Source) gelişmiş bir AFK Client yazılımıdır. 

Normal bir Minecraft istemcisi gibi 3D grafikler çizmediği için bilgisayarınızı neredeyse hiç yormaz ve her bir bot için oldukça düşük RAM (yaklaşık 40-60 MB) harcar.

---

## ✨ Öne Çıkan Özellikler

*   🖥️ **Bağımsız Masaüstü Uygulaması (Electron):** Tarayıcıya veya siyah CMD pencerelerine gerek kalmadan, tıpkı Discord veya Steam gibi doğrudan kendi özel penceresiyle çalışır.
*   Saat yanındaki sistem tepsisine (Tray) sessizce küçülebilir, görev çubuğunuzu meşgul etmez.
*   💾 **Kalıcı Yerel Veri Depolama (`accounts.json`):** Eklediğiniz tüm bot hesapları, şifreleri ve otomasyon ayarları bilgisayarınıza otomatik olarak kaydedilir. Programı kapatsanız bile bir sonraki açılışta hesaplarınız sizi bekler.
*   ⚙️ **Profil Düzenleme:** Çevrimdışı olan hesaplarınızın tüm ayarlarını (kullanıcı adı, sürüm, IP, otomasyonlar vb.) anında panel üzerinden düzenleyip diske kaydedebilirsiniz.
*   💬 **Discord Tarzı Canlı Sohbet:** 
    *   Farklı mesaj tipleri için parlayan neon etiketler (Sistem, Hata, Giriş, Reklam vb.).
    *   Minecraft sohbetindeki oyuncu isimlerini altın sarısı yapan akıllı süzgeç (Regex) sistemi.
    *   Geçmişi okurken ekranın aşağı kaymasını engelleyen akıllı otomatik kaydırma (Smart Auto-Scroll).
*   ↩️ **5'li Komut Geçmişi Balonları:** En son yazdığınız 5 komut/mesaj sohbet kutusunun üzerinde listelenir. Tek tıklamayla komutu tekrar yazma kutusuna doldurabilirsiniz.
*   🤖 **Gecikmeli Sıralı Giriş Otomasyonu:** Lobi sunucularında şifre girme ve otomatik sunucu değiştirme süreçleri için 4 saniye gecikmeli çalışan ardışık komut zinciri.
*   📢 **Zaman Ayarlı Reklam / Duyuru:** Belirlediğiniz bir reklam mesajını, belirlediğiniz saniye aralığıyla (örn: her 5 dakikada bir) sohbete otomatik yazdırma.
*   🔁 **Döngüsel Görev Otomasyonu (Dungeon & Geri Dönüş):** İki farklı komutu zaman ayarlı ve gecikmeli olarak döngüsel çalıştırır. (Örn: Her 5 dakikada bir `/warp zindan` yazar, 10 saniye bekler ve `/back` yazarak güvenli bölgesine geri döner).
*   🛡️ **Çökme Koruması (Auto-Reconnect):** İnternet dalgalanmalarında veya sunucu restartlarında programın kendi kendine kapanmasını %100 engeller. Bağlantı koptuğunda 8 saniye sonra otomatik olarak sunucuya geri bağlanır.

---

## 📦 Nasıl Çalıştırılır?

### 1. Son Kullanıcılar (Oyuncular) İçin:
1. Sağ taraftaki **[Releases](https://github.com/Yusuf-Eken/LunkeBot-AfkClientforMinecraft/releases)** bölümünden en güncel `LunkeBot.exe` dosyasını bilgisayarınıza indirin.
2. Dosyayı çift tıklayarak çalıştırın. Doğrudan pencereli arayüzümüz açılacaktır.

### 2. Geliştiriciler İçin (Kaynak Koddan Çalıştırma):
Eğer kaynak kodları düzenlemek ve yerelde çalıştırmak istiyorsanız:

```bash
# Projeyi bilgisayarınıza klonlayın
git clone https://github.com/Yusuf-Eken/LunkeBot-AfkClientforMinecraft.git
cd LunkeBot-AfkClientforMinecraft

# Gerekli bağımlılıkları yükleyin
npm install

# Geliştirici modunda yerel pencereyi başlatın
npm start


Kodları düzenledikten sonra tek başın çalışan Windows uygulaması (.exe) olarak derlemek isterseniz:
npm run pack
Derleme bittiğinde tek dosyalık uygulamanız dist/ klasörünün altında oluşacaktır.
