const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
require('dotenv').config();

const commands = [
  new SlashCommandBuilder()
    .setName('setup-ticket')
    .setDescription('ส่งกล่องเปิด Ticket เข้าสู่ห้องนี้ (เฉพาะแอดมิน)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('close-ticket')
    .setDescription('ปิด Ticket ปัจจุบัน')
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
