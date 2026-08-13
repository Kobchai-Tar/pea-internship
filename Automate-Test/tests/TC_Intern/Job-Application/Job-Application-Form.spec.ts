import { test, expect, type Page } from '@playwright/test';
import { login } from '../Function/Login';
import { cancelPendingApplication } from '../Function/Cancelapplication';

test.describe('Job Application', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    // ต้อง login เข้าระบบก่อนเสมอ (User ต้องมีอยู่ในระบบ)
    await page.goto('http://localhost:2700/login/intern');
    await login(page, '7777777777', '12345678');
    await expect(page).not.toHaveURL(/\/login/);

    await page.goto('http://localhost:2700/intern-info?positionId=3');
  });

  // หลังจบทุก test case ให้ยกเลิกใบสมัครที่เพิ่งสร้างไว้อัตโนมัติ
  // เพื่อให้ test case ถัดไปสมัครตำแหน่งเดิมซ้ำได้โดยไม่ติดปัญหา "มีใบสมัครค้างอยู่"
  test.afterEach(async ({ page }) => {
    await cancelPendingApplication(page);
  });

  // IT-TC-036: กรณีกรอกจำนวนชั่วโมงฝึกงานเป็น 0 
  // (CASE STATUS : FAIL) — ทีม Tester แนะนำให้ล็อคช่องชั่วโมงไม่ให้แก้ไขเองได้
  test('IT-TC-036: application fails when training hours is set to 0', async ({ page }) => {
    test.fail(true, 'Known bug: ระบบยังอนุญาตให้กรอกจำนวนชั่วโมงเป็น 0 ได้');

    await page.getByPlaceholder('จำนวนชั่วโมงที่ฝึก').fill('0');
    await page.getByPlaceholder('ทักษะด้านต่าง ๆ').fill('มีพื้นฐานภาษา Python และ SQL');
    await page.getByPlaceholder('โปรดระบุสิ่งที่คาดหวังจากการฝึกงาน').fill('ต้องการเรียนรู้การทำงานจริงในองค์กร');
    await page.getByRole('button', { name: 'ยืนยัน', exact: true }).click();

    // เผื่อระบบเปิด popup ยืนยันขึ้นมาก่อน (พฤติกรรมจริงที่อาจเกิดคล้ายกรณีอื่นๆ ที่เจอมาก่อน)
    const confirmButton = page.getByRole('button', { name: 'ยืนยัน', exact: true });
    if (await confirmButton.isVisible().catch(() => false)) {
      await confirmButton.click();
    }

    // Expected ที่ถูกต้อง: ต้องไม่อนุญาตให้ส่งฟอร์มสำเร็จ ต้องมีข้อความเตือนว่าห้ามเป็น "ชั่วโมงที่ฝึกไม่ถูกต้อง" หรือ ระบบควรทำให้ช่องชั่วโมงไม่สามารถแก้ไขเองได้ (ล็อคช่อง)
    await expect(page).toHaveURL(/intern-info/);
    await expect(page.getByText(/ชั่วโมงที่ฝึกไม่ถูกต้อง/)).toBeVisible();
  });

  // IT-TC-037: กรณีกรอกจำนวนชั่วโมงฝึกงานเกินความเป็นจริงเมื่อเทียบกับระยะเวลาที่เลือก
  // (CASE STATUS: FAIL) — ทีมแนะนำให้ล็อคช่องชั่วโมงไม่ให้แก้ไขเองได้เช่นกัน
  test('IT-TC-037: application fails when training hours exceed a realistic maximum for the selected period', async ({ page }) => {
    test.fail(true, 'Known bug: ระบบยังอนุญาตให้กรอกจำนวนชั่วโมงเกินความเป็นจริงเมื่อเทียบกับระยะเวลาที่เลือก');

    await page.getByPlaceholder('จำนวนชั่วโมงที่ฝึก').fill('20000');
    await page.getByPlaceholder('ทักษะด้านต่าง ๆ').fill('มีพื้นฐานภาษา Python และ SQL');
    await page.getByPlaceholder('โปรดระบุสิ่งที่คาดหวังจากการฝึกงาน').fill('ต้องการเรียนรู้การทำงานจริงในองค์กร');
    await page.getByRole('button', { name: 'ยืนยัน', exact: true }).click();

    const confirmButton = page.getByRole('button', { name: 'ยืนยัน', exact: true });
    if (await confirmButton.isVisible().catch(() => false)) {
      await confirmButton.click();
    }

    // Expected ที่ถูกต้อง: ต้องไม่อนุญาตให้ส่งฟอร์มสำเร็จ ต้องมีข้อความเตือนว่าชั่วโมงไม่สอดคล้องกับระยะเวลา หรือ ระบบควรทำให้ช่องชั่วโมงไม่สามารถแก้ไขเองได้ (ล็อคช่อง)
    await expect(page).toHaveURL(/intern-info/);
    await expect(page.getByText(/ชั่วโมง.*ไม่สอดคล้องกับระยะเวลา/)).toBeVisible();
  });

  // IT-TC-038: กรณีกรอกข้อมูลทักษะ/ความคาดหวังเป็นตัวอักษรเพียงตัวเดียว
  // (CASE STATUS: FAIL) — ทีม Tester แนะนำให้ตั้งเงื่อนไข min length ให้ฟิลด์นี้ หรือ มีการตรวจสอบ value เป็นคำ
  test('IT-TC-038: application fails when skills/expectation fields contain only a single character', async ({ page }) => {
    test.fail(true, 'Known bug: ระบบยังอนุญาตให้กรอกฟิลด์ทักษะ/ความคาดหวังแค่ตัวอักษรเดียว');

    await page.getByPlaceholder('จำนวนชั่วโมงที่ฝึก').fill('200');
    await page.getByPlaceholder('ทักษะด้านต่าง ๆ').fill('.');
    await page.getByPlaceholder('โปรดระบุสิ่งที่คาดหวังจากการฝึกงาน').fill('A');
    await page.getByRole('button', { name: 'ยืนยัน', exact: true }).click();

    const confirmButton = page.getByRole('button', { name: 'ยืนยัน', exact: true });
    if (await confirmButton.isVisible().catch(() => false)) {
      await confirmButton.click();
    }

    // Expected ที่ถูกต้อง: ต้องไม่อนุญาตให้ส่งฟอร์มสำเร็จ ต้องขึ้นข้อความเตือนให้ระบุข้อมูลเพิ่มเติม
    await expect(page).toHaveURL(/intern-info/);
    await expect(page.getByText(/กรุณาระบุข้อมูลเพิ่มเติม/)).toBeVisible();
  });

  // IT-TC-039: กรณีกรอกข้อมูลถูกต้องครบถ้วนและกดยืนยันแล้วต้องไปหน้า application-status
  test('IT-TC-039: application status page displays correctly after submitting valid data', async ({ page }) => {
    await page.getByPlaceholder('จำนวนชั่วโมงที่ฝึก').fill('320');
    await page.getByPlaceholder('ทักษะด้านต่าง ๆ').fill('มีพื้นฐานภาษา Python, SQL และทักษะการเทสต์ระบบ');
    await page.getByPlaceholder('โปรดระบุสิ่งที่คาดหวังจากการฝึกงาน').fill('ต้องการเรียนรู้การทำงานจริงในองค์กร');
    await page.getByRole('button', { name: 'ยืนยัน', exact: true }).click();

    // กดยืนยันแล้วต้องเปลี่ยนไปหน้า application-status ทันที (ไม่มี popup เด้งขึ้นมมา)
    await expect(page).toHaveURL(/\/application-status/);

    // Expected: ต้องแสดงข้อความ "เอกสารที่ต้องอัปโหลด" และรายการเอกสารที่ต้องอัปโหลดครบถ้วน (Transcript, Resume, Portfolio)
    await expect(page.getByText('เอกสารที่ต้องอัปโหลด')).toBeVisible();
    await expect(page.getByText('Transcript*')).toBeVisible();
    await expect(page.getByText('Resume*')).toBeVisible();
    await expect(page.getByText('Portfolio*')).toBeVisible();
    await page.locator('div').filter({ hasText: /^รอยื่นเอกสาร$/ }).click();
  });
});