const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');

// ลงทะเบียนฟอนต์ภาษาไทย Kanit
const fontBoldPath = path.join(__dirname, '../../assets/fonts/Kanit-Bold.ttf');
const fontRegPath = path.join(__dirname, '../../assets/fonts/Kanit-Regular.ttf');

if (fs.existsSync(fontBoldPath)) {
  GlobalFonts.registerFromPath(fontBoldPath, 'Kanit-Bold');
}
if (fs.existsSync(fontRegPath)) {
  GlobalFonts.registerFromPath(fontRegPath, 'Kanit-Regular');
}

/**
 * ตัดทอนข้อความหากยาวเกินความกว้างที่กำหนด
 */
function truncateText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 0 && ctx.measureText(truncated + '...').width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '...';
}

/**
 * วาดสี่เหลี่ยมมุมโค้ง
 */
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * สร้างรูปภาพการ์ดต้อนรับสมาชิกใหม่ (1024x450 px) ในสไตล์ Dark Modern Luxury & Gold
 * @param {import('discord.js').GuildMember} member 
 * @returns {Promise<Buffer>}
 */
async function generateWelcomeCard(member) {
  const width = 1024;
  const height = 450;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const guildName = member.guild?.name || 'เซิร์ฟเวอร์';
  const username = member.user?.username || member.displayName || 'สมาชิกใหม่';
  const memberCount = member.guild?.memberCount || 1;

  // 1. พื้นหลังหลัก (Dark Premium Obsidian)
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#0c0d12');
  bgGrad.addColorStop(0.5, '#13151e');
  bgGrad.addColorStop(1, '#090a0e');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. แสงนีออนโกลว์สีทอง (Ambient Golden Glow)
  // Glow รอบ Avatar
  const avatarGlow = ctx.createRadialGradient(180, 225, 40, 180, 225, 260);
  avatarGlow.addColorStop(0, 'rgba(212, 175, 55, 0.25)');
  avatarGlow.addColorStop(0.6, 'rgba(212, 175, 55, 0.08)');
  avatarGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = avatarGlow;
  ctx.fillRect(0, 0, width, height);

  // Glow มุมขวาบน
  const topGlow = ctx.createRadialGradient(900, 50, 20, 900, 50, 300);
  topGlow.addColorStop(0, 'rgba(245, 200, 66, 0.15)');
  topGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, width, height);

  // 3. วาดลายเส้นประดับเรขาคณิต (Geometric Tech & Luxury Lines)
  ctx.save();
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.12)';
  ctx.lineWidth = 1.5;
  for (let i = -100; i < width + 200; i += 80) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i - 120, height);
    ctx.stroke();
  }
  ctx.restore();

  // 4. กรอบการ์ดชั้นนอกสุด (Card Border with Gold Gradient)
  ctx.save();
  const borderGrad = ctx.createLinearGradient(0, 0, width, height);
  borderGrad.addColorStop(0, '#e5b94c');
  borderGrad.addColorStop(0.3, 'rgba(212, 175, 55, 0.4)');
  borderGrad.addColorStop(0.7, 'rgba(243, 229, 171, 0.7)');
  borderGrad.addColorStop(1, '#9e7d23');
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 4;
  roundRect(ctx, 16, 16, width - 32, height - 32, 24);
  ctx.stroke();
  ctx.restore();

  // 5. โหลดและวาดรูป Avatar
  const avatarX = 180;
  const avatarY = 225;
  const avatarRadius = 90;

  let avatarImg = null;
  try {
    const avatarURL = member.user?.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true }) ||
      member.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
    if (avatarURL) {
      avatarImg = await loadImage(avatarURL);
    }
  } catch (err) {
    console.warn('[WelcomeCard] Failed to load user avatar, using fallback:', err.message);
  }

  // วาดวงแหวนด้านหลัง Avatar
  ctx.save();
  const ringGrad = ctx.createLinearGradient(avatarX - avatarRadius, avatarY - avatarRadius, avatarX + avatarRadius, avatarY + avatarRadius);
  ringGrad.addColorStop(0, '#ffe885');
  ringGrad.addColorStop(0.5, '#d4af37');
  ringGrad.addColorStop(1, '#8c6d1f');

  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarRadius + 8, 0, Math.PI * 2);
  ctx.fillStyle = ringGrad;
  ctx.shadowColor = 'rgba(245, 200, 66, 0.6)';
  ctx.shadowBlur = 20;
  ctx.fill();
  ctx.restore();

  // ตัดรูป Avatar เป็นวงกลม
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  if (avatarImg) {
    ctx.drawImage(avatarImg, avatarX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
  } else {
    // Fallback เมื่อโหลดรูปโปรไฟล์ไม่ได้
    ctx.fillStyle = '#222533';
    ctx.fillRect(avatarX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
    ctx.fillStyle = '#d4af37';
    ctx.font = 'bold 60px Kanit-Bold, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(username.charAt(0).toUpperCase(), avatarX, avatarY);
  }
  ctx.restore();

  // วาดขอบเส้นสีทองทับขอบในของ Avatar ให้เนียนกริบ
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  // 6. วาดส่วนข้อความ (Text Area) ทางขวา
  const textStartX = 340;
  const maxTextWidth = width - textStartX - 50;

  // 6.1 ข้อความบนสุด: ยินดีต้อนรับสู่ {Guild Name}
  ctx.save();
  ctx.font = '22px Kanit-Regular, sans-serif';
  ctx.fillStyle = '#e5be59';
  ctx.shadowColor = 'rgba(229, 190, 89, 0.3)';
  ctx.shadowBlur = 8;
  const subText = truncateText(ctx, `ยินดีต้อนรับสู่ ${guildName}`, maxTextWidth);
  ctx.fillText(subText, textStartX, 140);
  ctx.restore();

  // 6.2 หัวข้อหลัก: "ยินดีต้อนรับ"
  ctx.save();
  ctx.font = 'bold 56px Kanit-Bold, sans-serif';
  const titleGrad = ctx.createLinearGradient(textStartX, 0, textStartX + 300, 0);
  titleGrad.addColorStop(0, '#ffffff');
  titleGrad.addColorStop(0.6, '#fff0a6');
  titleGrad.addColorStop(1, '#d4af37');
  ctx.fillStyle = titleGrad;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 3;
  ctx.fillText('ยินดีต้อนรับ', textStartX, 210);
  ctx.restore();

  // 6.3 ชื่อสมาชิก (Username)
  ctx.save();
  ctx.font = 'bold 36px Kanit-Bold, sans-serif';
  ctx.fillStyle = '#f0f3f8';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 8;
  const safeUsername = truncateText(ctx, username, maxTextWidth);
  ctx.fillText(safeUsername, textStartX, 268);
  ctx.restore();

  // 6.4 ป้าย Badge ลำดับสมาชิก: "สมาชิกลำดับที่ #X"
  ctx.save();
  const badgeText = `สมาชิกลำดับที่ #${memberCount.toLocaleString()}`;
  ctx.font = 'bold 20px Kanit-Bold, sans-serif';
  const textW = ctx.measureText(badgeText).width;
  const badgeWidth = textW + 56;
  const badgeHeight = 44;
  const badgeX = textStartX;
  const badgeY = 305;

  // กล่องพื้นหลัง Badge
  roundRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 22);
  const badgeGrad = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeWidth, badgeY + badgeHeight);
  badgeGrad.addColorStop(0, 'rgba(212, 175, 55, 0.25)');
  badgeGrad.addColorStop(1, 'rgba(35, 38, 50, 0.7)');
  ctx.fillStyle = badgeGrad;
  ctx.fill();

  // ขอบ Badge
  roundRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 22);
  ctx.strokeStyle = 'rgba(245, 200, 66, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // ไอคอนประกายทอง (Diamond Sparkle)
  const iconX = badgeX + 22;
  const iconY = badgeY + (badgeHeight / 2);
  ctx.fillStyle = '#ffdf6d';
  ctx.beginPath();
  ctx.moveTo(iconX, iconY - 7);
  ctx.lineTo(iconX + 6, iconY);
  ctx.lineTo(iconX, iconY + 7);
  ctx.lineTo(iconX - 6, iconY);
  ctx.closePath();
  ctx.fill();

  // ข้อความใน Badge
  ctx.fillStyle = '#ffea9f';
  ctx.textBaseline = 'middle';
  ctx.fillText(badgeText, badgeX + 36, iconY);
  ctx.restore();

  return canvas.toBuffer('image/png');
}

module.exports = {
  generateWelcomeCard
};
