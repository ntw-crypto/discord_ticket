const {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} = require('discord.js');
const discordTranscripts = require('discord-html-transcripts');
const config = require('../../config.json');

async function handleInteraction(interaction) {
  // 1. จัดการ Slash Commands
  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;

    if (commandName === 'setup-ticket') {
      const embed = new EmbedBuilder()
        .setTitle(config.embed.title)
        .setDescription(config.embed.description)
        .setColor(config.embed.color)
        .setFooter({ text: config.embed.footer })
        .setTimestamp();

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('ticket_select_category')
        .setPlaceholder('เลือกประเภท Ticket ที่คุณต้องการติดต่อ...')
        .addOptions(
          config.categories.map(cat =>
            new StringSelectMenuOptionBuilder()
              .setLabel(cat.label)
              .setValue(cat.id)
              .setDescription(cat.description)
              .setEmoji(cat.emoji)
          )
        );

      const row = new ActionRowBuilder().addComponents(selectMenu);

      await interaction.channel.send({
        embeds: [embed],
        components: [row]
      });

      return interaction.reply({
        content: '✅ ส่งแผง Ticket เรียบร้อยแล้ว!',
        ephemeral: true
      });
    }

    if (commandName === 'close-ticket') {
      return askCloseConfirmation(interaction);
    }
  }

  // 2. จัดการเมื่อผู้ใช้เลือกหมวดหมู่จาก Dropdown Menu
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'ticket_select_category') {
      const selectedValue = interaction.values[0];
      const categoryData = config.categories.find(c => c.id === selectedValue);

      if (!categoryData) {
        return interaction.reply({ content: '❌ ไม่พบหมวดหมู่นี้ในระบบ', ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });

      const guild = interaction.guild;
      const user = interaction.user;

      // ตรวจสอบว่าผู้ใช้เปิดห้องค้างไว้แล้วหรือไม่
      const existingChannel = guild.channels.cache.find(c =>
        c.name.includes(`${categoryData.prefix}-${user.username.toLowerCase()}`) &&
        c.type === ChannelType.GuildText
      );

      if (existingChannel) {
        return interaction.editReply({
          content: `⚠️ คุณมี Ticket ที่เปิดค้างอยู่แล้วในห้อง: <#${existingChannel.id}>`
        });
      }

      try {
        const staffRoleId = process.env.STAFF_ROLE_ID;
        const permissionOverwrites = [
          {
            id: guild.id, // @everyone ปิดการมองเห็น
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: user.id, // ผู้เปิด Ticket ให้มองเห็นและพิมพ์ได้
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks
            ]
          }
        ];

        // หากมีการระบุ STAFF_ROLE_ID ให้เพิ่มสิทธิ์ให้ทีมงาน
        if (staffRoleId) {
          permissionOverwrites.push({
            id: staffRoleId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageMessages
            ]
          });
        }

        const channelName = `${categoryData.prefix}-${user.username}`.toLowerCase().replace(/[^a-z0-9_-]/g, '');

        const ticketChannel = await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: process.env.TICKET_CATEGORY_ID || null,
          permissionOverwrites: permissionOverwrites
        });

        // ส่งข้อความต้อนรับในห้อง Ticket
        const welcomeEmbed = new EmbedBuilder()
          .setTitle(`${categoryData.emoji} Ticket: ${categoryData.label}`)
          .setDescription(`สวัสดีคุณ <@${user.id}>\n\nขอบคุณที่ติดต่อเข้ามา ทีมงานได้รับเรื่องเรียบร้อยแล้ว กรุณาระบุรายละเอียดข้อความของคุณทิ้งไว้ได้เลยครับ`)
          .addFields(
            { name: '👤 ผู้เปิด Ticket', value: `<@${user.id}> (${user.tag})`, inline: true },
            { name: '📂 หมวดหมู่', value: categoryData.label, inline: true }
          )
          .setColor('#2ECC71')
          .setFooter({ text: 'กดปุ่มด้านล่างเพื่อปิด Ticket หรือบันทึกการสนทนา' })
          .setTimestamp();

        const actionRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('ticket_btn_close')
            .setLabel('🔒 ปิด Ticket')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('ticket_btn_transcript')
            .setLabel('📄 บันทึกประวัติ (Transcript)')
            .setStyle(ButtonStyle.Secondary)
        );

        await ticketChannel.send({
          content: `<@${user.id}> ${staffRoleId ? `<@&${staffRoleId}>` : ''}`,
          embeds: [welcomeEmbed],
          components: [actionRow]
        });

        await interaction.editReply({
          content: `✅ เปิด Ticket สำเร็จแล้ว! ไปที่ห้อง: <#${ticketChannel.id}>`
        });

      } catch (err) {
        console.error('เกิดข้อผิดพลาดในการสร้างห้อง Ticket:', err);
        await interaction.editReply({
          content: '❌ เกิดข้อผิดพลาดในการสร้างห้อง Ticket กรุณาตรวจสอบสิทธิ์ของบอทในเซิร์ฟเวอร์'
        });
      }
    }
  }

  // 3. จัดการปุ่มกด (Buttons)
  if (interaction.isButton()) {
    const { customId, channel, user } = interaction;

    if (customId === 'ticket_btn_close') {
      return askCloseConfirmation(interaction);
    }

    if (customId === 'ticket_confirm_close') {
      await interaction.reply({ content: '🔒 กำลังดำเนินการปิด Ticket และบันทึกข้อมูล...', ephemeral: false });

      // ทำ Transcript ก่อนลบ
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
              .setTitle('📁 บันทึกประวัติ Ticket ที่ถูกปิด')
              .addFields(
                { name: 'ห้อง Ticket', value: channel.name, inline: true },
                { name: 'ผู้กดปิด', value: `<@${user.id}> (${user.tag})`, inline: true },
                { name: 'เวลา', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
              )
              .setColor('#E74C3C')
              .setTimestamp();

            await logChannel.send({ embeds: [logEmbed], files: [transcript] });
          }
        }
      } catch (err) {
        console.error('Error creating transcript:', err);
      }

      setTimeout(async () => {
        try {
          await channel.delete();
        } catch (delError) {
          console.error('Error deleting ticket channel:', delError);
        }
      }, 3000);
    }

    if (customId === 'ticket_cancel_close') {
      return interaction.reply({
        content: 'ยกเลิกการปิด Ticket เรียบร้อยแล้ว',
        ephemeral: true
      });
    }

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
          content: '📄 นี่คือไฟล์ประวัติการสนทนาของ Ticket นี้:',
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
      .setLabel('ยืนยันปิดและลบห้อง')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('ticket_cancel_close')
      .setLabel('ยกเลิก')
      .setStyle(ButtonStyle.Secondary)
  );

  return interaction.reply({
    content: '⚠️ คุณแน่ใจหรือไม่ว่าต้องการปิด Ticket นี้? ห้องจะถูกลบและบันทึกข้อมูลถาวร',
    components: [confirmRow]
  });
}

module.exports = { handleInteraction };
