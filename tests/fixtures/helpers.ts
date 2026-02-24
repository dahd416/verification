import { Page, expect } from '@playwright/test';

export async function waitForAppReady(page: Page) {
  await page.waitForLoadState('domcontentloaded');
}

export async function dismissToasts(page: Page) {
  await page.addLocatorHandler(
    page.locator('[data-sonner-toast], .Toastify__toast, [role="status"].toast, .MuiSnackbar-root'),
    async () => {
      const close = page.locator('[data-sonner-toast] [data-close], [data-sonner-toast] button[aria-label="Close"], .Toastify__close-button, .MuiSnackbar-root button');
      await close.first().click({ timeout: 2000 }).catch(() => {});
    },
    { times: 10, noWaitAfter: true }
  );
}

export async function checkForErrors(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const errorElements = Array.from(
      document.querySelectorAll('.error, [class*="error"], [id*="error"]')
    );
    return errorElements.map(el => el.textContent || '').filter(Boolean);
  });
}

export async function login(page: Page, email: string, password: string) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  
  // Fill login form
  await page.getByRole('textbox', { name: /correo/i }).fill(email);
  await page.locator('input[type="password"]').fill(password);
  
  // Click login button
  await page.getByRole('button', { name: /iniciar sesión/i }).click();
  
  // Wait for redirect to dashboard
  await expect(page).toHaveURL(/.*/, { timeout: 10000 });
}

export async function navigateToSettings(page: Page) {
  const settingsNav = page.getByTestId('nav-settings');
  await expect(settingsNav).toBeVisible();
  await settingsNav.click();
  await expect(page.getByTestId('settings-page')).toBeVisible();
}

export async function navigateToDiplomas(page: Page) {
  const diplomasNav = page.getByTestId('nav-diplomas');
  await expect(diplomasNav).toBeVisible();
  await diplomasNav.click();
  await expect(page.getByTestId('diplomas-page')).toBeVisible();
}
