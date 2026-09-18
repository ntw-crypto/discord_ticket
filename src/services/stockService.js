const fs = require('fs');
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getTrialKeysPool, getClaimedUsers, addKeysToPool } = require('./trialService');
const { getSheetsConfig, fetchSheetsStock } = require('./sheetsService');

const dataDir = path.join(__dirname, '../../data');
const stockConfigPath = path.join(dataDir, 'stock_config.json');

// ตรวจสอบและสร้างโฟลเดอร์ data
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function getStockConfig() {
  try {
    if (fs.existsSync(stockConfigPath)) {
      const data = JSON.parse(fs.readFileSync(stockConfigPath, 'utf-8'));
      if (data && data.channelId) return data;
    }
  } catch (e) {}

  if (process.env.TRIAL_KEYS_CHANNEL_ID) {
    return { channelId: process.env.TRIAL_KEYS_CHANNEL_ID, messageId: null };
  }
  return null;
}

function saveStockConfig(config) {
  try {
    fs.writeFileSync(stockConfigPath, JSON.stringify(config, null, 2), 'utf-8');
  } catch (e) {}
}

/**
 * สร้าง Embed สำหรับแดชบอร์ดสรุปคลัง Key แบบ Real-time (รองรับ Google Sheets)
 */
async function buildStockEmbed() {
  const sheetsConfig = getSheetsConfig();
  let isGoogleSheets = false;
  let availableCount = 0;
  let claimedCount = 0;
  let poolPreview = '';
  let claimedPreview = '';

  const claimed = getClaimedUsers();
  const claimedEntries = Object.entries(claimed);
  claimedEntries.sort((a, b) => new Date(b[1].claimedAt) - new Date(a[1].claimedAt));

  if (sheetsConfig && sheetsConfig.webAppUrl) {
    const sheetData = await fetchSheetsStock();
    if (sheetData && sheetData.success) {
      isGoogleSheets = true;
      availableCount = sheetData.available;
      claimedCount = sheetData.claimed;

      if (sheetData.availableKeys && sheetData.availableKeys.length > 0) {
        if (sheetData.availableKeys.length <= 15) {
          poolPreview = sheetData.availableKeys.map((k, i) => `${i + 1}. \`${k}\``).join('\n');
        } else {
          poolPreview = sheetData.availableKeys.slice(0, 15).map((k, i) => `${i + 1}. \`${k}\``).join('\n') +
            `\n*...และอีก ${sheetData.available - 15} คีย์ใน Google Sheet*`;
        }
      } else {
        poolPreview = '⚠️ *คลังใน Google Sheet ว่างเปล่า (เปิดชีตแล้วเพิ่มคีย์ในคอลัมน์ A ได้เลย)*';
      }
    }
  }

  // ถ้าไม่ได้ใช้ Google Sheets หรือเชื่อมต่อไม่ได้ ให้ใช้ข้อมูล Local Pool
  if (!isGoogleSheets) {
    const pool = getTrialKeysPool();
    availableCount = pool.length;
    claimedCount = claimedEntries.length;

    if (pool.length > 0) {
      if (pool.length <= 15) {
        poolPreview = pool.map((k, i) => `${i + 1}. \`${k}\``).join('\n');
      } else {
        poolPreview = pool.slice(0, 15).map((k, i) => `${i + 1}. \`${k}\``).join('\n') + `\n*...และอีก ${pool.length - 15} คีย์ในระบบ*`;
      }
    } else {
      poolPreview = '⚠️ *คลังว่างเปล่า (พิมพ์ Key ลงในห้องนี้เพื่อเติม หรือเชื่อมต่อ Google Sheets ด้วย /setup-sheets)*';
    }
  }

  // แสดงประวัติคนที่รับล่าสุด 5 คน
  if (claimedEntries.length > 0) {
    const recent = claimedEntries.slice(0, 5);
    claimedPreview = recent.map(([userId, data], i) => {
      const timeSec = Math.floor(new Date(data.claimedAt).getTime() / 1000);
      return `${i + 1}. <@${userId}> ↳ ~~\`${data.key}\`~~ • <t:${timeSec}:R>`;
    }).join('\n');
  } else {
    claimedPreview = 'ℹ️ *ยังไม่มีสมาชิกกดรับ Key*';
  }

  const storageSourceText = isGoogleSheets 
    ? '📊 **แหล่งข้อมูลคลัง**: 🟢 **Google Sheets** (ซิงค์อัตโนมัติ Real-time)'
    : '📊 **แหล่งข้อมูลคลัง**: 📁 **Local Storage** (บอทใน Discord)';

  const embed = new EmbedBuilder()
    .setTitle('📦 แดชบอร์ดสรุปสถานะคลัง License Key (CookieRunX)')
    .setDescription(
      `${storageSourceText}\n\n` +
      `> 📥 **การจัดการคีย์**: แอดมินสามารถเปิด Google Sheets เพื่อเพิ่ม/ลบ/แก้ไขคีย์ได้ตลอดเวลา หรือพิมพ์ Key ลงในห้องนี้\n` +
      `> ⚡ **ระบบแจก**: เมื่อมีสมาชิกกดรับ Key ระบบจะตัดยอดและบันทึกข้อมูลแบบ Real-time ทันที`
    )
    .addFields(
      {
        name: '📊 ภาพรวมคลัง',
        value: `>>> 🟢 **Key พร้อมแจก**: \`${availableCount}\` คีย์\n👥 **แจกไปแล้วทั้งหมด**: \`${claimedCount}\` คน`,
        inline: false
      },
      {
        name: `🔑 รายชื่อ Key ในคลัง (${availableCount} คีย์)`,
        value: poolPreview,
        inline: false
      },
      {
        name: `📜 ประวัติสมาชิกที่รับไปล่าสุด (5 รายการ)`,
        value: claimedPreview,
        inline: false
      }
    )
    .setColor(availableCount > 0 ? '#2ECC71' : '#E74C3C')
    .setFooter({ text: 'ระบบจัดการคลัง Key อัตโนมัติ • Real-time Sync' })
    .setTimestamp();

  return embed;
}

function buildStockActionRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_stock_refresh')
      .setLabel('รีเฟรชข้อมูล')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Secondary)
  );
}

/**
 * อัปเดตข้อความแดชบอร์ดในห้องสต็อกให้เป็นข้อมูลล่าสุด
 */
async function updateStockDashboard(client) {
  const config = getStockConfig();
  if (!config || !config.channelId) return false;

  try {
    const channel = client.channels.cache.get(config.channelId) || await client.channels.fetch(config.channelId).catch(() => null);
    if (!channel) return false;

    const embed = await buildStockEmbed();
    const row = buildStockActionRow();

    if (config.messageId) {
      const message = await channel.messages.fetch(config.messageId).catch(() => null);
      if (message) {
        await message.edit({ embeds: [embed], components: [row] });
        return true;
      }
    }

    // กรณีไม่มี messageId หรือหาข้อความเดิมไม่เจอ ให้ส่งข้อความใหม่และเซฟ
    const newMsg = await channel.send({ embeds: [embed], components: [row] });
    saveStockConfig({
      channelId: config.channelId,
      messageId: newMsg.id
    });
    return true;
  } catch (err) {
    console.error('Error updating stock dashboard:', err.message);
    return false;
  }
}

module.exports = {
  getStockConfig,
  saveStockConfig,
  buildStockEmbed,
  buildStockActionRow,
  updateStockDashboard
};
