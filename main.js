// ======================================================
// LUNKE BOT - STANDALONE DESKTOP AFK CLIENT (v1.0.0)
// ======================================================

// [GÜVENLİK] Beklenmedik hatalarda çökmeyi engeller
process.on('uncaughtException', (err) => {
  console.log(`\n[Çökme Engellendi] Beklenmedik Hata: ${err.message}`);
});
process.on('unhandledRejection', (reason, promise) => {
  console.log('\n[Hata Engellendi] Arka planda bir işlem reddedildi:', reason);
});

const { app: electronApp, BrowserWindow } = require('electron');
const mineflayer = require('mineflayer');
const express = require('express');
const path = require('path');
const fs = require('fs');
const SocksClient = require('socks').SocksClient;

const app = express();
const PORT = process.env.PORT || 3000;
const ACCOUNTS_FILE = path.join(electronApp.getPath('userData'), 'accounts.json'); // Verileri Windows kullanıcı verilerine kaydeder

let accounts = [];
let activeBots = {}; 
let sseClients = [];

app.use(express.json());

// Hesapları diskten oku veya oluştur
function loadAccounts() {
  try {
    if (fs.existsSync(ACCOUNTS_FILE)) {
      const data = fs.readFileSync(ACCOUNTS_FILE, 'utf8');
      accounts = JSON.parse(data);
    } else {
      saveAccounts([]);
    }
  } catch (err) {
    accounts = [];
  }
}

// Hesapları diske kaydet
function saveAccounts(data) {
  try {
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {}
}

loadAccounts();

// Arayüz dosyamız
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

// API endpoint'leri
app.post('/api/accounts/add', (req, res) => {
  const { username, host, port, version, proxy, commands, broadcastMsg, broadcastInterval } = req.body;
  if (accounts.some(acc => acc.username === username)) {
    return res.json({ success: false, error: 'Bu kullanıcı adı zaten var.' });
  }
  accounts.push({ username, host, port, version, proxy, commands: commands || '', broadcastMsg: broadcastMsg || '', broadcastInterval: parseInt(broadcastInterval) || 300 });
  saveAccounts(accounts);
  res.json({ success: true });
});

app.post('/api/accounts/delete', (req, res) => {
  const { username } = req.body;
  if (activeBots[username]) {
    if (activeBots[username].afkTimer) clearInterval(activeBots[username].afkTimer);
    if (activeBots[username].broadcastTimer) clearInterval(activeBots[username].broadcastTimer);
    activeBots[username].instance.quit();
    delete activeBots[username];
  }
  accounts = accounts.filter(acc => acc.username !== username);
  saveAccounts(accounts);
  res.json({ success: true });
});

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
  res.json({ success: false });
});

setInterval(() => {
  let statuses = {};
  accounts.forEach(acc => {
    const active = activeBots[acc.username];
    const isOnline = active && active.instance && active.instance.entity;
    
    statuses[acc.username] = {
      online: isOnline,
      connecting: active ? active.connecting : false,
      host: acc.host,
      port: acc.port,
      proxy: acc.proxy || null,
      commands: acc.commands || '',
      broadcastMsg: acc.broadcastMsg || '',
      broadcastInterval: acc.broadcastInterval || 300,
      hasAutoBroadcaster: acc.broadcastMsg && acc.broadcastMsg.trim() !== '',
      health: isOnline && active.instance.health ? active.instance.health.toFixed(1) : '-',
      food: isOnline && active.instance.food ? active.instance.food : '-',
      pos: isOnline ? { x: active.instance.entity.position.x.toFixed(1), y: active.instance.entity.position.y.toFixed(1), z: active.instance.entity.position.z.toFixed(1) } : { x: '-', y: '-', z: '-' },
      inventory: isOnline && active.instance.inventory ? active.instance.inventory.items().map(item => ({ name: item.displayName, count: item.count })) : [],
      players: isOnline && active.instance.players ? Object.keys(active.instance.players) : []
    };
  });
  broadcast('status_all', { statuses });
}, 1000);

app.post('/api/control', (req, res) => {
  const { username, action } = req.body;
  const acc = accounts.find(a => a.username === username);
  if (!acc) return res.json({ success: false });

  if (action === 'connect') {
    if (!activeBots[username]) {
      activeBots[username] = { instance: null, afkTimer: null, broadcastTimer: null, connecting: true, antiAfk: true, manualDisconnect: false };
      startBot(acc);
      res.json({ success: true });
    }
  } else if (action === 'disconnect') {
    const active = activeBots[username];
    if (active) {
      active.manualDisconnect = true;
      if (active.afkTimer) clearInterval(active.afkTimer);
      if (active.broadcastTimer) clearInterval(active.broadcastTimer);
      if (active.instance) active.instance.quit();
      delete activeBots[username];
      broadcast('chat', { bot: username, text: `[Sistem] Sunucu ile bağlantı panelden kesildi.` });
      res.json({ success: true });
    }
  } else if (action === 'toggle-afk') {
    const active = activeBots[username];
    if (active) {
      active.antiAfk = !active.antiAfk;
      broadcast('chat', { text: `[Sistem] Anti-AFK durumu: ${active.antiAfk ? 'Aktif' : 'Pasif'}` });
      res.json({ success: true });
    }
  } else if (action === 'respawn') {
    const active = activeBots[username];
    if (active && active.instance) {
      active.instance.respawn();
      res.json({ success: true });
    }
  }
});

function startBot(acc) {
  const username = acc.username;
  broadcast('chat', { bot: username, text: `[Sistem] Sunucuya bağlanılıyor...` });

  const botOptions = { host: acc.host, port: acc.port, username: acc.username, version: acc.version, auth: 'offline', viewDistance: 'tiny' };

  if (acc.proxy && acc.proxy.trim() !== '') {
    try {
      const proxyParts = acc.proxy.split(':');
      botOptions.connect = (client) => {
        const socksOpts = { proxy: { host: proxyParts[0], port: parseInt(proxyParts[1]), type: 5 }, command: 'connect', destination: { host: acc.host, port: parseInt(acc.port) } };
        if (proxyParts[2] && proxyParts[3]) { socksOpts.proxy.userId = proxyParts[2]; socksOpts.proxy.password = proxyParts[3]; }
        SocksClient.createConnection(socksOpts, (err, info) => {
          if (err) {
            broadcast('chat', { bot: username, text: `[Proxy Hatası] Bağlanamadı: ${err.message}` });
            if (activeBots[username]) delete activeBots[username];
            return;
          }
          client.setSocket(info.socket);
          client.emit('connect');
        });
      };
    } catch (e) {}
  }

  const botInstance = mineflayer.createBot(botOptions);
  if (activeBots[username]) activeBots[username].instance = botInstance;

  botInstance.once('spawn', () => {
    if (activeBots[username]) activeBots[username].connecting = false;
    broadcast('chat', { bot: username, text: `[Sistem] Başarıyla oyuna girdi!` });

    if (acc.commands && acc.commands.trim() !== '') {
      const cmdLines = acc.commands.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      cmdLines.forEach((line, index) => {
        setTimeout(() => {
          const active = activeBots[username];
          if (active && active.instance && active.instance.entity) { active.instance.chat(line); broadcast('chat', { bot: username, text: `[Oto-Giriş]: ${line}` }); }
        }, (index + 1) * 4000); 
      });
    }

    if (acc.broadcastMsg && acc.broadcastMsg.trim() !== '' && acc.broadcastInterval > 0) {
      if (activeBots[username].broadcastTimer) clearInterval(activeBots[username].broadcastTimer);
      activeBots[username].broadcastTimer = setInterval(() => {
        const active = activeBots[username];
        if (active && active.instance && active.instance.entity) { active.instance.chat(acc.broadcastMsg); broadcast('chat', { bot: username, text: `[Oto-Reklam]: ${acc.broadcastMsg}` }); }
      }, acc.broadcastInterval * 1000);
    }

    const afkTimer = setInterval(() => {
      const active = activeBots[username];
      if (!active || !active.instance || !active.instance.entity || !active.antiAfk) return;
      const actions = [
        () => { active.instance.setControlState('jump', true); setTimeout(() => active.instance.setControlState('jump', false), 400); },
        () => { const yaw = active.instance.entity.yaw + (Math.random() - 0.5) * 1.5; const pitch = (Math.random() - 0.5) * 0.5; active.instance.look(yaw, pitch); },
        () => { active.instance.setControlState('sneak', true); setTimeout(() => active.instance.setControlState('sneak', false), 600); }
      ];
      actions[Math.floor(Math.random() * actions.length)]();
    }, 30000 + Math.random() * 15000);

    if (activeBots[username]) activeBots[username].afkTimer = afkTimer;
  });

  botInstance.on('message', (jsonMsg) => {
    const rawMessage = jsonMsg.toString().trim();
    if (!rawMessage || rawMessage.startsWith('===') || rawMessage.startsWith('---')) return;
    broadcast('chat', { bot: username, text: `[Sunucu]: ${rawMessage}` });
  });

  botInstance.on('death', () => {
    broadcast('chat', { bot: username, text: `[Sistem] Öldü! Yeniden doğuluyor...` });
    setTimeout(() => { if (activeBots[username] && activeBots[username].instance) activeBots[username].instance.respawn(); }, 3000);
  });

  botInstance.on('end', (reason) => {
    broadcast('chat', { bot: username, text: `[Sistem] Bağlantı koptu: ${reason}` });
    const active = activeBots[username];
    if (active) {
      if (active.afkTimer) clearInterval(active.afkTimer);
      if (active.broadcastTimer) clearInterval(active.broadcastTimer);
    }
    if (active && !active.manualDisconnect) {
      active.connecting = true;
      broadcast('chat', { bot: username, text: `[Sistem] 8 saniye içinde otomatik yeniden bağlanacak...` });
      setTimeout(() => { startBot(acc); }, 8000);
    } else {
      delete activeBots[username];
    }
  });

  botInstance.on('error', (err) => {
    broadcast('chat', { bot: username, text: `[Hata] ${err.message}` });
  });
}

// Express sunucusunu başlatıyoruz
app.listen(PORT, '127.0.0.1');

// ==========================================
// ELECTRON MASAÜSTÜ PENCERE YÖNETİMİ
// ==========================================

function createWindow() {
  // Masaüstü penceremizi oluşturuyoruz
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Lunke Bot - Multi AFK Client",
    autoHideMenuBar: true, // Üstteki gri menü çubuğunu gizler (Steam gibi temiz görünür)
    icon: path.join(__dirname, 'views', 'icon.png'), // Varsa pencere ikonu
    webPreferences: {
      nodeIntegration: false
    }
  });

  // Penceremizin içine yerel Express sunucumuzu yüklüyoruz
  win.loadURL(`http://127.0.0.1:${PORT}`);
}

// Electron hazır olduğunda pencereyi aç
electronApp.whenReady().then(() => {
  createWindow();

  electronApp.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Tüm pencereler kapatıldığında programı tamamen sonlandır
electronApp.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    electronApp.quit();
  }
});