const {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const discordTranscripts = require('discord-html-transcripts');
const config = require('../../config.json');

async function handleInteraction(interaction) {
  // 1. คำสั่ง Slash Commands
  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;

    if (commandName === 'setup-ticket') {
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

    // คำสั่ง /say สั่งให้บอทพิมพ์ข้อความธรรมดาแทนเรา
    if (commandName === 'say') {
      const staffRoleId = process.env.STAFF_ROLE_ID;
      const member = interaction.member;

      const isStaff = member.permissions.has(PermissionFlagsBits.Administrator) ||
        (staffRoleId && member.roles.cache.has(staffRoleId));

      if (!isStaff) {
        return interaction.reply({
          content: '❌ เฉพาะทีมงานหรือแอดมินเท่านั้นที่สามารถใช้คำสั่งนี้ได้ครับ',
          ephemeral: true
        });
      }

      const messageText = interaction.options.getString('message');
      const attachment = interaction.options.getAttachment('attachment');

      const sendOptions = { content: messageText };
      if (attachment) {
        sendOptions.files = [attachment.url];
      }

      await interaction.channel.send(sendOptions);

      return interaction.reply({
        content: '✅ ส่งข้อความแทนเรียบร้อยแล้ว!',
        ephemeral: true
      });
    }

    // คำสั่ง /say-embed สั่งให้บอทส่งการ์ด Embed สวยหรูแทนเรา
    if (commandName === 'say-embed') {
      const staffRoleId = process.env.STAFF_ROLE_ID;
      const member = interaction.member;

      const isStaff = member.permissions.has(PermissionFlagsBits.Administrator) ||
        (staffRoleId && member.roles.cache.has(staffRoleId));

      if (!isStaff) {
        return interaction.reply({
          content: '❌ เฉพาะทีมงานหรือแอดมินเท่านั้นที่สามารถใช้คำสั่งนี้ได้ครับ',
          ephemeral: true
        });
      }

      const messageText = interaction.options.getString('message');
      const title = interaction.options.getString('title');
      const image = interaction.options.getAttachment('image');

      const embed = new EmbedBuilder()
        .setDescription(messageText)
        .setColor('#D4AF37')
        .setFooter({ text: 'CookieRunX Staff Support' })
        .setTimestamp();

      if (title) embed.setTitle(title);
      if (image) embed.setImage(image.url);

      await interaction.channel.send({ embeds: [embed] });

      return interaction.reply({
        content: '✅ ส่งการ์ด Embed แทนเรียบร้อยแล้ว!',
        ephemeral: true
      });
    }

    // คำสั่ง /setup-role สั่งส่งการ์ดปุ่มกดรับยศ
    if (commandName === 'setup-role') {
      const targetRole = interaction.options.getRole('role') || interaction.guild.roles.cache.get('1545757478573178941');
      
      if (!targetRole) {
        return interaction.reply({
          content: '❌ ไม่พบยศดังกล่าว กรุณาตรวจสอบ Role ID หรือเลือกยศที่ต้องการ',
          ephemeral: true
        });
      }

      const title = interaction.options.getString('title') || '👑 ยืนยันตัวตนเพื่อรับยศ / Get Verified Role';
      const description = interaction.options.getString('description') || 
        `กดปุ่มด้านล่างเพื่อรับยศ <@&${targetRole.id}>\n> ✨ ปลดล็อกการเข้าถึงห้องต่างๆ ในเซิร์ฟเวอร์\n> 🔔 ได้รับการแจ้งเตือนข่าวสารและอัปเดตบอท CookieRun ก่อนใคร`;
      const buttonLabel = interaction.options.getString('button-label') || `รับยศ ${targetRole.name}`;

      const roleEmbed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor('#D4AF37')
        .setFooter({ text: 'CookieRunX Role Assignment' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`btn_role_${targetRole.id}`)
          .setLabel(buttonLabel)
          .setEmoji('✨')
          .setStyle(ButtonStyle.Success)
      );

      await interaction.channel.send({
        embeds: [roleEmbed],
        components: [row]
      });

      return interaction.reply({
        content: `✅ ส่งการ์ดกดรับยศ <@&${targetRole.id}> เรียบร้อยแล้ว!`,
        ephemeral: true
      });
    }
  }

  // 2. จัดการเมื่อกดปุ่ม (Buttons)
  if (interaction.isButton()) {
    const { customId, channel, user, guild } = interaction;

    // ปุ่มกดรับยศอัตโนมัติ (ห้ามถอดยศเอง)
    if (customId.startsWith('btn_role_')) {
      const roleId = customId.replace('btn_role_', '');
      const member = interaction.member;
      const role = guild.roles.cache.get(roleId);

      if (!role) {
        return interaction.reply({
          content: '❌ ไม่พบยศนี้ในเซิร์ฟเวอร์ (อาจถูกลบไปแล้ว)',
          ephemeral: true
        });
      }

      // ตรวจสอบระดับยศของบอทว่าสูงกว่ายศที่จะให้หรือไม่
      const botMember = guild.members.me;
      if (role.position >= botMember.roles.highest.position) {
        return interaction.reply({
          content: '⚠️ บอทไม่สามารถให้ยศนี้ได้ เนื่องจากตำแหน่งยศของบอทอยู่ต่ำกว่ายศนี้ (กรุณาลากยศบอทขึ้นไปอยู่เหนือยศนี้ในการตั้งค่าเซิร์ฟเวอร์)',
          ephemeral: true
        });
      }

      try {
        if (member.roles.cache.has(roleId)) {
          return interaction.reply({
            content: `⚠️ คุณมียศ <@&${role.id}> อยู่แล้วครับ (ไม่สามารถถอดยศเองได้ หากต้องการถอดยศกรุณาติดต่อแอดมิน)`,
            ephemeral: true
          });
        } else {
          await member.roles.add(role);
          return interaction.reply({
            content: `🎉 **รับยศสำเร็จ!** คุณได้รับยศ <@&${role.id}> เรียบร้อยแล้ว ยินดีต้อนรับครับ ✨`,
            ephemeral: true
          });
        }
      } catch (err) {
        console.error('Error toggling role:', err);
        return interaction.reply({
          content: '❌ เกิดข้อผิดพลาดในการปรับยศ กรุณาตรวจสอบสิทธิ์ Manage Roles ของบอท',
          ephemeral: true
        });
      }
    }

    // ปุ่มกดเปิด Ticket
    if (customId === 'ticket_btn_create') {
      await interaction.deferReply({ ephemeral: true });

      // จัดรูปแบบชื่อผู้ใช้ให้ปลอดภัยสำหรับห้อง Discord (ไม่เกิน 15 ตัวอักษร)
      const safeUsername = (user.username || 'user')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '')
        .slice(0, 15) || 'user';
      
      const channelName = `🎫・${safeUsername}`;

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

        // บันทึก ownerId ไว้ใน topic เพื่อใช้ส่งรีวิวและแจ้งเตือน
        const ticketChannel = await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: parentCategoryId || null,
          topic: `owner:${user.id}|claimed:none`,
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
            .setCustomId('ticket_btn_claim')
            .setLabel('รับเรื่อง (Claim)')
            .setEmoji('🙋‍♂️')
            .setStyle(ButtonStyle.Success),
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

    // ปุ่มกดรับเคส (Claim Ticket)
    if (customId === 'ticket_btn_claim') {
      const staffRoleId = process.env.STAFF_ROLE_ID;
      const member = interaction.member;

      const isStaff = member.permissions.has(PermissionFlagsBits.Administrator) ||
        (staffRoleId && member.roles.cache.has(staffRoleId));

      if (!isStaff) {
        return interaction.reply({
          content: '❌ เฉพาะแอดมินหรือทีมงานเท่านั้นที่สามารถกดรับเรื่องได้ครับ',
          ephemeral: true
        });
      }

      // อัปเดต topic ว่าใคร claim
      try {
        const topic = channel.topic || '';
        const ownerMatch = topic.match(/owner:(\d+)/);
        const ownerId = ownerMatch ? ownerMatch[1] : '';
        await channel.setTopic(`owner:${ownerId}|claimed:${user.id}`);
      } catch (e) {}

      const updatedRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_btn_claimed')
          .setLabel(`ดูแลโดย ${user.username}`)
          .setEmoji('✅')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
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

      const claimEmbed = new EmbedBuilder()
        .setTitle('🙋‍♂️ มีเจ้าหน้าที่รับเรื่องดูแลแล้ว')
        .setDescription(`เคสนี้กำลังได้รับการดูแลโดยเจ้าหน้าที่ <@${user.id}> (\`${user.tag}\`) เรียบร้อยแล้วครับ ✨`)
        .setColor('#2ECC71')
        .setTimestamp();

      await interaction.update({ components: [updatedRow] });
      return interaction.channel.send({ embeds: [claimEmbed] });
    }

    // ปุ่มกดปิด Ticket
    if (customId === 'ticket_btn_close') {
      return askCloseConfirmation(interaction);
    }

    // ปุ่มยืนยันปิด Ticket
    if (customId === 'ticket_confirm_close') {
      await interaction.reply({ content: '🔒 กำลังบันทึกประวัติและปิดห้อง Ticket...', ephemeral: false });

      // ดึง ID ผู้เปิดห้องจาก Channel Topic
      let ownerId = null;
      if (channel.topic) {
        const match = channel.topic.match(/owner:(\d+)/);
        if (match) ownerId = match[1];
      }

      // ทำ Transcript ก่อนลบ
      let transcriptAttachment = null;
      try {
        transcriptAttachment = await discordTranscripts.createTranscript(channel, {
          limit: -1,
          fileName: `transcript-${channel.name}.html`,
          returnType: 'attachment',
          poweredBy: false
        });

        const transcriptChannelId = process.env.TRANSCRIPT_CHANNEL_ID;
        if (transcriptChannelId) {
          const logChannel = interaction.guild.channels.cache.get(transcriptChannelId);
          if (logChannel && transcriptAttachment) {
            const logEmbed = new EmbedBuilder()
              .setTitle('📜 ประวัติการปิด Ticket')
              .addFields(
                { name: 'ห้อง', value: `\`${channel.name}\``, inline: true },
                { name: 'ผู้ปิด', value: `<@${user.id}>`, inline: true },
                { name: 'ผู้เปิดเคส', value: ownerId ? `<@${ownerId}>` : 'ไม่ระบุ', inline: true }
              )
              .setColor('#D4AF37')
              .setTimestamp();

            await logChannel.send({ embeds: [logEmbed], files: [transcriptAttachment] });
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
