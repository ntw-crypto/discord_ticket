const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
require('dotenv').config();

const commands = [
  new SlashCommandBuilder()
    .setName('setup-ticket')
    .setDescription('ส่งกล่องเปิด Ticket เข้าสู่ห้องนี้ (เฉพาะแอดมิน)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('close-ticket')
    .setDescription('ปิด Ticket ปัจจุบัน'),
  new SlashCommandBuilder()
    .setName('say')
    .setDescription('สั่งให้บอทส่งข้อความแทนเรา (เฉพาะทีมงาน/แอดมิน)')
    .addStringOption(option =>
      option.setName('message')
        .setDescription('ข้อความที่ต้องการให้บอทพิมพ์แทน')
        .setRequired(true)
    )
    .addAttachmentOption(option =>
      option.setName('attachment')
        .setDescription('แนบรูปภาพหรือไฟล์ (ถ้ามี)')
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('say-embed')
    .setDescription('สั่งให้บอทส่งข้อความแบบการ์ด Embed สวยหรูแทนเรา')
    .addStringOption(option =>
      option.setName('message')
        .setDescription('ข้อความในการ์ด Embed')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('title')
        .setDescription('หัวข้อการ์ด (Title)')
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('setup-role')
    .setDescription('ส่งการ์ดปุ่มกดรับยศด้วยตัวเอง (เฉพาะแอดมิน)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('ยศที่ต้องการให้สมาชิกกดรับ')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('title')
        .setDescription('หัวข้อการ์ด (ไม่ใส่จะมีค่าเริ่มต้น)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('description')
        .setDescription('คำอธิบาย (ไม่ใส่จะมีค่าเริ่มต้น)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('button-label')
        .setDescription('ข้อความบนปุ่มกด (เช่น กดรับยศสมาชิก)')
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('trial')
    .setDescription('🎁 กดรับ License Key ทดลองใช้งานบอท CookieRun ฟรี 7 วัน (1 บัญชีต่อ 1 สิทธิ์)'),
  new SlashCommandBuilder()
    .setName('setup-trial')
    .setDescription('ส่งการ์ดปุ่มกดรับ Key ทดลองใช้ฟรีเข้าห้องนี้ (เฉพาะแอดมิน)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addRoleOption(option =>
      option.setName('required-role')
        .setDescription('กำหนดยศที่ต้องมีถึงจะกดรับ Key ได้ (หากไม่ระบุ ใครก็กดรับได้)')
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('broadcast')
    .setDescription('📢 ส่งข้อความประกาศหาลูกค้า/สมาชิกทุกคนทาง DM (เฉพาะแอดมิน)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('message')
        .setDescription('ข้อความที่ต้องการบรอดแคสต์ส่งถึงทุกคน')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('title')
        .setDescription('หัวข้อประกาศ (ไม่ระบุจะมีค่าเริ่มต้น)')
        .setRequired(false)
    )
    .addRoleOption(option =>
      option.setName('target-role')
        .setDescription('ส่งเฉพาะคนที่มียศนี้ (หากไม่ระบุจะส่งหาสมาชิกทุกคนในเซิร์ฟเวอร์)')
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('setup-stock')
    .setDescription('📦 ส่งการ์ดแดชบอร์ดสรุปคลัง Key ในห้องนี้ และตั้งเป็นห้องเติม Key อัตโนมัติ (เฉพาะแอดมิน)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('setup-welcome')
    .setDescription('🎉 ตั้งค่าระบบแจ้งเตือนคนเข้า-ออก และแจกยศเริ่มต้นอัตโนมัติ (เฉพาะแอดมิน)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
      option.setName('join-channel')
        .setDescription('ห้องสำหรับแจ้งเตือนเมื่อมีคนเข้าเซิร์ฟเวอร์')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addChannelOption(option =>
      option.setName('leave-channel')
        .setDescription('ห้องสำหรับแจ้งเตือนเมื่อมีคนออกจากเซิร์ฟเวอร์')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addRoleOption(option =>
      option.setName('auto-role')
        .setDescription('ยศเริ่มต้นที่จะแจกให้สมาชิกใหม่อัตโนมัติ (ไม่ระบุก็ได้)')
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('setup-sheets')
    .setDescription('📊 เชื่อมต่อคลัง Key กับ Google Sheets Web App (เฉพาะแอดมิน)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('url')
        .setDescription('URL ของ Google Apps Script Web App (https://script.google.com/macros/s/.../exec)')
        .setRequired(true)
    )
].map(command => command.toJSON());

const restOptions = { version: '10' };
if (process.env.DISCORD_API_PROXY) {
  restOptions.api = process.env.DISCORD_API_PROXY;
}
const rest = new REST(restOptions).setToken(process.env.DISCORD_TOKEN);

async function deployCommands() {
  try {
    console.log('กำลังลงทะเบียน Slash Commands เข้า Discord...');

    if (process.env.GUILD_ID) {
      // ลงทะเบียนเฉพาะ Guild ทันที (ไม่ต้องรอแคชทั่วโลก)
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: commands },
      );
      console.log('✅ ลงทะเบียน Slash Commands เฉพาะ Guild สำเร็จเรียบร้อย!');
    } else {
      // ลงทะเบียนแบบ Global
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands },
      );
      console.log('✅ ลงทะเบียน Slash Commands ทั่วโลก (Global) สำเร็จเรียบร้อย!');
    }
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในการลงทะเบียนคำสั่ง:', error);
  }
}

if (require.main === module) {
  deployCommands();
}

module.exports = { deployCommands };
