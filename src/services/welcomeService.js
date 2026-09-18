const fs = require('fs');
const path = require('path');
const { AttachmentBuilder } = require('discord.js');
const { generateWelcomeCard } = require('./canvasWelcomeService');

const dataDir = path.join(__dirname, '../../data');
const welcomeConfigPath = path.join(dataDir, 'welcome_config.json');

// ตรวจสอบและสร้างโฟลเดอร์ data
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

/**
 * ดึงค่าการตั้งค่าระบบต้อนรับของ Guild
 * @param {string} guildId 
 * @returns {object|null}
 */
function getWelcomeConfig(guildId) {
  try {
    if (fs.existsSync(welcomeConfigPath)) {
      const data = JSON.parse(fs.readFileSync(welcomeConfigPath, 'utf-8'));
      if (guildId && data[guildId]) return data[guildId];
      if (data.joinChannelId || data.leaveChannelId) return data;
    }
  } catch (e) {
    console.error('Error reading welcome_config.json:', e);
  }
  return null;
}

/**
 * บันทึกค่าการตั้งค่าระบบต้อนรับของ Guild
 * @param {string} guildId 
 * @param {object} config 
 */
function saveWelcomeConfig(guildId, config) {
  try {
    let allConfigs = {};
    if (fs.existsSync(welcomeConfigPath)) {
      try {
        allConfigs = JSON.parse(fs.readFileSync(welcomeConfigPath, 'utf-8'));
      } catch (e) {
        allConfigs = {};
      }
    }
    allConfigs[guildId] = config;
    fs.writeFileSync(welcomeConfigPath, JSON.stringify(allConfigs, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving welcome_config.json:', e);
  }
}

/**
 * จัดการเมื่อมีสมาชิกใหม่เข้าสู่เซิร์ฟเวอร์
 * @param {import('discord.js').GuildMember} member 
 */
async function handleMemberJoin(member) {
  if (!member.guild) return;

  const config = getWelcomeConfig(member.guild.id);
  if (!config) return;

  // 1. แจกยศเริ่มต้นอัตโนมัติ (Auto-Role)
  if (config.autoRoleId) {
    try {
      const role = member.guild.roles.cache.get(config.autoRoleId) ||
        await member.guild.roles.fetch(config.autoRoleId).catch(() => null);

      if (role) {
        await member.roles.add(role);
        console.log(`[Auto-Role] ✅ มอบยศ "${role.name}" ให้กับ ${member.user?.tag || member.id} สำเร็จ`);
      } else {
        console.warn(`[Auto-Role] ⚠️ ไม่พบยศ ID: ${config.autoRoleId} ในเซิร์ฟเวอร์`);
      }
    } catch (roleErr) {
      console.error(`[Auto-Role] ❌ ไม่สามารถมอบยศได้ (สิทธิ์บอทอาจต่ำกว่ายศเป้าหมาย):`, roleErr.message);
    }
  }

  // 2. ส่งข้อความแจ้งเตือนคนเข้าพร้อมรูปการ์ดต้อนรับ
  if (config.joinChannelId) {
    try {
      const channel = member.guild.channels.cache.get(config.joinChannelId) ||
        await member.guild.channels.fetch(config.joinChannelId).catch(() => null);

      if (channel && channel.isTextBased()) {
        const username = member.user?.username || member.displayName || 'สมาชิกใหม่';
        const memberCount = member.guild.memberCount;
        const messageText = `🎉 ยินดีต้อนรับ <@${member.id}> เข้าสู่เซิร์ฟเวอร์!`;

        try {
          const imageBuffer = await generateWelcomeCard(member);
          const attachment = new AttachmentBuilder(imageBuffer, { name: 'welcome-card.png' });

          await channel.send({
            content: messageText,
            files: [attachment]
          });
        } catch (imgErr) {
          console.error('[WelcomeCard] ไม่สามารถสร้างรูปภาพการ์ดได้ ใช้ข้อความสำรองแทน:', imgErr.message);
          const fallbackText = `🎉 ยินดีต้อนรับ <@${member.id}> (\`${username}\`) เข้าสู่เซิร์ฟเวอร์! (สมาชิกลำดับที่ #${memberCount})`;
          await channel.send({ content: fallbackText });
        }
      }
    } catch (msgErr) {
      console.error('[Welcome] ❌ ส่งข้อความคนเข้าไม่สำเร็จ:', msgErr.message);
    }
  }
}

/**
 * จัดการเมื่อมีสมาชิกออกจากเซิร์ฟเวอร์
 * @param {import('discord.js').GuildMember} member 
 */
async function handleMemberLeave(member) {
  if (!member.guild) return;

  const config = getWelcomeConfig(member.guild.id);
  if (!config || !config.leaveChannelId) return;

  try {
    const channel = member.guild.channels.cache.get(config.leaveChannelId) ||
      await member.guild.channels.fetch(config.leaveChannelId).catch(() => null);

    if (channel && channel.isTextBased()) {
      const username = member.user?.username || member.displayName || 'สมาชิก';
      const memberCount = member.guild.memberCount;
      const messageText = `👋 **${username}** ได้ออกจากเซิร์ฟเวอร์แล้ว (สมาชิกคงเหลือ ${memberCount} คน)`;

      await channel.send({ content: messageText });
    }
  } catch (msgErr) {
    console.error('[Leave] ❌ ส่งข้อความคนออกไม่สำเร็จ:', msgErr.message);
  }
}

module.exports = {
  getWelcomeConfig,
  saveWelcomeConfig,
  handleMemberJoin,
  handleMemberLeave
};
