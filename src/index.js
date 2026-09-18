const dns = require('node:dns');
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

const { Client, GatewayIntentBits, Partials, ActivityType } = require('discord.js');
require('dotenv').config();

const { startWebServer } = require('./server');
const { handleInteraction } = require('./handlers/ticketHandler');
const { deployCommands } = require('./deploy-commands');
const { getStockConfig, updateStockDashboard } = require('./services/stockService');
const { addKeysToPool } = require('./services/trialService');
const { handleMemberJoin, handleMemberLeave } = require('./services/welcomeService');
const { getSheetsConfig, fetchSheetsStock } = require('./services/sheetsService');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel, Partials.Message],
  rest: {
    api: process.env.DISCORD_API_PROXY || 'https://discord.com/api',
    timeout: 15000
  }
});

// ติดตามว่าบอทเคยต่อติดสำเร็จอย่างน้อย 1 ครั้งหรือไม่
let hasEverBeenReady = false;
global.lastLoginError = null;
global.debugLogs = [];

function addDebugLog(msg) {
  const time = new Date().toISOString().split('T')[1].slice(0, 8);
  global.debugLogs.push(`[${time}] ${msg}`);
  if (global.debugLogs.length > 30) global.debugLogs.shift();
  console.log(`[Debug] ${msg}`);
}

client.on('debug', (info) => {
  const safeInfo = typeof info === 'string' ? info.replace(/Bot\s+[A-Za-z0-9._-]+/g, 'Bot [REDACTED]') : String(info);
  addDebugLog(safeInfo);
});

if (client.rest) {
  client.rest.on('rateLimited', (info) => {
    addDebugLog(`⚠️ RATE_LIMITED: reset in ${info.timeToReset}ms, global: ${info.global}`);
  });
  client.rest.on('invalidRequestWarning', (info) => {
    addDebugLog(`⚠️ INVALID_REQ: count ${info.count}, remaining ${info.remainingTime}ms`);
  });
}

// ทดสอบการเชื่อมต่อไปยัง Discord API พร้อม Headers ให้ครบถ้วน
if (process.env.DISCORD_TOKEN) {
  fetch('https://discord.com/api/v10/gateway/bot', {
    headers: {
      'Authorization': `Bot ${process.env.DISCORD_TOKEN}`,
      'User-Agent': 'DiscordBot (https://github.com/ntw-crypto/discord_ticket, 1.0.0)'
    }
  })
    .then(async (r) => {
      const text = await r.text();
      addDebugLog(`Direct API Status ${r.status}: ${text.slice(0, 100).replace(/[\r\n]+/g, ' ')}`);
    })
    .catch((err) => {
      addDebugLog(`Direct API Fetch Error: ${err.message}`);
    });
}
client.on('warn', (warning) => {
  addDebugLog(`⚠️ Warn: ${warning}`);
});

if (client.rest) {
  client.rest.on('response', (request, response) => {
    addDebugLog(`REST: ${request.method} ${request.path} => HTTP ${response.status}`);
  });
}

// Event เมื่อบอทออนไลน์
client.once('ready', async () => {
  hasEverBeenReady = true;
  global.lastLoginError = null;
  addDebugLog(`🎉 บอทออนไลน์สำเร็จในชื่อ: ${client.user.tag}`);
  console.log(`🤖 บอทออนไลน์แล้วในชื่อ: ${client.user.tag}`);
  
  client.user.setActivity('ระบบ Ticket Support 🎫', { type: ActivityType.Watching });

  // อัปเดต Slash Commands อัตโนมัติเมื่อเริ่มระบบ (ถ้ามี token และ client id)
  if (process.env.DISCORD_TOKEN && process.env.CLIENT_ID) {
    try {
      await deployCommands();
    } catch (e) {
      console.warn('⚠️ ไม่สามารถลงทะเบียนคำสั่งอัตโนมัติได้:', e.message);
    }
  }
});

// Shard & Gateway Event Listeners เพื่อติดตามสถานะการเชื่อมต่อ
client.on('shardDisconnect', (event, shardId) => {
  addDebugLog(`⚠️ Shard ${shardId} Disconnected: Code ${event.code}`);
  console.warn(`⚠️ [Shard ${shardId}] บอทหลุดการเชื่อมต่อจาก Discord (Code: ${event.code}, Reason: ${event.reason || 'None'})`);
});

client.on('shardReconnecting', (shardId) => {
  addDebugLog(`🔄 Shard ${shardId} Reconnecting...`);
  console.log(`🔄 [Shard ${shardId}] กำลังพยายามเชื่อมต่อใหม่กับ Discord Gateway...`);
});

client.on('shardResume', (shardId, replayedEvents) => {
  addDebugLog(`✅ Shard ${shardId} Resumed (replayed: ${replayedEvents})`);
  console.log(`✅ [Shard ${shardId}] กู้คืน Session สำเร็จ (Replayed events: ${replayedEvents})`);
});

client.on('shardError', (error, shardId) => {
  addDebugLog(`❌ Shard ${shardId} Error: ${error.message}`);
  console.error(`❌ [Shard ${shardId} Error]:`, error.message);
});

client.on('error', (error) => {
  addDebugLog(`❌ Client Error: ${error.message}`);
  console.error(`❌ [Discord Client Error]:`, error.message);
});

// Event เมื่อมีการกดปุ่ม, คำสั่ง Slash Command, หรือ Dropdown
client.on('interactionCreate', async (interaction) => {
  try {
    await handleInteraction(interaction);
  } catch (error) {
    console.error('Interaction Error:', error);
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: '❌ มีข้อผิดพลาดเกิดขึ้นในระบบ!', ephemeral: true }).catch(() => {});
      } else {
        await interaction.reply({ content: '❌ มีข้อผิดพลาดเกิดขึ้นในระบบ!', ephemeral: true }).catch(() => {});
      }
    } catch (e) {}
  }
});

// Event แจ้งเตือนลูกค้าผ่าน DM เมื่อมีทีมงานตอบกลับในห้อง Ticket
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  const channel = message.channel;

  // ตรวจสอบข้อความที่พิมพ์ในห้องสต็อก Key เพื่อดึง Key เข้าคลังอัตโนมัติ
  const stockConfig = getStockConfig();
  if (stockConfig && channel.id === stockConfig.channelId) {
    const newKeys = [];

    // 1. ตรวจสอบข้อความธรรมดา
    if (message.content && message.content.trim().length > 0) {
      const lines = message.content
        .split(/[\r\n,]+/)
        .map(l => l.trim())
        .filter(l => l.length > 0 && !l.startsWith('#') && !l.startsWith('/'));
      newKeys.push(...lines);
    }

    // 2. ตรวจสอบไฟล์แนบ (.txt)
    if (message.attachments.size > 0) {
      for (const [, file] of message.attachments) {
        if (file.name.endsWith('.txt') || file.contentType?.includes('text')) {
          try {
            const resp = await fetch(file.url);
            if (resp.ok) {
              const text = await resp.text();
              const fileKeys = text
                .split(/[\r\n,]+/)
                .map(l => l.trim())
                .filter(l => l.length > 0 && !l.startsWith('#'));
              newKeys.push(...fileKeys);
            }
          } catch (e) {}
        }
      }
    }

    if (newKeys.length > 0) {
      const totalRemaining = addKeysToPool(newKeys);
      await message.react('✅').catch(() => {});
      await updateStockDashboard(client);

      const notice = await message.reply({
        content: `🎉 **ดึง Key เข้าคลังสำเร็จ!** เพิ่มเข้าคลัง **${newKeys.length}** คีย์ (ยอดคงเหลือทั้งหมด: **${totalRemaining}** คีย์)`
      }).catch(() => null);

      if (notice) {
        setTimeout(() => notice.delete().catch(() => {}), 6000);
      }
      return;
    }
  }

  // ตรวจสอบว่าเป็นห้อง Ticket หรือไม่
  if (channel.name && (channel.name.startsWith('ticket-') || channel.name.includes('ticket') || channel.name.startsWith('🎫'))) {
    if (channel.topic && channel.topic.includes('owner:')) {
      const match = channel.topic.match(/owner:(\d+)/);
      if (match) {
        const ownerId = match[1];

        // ถ้าคนที่พิมพ์ไม่ใช่เจ้าของ Ticket (คือแอดมินหรือคนอื่น) ให้ส่ง DM สะกิดเจ้าของห้อง
        if (message.author.id !== ownerId) {
          try {
            const owner = await client.users.fetch(ownerId);
            if (owner) {
              const dmEmbed = {
                title: '💬 ทีมงานได้ตอบกลับในห้อง Ticket ของคุณแล้ว!',
                description: `มีข้อความใหม่จาก **${message.author.tag}** ในห้อง <#${channel.id}>:\n\n> "${message.content ? (message.content.slice(0, 150) + (message.content.length > 150 ? '...' : '')) : '[ส่งไฟล์แนบ/รูปภาพ]'}"`,
                color: 0xD4AF37,
                timestamp: new Date().toISOString()
              };

              await owner.send({ embeds: [dmEmbed] }).catch(() => {});
            }
          } catch (e) {}
        }
      }
    }
  }
});

// Event เมื่อมีสมาชิกใหม่เข้าเซิร์ฟเวอร์ (แจ้งเตือนคนเข้า + แจกยศเริ่มต้น)
client.on('guildMemberAdd', async (member) => {
  try {
    await handleMemberJoin(member);
  } catch (error) {
    console.error('Error in guildMemberAdd handler:', error);
  }
});

// Event เมื่อมีสมาชิกออกจากเซิร์ฟเวอร์ (แจ้งเตือนคนออก)
client.on('guildMemberRemove', async (member) => {
  try {
    await handleMemberLeave(member);
  } catch (error) {
    console.error('Error in guildMemberRemove handler:', error);
  }
});

// ตรวจสอบการเปลี่ยนแปลงของคีย์ใน Google Sheets เป็นระยะ เพื่ออัปเดตแดชบอร์ดอัตโนมัติ
let lastKnownSheetsSignature = null;
setInterval(async () => {
  try {
    const isReady = Boolean(client && client.isReady && client.isReady());
    if (!isReady) return;

    const sheetsConfig = getSheetsConfig();
    if (!sheetsConfig || !sheetsConfig.webAppUrl) return;

    const stock = await fetchSheetsStock();
    if (stock && stock.success) {
      const signature = `${stock.available}_${stock.claimed}_${(stock.availableKeys || []).join(',')}`;
      if (lastKnownSheetsSignature !== null && lastKnownSheetsSignature !== signature) {
        console.log('[GoogleSheets Auto-Sync] ตรวจพบข้อมูลในชีตเปลี่ยนแปลง สั่งอัปเดตแดชบอร์ด...');
        await updateStockDashboard(client);
      }
      lastKnownSheetsSignature = signature;
    }
  } catch (err) {
    // ละเว้น error เพื่อไม่ให้กระทบ loop
  }
}, 30000); // ตรวจสอบทุก 30 วินาที

// Gateway Watchdog ป้องกัน Zombie Connection (ทำงานเฉพาะเมื่อบอทเคยต่อติดสำเร็จแล้วเท่านั้น)
let staleGatewayCount = 0;
let stalePingCount = 0;

setInterval(() => {
  // หากยังไม่เคยต่อติดสำเร็จมาก่อน จะไม่บังคับปิดโปรเซส เพื่อให้ดูค่า error / diagnostics ได้
  if (!hasEverBeenReady) return;

  const wsStatus = client.ws?.status;
  const ping = client.ws?.ping;

  // 1. ตรวจสอบสถานะ WebSocket: 0 = READY
  if (wsStatus !== 0) {
    staleGatewayCount++;
    console.warn(`⚠️ [Watchdog] ตรวจพบ Gateway status = ${wsStatus} (${staleGatewayCount}/3 ครั้ง)`);
    if (staleGatewayCount >= 3) {
      console.error('🚨 [Watchdog] Gateway หลุดการเชื่อมต่อนานเกิน 90 วินาที! สั่ง Restart Process ให้ Render กู้คืนใหม่อัตโนมัติ...');
      process.exit(1);
    }
  } else {
    staleGatewayCount = 0;

    // 2. ตรวจสอบ Zombie Ping (Ping ค้างเป็นลบ หรือ NaN)
    if (typeof ping !== 'number' || ping < 0 || isNaN(ping)) {
      stalePingCount++;
      console.warn(`⚠️ [Watchdog] ตรวจพบ Ping ค้าง/ผิดปกติ (${ping}ms) (${stalePingCount}/4 ครั้ง)`);
      if (stalePingCount >= 4) {
        console.error('🚨 [Watchdog] ตรวจพบ Zombie Connection ค้าง! สั่ง Restart Process เพื่อเชื่อมต่อใหม่...');
        process.exit(1);
      }
    } else {
      stalePingCount = 0;
    }
  }
}, 30000);

// ป้องกัน Process Crash จาก Error ที่ไม่คาดคิด
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ [Unhandled Rejection]:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('❌ [Uncaught Exception]:', err);
});

// เริ่ม Express Web Server
startWebServer(client);

// Login เข้าสู่ Discord
if (!process.env.DISCORD_TOKEN || process.env.DISCORD_TOKEN === 'your_bot_token_here') {
  global.lastLoginError = 'DISCORD_TOKEN is missing or default in environment variables!';
  addDebugLog('⚠️ DISCORD_TOKEN is missing or default in environment variables!');
  console.error('⚠️ [แจ้งเตือน] ยังไม่ได้ใส่ DISCORD_TOKEN ใน Environment Variables ของ Render');
} else {
  addDebugLog('🔑 Starting client.login()...');
  client.login(process.env.DISCORD_TOKEN).then(() => {
    addDebugLog('✅ client.login() resolved successfully!');
  }).catch((err) => {
    global.lastLoginError = err.message;
    addDebugLog(`❌ client.login() failed: ${err.message}`);
    console.error('❌ ไม่สามารถเชื่อมต่อกับ Discord ได้:', err.message);
  });
}
