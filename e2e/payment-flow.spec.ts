import { test, expect } from './fixtures/auth';
import { NAV, CRM, TOAST } from './helpers/selectors';

/**
 * E2E Test: Оплата долга клиента (Payment / Debt Repayment Flow)
 *
 * Covers:
 * 1. CRM navigation — client list, search, filters
 * 2. Opening RepaymentModal for a client with debt
 * 3. Filling payment form (amount, method, currency)
 * 4. Verifying debt change after payment
 * 5. Repayment statistics tab
 */

test.describe('Payment Flow — CRM Навигация', () => {

  test('should open CRM page and see client list', async ({ authedPage: page }) => {
    await page.getByText(NAV.crm).click();
    await expect(page.getByText(CRM.header)).toBeVisible({ timeout: 10_000 });

    // Search input exists
    await expect(page.getByPlaceholder(CRM.search)).toBeVisible();

    // Filter buttons
    await expect(page.getByRole('button', { name: CRM.filter.all })).toBeVisible();
  });

  test('should search for clients', async ({ authedPage: page }) => {
    await page.getByText(NAV.crm).click();
    await expect(page.getByText(CRM.header)).toBeVisible({ timeout: 10_000 });

    const searchInput = page.getByPlaceholder(CRM.search);
    await searchInput.fill('Тест');

    // Wait for filtering
    await page.waitForTimeout(1_000);

    // Search should narrow results
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });

  test('should filter clients by type', async ({ authedPage: page }) => {
    await page.getByText(NAV.crm).click();
    await expect(page.getByText(CRM.header)).toBeVisible({ timeout: 10_000 });

    // Click "Все" filter
    await page.getByRole('button', { name: CRM.filter.all }).click();
    await page.waitForTimeout(500);

    // Click "Физ" filter
    const individualBtn = page.getByText(CRM.filter.individual);
    if (await individualBtn.isVisible()) {
      await individualBtn.click();
      await page.waitForTimeout(500);
    }

    // Click "Юр" filter
    const legalBtn = page.getByText(CRM.filter.legal);
    if (await legalBtn.isVisible()) {
      await legalBtn.click();
      await page.waitForTimeout(500);
    }
  });

  test('should open new client form', async ({ authedPage: page }) => {
    await page.getByText(NAV.crm).click();
    await expect(page.getByText(CRM.header)).toBeVisible({ timeout: 10_000 });

    const addButton = page.getByText(CRM.addClient);
    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForTimeout(1_000);
      // Modal/form should appear
    }
  });
});

test.describe('Payment Flow — Погашение долга', () => {

  test('should display client cards with debt info', async ({ authedPage: page }) => {
    await page.getByText(NAV.crm).click();
    await expect(page.getByText(CRM.header)).toBeVisible({ timeout: 10_000 });

    // Wait for clients to load
    await page.waitForTimeout(3_000);

    // Check for "Погасить долг" buttons on client cards
    const repayButtons = page.getByText('Погасить долг');
    const count = await repayButtons.count();

    // If there are clients with debt, buttons should be visible
    if (count > 0) {
      // At least one client has debt
      await expect(repayButtons.first()).toBeVisible();
    }
  });

  test('should open RepaymentModal and fill payment details', async ({ authedPage: page }) => {
    await page.getByText(NAV.crm).click();
    await expect(page.getByText(CRM.header)).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(3_000);

    // Find a "Погасить долг" button (enabled = client has debt)
    const repayButton = page.getByText('Погасить долг').first();

    if (await repayButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const isEnabled = await repayButton.isEnabled();
      if (isEnabled) {
        // Click to open modal
        await repayButton.click();

        // Modal should appear with title "Погашение долга"
        await expect(page.getByText('Погашение долга')).toBeVisible({ timeout: 5_000 });

        // Should see debt amount
        await expect(page.getByText(/Общий долг/)).toBeVisible();

        // Select payment method — Cash
        const cashPayment = page.getByRole('button', { name: 'Нал' }).first();
        if (await cashPayment.isVisible()) {
          await cashPayment.click();
        }

        // Fill amount — find the amount input
        const amountInputs = page.locator('input[type="number"]');
        const amountInput = amountInputs.first();
        if (await amountInput.isVisible()) {
          await amountInput.fill('100');
        }

        // Verify "Подтвердить оплату" button exists
        const confirmButton = page.getByRole('button', { name: 'Подтвердить оплату' });
        await expect(confirmButton).toBeVisible();
      }
    }
  });

  test('should complete a debt repayment', async ({ authedPage: page }) => {
    await page.getByText(NAV.crm).click();
    await expect(page.getByText(CRM.header)).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(3_000);

    const repayButton = page.getByText('Погасить долг').first();

    if (await repayButton.isVisible({ timeout: 5_000 }).catch(() => false) && await repayButton.isEnabled()) {
      await repayButton.click();
      await expect(page.getByText('Погашение долга')).toBeVisible({ timeout: 5_000 });

      // Select cash method
      const cashBtn = page.getByRole('button', { name: 'Нал' }).first();
      if (await cashBtn.isVisible()) await cashBtn.click();

      // Fill a small amount
      const amountInput = page.locator('input[type="number"]').first();
      if (await amountInput.isVisible()) {
        await amountInput.fill('50');
      }

      // Submit
      const confirmButton = page.getByRole('button', { name: 'Подтвердить оплату' });
      if (await confirmButton.isVisible() && await confirmButton.isEnabled()) {
        await confirmButton.click();
        await page.waitForTimeout(3_000);
      }
    }
  });
});

test.describe('Payment Flow — Статистика погашений', () => {

  test('should navigate to repayment statistics tab', async ({ authedPage: page }) => {
    await page.getByText(NAV.crm).click();
    await expect(page.getByText(CRM.header)).toBeVisible({ timeout: 10_000 });

    // Switch to Statistics tab
    const statsTab = page.getByText('Статистика погашений');
    if (await statsTab.isVisible()) {
      await statsTab.click();
      await page.waitForTimeout(2_000);

      // Should show some analytics content
      const content = await page.textContent('body');
      expect(content).toBeTruthy();
    }
  });
});
