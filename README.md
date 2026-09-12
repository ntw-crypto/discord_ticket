# 🚀 Discord Ticket Bot (พร้อม Deploy ขึ้น Web Hosting 24/7)

ระบบ Discord Ticket Tool อัตโนมัติ รองรับการสร้างห้อง Ticket แยกหมวดหมู่, จัดการสิทธิ์การมองเห็น, ปุ่มปิดห้องยืนยัน, และสร้างไฟล์สรุปการคุย (HTML Transcript) สวยงาม พร้อม Web Server ในตัวสำหรับรันบน Web Hosting / Cloud 24 ชั่วโมง

---

## 📁 โครงสร้างโปรเจกต์
```text
discord_bot/
├── src/
│   ├── index.js                  # ไฟล์หลักเริ่มต้นบอท
│   ├── server.js                 # Web Server (Express) สำหรับ Hosting / Keep-alive
│   ├── deploy-commands.js        # สคริปต์ลงทะเบียน Slash Commands
│   └── handlers/
│       └── ticketHandler.js      # ตัวจัดการระบบ Ticket (สร้าง/ปิด/Transcript)
├── config.json                   # ปรับแต่งข้อความ embed, สี, หมวดหมู่ Ticket
├── package.json
├── Dockerfile                    # สำหรับ Deploy บน Docker / VPS
├── Procfile                      # สำหรับ Deploy บน Railway / Render
├── .env.example                  # ตัวอย่างการตั้งค่าตัวแปรระบบ
└── README.md
```

---

## 🛠️ ขั้นตอนการตั้งค่าก่อนเริ่มใช้งาน (บนเครื่องของคุณ)

### 1. สร้าง Bot และรับ Token จาก Discord Developer Portal
1. ไปที่ [Discord Developer Portal](https://discord.com/developers/applications)
2. กด **New Application** ตั้งชื่อบอท
3. ไปที่เมนู **Bot**:
   - กด **Reset Token** แล้วคัดลอก Token มาเก็บไว้
   - เลื่อนลงมาที่หัวข้อ **Privileged Gateway Intents** ติ๊กเปิด:
     - ✅ **PRESENCE INTENT**
     - ✅ **SERVER MEMBERS INTENT**
     - ✅ **MESSAGE CONTENT INTENT**
4. ไปที่เมนู **OAuth2 -> URL Generator**:
   - ติ๊ก Scope: `bot`, `applications.commands`
   - ติ๊ก Bot Permissions: `Administrator` หรือเลือก `Manage Channels`, `View Channels`, `Send Messages`, `Attach Files`, `Embed Links`, `Read Message History`
   - คัดลอก URL ด้านล่างไปเปิดในเบราว์เซอร์เพื่อเชิญบอทเข้าเซิร์ฟเวอร์

### 2. ตั้งค่าไฟล์ `.env`
คัดลอกไฟล์ `.env.example` เป็นชื่อ `.env` แล้วกรอกข้อมูล:
```env
DISCORD_TOKEN=ใส่ Token ของบอทที่นี่
CLIENT_ID=ใส่ Application ID ของบอทที่นี่
GUILD_ID=ใส่ Server ID ของคุณที่นี่ (คลิกขวาที่ชื่อเซิร์ฟเวอร์ -> Copy Server ID)

# ID ยศทีมงาน (Role ID) ที่จะให้มีสิทธิ์เข้าห้อง Ticket
STAFF_ROLE_ID=ไอดี Role ทีมงาน

# ID หมวดหมู่ (Category ID) ที่จะให้สร้างห้อง Ticket
TICKET_CATEGORY_ID=ไอดี Category

# ID ห้องที่ต้องการให้ส่งบันทึก Transcript หลังจากปิดห้อง (ไม่ใส่ก็ได้)
TRANSCRIPT_CHANNEL_ID=ไอดีห้อง Log
```

### 3. คำสั่งใช้งานใน Discord
- `/setup-ticket`: ใช้โดยแอดมิน เพื่อส่งแผงเลือกหมวดหมู่ Ticket เข้าห้องนั้นๆ
- `/close-ticket`: พิมพ์เพื่อปิดห้อง Ticket ที่กำลังเปิดอยู่

---

## 🌐 วิธีนำขึ้น Web Hosting (Deploy)

เลือกวิธีตามโฮสติ้งที่คุณใช้งาน:

### แบบที่ 1: Deploy บน Render.com (ฟรี / นิยมมาก)
1. นำโค้ดขึ้น GitHub repository ส่วนตัว
2. สมัครใช้งาน [Render.com](https://render.com)
3. กด **New +** -> เลือก **Web Service**
4. เชื่อมต่อกับ GitHub repository ของคุณ
5. ตั้งค่า:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
6. เลื่อนลงมาที่หัวข้อ **Environment Variables** แล้วเพิ่มตัวแปรให้ครบตามที่ระบุใน `.env`
7. กด **Create Web Service** บอทจะเริ่มทำงานทันที!
8. *แนะนำ*: นำ URL ของ Render (เช่น `https://mybot.onrender.com/health`) ไปใส่ใน [UptimeRobot.com](https://uptimerobot.com) เพื่อ Ping ทุก 5 นาที ป้องกันโฮสต์หลับ

---

### แบบที่ 2: Deploy บน Railway.app
1. เข้าไปที่ [Railway.app](https://railway.app)
2. สร้าง New Project -> **Deploy from GitHub repo**
3. ไปที่แท็บ **Variables** แล้วใส่ Key-Value จากไฟล์ `.env` ทั้งหมด
4. Railway จะตรวจจับ `Procfile` และเริ่มรันบอทให้อัตโนมัติ

---

### แบบที่ 3: Deploy บน Web Hosting ทั่วไปที่มี cPanel (Node.js Selector)
1. บีบอัดไฟล์ทั้งหมดเป็น `.zip` (ไม่ต้องรวมโฟลเดอร์ `node_modules`)
2. อัปโหลดขึ้นผ่าน File Manager ใน cPanel
3. เข้าเมนู **Setup Node.js App** ใน cPanel:
   - เลือก Node.js Version: `18.x` หรือ `20.x`
   - Application root: ไดเรกทอรีที่อัปโหลดไฟล์ไว้
   - Application startup file: `src/index.js`
4. เพิ่ม Environment Variables ในหน้า cPanel Node.js ให้ครบ
5. กด **Run NPM Install** แล้วกด **Start App**
