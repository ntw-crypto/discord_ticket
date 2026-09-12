const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
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
    )
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

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
