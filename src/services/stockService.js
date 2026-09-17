const fs = require('fs');
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getTrialKeysPool, getClaimedUsers, addKeysToPool } = require('./trialService');

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

  // รองรับกรณีระบุใน .env
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
 * สร้าง Embed สำหรับแดชบอร์ดสรุปคลัง Key แบบ Real-time
 */
function buildStockEmbed() {
  const pool = getTrialKeysPool();
  const claimed = getClaimedUsers();
  const claimedEntries = Object.entries(claimed);
  claimedEntries.sort((a, b) => new Date(b[1].claimedAt) - new Date(a[1].claimedAt));

  // แสดงตัวอย่าง Key ในคลัง
  let poolPreview = '⚠️ *คลังว่างเปล่า (ไม่มี Key พร้อมแจก พิมพ์ Key ลงในห้องนี้เพื่อเติมได้ทันที)*';
  if (pool.length > 0) {
    if (pool.length <= 15) {
      poolPreview = pool.map((k, i) => `${i + 1}. \`${k}\``).join('\n');
    } else {
      poolPreview = pool.slice(0, 15).map((k, i) => `${i + 1}. \`${k}\``).join('\n') + `\n*...และอีก ${pool.length - 15} คีย์ในระบบ*`;
    }
  }

  // แสดงประวัติคนที่รับล่าสุด 5 คน
  let claimedPreview = 'ℹ️ *ยังไม่มีสมาชิกกดรับ Key*';
  if (claimedEntries.length > 0) {
    const recent = claimedEntries.slice(0, 5);
    claimedPreview = recent.map(([userId, data], i) => {
      const timeSec = Math.floor(new Date(data.claimedAt).getTime() / 1000);
      return `${i + 1}. <@${userId}> ↳ ~~\`${data.key}\`~~ • <t:${timeSec}:R>`;
    }).join('\n');
  }

  const embed = new EmbedBuilder()
    .setTitle('📦 แดชบอร์ดสรุปสถานะคลัง License Key (CookieRunX)')
    .setDescription(
      `ห้องจัดการคลัง License Key อัตโนมัติ\n` +
      `> 📥 **วิธีเติม Key เข้าคลัง**: แอดมินสามารถพิมพ์ Key ลงในห้องนี้ หรือแนบไฟล์ \`.txt\` ได้เลย บอทจะดึงเข้าคลังและอัปเดตการ์ดนี้ทันที\n` +
      `> ⚡ **ระบบแจก**: เมื่อมีสมาชิกกดรับ Key บอทจะตัดออกจากคลังและขีดฆ่าแสดงในประวัติด้านล่างแบบ Real-time`
    )
    .addFields(
      {
        name: '📊 ภาพรวมคลัง',
        value: `>>> 🟢 **Key พร้อมแจก**: \`${pool.length}\` คีย์\n👥 **แจกไปแล้วทั้งหมด**: \`${claimedEntries.length}\` คน`,
        inline: false
      },
      {
        name: `🔑 รายชื่อ Key ในคลัง (${pool.length} คีย์)`,
        value: poolPreview,
        inline: false
      },
      {
        name: `📜 ประวัติสมาชิกที่รับไปล่าสุด (5 รายการ)`,
        value: claimedPreview,
        inline: false
      }
    )
    .setColor(pool.length > 0 ? '#2ECC71' : '#E74C3C')
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

    const embed = buildStockEmbed();
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
