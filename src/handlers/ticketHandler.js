const {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const discordTranscripts = require('discord-html-transcripts');
const config = require('../../config.json');

async function handleInteraction(interaction) {
  // 1. คำสั่ง Slash Commands
  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;

    if (commandName === 'setup-ticket') {
      // การ์ดเล็ก ข้อความสั้น กระชับ สไตล์คลีนหรูหรา
      const embed = new EmbedBuilder()
        .setTitle(config.embed.title)
        .setDescription(config.embed.description)
        .setColor(config.embed.color)
        .setFooter({ text: config.embed.footer });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_btn_create')
          .setLabel(config.button.label)
          .setEmoji(config.button.emoji)
          .setStyle(ButtonStyle.Primary)
      );

      await interaction.channel.send({
        embeds: [embed],
        components: [row]
      });

      return interaction.reply({
        content: '✅ ส่งการ์ด Ticket เรียบร้อยแล้ว!',
        ephemeral: true
      });
    }

    if (commandName === 'close-ticket') {
      return askCloseConfirmation(interaction);
    }
  }

  // 2. จัดการเมื่อกดปุ่ม (Buttons)
  if (interaction.isButton()) {
    const { customId, channel, user, guild } = interaction;

    // ปุ่มกดเปิด Ticket
    if (customId === 'ticket_btn_create') {
      await interaction.deferReply({ ephemeral: true });

      const safeUsername = (user.username || 'user').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 15) || 'user';
      
      // เช็คว่ามีห้องค้างอยู่ไหม
      const existingChannel = guild.channels.cache.find(c =>
        c.name.includes(`ticket-${safeUsername}`) &&
        c.type === ChannelType.GuildText
      );

      if (existingChannel) {
        return interaction.editReply({
          content: `⚠️ คุณมีห้อง Ticket เปิดอยู่แล้วที่: <#${existingChannel.id}>`
        });
      }

      try {
        const staffRoleId = process.env.STAFF_ROLE_ID;
        const permissionOverwrites = [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks
            ]
          }
        ];

        // ตรวจสอบว่ามี role นี้จริงในเซิร์ฟเวอร์หรือไม่
        if (staffRoleId) {
          const staffRole = guild.roles.cache.get(staffRoleId);
          if (staffRole) {
            permissionOverwrites.push({
              id: staffRole.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageMessages
              ]
            });
          } else {
            console.warn(`[Ticket] Staff Role ID "${staffRoleId}" ไม่พบในเซิร์ฟเวอร์ ข้ามการเพิ่มสิทธิ์ยศนี้`);
          }
        }

        // ตรวจสอบ Parent Category
        let parentCategoryId = process.env.TICKET_CATEGORY_ID;
        if (parentCategoryId) {
          const cat = guild.channels.cache.get(parentCategoryId);
          if (!cat || cat.type !== ChannelType.GuildCategory) {
            parentCategoryId = null;
          }
        }

        const channelName = `ticket-${safeUsername}-${Date.now().toString().slice(-4)}`;

        const ticketChannel = await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: parentCategoryId || null,
          permissionOverwrites: permissionOverwrites
        });

        // ข้อความสั้น กระชับในห้อง Ticket
        const welcomeEmbed = new EmbedBuilder()
          .setTitle('🎫 ติดต่อทีมงาน')
          .setDescription(`สวัสดีคุณ <@${user.id}>\nกรุณาแจ้งรายละเอียดที่ต้องการติดต่อไว้ได้เลยครับ ทีมงานจะรีบเข้ามาดูแลโดยเร็วที่สุด ✨`)
          .setColor('#D4AF37')
          .setFooter({ text: 'CookieRunX Support' })
          .setTimestamp();

        const actionRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('ticket_btn_close')
            .setLabel('ปิด Ticket')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('ticket_btn_transcript')
            .setLabel('บันทึกประวัติ')
            .setEmoji('📜')
            .setStyle(ButtonStyle.Secondary)
        );

        await ticketChannel.send({
          content: `<@${user.id}> ${staffRoleId ? `| <@&${staffRoleId}>` : ''}`,
          embeds: [welcomeEmbed],
          components: [actionRow]
        });

        await interaction.editReply({
          content: `✅ เปิด Ticket เรียบร้อยแล้วที่ห้อง: <#${ticketChannel.id}>`
        });

      } catch (err) {
        console.error('เกิดข้อผิดพลาดในการสร้างห้อง Ticket:', err);
        await interaction.editReply({
          content: '❌ เกิดข้อผิดพลาดในการสร้างห้อง Ticket'
        });
      }
    }

    // ปุ่มกดปิด Ticket
    if (customId === 'ticket_btn_close') {
      return askCloseConfirmation(interaction);
    }

    // ปุ่มยืนยันปิด Ticket
    if (customId === 'ticket_confirm_close') {
      await interaction.reply({ content: '🔒 กำลังบันทึกประวัติและปิดห้อง Ticket...', ephemeral: false });

      try {
        const transcript = await discordTranscripts.createTranscript(channel, {
          limit: -1,
          fileName: `transcript-${channel.name}.html`,
          returnType: 'attachment',
          poweredBy: false
        });

        const transcriptChannelId = process.env.TRANSCRIPT_CHANNEL_ID;
        if (transcriptChannelId) {
          const logChannel = interaction.guild.channels.cache.get(transcriptChannelId);
          if (logChannel) {
            const logEmbed = new EmbedBuilder()
              .setTitle('📜 ประวัติการปิด Ticket')
              .addFields(
                { name: 'ห้อง', value: `\`${channel.name}\``, inline: true },
                { name: 'ผู้ปิด', value: `<@${user.id}>`, inline: true }
              )
              .setColor('#D4AF37')
              .setTimestamp();

            await logChannel.send({ embeds: [logEmbed], files: [transcript] });
          }
        }
      } catch (err) {
        console.error('Transcript error:', err);
      }

      setTimeout(async () => {
        try {
          await channel.delete();
        } catch (delError) {
          console.error('Error deleting channel:', delError);
        }
      }, 2500);
    }

    // ปุ่มยกเลิกการปิด
    if (customId === 'ticket_cancel_close') {
      return interaction.reply({
        content: 'ยกเลิกการปิด Ticket แล้วครับ',
        ephemeral: true
      });
    }

    // ปุ่มสร้าง Transcript
    if (customId === 'ticket_btn_transcript') {
      await interaction.deferReply({ ephemeral: true });
      try {
        const transcript = await discordTranscripts.createTranscript(channel, {
          limit: -1,
          fileName: `transcript-${channel.name}.html`,
          returnType: 'attachment',
          poweredBy: false
        });

        await interaction.editReply({
          content: '📜 ไฟล์ประวัติการสนทนาของ Ticket นี้:',
          files: [transcript]
        });
      } catch (err) {
        console.error('Transcript error:', err);
        await interaction.editReply({ content: '❌ เกิดข้อผิดพลาดในการสร้าง Transcript' });
      }
    }
  }
}

async function askCloseConfirmation(interaction) {
  const confirmRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_confirm_close')
      .setLabel('ยืนยันปิดห้อง')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('ticket_cancel_close')
      .setLabel('ยกเลิก')
      .setStyle(ButtonStyle.Secondary)
  );

  return interaction.reply({
    content: '⚠️ ยืนยันการปิดและลบห้อง Ticket นี้หรือไม่?',
    components: [confirmRow]
  });
}

module.exports = { handleInteraction };
