# 📊 คู่มือการเชื่อมต่อ Google Sheets กับบอท Discord สำหรับคลัง License Key

คุณสามารถนำ Google Sheets มาใช้เป็นคลังเก็บ License Key ทดลองใช้ฟรีได้ โดยสามารถเปิดดู, เพิ่ม, ลบ หรือแก้ไขคีย์ได้ตลอดเวลาผ่านมือถือหรือคอมพิวเตอร์ และบอทจะตัดยอดบันทึกชื่อคนกดรับลงในตารางให้โดยอัตโนมัติแบบ Real-time!

---

## 🚀 ขั้นตอนการติดตั้ง (ทำเพียงครั้งเดียวใน 1 นาที)

### ขั้นตอนที่ 1: สร้าง Google Sheet ใหม่
1. เข้าไปที่ [Google Sheets](https://sheets.new) เพื่อสร้างตารางใหม่
2. ตั้งชื่อไฟล์ตามต้องการ เช่น `CookieRun License Keys`
3. ในแถวที่ 1 (หัวตาราง) ให้พิมพ์หัวข้อดังนี้:
   - **คอลัมน์ A**: `Key`
   - **คอลัมน์ B**: `Status`
   - **คอลัมน์ C**: `Claimed By`
   - **คอลัมน์ D**: `User ID`
   - **คอลัมน์ E**: `Claimed Date`
4. นำ License Key ที่ต้องการแจกมาวางใน **คอลัมน์ A** (เริ่มตั้งแต่แถวที่ 2 ลงไป)

---

### ขั้นตอนที่ 2: วางโค้ด Google Apps Script
1. ที่เมนูด้านบนของ Google Sheet ให้คลิกที่ **ส่วนขยาย (Extensions)** ➔ เลือก **Apps Script**
2. ลบโค้ดเดิมทั้งหมดในหน้าต่าง แล้วคัดลอกโค้ดด้านล่างนี้ไปวาง:

```javascript
/**
 * Google Apps Script สำหรับเชื่อมต่อระบบแจก License Key กับ Discord Bot
 */
const SHEET_NAME = 'Sheet1'; // หากเปลี่ยนชื่อแผ่นงาน ให้แก้ชื่อตรงนี้

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
}

// ตรวจสอบสถานะและยอดคีย์คงเหลือ (GET)
function doGet(e) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  
  let total = 0;
  let available = 0;
  let claimed = 0;
  const availableKeys = [];

  for (let i = 1; i < data.length; i++) {
    const key = String(data[i][0] || '').trim();
    const status = String(data[i][1] || '').trim().toLowerCase();
    
    if (key) {
      total++;
      if (status === 'claimed' || status === 'ใช้แล้ว' || status === 'รับแล้ว') {
        claimed++;
      } else {
        available++;
        if (availableKeys.length < 20) availableKeys.push(key);
      }
    }
  }

  const response = {
    success: true,
    total: total,
    available: available,
    claimed: claimed,
    availableKeys: availableKeys
  };

  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

// ขอดึงคีย์และตัดยอดลงตาราง (POST)
function doPost(e) {
  const lock = LockService.getScriptLock();
  // ล็อกคิว 10 วินาที ป้องกันคนกดพร้อมกันแล้วได้คีย์ซ้ำ
  lock.waitLock(10000);

  try {
    const sheet = getSheet();
    const data = sheet.getDataRange().getValues();
    const params = JSON.parse(e.postData.contents || '{}');
    const action = params.action || 'claim';
    const userId = String(params.userId || '').trim();
    const username = String(params.username || '').trim();

    if (action === 'check') {
      return doGet(e);
    }

    if (action === 'claim') {
      if (!userId) {
        return createJsonResponse({ success: false, error: 'User ID is required' });
      }

      // 1. ตรวจสอบว่า User ID นี้เคยกดรับสิทธิ์ไปแล้วหรือไม่
      for (let i = 1; i < data.length; i++) {
        const rowUserId = String(data[i][3] || '').trim();
        if (rowUserId === userId) {
          return createJsonResponse({
            success: false,
            alreadyClaimed: true,
            key: data[i][0],
            claimedAt: data[i][4]
          });
        }
      }

      // 2. ค้นหา Key แรกที่ยังไม่ได้ถูกรับ
      let targetRow = -1;
      let assignedKey = '';

      for (let i = 1; i < data.length; i++) {
        const key = String(data[i][0] || '').trim();
        const status = String(data[i][1] || '').trim().toLowerCase();

        if (key && status !== 'claimed' && status !== 'ใช้แล้ว' && status !== 'รับแล้ว') {
          targetRow = i + 1; // แปลง index เป็น row number (1-based)
          assignedKey = key;
          break;
        }
      }

      // หากไม่พบคีย์ว่าง (คีย์หมด)
      if (targetRow === -1 || !assignedKey) {
        return createJsonResponse({
          success: false,
          outOfKeys: true,
          message: 'License keys in stock are exhausted'
        });
      }

      // 3. บันทึกข้อมูลลงตารางแถวนั้นทันที
      const now = new Date();
      const timeString = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

      sheet.getRange(targetRow, 2).setValue('Claimed'); // Column B: Status
      sheet.getRange(targetRow, 3).setValue(username); // Column C: Claimed By
      sheet.getRange(targetRow, 4).setValue("'" + userId); // Column D: User ID
      sheet.getRange(targetRow, 5).setValue(timeString); // Column E: Claimed Date

      // คำนวณยอดคงเหลือ
      let remaining = 0;
      for (let i = 1; i < data.length; i++) {
        if (i + 1 !== targetRow) {
          const k = String(data[i][0] || '').trim();
          const s = String(data[i][1] || '').trim().toLowerCase();
          if (k && s !== 'claimed' && s !== 'ใช้แล้ว' && s !== 'รับแล้ว') {
            remaining++;
          }
        }
      }

      return createJsonResponse({
        success: true,
        key: assignedKey,
        remaining: remaining
      });
    }

    return createJsonResponse({ success: false, error: 'Unknown action' });

  } catch (err) {
    return createJsonResponse({ success: false, error: err.message });
  } finally {
    lock.releaseLock();
  }
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
```

3. กดปุ่ม **💾 บันทึกโครงการ (รูปแผ่นดิสก์)**

---

### ขั้นตอนที่ 3: ทำให้ใช้งานได้ (Deploy as Web App)
1. ที่มุมขวาบน ให้คลิกปุ่มสีน้ำเงิน **ทำให้ใช้งานได้ (Deploy)** ➔ เลือก **การจัดการทำให้ใช้งานได้ใหม่ (New deployment)**
2. คลิกรูปฟันเฟือง ⚙️ ข้างคำว่า "เลือกประเภท" ➔ เลือก **เว็บแอป (Web app)**
3. ตั้งค่าการทำให้ใช้งานได้:
   - **คำอธิบาย (Description)**: `Discord Key Bot API`
   - **เรียกใช้ในฐานะ (Execute as)**: `ฉัน (อีเมลของคุณ)`
   - **ผู้มีสิทธิ์เข้าถึง (Who has access)**: `ทุกคน (Anyone)` *(สำคัญมาก! เพื่อให้บอทสามารถเชื่อมต่อได้)*
4. คลิกปุ่ม **ทำให้ใช้งานได้ (Deploy)**
5. หากมีหน้าต่างขออนุญาตสิทธิ์ ให้คลิก **ให้สิทธิ์การเข้าถึง (Authorize Access)** ➔ เลือกบัญชี Google ➔ คลิก **ขั้นสูง (Advanced)** ➔ คลิก **ไปที่โครงการ (ไม่ปลอดภัย)** ➔ คลิก **อนุญาต (Allow)**
6. คัดลอก **URL เว็บแอป (Web app URL)** ที่ขึ้นต้นด้วย `https://script.google.com/macros/s/.../exec`

---

### ขั้นตอนที่ 4: เชื่อมต่อใน Discord
เปิด Discord แล้วพิมพ์คำสั่ง:
```
/setup-sheets url:https://script.google.com/macros/s/xxxxxx/exec
```
บอทจะทำการตรวจสอบการเชื่อมต่อทันที และรายงานจำนวน Key ที่พร้อมแจกใน Google Sheet ให้ทราบ พร้อมเริ่มใช้งานได้ทันที!

---

## 🔄 ระบบอัปเดตข้อมูลแดชบอร์ดอัตโนมัติ (Auto-Sync)

เมื่อคุณเปิด Google Sheets บนมือถือหรือคอมพิวเตอร์เพื่อ **เพิ่มคีย์, ลบคีย์ หรือเปลี่ยนสถานะคีย์เป็น Claimed / ใช้แล้ว**:

1. **Auto-Sync อัตโนมัติทุก 30 วินาที**:
   - บอทจะคอยตรวจสอบความเปลี่ยนแปลงใน Google Sheets อยู่ตลอดเวลาในเบื้องหลัง
   - เมื่อตรวจพบว่าคุณแก้ไขคีย์หรือเปลี่ยนสถานะ การ์ดแดชบอร์ดในห้องสต็อก (`/setup-stock`) จะทำการแก้ไขข้อความและอัปเดตตัวเลขให้เองโดยอัตโนมัติภายใน 30 วินาทีโดยที่คุณไม่ต้องกดอะไรเลย!
2. **กดปุ่ม "🔄 รีเฟรชข้อมูล" เพื่ออัปเดตทันที**:
   - หากต้องการดูผลลัพธ์ทันทีโดยไม่ต้องรอ 30 วินาที สามารถกดปุ่ม **"🔄 รีเฟรชข้อมูล"** ใต้การ์ดสต็อกใน Discord เพื่อสั่งดึงข้อมูลล่าสุดจาก Google Sheet ได้ทันทีใน 1 วินาทีครับ

