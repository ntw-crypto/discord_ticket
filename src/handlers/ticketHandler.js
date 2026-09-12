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
        .setThumbnail(config.embed.thumbnail || null)
        .setImage(config.embed.banner_image || null)
        .addFields(
          {
            name: config.embed.rules_field.name,
            value: config.embed.rules_field.value,
            inline: false
          },
          {
            name: '✨ หมวดหมู่บริการที่พร้อมดูแลคุณ',
            value: config.categories.map(c => `${c.emoji} **${c.label}**\n↳ *${c.description}*`).join('\n\n'),
            inline: false
          }
        )
        .setFooter({
          text: config.embed.footer,
          iconURL: interaction.guild.iconURL({ dynamic: true }) || undefined
        })
        .setTimestamp();

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('ticket_select_category')
        .setPlaceholder('✦ เลือกประเภทบริการที่คุณต้องการติดต่อ (Select Service)...')
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
        content: '✨ ส่งแผง Ticket สไตล์พรีเมียมเรียบร้อยแล้ว!',
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
      const safeUsername = (user.username || 'user').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 15) || 'user';
      const existingChannel = guild.channels.cache.find(c =>
        c.name.includes(`${categoryData.prefix}-${safeUsername}`) &&
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
            id: user.id, // ผู้เปิด Ticket
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks
            ]
          }
        ];

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

        // ตรวจสอบความถูกต้องของ Parent Category
        let parentCategoryId = process.env.TICKET_CATEGORY_ID;
        if (parentCategoryId) {
          const cat = guild.channels.cache.get(parentCategoryId);
          if (!cat || cat.type !== ChannelType.GuildCategory) {
            parentCategoryId = null;
          }
        }

        const channelName = `${categoryData.prefix}-${safeUsername}-${Date.now().toString().slice(-4)}`;

        const ticketChannel = await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: parentCategoryId || null,
          permissionOverwrites: permissionOverwrites
        });

        // ข้อความต้อนรับในห้อง Ticket ดีไซน์หรูหรา
        const welcomeEmbed = new EmbedBuilder()
          .setTitle(`${categoryData.emoji} ${categoryData.label.toUpperCase()}`)
          .setDescription(
            `เรียนคุณ <@${user.id}>\n\n` +
            `ขอขอบพระคุณที่ไว้วางใจเลือกใช้บริการ **CookieRunX**\n` +
            `ระบบได้ส่งคำขอของคุณไปยังทีมงานเรียบร้อยแล้ว\n\n` +
            `> 💬 **คำแนะนำ**: กรุณาพิมพ์รายละเอียดสิ่งที่ต้องการติดต่อ หรือแนบสลิป/หลักฐานไว้ได้เลยครับ เจ้าหน้าที่จะรีบเข้ามาดูแลโดยเร็วที่สุด ✨`
          )
          .addFields(
            { name: '👤 ลูกค้าผู้ติดต่อ', value: `\`${user.tag}\` (<@${user.id}>)`, inline: true },
            { name: '📂 ประเภทบริการ', value: `**${categoryData.label}**`, inline: true },
            { name: '⏰ เวลาที่เปิดคำขอ', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
          )
          .setColor(categoryData.color || '#D4AF37')
          .setFooter({
            text: 'CookieRunX Support Protocol • สามารถกดปุ่มด้านล่างเพื่อจัดการ Ticket ได้',
            iconURL: user.displayAvatarURL({ dynamic: true })
          })
          .setTimestamp();

        const actionRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('ticket_btn_close')
            .setLabel('ปิดการสนทนา (Close)')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('ticket_btn_transcript')
            .setLabel('บันทึกประวัติ (Transcript)')
            .setEmoji('📜')
            .setStyle(ButtonStyle.Secondary)
        );

        await ticketChannel.send({
          content: `🔔 แจ้งเตือน: <@${user.id}> ${staffRoleId ? `| <@&${staffRoleId}>` : ''}`,
          embeds: [welcomeEmbed],
          components: [actionRow]
        });

        await interaction.editReply({
          content: `✨ **เปิด Ticket สำเร็จแล้ว!** เจ้าหน้าที่พร้อมให้บริการที่ห้อง: <#${ticketChannel.id}>`
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
      const closeEmbed = new EmbedBuilder()
        .setTitle('🔒 ยืนยันการปิด Ticket')
        .setDescription('ระบบกำลังบันทึกประวัติการสนทนา (Transcript) และจะลบห้องอัตโนมัติในไม่กี่วินาที...')
        .setColor('#E74C3C');

      await interaction.reply({ embeds: [closeEmbed] });

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
              .setTitle('📜 รายงานการปิด Ticket / Chat Log')
              .addFields(
                { name: '🏷️ ชื่อห้อง Ticket', value: `\`${channel.name}\``, inline: true },
                { name: '👤 เจ้าหน้าที่/ผู้กดปิด', value: `<@${user.id}> (\`${user.tag}\`)`, inline: true },
                { name: '⏰ เวลาที่ปิด', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
              )
              .setColor('#D4AF37')
              .setFooter({ text: 'CookieRunX Ticket Logs' })
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
      }, 3500);
    }

    if (customId === 'ticket_cancel_close') {
      return interaction.reply({
        content: '✨ ยกเลิกการปิด Ticket แล้ว คุณสามารถพูดคุยต่อได้ทันทีครับ',
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
          content: '📜 **นี่คือไฟล์บันทึกประวัติการสนทนาทั้งหมดของ Ticket นี้ครับ** (เปิดด้วยเบราว์เซอร์เพื่อดูหน้าตาแชทแบบสมบูรณ์):',
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
  const confirmEmbed = new EmbedBuilder()
    .setTitle('⚠️ ยืนยันการปิด Ticket')
    .setDescription('คุณแน่ใจหรือไม่ว่าต้องการปิดและลบห้อง Ticket นี้?\n> เมื่อยืนยัน ระบบจะทำการบันทึกประวัติและลบห้องออกอย่างถาวร')
    .setColor('#F39C12');

  const confirmRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_confirm_close')
      .setLabel('ยืนยันปิดและบันทึกข้อมูล')
      .setEmoji('🗑️')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('ticket_cancel_close')
      .setLabel('ยกเลิก')
      .setStyle(ButtonStyle.Secondary)
  );

  return interaction.reply({
    embeds: [confirmEmbed],
    components: [confirmRow]
  });
}

module.exports = { handleInteraction };
