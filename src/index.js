const { Client, GatewayIntentBits, Partials, ActivityType } = require('discord.js');
require('dotenv').config();

const { startWebServer } = require('./server');
const { handleInteraction } = require('./handlers/ticketHandler');
const { deployCommands } = require('./deploy-commands');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel, Partials.Message]
});

// Event เมื่อบอทออนไลน์
client.once('ready', async () => {
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
  console.warn(`⚠️ [Shard ${shardId}] บอทหลุดการเชื่อมต่อจาก Discord (Code: ${event.code}, Reason: ${event.reason || 'None'})`);
});

client.on('shardReconnecting', (shardId) => {
  console.log(`🔄 [Shard ${shardId}] กำลังพยายามเชื่อมต่อใหม่กับ Discord Gateway...`);
});

client.on('shardResume', (shardId, replayedEvents) => {
  console.log(`✅ [Shard ${shardId}] กู้คืน Session สำเร็จ (Replayed events: ${replayedEvents})`);
});

client.on('shardError', (error, shardId) => {
  console.error(`❌ [Shard ${shardId} Error]:`, error.message);
});

client.on('error', (error) => {
  console.error('❌ [Discord Client Error]:', error.message);
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
  // ตรวจสอบว่าเป็นห้อง Ticket หรือไม่
  if (channel.name && (channel.name.startsWith('ticket-') || channel.name.includes('ticket'))) {
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

// Gateway Watchdog ป้องกัน Zombie Connection (บอทขึ้นออนไลน์แต่ไม่ตอบสนอง)
let staleGatewayCount = 0;
let stalePingCount = 0;

setInterval(() => {
  // ไม่ตรวจสอบช่วง 60 วินาทีแรกที่บอทกำลังเริ่มต้น
  if (process.uptime() < 60) return;

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

// เริ่ม Express Web Server (สำหรับ Web Hosting / Uptime Monitor)
startWebServer(client);

// Login เข้าสู่ Discord
if (!process.env.DISCORD_TOKEN || process.env.DISCORD_TOKEN === 'your_bot_token_here') {
  console.log('⚠️ [แจ้งเตือน] ยังไม่ได้ใส่ DISCORD_TOKEN ในไฟล์ .env');
  console.log('👉 กรุณาสร้างไฟล์ .env โดยคัดลอกจาก .env.example แล้วใส่ Token ก่อนรัน');
} else {
  client.login(process.env.DISCORD_TOKEN).catch((err) => {
    console.error('❌ ไม่สามารถเชื่อมต่อกับ Discord ได้:', err.message);
  });
}
