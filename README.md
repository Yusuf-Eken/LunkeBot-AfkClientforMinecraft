# 🚀 LunkeBot - Multi-Account Minecraft AFK Client & Desktop Panel

![LunkeBot Banner](https://img.shields.io/badge/Minecraft-AFK%20Client-a855f7?style=for-the-badge&logo=minecraft)
![Electron](https://img.shields.io/badge/Electron-282C34?style=for-the-badge&logo=electron&logoColor=61DAFB)
![NodeJS](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-purple?style=for-the-badge)

**LunkeBot**, Minecraft sunucularında birden fazla oyuncu hesabını çok düşük sistem kaynaklarıyla (hesap başı ortalama 40-60 MB RAM) 7/24 kesintisiz ve akıllı otomasyonlarla AFK tutabilmek amacıyla geliştirilmiş, siber-mor (cyberpunk) temalı masaüstü panel yazılımıdır.

---

## ✨ Öne Çıkan Özellikler

- ⚡ **Aşırı Düşük Kaynak Kullanımı:** Standart Minecraft istemcilerine kıyasla hesap başına sadece **40-60 MB RAM** harcar.
- 🌐 **Otomatik Sürüm Algılama (Auto-Detect Handshake):** Sunucunun taban protokolünü otomatik olarak el sıkışarak tespit eder; alt sunucu (`/survival`, `/skyblock`) geçişlerinde yaşanan `socketClosed` ve `ECONNRESET` protokol uyumsuzluklarını önler.
- 🎒 **Canlı Envanter & GUI Menü Desteği:** Botların sırt çantalarını anlık görüntüleyin; sunucudaki çiftçi, sandık veya ayar menülerinin (GUI) slotlarına arayüzden doğrudan tıklayın.
- 💬 **Gelişmiş Sohbet & Komut Hatırlatıcı (Recall UI):**
  - **Son 5 Komut Baloncuğu:** Sık kullanılan komutları tek tıkla mesaj kutusuna doldurur.
  - **Terminal Tarzı Geçmiş:** Minecraft'taki gibi **Yukarı ($\uparrow$) ve Aşağı ($\downarrow$)** ok tuşlarıyla önceki komutlar arasında hızlıca gezinin.
  - Bot bazlı veya tüm botlara toplu mesaj/komut gönderme.
  - Sistem, hata, reklam ve sunucu mesajları için renkli neon etiketler.
- 🤖 **Akıllı Otomasyonlar:**
  - **Sıralı Oto-Giriş (Auto-Login):** Sunucuya girişte `/register`, `/login` gibi komutları belirlediğiniz gecikmeyle sırayla çalıştırır.
  - **Zaman Ayarlı Oto-Reklam (Broadcaster):** Belirlenen saniye aralıklarında otomatik duyuru/reklam mesajı atar.
  - **Döngüsel Komut Otomasyonu (Dungeon/Loop Task):** Çoklu komut zincirlerini belirlediğiniz sıklık ve satır arası gecikmeyle döngüsel olarak çalıştırır.
  - **Periyodik Auto-Restart:** Sunucu çökmelerine veya lobi takılmalarına karşı belirlediğiniz dakikada bir botu otomatik olarak yeniden başlatır.
- 🚶 **Gelişmiş Anti-AFK:** Sunucu korumalarına takılmamak için zıplama, bakış açısı değiştirme, eğilme (sneak) ve rastgele ileri-geri yürüme hareketleri yapar.
- 🔒 **Güvenli & Ergonomik UI:** Online olan botların konfigürasyonlarının bozulmaması için cam efektli (Glassmorphism) kilit katmanı ve odaklanmayı bozmayan Toast bildirimleri.
- 🪟 **Sistem Tepsisi (System Tray) Desteği:** Pencere kapatıldığında sağ alta küçülür, arka planda çalışmaya devam eder.

---

## 🛠️ Teknik Mimari ve Optimizasyon

- **Çekirdek (Backend):** Node.js & Express (SSE - Server-Sent Events canlı veri akışı)
- **Minecraft Protokolü:** `mineflayer`
- **Masaüstü Sarmalayıcı (GUI):** Electron.js & `electron-builder`
- **Veri Depolama:** İşletim sistemi kullanıcı verileri dizininde JSON veri tabanı (`accounts.json`)
- **Boyut Optimizasyonu:** `minecraft-data` bağımlılıklarında gereksiz protokoller elenmiş ve derleme optimizasyonlarıyla taşınabilir (Portable) tek dosya boyutu **~59 MB** seviyesinde tutulmuştur.

---

## 💻 Kurulum ve Çalıştırma

### Geliştirici Modunda Çalıştırma (Development)

Projeyi klonlayıp geliştirici modunda çalıştırmak için:

```bash
# 1. Depoyu klonlayın
git clone [https://github.com/Yusuf-Eken/LunkeBot-AfkClientforMinecraft.git](https://github.com/Yusuf-Eken/LunkeBot-AfkClientforMinecraft.git)

# 2. Proje dizinine gidin
cd LunkeBot-AfkClientforMinecraft

# 3. Bağımlılıkları yükleyin
npm install

# 4. Uygulamayı başlatın
npm start
