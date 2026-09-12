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

// Event เมื่อมีการกดปุ่ม, คำสั่ง Slash Command, หรือ Dropdown
client.on('interactionCreate', async (interaction) => {
  try {
    await handleInteraction(interaction);
  } catch (error) {
    console.error('Interaction Error:', error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: '❌ มีข้อผิดพลาดเกิดขึ้นในระบบ!', ephemeral: true }).catch(() => {});
    } else {
      await interaction.reply({ content: '❌ มีข้อผิดพลาดเกิดขึ้นในระบบ!', ephemeral: true }).catch(() => {});
    }
  }
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
