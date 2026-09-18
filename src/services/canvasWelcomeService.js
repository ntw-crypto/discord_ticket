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
 * วาดรูปทรงหกเหลี่ยม (Hexagon) สไตล์ Cyber Shield
 */
function drawHexagon(ctx, x, y, radius) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const hx = x + radius * Math.cos(angle);
    const hy = y + radius * Math.sin(angle);
    if (i === 0) ctx.moveTo(hx, hy);
    else ctx.lineTo(hx, hy);
  }
  ctx.closePath();
}

/**
 * สร้างรูปภาพการ์ดต้อนรับสมาชิกใหม่ (1024x450 px) สไตล์ Cyber Sci-Fi HUD ล้ำยุค
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

  // 1. พื้นหลังหลัก (Deep Space Sci-Fi Dark)
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#06070b');
  bgGrad.addColorStop(0.5, '#0b0f19');
  bgGrad.addColorStop(1, '#080a11');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. แสงนีออน Cyber Glow ในบรรยากาศ (Ambient Glow)
  // Glow นีออน Cyan รอบ Avatar
  const cyanGlow = ctx.createRadialGradient(180, 225, 30, 180, 225, 270);
  cyanGlow.addColorStop(0, 'rgba(0, 242, 254, 0.28)');
  cyanGlow.addColorStop(0.5, 'rgba(0, 242, 254, 0.08)');
  cyanGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = cyanGlow;
  ctx.fillRect(0, 0, width, height);

  // Glow นีออน Purple ด้านบนขวา
  const purpleGlow = ctx.createRadialGradient(900, 60, 20, 900, 60, 320);
  purpleGlow.addColorStop(0, 'rgba(184, 39, 252, 0.22)');
  purpleGlow.addColorStop(0.6, 'rgba(127, 0, 255, 0.06)');
  purpleGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = purpleGlow;
  ctx.fillRect(0, 0, width, height);

  // 3. วาดตารางเรขาคณิตไซเบอร์ (Cyber Tech Grid & Circuits)
  ctx.save();
  ctx.strokeStyle = 'rgba(0, 242, 254, 0.06)';
  ctx.lineWidth = 1;
  // เส้นแนวตั้ง
  for (let x = 40; x < width; x += 50) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  // เส้นแนวนอน
  for (let y = 30; y < height; y += 50) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // วาดลายวงจร Tech Circuit เส้นเฉียง 45 องศา
  ctx.strokeStyle = 'rgba(184, 39, 252, 0.15)';
  ctx.lineWidth = 1.5;
  const circuits = [
    { x1: 50, y1: 400, x2: 120, y2: 330, x3: 200, y3: 330 },
    { x1: 750, y1: 40, x2: 830, y2: 120, x3: 980, y3: 120 },
    { x1: 850, y1: 400, x2: 920, y2: 330, x3: 990, y3: 330 }
  ];
  for (const c of circuits) {
    ctx.beginPath();
    ctx.moveTo(c.x1, c.y1);
    ctx.lineTo(c.x2, c.y2);
    ctx.lineTo(c.x3, c.y3);
    ctx.stroke();

    // จุดโหนดกลมที่ปลายวงจร
    ctx.fillStyle = '#00f2fe';
    ctx.beginPath();
    ctx.arc(c.x3, c.y3, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 4. กรอบการ์ดสไตล์ Sci-Fi HUD (Cyber Chamfered Card Frame)
  ctx.save();
  const borderGrad = ctx.createLinearGradient(0, 0, width, height);
  borderGrad.addColorStop(0, '#00f2fe');
  borderGrad.addColorStop(0.3, 'rgba(79, 172, 254, 0.4)');
  borderGrad.addColorStop(0.7, 'rgba(184, 39, 252, 0.5)');
  borderGrad.addColorStop(1, '#b827fc');
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 2.5;
  ctx.shadowColor = 'rgba(0, 242, 254, 0.4)';
  ctx.shadowBlur = 12;
  roundRect(ctx, 16, 16, width - 32, height - 32, 22);
  ctx.stroke();

  // มุมตัดฉากตกแต่งสไตล์ HUD (Corner HUD Brackets)
  ctx.strokeStyle = '#00f2fe';
  ctx.lineWidth = 3.5;
  // มุมซ้ายบน
  ctx.beginPath();
  ctx.moveTo(16, 60);
  ctx.lineTo(16, 16);
  ctx.lineTo(60, 16);
  ctx.stroke();
  // มุมขวาล่าง
  ctx.beginPath();
  ctx.moveTo(width - 16, height - 60);
  ctx.lineTo(width - 16, height - 16);
  ctx.lineTo(width - 60, height - 16);
  ctx.stroke();
  ctx.restore();

  // 5. รูปโปรไฟล์ทรงหกเหลี่ยมไฮเทค (Hexagon Cyber Shield)
  const avatarX = 180;
  const avatarY = 225;
  const avatarRadius = 92;

  // 5.1 วงแหวนเรดาร์ HUD ด้านนอกสุด (HUD Radar Scanner Ring)
  ctx.save();
  ctx.strokeStyle = 'rgba(0, 242, 254, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarRadius + 22, 0, Math.PI * 2);
  ctx.stroke();

  // เส้นสแกนเรดาร์ประดับ (HUD Arcs)
  ctx.strokeStyle = '#00f2fe';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#00f2fe';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarRadius + 22, -Math.PI / 4, Math.PI / 6);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarRadius + 22, (3 * Math.PI) / 4, (7 * Math.PI) / 6);
  ctx.stroke();

  // มาร์กเกอร์เป้าเล็ง HUD (Reticle Ticks)
  ctx.fillStyle = '#b827fc';
  ctx.fillRect(avatarX - 2, avatarY - avatarRadius - 28, 4, 8);
  ctx.fillRect(avatarX - 2, avatarY + avatarRadius + 20, 4, 8);
  ctx.fillRect(avatarX - avatarRadius - 28, avatarY - 2, 8, 4);
  ctx.fillRect(avatarX + avatarRadius + 20, avatarY - 2, 8, 4);
  ctx.restore();

  // 5.2 กรอบหกเหลี่ยมนีออนชั้นนอก (Outer Glowing Hexagon)
  ctx.save();
  const hexGrad = ctx.createLinearGradient(avatarX - avatarRadius, avatarY - avatarRadius, avatarX + avatarRadius, avatarY + avatarRadius);
  hexGrad.addColorStop(0, '#00f2fe');
  hexGrad.addColorStop(0.5, '#4facfe');
  hexGrad.addColorStop(1, '#b827fc');

  ctx.strokeStyle = hexGrad;
  ctx.lineWidth = 5;
  ctx.shadowColor = '#00f2fe';
  ctx.shadowBlur = 24;
  drawHexagon(ctx, avatarX, avatarY, avatarRadius + 4);
  ctx.stroke();
  ctx.restore();

  // 5.3 โหลดรูป Avatar
  let avatarImg = null;
  try {
    const avatarURL = member.user?.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true }) ||
      member.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
    if (avatarURL) {
      avatarImg = await loadImage(avatarURL);
    }
  } catch (err) {
    console.warn('[WelcomeCard] Failed to load avatar:', err.message);
  }

  // 5.4 ตัดรูป Avatar เป็นทรงหกเหลี่ยม
  ctx.save();
  drawHexagon(ctx, avatarX, avatarY, avatarRadius);
  ctx.clip();

  if (avatarImg) {
    ctx.drawImage(avatarImg, avatarX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
  } else {
    // Fallback
    ctx.fillStyle = '#111728';
    ctx.fillRect(avatarX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
    ctx.fillStyle = '#00f2fe';
    ctx.font = 'bold 64px Kanit-Bold, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(username.charAt(0).toUpperCase(), avatarX, avatarY);
  }
  ctx.restore();

  // 5.5 ขอบเส้นนีออนชั้นในของหกเหลี่ยมเพื่อความคมชัด
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 2;
  drawHexagon(ctx, avatarX, avatarY, avatarRadius);
  ctx.stroke();
  ctx.restore();

  // 6. ส่วนข้อความและข้อมูล (Text & HUD Data)
  const textStartX = 340;
  const maxTextWidth = width - textStartX - 50;

  // 6.1 ข้อความบนสุด: ยินดีต้อนรับสู่ {Guild Name}
  ctx.save();
  ctx.font = '22px Kanit-Regular, sans-serif';
  ctx.fillStyle = '#00f2fe';
  ctx.shadowColor = 'rgba(0, 242, 254, 0.6)';
  ctx.shadowBlur = 10;
  const subText = truncateText(ctx, `ยินดีต้อนรับสู่ ${guildName}`, maxTextWidth);
  ctx.fillText(subText, textStartX, 138);
  ctx.restore();

  // 6.2 หัวข้อหลัก: "ยินดีต้อนรับ" (Holographic Cyan-to-Purple Gradient)
  ctx.save();
  ctx.font = 'bold 56px Kanit-Bold, sans-serif';
  const titleGrad = ctx.createLinearGradient(textStartX, 0, textStartX + 320, 0);
  titleGrad.addColorStop(0, '#ffffff');
  titleGrad.addColorStop(0.3, '#d4fcff');
  titleGrad.addColorStop(0.7, '#00f2fe');
  titleGrad.addColorStop(1, '#b827fc');
  ctx.fillStyle = titleGrad;
  ctx.shadowColor = 'rgba(0, 242, 254, 0.7)';
  ctx.shadowBlur = 18;
  ctx.fillText('ยินดีต้อนรับ', textStartX, 210);
  ctx.restore();

  // 6.3 เส้นแบ่งนีออนไฮเทค (Tech Neon Accent Divider)
  ctx.save();
  const lineGrad = ctx.createLinearGradient(textStartX, 0, textStartX + 420, 0);
  lineGrad.addColorStop(0, '#00f2fe');
  lineGrad.addColorStop(0.6, '#b827fc');
  lineGrad.addColorStop(1, 'rgba(184, 39, 252, 0)');
  ctx.fillStyle = lineGrad;
  ctx.fillRect(textStartX, 226, 380, 2.5);
  ctx.restore();

  // 6.4 ชื่อสมาชิก (Username)
  ctx.save();
  ctx.font = 'bold 36px Kanit-Bold, sans-serif';
  ctx.fillStyle = '#f8fbff';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 10;
  const safeUsername = truncateText(ctx, username, maxTextWidth);
  ctx.fillText(safeUsername, textStartX, 280);
  ctx.restore();

  // 6.5 ป้าย Badge ลำดับสมาชิกสไตล์ชิปไซไฟ (Cyber HUD Capsule Badge)
  ctx.save();
  const badgeText = `สมาชิกลำดับที่ #${memberCount.toLocaleString()}`;
  ctx.font = 'bold 20px Kanit-Bold, sans-serif';
  const textW = ctx.measureText(badgeText).width;
  const badgeWidth = textW + 54;
  const badgeHeight = 42;
  const badgeX = textStartX;
  const badgeY = 312;

  // กล่องพื้นหลัง Badge (Dark Cyber Glass)
  roundRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 10);
  const badgeGrad = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeWidth, badgeY + badgeHeight);
  badgeGrad.addColorStop(0, 'rgba(0, 242, 254, 0.15)');
  badgeGrad.addColorStop(1, 'rgba(184, 39, 252, 0.18)');
  ctx.fillStyle = badgeGrad;
  ctx.fill();

  // ขอบ Badge นีออน
  roundRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 10);
  ctx.strokeStyle = 'rgba(0, 242, 254, 0.7)';
  ctx.lineWidth = 1.5;
  ctx.shadowColor = 'rgba(0, 242, 254, 0.5)';
  ctx.shadowBlur = 8;
  ctx.stroke();

  // ไอคอนประดับเพชรไซเบอร์ (Cyber Diamond Sparkle)
  const iconX = badgeX + 20;
  const iconY = badgeY + (badgeHeight / 2);
  ctx.fillStyle = '#00f2fe';
  ctx.beginPath();
  ctx.moveTo(iconX, iconY - 6);
  ctx.lineTo(iconX + 5, iconY);
  ctx.lineTo(iconX, iconY + 6);
  ctx.lineTo(iconX - 5, iconY);
  ctx.closePath();
  ctx.fill();

  // ข้อความใน Badge
  ctx.fillStyle = '#dcfbfe';
  ctx.textBaseline = 'middle';
  ctx.fillText(badgeText, badgeX + 34, iconY);
  ctx.restore();

  return canvas.toBuffer('image/png');
}

module.exports = {
  generateWelcomeCard
};
