const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

const dataDir = path.join(__dirname, '../../data');
const welcomeConfigPath = path.join(dataDir, 'welcome_config.json');

// ตรวจสอบและสร้างโฟลเดอร์ data
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// แคชเก็บรายการลิงก์เชิญของแต่ละกิลด์ (Guild ID -> Map(Invite Code -> Uses))
const guildInvitesCache = new Map();

/**
 * โหลดและบันทึกลิงก์เชิญทั้งหมดของกิลด์ลงในแคช
 * @param {import('discord.js').Guild} guild 
 */
async function cacheGuildInvites(guild) {
  if (!guild || !guild.invites) return;
  try {
    const invites = await guild.invites.fetch().catch(() => null);
    if (!invites) return;

    const codeUsesMap = new Map();
    invites.forEach(inv => {
      codeUsesMap.set(inv.code, inv.uses || 0);
    });
    guildInvitesCache.set(guild.id, codeUsesMap);
  } catch (err) {
    // บอทอาจไม่มีสิทธิ์ ManageGuild (จัดการเซิร์ฟเวอร์)
  }
}

/**
 * เริ่มต้นระบบแคช Invite สำหรับทุกกิลด์ที่บอทอยู่
 * @param {import('discord.js').Client} client 
 */
async function initInviteTracker(client) {
  try {
    for (const guild of client.guilds.cache.values()) {
      await cacheGuildInvites(guild);
    }
    console.log(`[InviteTracker] ✅ แคชลิงก์เชิญสำเร็จสำหรับ ${guildInvitesCache.size} เซิร์ฟเวอร์`);
  } catch (err) {
    console.warn('[InviteTracker] ⚠️ เกิดข้อผิดพลาดในการโหลดแคช Invite:', err.message);
  }
}

/**
 * อัปเดตแคชเมื่อมีคนสร้างลิงก์เชิญใหม่
 * @param {import('discord.js').Invite} invite 
 */
function updateInviteCache(invite) {
  if (!invite || !invite.guild) return;
  const cache = guildInvitesCache.get(invite.guild.id) || new Map();
  cache.set(invite.code, invite.uses || 0);
  guildInvitesCache.set(invite.guild.id, cache);
}

/**
 * ลบแคชเมื่อลิงก์เชิญถูกลบหรือหมดอายุ
 * @param {import('discord.js').Invite} invite 
 */
function deleteInviteCache(invite) {
  if (!invite || !invite.guild) return;
  const cache = guildInvitesCache.get(invite.guild.id);
  if (cache) cache.delete(invite.code);
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
 * จัดการเมื่อมีสมาชิกใหม่เข้าสู่เซิร์ฟเวอร์ (Admin Join Audit Log)
 * @param {import('discord.js').GuildMember} member 
 */
async function handleMemberJoin(member) {
  if (!member.guild) return;

  const config = getWelcomeConfig(member.guild.id);
  if (!config) return;

  // 1. แจกยศเริ่มต้นอัตโนมัติ (Auto-Role)
  let autoRoleGiven = false;
  if (config.autoRoleId) {
    try {
      const role = member.guild.roles.cache.get(config.autoRoleId) ||
        await member.guild.roles.fetch(config.autoRoleId).catch(() => null);

      if (role) {
        await member.roles.add(role);
        autoRoleGiven = true;
        console.log(`[Auto-Role] ✅ มอบยศ "${role.name}" ให้กับ ${member.user?.tag || member.id} สำเร็จ`);
      } else {
        console.warn(`[Auto-Role] ⚠️ ไม่พบยศ ID: ${config.autoRoleId} ในเซิร์ฟเวอร์`);
      }
    } catch (roleErr) {
      console.error(`[Auto-Role] ❌ ไม่สามารถมอบยศได้ (สิทธิ์บอทอาจต่ำกว่ายศเป้าหมาย):`, roleErr.message);
    }
  }

  // 2. ตรวจสอบว่าสมาชิกเข้าผ่านลิงก์เชิญไหน (Invite Tracker)
  let usedInvite = null;
  let isVanity = false;

  try {
    const cachedInvites = guildInvitesCache.get(member.guild.id);
    const currentInvites = await member.guild.invites.fetch().catch(() => null);

    if (currentInvites) {
      if (cachedInvites) {
        for (const [code, inv] of currentInvites) {
          const oldUses = cachedInvites.get(code) || 0;
          if (inv.uses > oldUses) {
            usedInvite = inv;
            break;
          }
        }
      }

      // ซิงค์แคชให้เป็นปัจจุบัน
      const updatedMap = new Map();
      currentInvites.forEach(inv => updatedMap.set(inv.code, inv.uses || 0));
      guildInvitesCache.set(member.guild.id, updatedMap);
    }

    // ตรวจสอบ Vanity URL หากยังไม่พบ Invite ปกติ
    if (!usedInvite && member.guild.vanityURLCode) {
      const vanityData = await member.guild.fetchVanityData().catch(() => null);
      if (vanityData) {
        isVanity = true;
      }
    }
  } catch (err) {
    console.warn('[InviteTracker] ไม่สามารถดึงข้อมูล Invite ได้:', err.message);
  }

  // 3. ส่งข้อความแจ้งเตือนคนเข้าสู่ห้องหลังบ้านแอดมิน
  if (config.joinChannelId) {
    try {
      const channel = member.guild.channels.cache.get(config.joinChannelId) ||
        await member.guild.channels.fetch(config.joinChannelId).catch(() => null);

      if (channel && channel.isTextBased()) {
        const createdTimestamp = Math.floor(member.user.createdTimestamp / 1000);
        const joinedTimestamp = Math.floor((member.joinedTimestamp || Date.now()) / 1000);
        const accountAgeMs = Date.now() - member.user.createdTimestamp;
        const accountAgeDays = Math.floor(accountAgeMs / (1000 * 60 * 60 * 24));
        const isNewAccount = accountAgeDays < 7;

        // จัดรูปแบบข้อมูล Invite
        let inviteText = '';
        if (usedInvite) {
          const inviterMention = usedInvite.inviter
            ? `<@${usedInvite.inviter.id}> (\`${usedInvite.inviter.tag || usedInvite.inviter.username}\`)`
            : '*ไม่ทราบผู้เชิญ*';
          inviteText = 
            `> 🎟️ **ลิงก์เชิญ**: \`https://discord.gg/${usedInvite.code}\`\n` +
            `> 👤 **ผู้สร้างลิงก์**: ${inviterMention}\n` +
            `> 📈 **ยอดใช้งานลิงก์นี้**: \`${usedInvite.uses}\` ครั้ง`;
        } else if (isVanity) {
          inviteText = `> 🌟 **เข้าผ่าน**: ลิงก์ Vanity URL ของเซิร์ฟเวอร์ (\`discord.gg/${member.guild.vanityURLCode}\`)`;
        } else {
          inviteText = `> ❓ **ไม่พบข้อมูลลิงก์**: *(อาจเข้าจาก Widget, ลิงก์แบบใช้ครั้งเดียว หรือบอทไม่มีสิทธิ์ Manage Guild)*`;
        }

        // สถานะความปลอดภัยของบัญชี
        const accountRiskText = isNewAccount
          ? `> ⚠️ **คำเตือนความปลอดภัย**: **บัญชีเพิ่งสร้างใหม่ (${accountAgeDays} วัน)!** กรุณาระวังแอคหลุม/บอทป่วน`
          : `> ✅ **สถานะบัญชี**: บัญชีปกติ (สร้างมาแล้ว \`${accountAgeDays}\` วัน)`;

        const joinEmbed = new EmbedBuilder()
          .setTitle('📥 สมาชิกใหม่เข้าร่วมเซิร์ฟเวอร์ (Member Joined)')
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
          .setColor(isNewAccount ? '#E67E22' : '#2ECC71')
          .addFields(
            {
              name: '👤 ข้อมูลสมาชิก',
              value: `> 🏷️ **ชื่อ**: <@${member.id}> (\`${member.user.tag || member.user.username}\`)\n` +
                     `> 🆔 **User ID**: \`${member.id}\`\n` +
                     `> 🤖 **ประเภท**: ${member.user.bot ? 'บอท (Bot)' : 'ผู้ใช้ทั่วไป (User)'}`,
              inline: false
            },
            {
              name: '🔗 ช่องทางการเข้า (Invite Tracker)',
              value: inviteText,
              inline: false
            },
            {
              name: '📅 ข้อมูลบัญชี Discord',
              value: `> 🎂 **วันที่สมัคร**: <t:${createdTimestamp}:F> (<t:${createdTimestamp}:R>)\n${accountRiskText}`,
              inline: false
            },
            {
              name: '📊 สถิติในเซิร์ฟเวอร์',
              value: `> 👥 **สมาชิกลำดับที่**: \`#${member.guild.memberCount}\` คน\n` +
                     (config.autoRoleId ? `> 🎖️ **ยศเริ่มต้น**: <@&${config.autoRoleId}> ${autoRoleGiven ? '(มอบสำเร็จ ✅)' : '(มอบไม่สำเร็จ ❌)'}\n` : '') +
                     `> ⏰ **เวลาที่เข้าร่วม**: <t:${joinedTimestamp}:F> (<t:${joinedTimestamp}:R>)`,
              inline: false
            }
          )
          .setFooter({ 
            text: `User ID: ${member.id} • CookieRunX Admin Security Log`,
            iconURL: member.guild.iconURL({ dynamic: true }) || undefined
          })
          .setTimestamp();

        await channel.send({ embeds: [joinEmbed] });
      }
    } catch (msgErr) {
      console.error('[Welcome] ❌ ส่งข้อความคนเข้าไม่สำเร็จ:', msgErr.message);
    }
  }
}

/**
 * จัดการเมื่อมีสมาชิกออกจากเซิร์ฟเวอร์ (Admin Leave Audit Log)
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
      const user = member.user;
      const username = user?.tag || user?.username || member.displayName || 'สมาชิก';
      const userId = member.id;
      const joinedAtMs = member.joinedTimestamp;
      const joinedTimestamp = joinedAtMs ? Math.floor(joinedAtMs / 1000) : null;
      const leftTimestamp = Math.floor(Date.now() / 1000);

      let stayDurationText = 'ไม่สามารถระบุได้';
      if (joinedAtMs) {
        const durationMs = Date.now() - joinedAtMs;
        const days = Math.floor(durationMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((durationMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

        const parts = [];
        if (days > 0) parts.push(`${days} วัน`);
        if (hours > 0) parts.push(`${hours} ชั่วโมง`);
        if (minutes > 0 || parts.length === 0) parts.push(`${minutes} นาที`);
        stayDurationText = parts.join(' ');
      }

      // ดึงยศที่เคยมีก่อนออก (ไม่รวม @everyone)
      const roles = member.roles?.cache
        ? member.roles.cache.filter(r => r.id !== member.guild.id).map(r => `<@&${r.id}>`)
        : [];
      const rolesText = roles.length > 0 ? roles.join(', ') : '*(ไม่มียศพิเศษ)*';

      const avatarUrl = user 
        ? user.displayAvatarURL({ dynamic: true, size: 256 }) 
        : member.guild.iconURL({ dynamic: true });

      const leaveEmbed = new EmbedBuilder()
        .setTitle('📤 สมาชิกออกจากเซิร์ฟเวอร์ (Member Left)')
        .setThumbnail(avatarUrl)
        .setColor('#E74C3C')
        .addFields(
          {
            name: '👤 ข้อมูลสมาชิก',
            value: `> 🏷️ **ชื่อ**: <@${userId}> (\`${username}\`)\n` +
                   `> 🆔 **User ID**: \`${userId}\`\n` +
                   `> 🤖 **ประเภท**: ${user?.bot ? 'บอท (Bot)' : 'ผู้ใช้ทั่วไป (User)'}`,
            inline: false
          },
          {
            name: '⏰ ระยะเวลาที่เคยอยู่ในเซิร์ฟเวอร์',
            value: `> 📥 **เข้าร่วมเมื่อ**: ${joinedTimestamp ? `<t:${joinedTimestamp}:F> (<t:${joinedTimestamp}:R>)` : 'ไม่ทราบข้อมูล'}\n` +
                   `> ⏳ **อยู่มานานทั้งหมด**: \`${stayDurationText}\`\n` +
                   `> 🚪 **เวลาที่ออก**: <t:${leftTimestamp}:F> (<t:${leftTimestamp}:R>)`,
            inline: false
          },
          {
            name: '🏷️ ยศที่เคยมีก่อนออก',
            value: `> ${rolesText}`,
            inline: false
          },
          {
            name: '👥 สมาชิกคงเหลือในเซิร์ฟเวอร์',
            value: `> ปัจจุบันคงเหลือ \`${member.guild.memberCount}\` คน`,
            inline: false
          }
        )
        .setFooter({
          text: `User ID: ${userId} • CookieRunX Admin Security Log`,
          iconURL: member.guild.iconURL({ dynamic: true }) || undefined
        })
        .setTimestamp();

      await channel.send({ embeds: [leaveEmbed] });
    }
  } catch (msgErr) {
    console.error('[Leave] ❌ ส่งข้อความคนออกไม่สำเร็จ:', msgErr.message);
  }
}

module.exports = {
  getWelcomeConfig,
  saveWelcomeConfig,
  handleMemberJoin,
  handleMemberLeave,
  initInviteTracker,
  updateInviteCache,
  deleteInviteCache
};
