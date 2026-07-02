// ======================================================
// LUNKE BOT - HYBRID MULTI AFK CLIENT & PANEL (v1.0.0)
// ======================================================

// [GÜVENLİK] Beklenmedik ağ ve kütüphane hatalarında programın çökmesini engeller
process.on('uncaughtException', (err) => {
  console.log(`\n[Çökme Engellendi] Beklenmedik Hata Yakalandı: ${err.message}`);
});
process.on('unhandledRejection', (reason, promise) => {
  console.log('\n[Hata Engellendi] Arka planda bir işlem reddedildi:', reason);
});

// [GÖRÜNMEZLİK & SİSTEM TEPSİSİ] Sadece Windows bilgisayarlarda çalışır (Render/Linux'ta hata vermez)
if (process.platform === 'win32') {
  try {
    const ConsoleWindow = require("node-hide-console-window");
    ConsoleWindow.hideConsole(); // Siyah CMD penceresini otomatik gizler

    const Tray = require('trayicon');
    Tray.create({ useTempDir: "clean" }, function(tray) {
      let mainItem = tray.item("Lunke Bot - AFK Client");
      let quitItem = tray.item("Kapat (Sonlandır)", () => {
        tray.kill(); // Saat yanındaki ikonu kaldırır
        process.exit(0); // Arka plandaki bot sürecini tamamen kapatır
      });
      tray.setMenu(mainItem, tray.separator(), quitItem);
      tray.notify("Lunke Bot Aktif", "AFK Client arka planda çalışıyor! Web Panel: http://localhost:3000");
    });
  } catch (e) {
    console.log("[Sistem] Sistem tepsisi modülü yüklenemedi, konsol modunda devam ediliyor.");
  }
}

const mineflayer = require('mineflayer');
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const ACCOUNTS_FILE = path.join(__dirname, 'accounts.json');

// Kayıtlı hesapların havuzu
let accounts = [];

// Aktif çalışan bot nesnelerinin havuzu
let activeBots = {}; 

let sseClients = [];

app.use(express.json());

// [OTOMASYON] Hesapları diskten oku veya oluştur
function loadAccounts() {
  try {
    if (fs.existsSync(ACCOUNTS_FILE)) {
      const data = fs.readFileSync(ACCOUNTS_FILE, 'utf8');
      accounts = JSON.parse(data);
      console.log(`[Sistem] ${accounts.length} adet kayıtlı hesap diskten başarıyla yüklendi.`);
    } else {
      saveAccounts([]);
    }
  } catch (err) {
    console.log('[Sistem] Hesap dosyası okunurken hata oluştu:', err.message);
    accounts = [];
  }
}

// [OTOMASYON] Hesapları diske kaydet
function saveAccounts(data) {
  try {
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.log('[Sistem] Hesap dosyası kaydedilirken hata oluştu:', err.message);
  }
}

// Program başlarken kayıtlı hesapları yükle
loadAccounts();

// Arayüz dosyamızı (index.html) Express üzerinden sunuyoruz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// SSE endpoint'i
app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  sseClients.push(res);
  req.on('close', () => {
    sseClients = sseClients.filter(client => client !== res);
  });
});

function broadcast(type, data) {
  sseClients.forEach(client => {
    client.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  });
}

// Yeni Hesap Ekleme API'si (Kalıcı diske yazar)
app.post('/api/accounts/add', (req, res) => {
  const { username, host, port, version, commands, broadcastMsg, broadcastInterval } = req.body;
  if (accounts.some(acc => acc.username === username)) {
    return res.json({ success: false, error: 'Bu kullanıcı adı listede zaten var.' });
  }
  
  accounts.push({ 
    username, host, port, version, 
    commands: commands || '', 
    broadcastMsg: broadcastMsg || '', 
    broadcastInterval: parseInt(broadcastInterval) || 300 
  });
  
  saveAccounts(accounts); // Diske yaz
  res.json({ success: true });
});

// Hesap Silme API'si (Diskten de temizler)
app.post('/api/accounts/delete', (req, res) => {
  const { username } = req.body;
  
  if (activeBots[username]) {
    if (activeBots[username].afkTimer) clearInterval(activeBots[username].afkTimer);
    if (activeBots[username].broadcastTimer) clearInterval(activeBots[username].broadcastTimer);
    activeBots[username].instance.quit();
    delete activeBots[username];
  }
  
  accounts = accounts.filter(acc => acc.username !== username);
  saveAccounts(accounts); // Diske yaz
  res.json({ success: true });
});

// Chat Mesajı Gönderme API'si
app.post('/api/send', (req, res) => {
  const { message, sender } = req.body;

  if (sender === 'all') {
    let sent = false;
    Object.keys(activeBots).forEach(usr => {
      const b = activeBots[usr];
      if (b && b.instance && b.instance.entity) {
        b.instance.chat(message);
        sent = true;
      }
    });
    return res.json({ success: sent });
  } else {
    const b = activeBots[sender];
    if (b && b.instance && b.instance.entity) {
      b.instance.chat(message);
      return res.json({ success: true });
    }
  }
  res.json({ success: false, error: 'Mesaj gönderilemedi, bot bağlı olmayabilir.' });
});

// Botların Durumunu Toplu Güncelleyen Döngü (Yerel kullanım için saniyelik/hızlı çalışır)
setInterval(() => {
  let statuses = {};

  accounts.forEach(acc => {
    const active = activeBots[acc.username];
    const isOnline = active && active.instance && active.instance.entity;
    
    const inventoryItems = isOnline && active.instance.inventory 
      ? active.instance.inventory.items().map(item => ({ name: item.displayName, count: item.count })) 
      : [];

    const playerNames = isOnline && active.instance.players 
      ? Object.keys(active.instance.players) 
      : [];

    statuses[acc.username] = {
      online: isOnline,
      connecting: active ? active.connecting : false,
      host: acc.host,
      port: acc.port,
      commands: acc.commands || '',
      broadcastMsg: acc.broadcastMsg || '',
      broadcastInterval: acc.broadcastInterval || 300,
      hasAutoBroadcaster: acc.broadcastMsg && acc.broadcastMsg.trim() !== '',
      health: isOnline && active.instance.health ? active.instance.health.toFixed(1) : '-',
      food: isOnline && active.instance.food ? active.instance.food : '-',
      pos: isOnline ? {
        x: active.instance.entity.position.x.toFixed(1),
        y: active.instance.entity.position.y.toFixed(1),
        z: active.instance.entity.position.z.toFixed(1)
      } : { x: '-', y: '-', z: '-' },
      inventory: inventoryItems,
      players: playerNames
    };
  });

  broadcast('status_all', { statuses });
}, 1000); // Yerel kullanım için 1 saniyelik çok akıcı durum yayını

// Bot Kontrol API'si
app.post('/api/control', (req, res) => {
  const { username, action } = req.body;
  const acc = accounts.find(a => a.username === username);

  if (!acc) return res.json({ success: false, error: 'Hesap bulunamadı.' });

  if (action === 'connect') {
    if (!activeBots[username]) {
      activeBots[username] = { instance: null, afkTimer: null, broadcastTimer: null, connecting: true, antiAfk: true, manualDisconnect: false };
      startBot(acc);
      res.json({ success: true });
    } else {
      res.json({ success: false, error: 'Bot zaten bağlı veya bağlanıyor.' });
    }
  } 
  else if (action === 'disconnect') {
    const active = activeBots[username];
    if (active) {
      active.manualDisconnect = true; 
      if (active.afkTimer) clearInterval(active.afkTimer);
      if (active.broadcastTimer) clearInterval(active.broadcastTimer);
      if (active.instance) active.instance.quit();
      delete activeBots[username];
      broadcast('chat', { bot: username, text: `[Sistem] Sunucu ile bağlantı panelden el ile kesildi.` });
      res.json({ success: true });
    } else {
      res.json({ success: false, error: 'Bot zaten çevrimdışı.' });
    }
  } 
  else if (action === 'toggle-afk') {
    const active = activeBots[username];
    if (active) {
      active.antiAfk = !active.antiAfk;
      broadcast('chat', { text: `[Sistem] Anti-AFK durumu değiştirildi: ${active.antiAfk ? 'Aktif' : 'Pasif'}` });
      res.json({ success: true });
    }
  } 
  else if (action === 'respawn') {
    const active = activeBots[username];
    if (active && active.instance) {
      active.instance.respawn();
      res.json({ success: true });
    }
  }
});

function startBot(acc) {
  const username = acc.username;
  broadcast('chat', { bot: username, text: `[Sistem] Sunucuya bağlanmaya çalışıyor...` });

  const botOptions = {
    host: acc.host,
    port: acc.port,
    username: acc.username,
    version: acc.version,
    auth: 'offline',
    viewDistance: 'tiny',
  };

  const botInstance = mineflayer.createBot(botOptions);

  if (activeBots[username]) {
    activeBots[username].instance = botInstance;
  }

  botInstance.once('spawn', () => {
    if (activeBots[username]) {
      activeBots[username].connecting = false;
    }
    broadcast('chat', { bot: username, text: `[Sistem] Başarıyla oyuna girdi!` });

    // 1. Sıralı Giriş Komutları Otomasyonu (4 saniye gecikmeli)
    if (acc.commands && acc.commands.trim() !== '') {
      const cmdLines = acc.commands.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      cmdLines.forEach((line, index) => {
        setTimeout(() => {
          const active = activeBots[username];
          if (active && active.instance && active.instance.entity) {
            active.instance.chat(line);
            broadcast('chat', { bot: username, text: `[Oto-Giriş]: ${line}` });
          }
        }, (index + 1) * 4000); 
      });
    }

    // 2. Zaman Ayarlı Reklam / Duyuru Otomasyonu
    if (acc.broadcastMsg && acc.broadcastMsg.trim() !== '' && acc.broadcastInterval > 0) {
      if (activeBots[username].broadcastTimer) clearInterval(activeBots[username].broadcastTimer);

      activeBots[username].broadcastTimer = setInterval(() => {
        const active = activeBots[username];
        if (active && active.instance && active.instance.entity) {
          active.instance.chat(acc.broadcastMsg);
          broadcast('chat', { bot: username, text: `[Oto-Reklam]: ${acc.broadcastMsg}` });
        }
      }, acc.broadcastInterval * 1000);
    }

    // Anti-AFK
    const afkTimer = setInterval(() => {
      const active = activeBots[username];
      if (!active || !active.instance || !active.instance.entity || !active.antiAfk) return;

      const actions = [
        () => {
          active.instance.setControlState('jump', true);
          setTimeout(() => active.instance.setControlState('jump', false), 400);
        },
        () => {
          const yaw = active.instance.entity.yaw + (Math.random() - 0.5) * 1.5;
          const pitch = (Math.random() - 0.5) * 0.5;
          active.instance.look(yaw, pitch);
        },
        () => {
          active.instance.setControlState('sneak', true);
          setTimeout(() => active.instance.setControlState('sneak', false), 600);
        }
      ];

      const randomAction = actions[Math.floor(Math.random() * actions.length)];
      randomAction();

    }, 30000 + Math.random() * 15000);

    if (activeBots[username]) {
      activeBots[username].afkTimer = afkTimer;
    }
  });

  botInstance.on('message', (jsonMsg) => {
    const rawMessage = jsonMsg.toString().trim();
    if (!rawMessage) return;
    if (rawMessage.startsWith('===') || rawMessage.startsWith('---')) return;

    broadcast('chat', { bot: username, text: `[Sunucu]: ${rawMessage}` });
  });

  botInstance.on('death', () => {
    broadcast('chat', { bot: username, text: `[Sistem] Öldü! 3 saniye içinde otomatik yeniden doğuluyor...` });
    setTimeout(() => {
      if (activeBots[username] && activeBots[username].instance) {
        activeBots[username].instance.respawn();
      }
    }, 3000);
  });

  botInstance.on('end', (reason) => {
    broadcast('chat', { bot: username, text: `[Sistem] Bağlantısı koptu. Sebep: ${reason}` });
    
    const active = activeBots[username];
    if (active) {
      if (active.afkTimer) clearInterval(active.afkTimer);
      if (active.broadcastTimer) clearInterval(active.broadcastTimer); 
    }
    
    if (active && !active.manualDisconnect) {
      active.connecting = true;
      broadcast('chat', { bot: username, text: `[Sistem] 8 saniye içinde otomatik yeniden bağlanacak...` });
      setTimeout(() => {
        startBot(acc);
      }, 8000);
    } else {
      delete activeBots[username];
    }
  });

  botInstance.on('error', (err) => {
    broadcast('chat', { bot: username, text: `[Hata] ${err.message}` });
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`[Lunke Bot] Çoklu Hesap Destekli Web Panel Aktif!`);
  console.log(`[Lunke Bot] URL: http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});