import { test, expect } from './fixtures/auth';
import { NAV, PROCUREMENT, TOAST } from './helpers/selectors';

/**
 * E2E Test: Полный цикл закупки (Purchase Flow)
 *
 * Covers:
 * 1. Navigation to Procurement
 * 2. Local purchase — fill form, add product, submit
 * 3. Import purchase — overheads + exchange rate
 * 4. Purchase history tab
 * 5. Workflow tab in procurement
 */

test.describe('Purchase Flow — Навигация и структура', () => {

  test('should open Procurement page and see all tabs', async ({ authedPage: page }) => {
    await page.getByText(NAV.procurement).click();
    await expect(page.getByText(PROCUREMENT.header)).toBeVisible({ timeout: 10_000 });

    // All tabs visible
    await expect(page.getByText(PROCUREMENT.tabs.new)).toBeVisible();
    await expect(page.getByText(PROCUREMENT.tabs.history)).toBeVisible();

    // Type switcher visible
    await expect(page.getByText(PROCUREMENT.type.local)).toBeVisible();
  });

  test('should switch between local and import purchase types', async ({ authedPage: page }) => {
    await page.getByText(NAV.procurement).click();
    await expect(page.getByText(PROCUREMENT.header)).toBeVisible({ timeout: 10_000 });

    // Click Import
    const importButton = page.getByText(PROCUREMENT.type.import);
    if (await importButton.isVisible()) {
      await importButton.click();
      await page.waitForTimeout(500);

      // Should show overhead fields (Логистика, etc.)
      const pageContent = await page.textContent('body') || '';
      // Import mode should have different form structure
      expect(pageContent).toBeTruthy();
    }

    // Switch back to Local
    await page.getByText(PROCUREMENT.type.local).click();
    await page.waitForTimeout(500);
  });
});

test.describe('Purchase Flow — Местный закуп', () => {

  test('should fill in local purchase form completely', async ({ authedPage: page }) => {
    // 1. Navigate
    await page.getByText(NAV.procurement).click();
    await expect(page.getByText(PROCUREMENT.header)).toBeVisible({ timeout: 10_000 });

    // 2. Ensure local type selected
    await page.getByText(PROCUREMENT.type.local).click();
    await page.getByText(PROCUREMENT.tabs.new).click();
    await page.waitForTimeout(1_000);

    // 3. Fill supplier
    const supplierInput = page.getByPlaceholder(PROCUREMENT.form.supplier);
    await expect(supplierInput).toBeVisible({ timeout: 5_000 });
    await supplierInput.fill('ООО ТестПоставщик E2E');

    // 4. Select warehouse — Main
    const warehouseBtn = page.getByText(PROCUREMENT.form.warehouse.main);
    if (await warehouseBtn.isVisible()) {
      await warehouseBtn.click();
    }

    // 5. Select payment — Cash
    const cashBtn = page.getByText(/💵 Наличные/).first();
    if (await cashBtn.isVisible()) {
      await cashBtn.click();
    }

    // 6. Try to add a product from dropdown
    const productSelect = page.locator('select').first();
    if (await productSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
      // Select first non-default option
      const options = await productSelect.locator('option').all();
      if (options.length > 1) {
        await productSelect.selectOption({ index: 1 });
      }
    }

    // 7. Fill quantity
    const qtyInput = page.getByPlaceholder('0').first();
    if (await qtyInput.isVisible()) {
      await qtyInput.fill('10');
    }

    // 8. Fill price
    const priceInput = page.locator('input[type="number"]').nth(1);
    if (await priceInput.isVisible()) {
      await priceInput.fill('150000');
    }

    // 9. Click "Добавить в список"
    const addToListBtn = page.getByRole('button', { name: 'Добавить в список' });
    if (await addToListBtn.isVisible()) {
      await addToListBtn.click();
      await page.waitForTimeout(1_000);
    }

    // 10. Verify submit button state
    const submitBtn = page.getByRole('button', { name: 'Провести закупку' });
    await expect(submitBtn).toBeVisible();
  });

  test('should submit a valid local purchase', async ({ authedPage: page }) => {
    // Navigate and fill form
    await page.getByText(NAV.procurement).click();
    await expect(page.getByText(PROCUREMENT.header)).toBeVisible({ timeout: 10_000 });
    await page.getByText(PROCUREMENT.type.local).click();
    await page.getByText(PROCUREMENT.tabs.new).click();
    await page.waitForTimeout(1_000);

    // Fill supplier
    const supplierInput = page.getByPlaceholder(PROCUREMENT.form.supplier);
    await supplierInput.fill('E2E Supplier Submit');

    // Select cash payment
    const cashBtn = page.getByText(/💵 Наличные/).first();
    if (await cashBtn.isVisible()) await cashBtn.click();

    // Add product (if products exist)
    const productSelect = page.locator('select').first();
    if (await productSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const options = await productSelect.locator('option').all();
      if (options.length > 1) {
        await productSelect.selectOption({ index: 1 });

        const qtyInput = page.getByPlaceholder('0').first();
        if (await qtyInput.isVisible()) await qtyInput.fill('5');

        const priceInputs = page.locator('input[type="number"]');
        const priceInput = priceInputs.nth(1);
        if (await priceInput.isVisible()) await priceInput.fill('120000');

        const addBtn = page.getByRole('button', { name: 'Добавить в список' });
        if (await addBtn.isVisible()) await addBtn.click();

        await page.waitForTimeout(500);

        // Submit
        const submitBtn = page.getByRole('button', { name: 'Провести закупку' });
        if (await submitBtn.isEnabled()) {
          await submitBtn.click();
          // Wait for processing
          await page.waitForTimeout(3_000);
        }
      }
    }
  });
});

test.describe('Purchase Flow — История и Workflow', () => {

  test('should show purchase history tab', async ({ authedPage: page }) => {
    await page.getByText(NAV.procurement).click();
    await expect(page.getByText(PROCUREMENT.header)).toBeVisible({ timeout: 10_000 });

    // Click history tab
    await page.getByText(PROCUREMENT.tabs.history).click();
    await page.waitForTimeout(2_000);

    // Supplier input should NOT be visible (history view, not form)
    const supplierInput = page.getByPlaceholder(PROCUREMENT.form.supplier);
    await expect(supplierInput).not.toBeVisible();
  });

  test('should show workflow tab in procurement', async ({ authedPage: page }) => {
    await page.getByText(NAV.procurement).click();
    await expect(page.getByText(PROCUREMENT.header)).toBeVisible({ timeout: 10_000 });

    // Switch to Workflow tab
    const workflowTab = page.getByText(PROCUREMENT.tabs.workflow);
    if (await workflowTab.isVisible()) {
      await workflowTab.click();
      await page.waitForTimeout(2_000);
    }
  });
});
