// ======================================================
// LUNKE BOT - STANDALONE DESKTOP AFK CLIENT (v1.2.3)
// ======================================================

process.on('uncaughtException', (err) => {
  console.log(`\n[Çökme Engellendi] Beklenmedik Hata: ${err.message}`);
});
process.on('unhandledRejection', (reason, promise) => {
  console.log('\n[Hata Engellendi] Arka planda bir işlem reddedildi:', reason);
});

const { app: electronApp, BrowserWindow, Tray, Menu } = require('electron');
const mineflayer = require('mineflayer');
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const ACCOUNTS_FILE = path.join(electronApp.getPath('userData'), 'accounts.json');

let accounts = [];
let activeBots = {}; 
let sseClients = [];
let win = null;
let tray = null;
let isQuitting = false;

app.use(express.json());

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

function saveAccounts(data) {
  try {
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {}
}

loadAccounts();

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

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

// Hesap Ekleme API'si
app.post('/api/accounts/add', (req, res) => {
  const { username, host, port, version, commands, broadcastMsg, broadcastInterval, loopCmds, loopInterval, loopDelay, autoRestartMins } = req.body;
  if (accounts.some(acc => acc.username === username)) {
    return res.json({ success: false, error: 'Bu kullanıcı adı zaten listede var.' });
  }
  accounts.push({ 
    username, 
    host, 
    port: parseInt(port) || 25565, 
    version: version || 'auto', 
    commands: commands || '', 
    broadcastMsg: broadcastMsg || '', 
    broadcastInterval: parseInt(broadcastInterval) || 300,
    loopCmds: loopCmds || '',
    loopInterval: parseInt(loopInterval) || 300,
    loopDelay: parseInt(loopDelay) || 10,
    autoRestartMins: parseInt(autoRestartMins) || 0
  });
  saveAccounts(accounts);
  res.json({ success: true });
});

// Profil Düzenleme API'si
app.post('/api/accounts/edit', (req, res) => {
  const { originalUsername, username, host, port, version, commands, broadcastMsg, broadcastInterval, loopCmds, loopInterval, loopDelay, autoRestartMins } = req.body;
  
  if (activeBots[originalUsername]) {
    return res.json({ success: false, error: 'Aktif botun ayarlarını değiştiremezsiniz. Önce bağlantıyı kesin.' });
  }

  const index = accounts.findIndex(acc => acc.username === originalUsername);
  if (index === -1) return res.json({ success: false, error: 'Hesap bulunamadı.' });

  if (username !== originalUsername && accounts.some(acc => acc.username === username)) {
    return res.json({ success: false, error: 'Bu kullanıcı adı başka bir hesapta kullanılıyor.' });
  }

  accounts[index] = {
    username, host,
    port: parseInt(port) || 25565,
    version: version || 'auto',
    commands: commands || '',
    broadcastMsg: broadcastMsg || '',
    broadcastInterval: parseInt(broadcastInterval) || 300,
    loopCmds: loopCmds || '',
    loopInterval: parseInt(loopInterval) || 300,
    loopDelay: parseInt(loopDelay) || 10,
    autoRestartMins: parseInt(autoRestartMins) || 0
  };

  saveAccounts(accounts);
  res.json({ success: true });
});

// Hesap Silme API'si
app.post('/api/accounts/delete', (req, res) => {
  try {
    const { username } = req.body;
    const active = activeBots[username];
    if (active) {
      clearBotTimers(active);
      if (active.instance) active.instance.quit();
      delete activeBots[username];
    }
    accounts = accounts.filter(acc => acc.username !== username);
    saveAccounts(accounts);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: 'Hesap silinirken hata: ' + err.message });
  }
});

// Chat Gönderme API'si
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

// Sandık / Menü Slot Tıklama API'si
app.post('/api/window/click', (req, res) => {
  const { username, slot } = req.body;
  const active = activeBots[username];
  if (active && active.instance && active.instance.currentWindow) {
    try {
      active.instance.clickWindow(slot, 0, 0);
      return res.json({ success: true });
    } catch (e) {
      return res.json({ success: false, error: e.message });
    }
  }
  res.json({ success: false, error: 'Açık menü bulunamadı.' });
});

// Saniyelik Durum Yayını (Güvenli Window Parse)
setInterval(() => {
  let statuses = {};
  accounts.forEach(acc => {
    const active = activeBots[acc.username];
    const isOnline = active && active.instance && active.instance.entity;
    
    let openWindow = null;
    if (isOnline && active.instance.currentWindow) {
      try {
        const w = active.instance.currentWindow;
        let titleText = 'Menü';
        if (w.title) {
          try {
            titleText = JSON.parse(w.title).text || w.title;
          } catch (e) {
            titleText = w.title.toString();
          }
        }
        openWindow = {
          title: titleText,
          slots: (w.slots || []).map((item, idx) => item ? { slot: idx, name: item.displayName, count: item.count } : null)
        };
      } catch (e) {
        openWindow = null;
      }
    }

    statuses[acc.username] = {
      online: isOnline,
      connecting: active ? active.connecting : false,
      host: acc.host,
      port: acc.port,
      version: acc.version || 'auto',
      commands: acc.commands || '',
      broadcastMsg: acc.broadcastMsg || '',
      broadcastInterval: acc.broadcastInterval || 300,
      hasAutoBroadcaster: acc.broadcastMsg && acc.broadcastMsg.trim() !== '',
      loopCmds: acc.loopCmds || (acc.loopCmd1 ? `${acc.loopCmd1}\n${acc.loopCmd2 || ''}` : ''),
      loopInterval: acc.loopInterval || 300,
      loopDelay: acc.loopDelay || 10,
      hasAutoLoop: acc.loopCmds && acc.loopCmds.trim() !== '',
      autoRestartMins: acc.autoRestartMins || 0,
      health: isOnline && active.instance.health !== undefined ? active.instance.health.toFixed(1) : '-',
      food: isOnline && active.instance.food !== undefined ? active.instance.food : '-',
      pos: isOnline ? { x: active.instance.entity.position.x.toFixed(1), y: active.instance.entity.position.y.toFixed(1), z: active.instance.entity.position.z.toFixed(1) } : { x: '-', y: '-', z: '-' },
      inventory: isOnline && active.instance.inventory ? active.instance.inventory.items().map(item => ({ slot: item.slot, name: item.displayName, count: item.count })) : [],
      openWindow: openWindow
    };
  });
  broadcast('status_all', { statuses });
}, 1000);

// Bot Kontrol API'si
app.post('/api/control', (req, res) => {
  const { username, action } = req.body;
  const acc = accounts.find(a => a.username === username);
  if (!acc) return res.json({ success: false });

  if (action === 'connect') {
    if (!activeBots[username]) {
      activeBots[username] = { instance: null, afkTimer: null, broadcastTimer: null, loopTimer: null, restartTimer: null, reconnectTimer: null, connecting: true, antiAfk: true, manualDisconnect: false };
      startBot(acc);
      res.json({ success: true });
    }
  } else if (action === 'disconnect') {
    const active = activeBots[username];
    if (active) {
      active.manualDisconnect = true;
      clearBotTimers(active);
      if (active.instance) active.instance.quit();
      delete activeBots[username];
      broadcast('chat', { bot: username, text: `[Sistem] Bağlantı el ile kesildi.` });
      res.json({ success: true });
    }
  } else if (action === 'toggle-afk') {
    const active = activeBots[username];
    if (active) {
      active.antiAfk = !active.antiAfk;
      broadcast('chat', { text: `[Sistem] Anti-AFK: ${active.antiAfk ? 'Aktif' : 'Pasif'}` });
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

// Toplu Kontrol API'si
app.post('/api/control-all', (req, res) => {
  const { action } = req.body;
  
  if (action === 'connect-all') {
    accounts.forEach((acc, index) => {
      setTimeout(() => {
        if (!activeBots[acc.username]) {
          activeBots[acc.username] = { instance: null, afkTimer: null, broadcastTimer: null, loopTimer: null, restartTimer: null, reconnectTimer: null, connecting: true, antiAfk: true, manualDisconnect: false };
          startBot(acc);
        }
      }, index * 2000);
    });
    res.json({ success: true });
  } else if (action === 'disconnect-all') {
    Object.keys(activeBots).forEach(usr => {
      const active = activeBots[usr];
      if (active) {
        active.manualDisconnect = true;
        clearBotTimers(active);
        if (active.instance) active.instance.quit();
      }
    });
    activeBots = {};
    res.json({ success: true });
  }
});

function clearBotTimers(active) {
  if (active.afkTimer) clearInterval(active.afkTimer);
  if (active.broadcastTimer) clearInterval(active.broadcastTimer);
  if (active.loopTimer) clearInterval(active.loopTimer);
  if (active.restartTimer) clearInterval(active.restartTimer);
  if (active.reconnectTimer) clearTimeout(active.reconnectTimer);
}

function startBot(acc) {
  const username = acc.username;
  broadcast('chat', { bot: username, text: `[Sistem] Sunucuya bağlanılıyor...` });

  const resolvedVersion = (acc.version && acc.version !== 'auto') ? acc.version : false;

  const botOptions = { 
    host: acc.host, 
    port: acc.port, 
    username: acc.username, 
    auth: 'offline', 
    viewDistance: 'tiny'
  };

  if (resolvedVersion) {
    botOptions.version = resolvedVersion;
  }
  
  const botInstance = mineflayer.createBot(botOptions);
  
  if (activeBots[username]) activeBots[username].instance = botInstance;

  botInstance.once('spawn', () => {
    if (activeBots[username]) activeBots[username].connecting = false;
    broadcast('chat', { bot: username, text: `[Sistem] Başarıyla oyuna girdi!` });

    // 1. Sıralı Giriş Komutları
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

    // 2. Reklam Otomasyonu
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

    // 3. Çoklu Döngü Komut Otomasyonu
    const loopRaw = acc.loopCmds || (acc.loopCmd1 ? `${acc.loopCmd1}\n${acc.loopCmd2 || ''}` : '');
    if (loopRaw && loopRaw.trim() !== '' && acc.loopInterval > 0) {
      if (activeBots[username].loopTimer) clearInterval(activeBots[username].loopTimer);

      const loopLines = loopRaw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const interDelay = (acc.loopDelay || 10) * 1000;

      activeBots[username].loopTimer = setInterval(() => {
        const active = activeBots[username];
        if (active && active.instance && active.instance.entity) {
          loopLines.forEach((cmdLine, idx) => {
            setTimeout(() => {
              const innerActive = activeBots[username];
              if (innerActive && innerActive.instance && innerActive.instance.entity) {
                innerActive.instance.chat(cmdLine);
                broadcast('chat', { bot: username, text: `[Oto-Döngü]: ${cmdLine}` });
              }
            }, idx * interDelay);
          });
        }
      }, acc.loopInterval * 1000);
    }

    // 4. Periyodik Restart
    if (acc.autoRestartMins && acc.autoRestartMins > 0) {
      if (activeBots[username].restartTimer) clearInterval(activeBots[username].restartTimer);
      activeBots[username].restartTimer = setInterval(() => {
        const active = activeBots[username];
        if (active && active.instance) {
          broadcast('chat', { bot: username, text: `[Sistem] Periyodik zamanlayıcı doldu (${acc.autoRestartMins} dk). Yeniden başlatılıyor...` });
          active.instance.quit();
        }
      }, acc.autoRestartMins * 60 * 1000);
    }

    // Anti-AFK
    const afkTimer = setInterval(() => {
      const active = activeBots[username];
      if (!active || !active.instance || !active.instance.entity || !active.antiAfk) return;
      
      const actions = [
        () => { active.instance.setControlState('jump', true); setTimeout(() => { if (active.instance) active.instance.setControlState('jump', false); }, 400); },
        () => { const yaw = active.instance.entity.yaw + (Math.random() - 0.5) * 1.5; const pitch = (Math.random() - 0.5) * 0.5; active.instance.look(yaw, pitch); },
        () => { active.instance.setControlState('sneak', true); setTimeout(() => { if (active.instance) active.instance.setControlState('sneak', false); }, 600); },
        () => {
          active.instance.setControlState('forward', true);
          setTimeout(() => {
            if (active.instance) {
              active.instance.setControlState('forward', false);
              active.instance.setControlState('back', true);
              setTimeout(() => { if (active.instance) active.instance.setControlState('back', false); }, 300);
            }
          }, 300);
        }
      ];
      actions[Math.floor(Math.random() * actions.length)]();
    }, 25000 + Math.random() * 10000);

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
    broadcast('chat', { bot: username, text: `[Sistem] Bağlantısı koptu: ${reason}` });
    const active = activeBots[username];
    if (active) clearBotTimers(active);
    
    if (active && !active.manualDisconnect) {
      active.connecting = true;
      broadcast('chat', { bot: username, text: `[Sistem] 8s içinde otomatik yeniden bağlanacak...` });
      active.reconnectTimer = setTimeout(() => { startBot(acc); }, 8000);
    } else {
      delete activeBots[username];
    }
  });

  botInstance.on('error', (err) => {
    broadcast('chat', { bot: username, text: `[Hata] ${err.message}` });
  });
}

app.listen(PORT, '127.0.0.1');

function createWindow() {
  win = new BrowserWindow({
    width: 1240,
    height: 820,
    title: "Lunke Bot - Multi AFK Client",
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'views', 'icon.ico'),
    webPreferences: { nodeIntegration: false }
  });

  win.loadURL(`http://127.0.0.1:${PORT}`);

  win.webContents.on('render-process-gone', (event, details) => {
    setTimeout(() => { if (win) win.reload(); }, 1000);
  });

  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
    return false;
  });
}

electronApp.whenReady().then(() => {
  createWindow();

  const iconPath = path.join(__dirname, 'views', 'icon.ico');
  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Göster / Aç', click: () => { win.show(); } },
    { type: 'separator' },
    { label: 'Kapat (Sonlandır)', click: () => { isQuitting = true; electronApp.quit(); } }
  ]);

  tray.setToolTip('Lunke Bot - AFK Client');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => { win.show(); });
});

electronApp.on('window-all-closed', () => {
  if (process.platform !== 'darwin') electronApp.quit();
});