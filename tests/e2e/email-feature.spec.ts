import { test, expect } from '@playwright/test';
import { dismissToasts, login, navigateToSettings, navigateToDiplomas } from '../fixtures/helpers';

/**
 * Email Settings Feature Tests
 * Tests the new SMTP configuration and email sending functionality
 */

test.describe('Login and Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await dismissToasts(page);
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    // Verify we're on login page
    await expect(page.getByTestId('login-page')).toBeVisible();
    
    // Fill login form
    await page.getByTestId('login-email').fill('test@orviti.com');
    await page.getByTestId('login-password').fill('test123');
    
    // Click login button
    await page.getByTestId('login-submit').click();
    
    // Wait for navigation - should redirect away from login
    await expect(page.getByTestId('login-page')).not.toBeVisible({ timeout: 10000 });
    
    // Should see sidebar logo after login (meaning we're in the dashboard)
    await expect(page.getByTestId('sidebar-logo')).toBeVisible();
  });
});

test.describe('Settings Page - Email Configuration', () => {
  test.beforeEach(async ({ page }) => {
    await dismissToasts(page);
    
    // Login first
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.getByTestId('login-email').fill('test@orviti.com');
    await page.getByTestId('login-password').fill('test123');
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('sidebar-logo')).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to settings page', async ({ page }) => {
    // Navigate to settings
    await page.getByTestId('nav-settings').click();
    
    // Wait for settings page to load
    await expect(page.getByTestId('settings-page')).toBeVisible();
    
    // Verify page title is present
    const pageContent = await page.textContent('body');
    expect(pageContent).toContain('Configuración');
  });

  test('should display email configuration section', async ({ page }) => {
    // Navigate to settings
    await page.getByTestId('nav-settings').click();
    await expect(page.getByTestId('settings-page')).toBeVisible();
    
    // Check for email configuration header (in Spanish)
    const emailHeader = page.getByText('Configuración de Email');
    await expect(emailHeader).toBeVisible();
    
    // Check for email enable switch
    await expect(page.getByTestId('email-enabled-switch')).toBeVisible();
  });

  test('should show SMTP fields when email is enabled', async ({ page }) => {
    // Navigate to settings
    await page.getByTestId('nav-settings').click();
    await expect(page.getByTestId('settings-page')).toBeVisible();
    
    // Enable email if not already enabled
    const emailSwitch = page.getByTestId('email-enabled-switch');
    
    // Check if switch exists and click it to enable
    await expect(emailSwitch).toBeVisible();
    
    // Check the current state and enable if needed
    const isChecked = await emailSwitch.isChecked();
    if (!isChecked) {
      await emailSwitch.click();
    }
    
    // Verify SMTP fields are now visible
    await expect(page.getByTestId('smtp-host-input')).toBeVisible();
    await expect(page.getByTestId('smtp-port-input')).toBeVisible();
    await expect(page.getByTestId('smtp-user-input')).toBeVisible();
    await expect(page.getByTestId('smtp-password-input')).toBeVisible();
    await expect(page.getByTestId('smtp-from-name-input')).toBeVisible();
    await expect(page.getByTestId('smtp-from-email-input')).toBeVisible();
    await expect(page.getByTestId('test-email-btn')).toBeVisible();
  });

  test('should hide SMTP fields when email is disabled', async ({ page }) => {
    // Navigate to settings
    await page.getByTestId('nav-settings').click();
    await expect(page.getByTestId('settings-page')).toBeVisible();
    
    const emailSwitch = page.getByTestId('email-enabled-switch');
    await expect(emailSwitch).toBeVisible();
    
    // Ensure email is disabled
    const isChecked = await emailSwitch.isChecked();
    if (isChecked) {
      await emailSwitch.click();
    }
    
    // SMTP fields should not be visible when email is disabled
    await expect(page.getByTestId('smtp-host-input')).not.toBeVisible();
    await expect(page.getByTestId('smtp-port-input')).not.toBeVisible();
  });

  test('should be able to fill and save SMTP settings', async ({ page }) => {
    // Navigate to settings
    await page.getByTestId('nav-settings').click();
    await expect(page.getByTestId('settings-page')).toBeVisible();
    
    // Enable email
    const emailSwitch = page.getByTestId('email-enabled-switch');
    const isChecked = await emailSwitch.isChecked();
    if (!isChecked) {
      await emailSwitch.click();
    }
    
    // Wait for fields to appear
    await expect(page.getByTestId('smtp-host-input')).toBeVisible();
    
    // Fill SMTP settings
    await page.getByTestId('smtp-host-input').fill('smtp.test.example.com');
    await page.getByTestId('smtp-port-input').fill('587');
    await page.getByTestId('smtp-user-input').fill('testuser@test.com');
    await page.getByTestId('smtp-password-input').fill('testpassword123');
    await page.getByTestId('smtp-from-name-input').fill('Test Academy');
    await page.getByTestId('smtp-from-email-input').fill('noreply@test.com');
    
    // Save settings
    await page.getByTestId('save-settings-btn').click();
    
    // Wait for success toast or confirmation
    // Toast should show "Configuración guardada" in Spanish
    await page.waitForTimeout(1000); // Allow toast to appear
    
    // Reload page and verify settings persisted
    await page.reload();
    await expect(page.getByTestId('settings-page')).toBeVisible();
    
    // Check email is still enabled
    const emailSwitchAfter = page.getByTestId('email-enabled-switch');
    await expect(emailSwitchAfter).toBeChecked();
    
    // Check SMTP host was saved
    await expect(page.getByTestId('smtp-host-input')).toHaveValue('smtp.test.example.com');
  });

  test('test email button should be disabled without credentials', async ({ page }) => {
    // Navigate to settings
    await page.getByTestId('nav-settings').click();
    await expect(page.getByTestId('settings-page')).toBeVisible();
    
    // Enable email
    const emailSwitch = page.getByTestId('email-enabled-switch');
    const isChecked = await emailSwitch.isChecked();
    if (!isChecked) {
      await emailSwitch.click();
    }
    
    await expect(page.getByTestId('smtp-host-input')).toBeVisible();
    
    // Clear SMTP credentials
    await page.getByTestId('smtp-user-input').fill('');
    await page.getByTestId('smtp-password-input').fill('');
    
    // Test email button should be disabled
    const testButton = page.getByTestId('test-email-btn');
    await expect(testButton).toBeDisabled();
  });
});

test.describe('Diplomas Page - Send Email Option', () => {
  test.beforeEach(async ({ page }) => {
    await dismissToasts(page);
    
    // Login first
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.getByTestId('login-email').fill('test@orviti.com');
    await page.getByTestId('login-password').fill('test123');
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('sidebar-logo')).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to diplomas page', async ({ page }) => {
    // Navigate to diplomas
    await page.getByTestId('nav-diplomas').click();
    
    // Wait for diplomas page
    await expect(page.getByTestId('diplomas-page')).toBeVisible();
    
    // Verify page shows diplomas title (in Spanish)
    const pageContent = await page.textContent('body');
    expect(pageContent).toContain('Diplomas');
  });

  test('should show send email option in diploma dropdown', async ({ page }) => {
    // Navigate to diplomas
    await page.getByTestId('nav-diplomas').click();
    await expect(page.getByTestId('diplomas-page')).toBeVisible();
    
    // Wait for diplomas to load - check if there are any diploma rows
    const diplomaRows = page.locator('[data-testid^="diploma-row-"]');
    const count = await diplomaRows.count();
    
    if (count > 0) {
      // Get the first diploma's action button
      const firstDiplomaRow = diplomaRows.first();
      const diplomaId = await firstDiplomaRow.getAttribute('data-testid');
      const id = diplomaId?.replace('diploma-row-', '');
      
      // Click the actions dropdown
      const actionsButton = page.getByTestId(`diploma-actions-${id}`);
      await actionsButton.click();
      
      // Check for "Enviar por Email" or "Reenviar Email" option in dropdown
      const sendEmailOption = page.getByRole('menuitem').filter({ hasText: /Enviar por Email|Reenviar Email/ });
      await expect(sendEmailOption).toBeVisible();
    } else {
      // No diplomas - skip this test
      test.skip();
    }
  });

  test('should show error when trying to send email without config', async ({ page }) => {
    // First, disable email in settings
    await page.getByTestId('nav-settings').click();
    await expect(page.getByTestId('settings-page')).toBeVisible();
    
    const emailSwitch = page.getByTestId('email-enabled-switch');
    const isChecked = await emailSwitch.isChecked();
    if (isChecked) {
      await emailSwitch.click();
    }
    await page.getByTestId('save-settings-btn').click();
    await expect(page.getByTestId('settings-page')).toBeVisible();
    
    // Navigate to diplomas
    await page.getByTestId('nav-diplomas').click();
    await expect(page.getByTestId('diplomas-page')).toBeVisible();
    
    // Wait for diplomas to load
    const diplomaRows = page.locator('[data-testid^="diploma-row-"]');
    const count = await diplomaRows.count();
    
    if (count > 0) {
      // Get the first diploma's action button
      const firstDiplomaRow = diplomaRows.first();
      const diplomaId = await firstDiplomaRow.getAttribute('data-testid');
      const id = diplomaId?.replace('diploma-row-', '');
      
      // Click the actions dropdown
      await page.getByTestId(`diploma-actions-${id}`).click();
      
      // Click send email option
      await page.getByRole('menuitem').filter({ hasText: /Enviar por Email|Reenviar Email/ }).click();
      
      // Wait for error toast to appear
      await expect(page.locator('[data-sonner-toast]')).toBeVisible({ timeout: 5000 });
    } else {
      test.skip();
    }
  });
});

test.describe('Diplomas Page - Email Status Column', () => {
  test.beforeEach(async ({ page }) => {
    await dismissToasts(page);
    
    // Login first
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.getByTestId('login-email').fill('test@orviti.com');
    await page.getByTestId('login-password').fill('test123');
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('sidebar-logo')).toBeVisible({ timeout: 10000 });
  });

  test('should show Email column header in diplomas table', async ({ page }) => {
    // Navigate to diplomas
    await page.getByTestId('nav-diplomas').click();
    await expect(page.getByTestId('diplomas-page')).toBeVisible();
    
    // Check for Email header column (Spanish)
    const emailHeader = page.locator('th').filter({ hasText: 'Email' });
    await expect(emailHeader).toBeVisible();
  });

  test('should show email status badges for diplomas', async ({ page }) => {
    // Navigate to diplomas
    await page.getByTestId('nav-diplomas').click();
    await expect(page.getByTestId('diplomas-page')).toBeVisible();
    
    // Wait for diplomas to load
    const diplomaRows = page.locator('[data-testid^="diploma-row-"]');
    const count = await diplomaRows.count();
    
    if (count > 0) {
      // Each diploma should have either sent or pending badge
      const firstRow = diplomaRows.first();
      const diplomaId = await firstRow.getAttribute('data-testid');
      const id = diplomaId?.replace('diploma-row-', '');
      
      // Check for either sent or pending badge
      const sentBadge = page.getByTestId(`email-sent-badge-${id}`);
      const pendingBadge = page.getByTestId(`email-pending-badge-${id}`);
      
      // One of them should be visible
      const hasSentBadge = await sentBadge.isVisible().catch(() => false);
      const hasPendingBadge = await pendingBadge.isVisible().catch(() => false);
      
      expect(hasSentBadge || hasPendingBadge).toBeTruthy();
    } else {
      test.skip();
    }
  });
});

test.describe('Diplomas Page - Checkbox Selection', () => {
  test.beforeEach(async ({ page }) => {
    await dismissToasts(page);
    
    // Login first
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.getByTestId('login-email').fill('test@orviti.com');
    await page.getByTestId('login-password').fill('test123');
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('sidebar-logo')).toBeVisible({ timeout: 10000 });
  });

  test('should show select all checkbox in table header', async ({ page }) => {
    // Navigate to diplomas
    await page.getByTestId('nav-diplomas').click();
    await expect(page.getByTestId('diplomas-page')).toBeVisible();
    
    // Check for select all checkbox
    const selectAllCheckbox = page.getByTestId('select-all-checkbox');
    await expect(selectAllCheckbox).toBeVisible();
  });

  test('should show checkbox for individual diplomas', async ({ page }) => {
    // Navigate to diplomas
    await page.getByTestId('nav-diplomas').click();
    await expect(page.getByTestId('diplomas-page')).toBeVisible();
    
    // Wait for diplomas to load
    const diplomaRows = page.locator('[data-testid^="diploma-row-"]');
    const count = await diplomaRows.count();
    
    if (count > 0) {
      const firstRow = diplomaRows.first();
      const diplomaId = await firstRow.getAttribute('data-testid');
      const id = diplomaId?.replace('diploma-row-', '');
      
      // Check for individual checkbox
      const checkbox = page.getByTestId(`select-diploma-${id}`);
      await expect(checkbox).toBeVisible();
    } else {
      test.skip();
    }
  });

  test('should select individual diploma with checkbox', async ({ page }) => {
    // Navigate to diplomas
    await page.getByTestId('nav-diplomas').click();
    await expect(page.getByTestId('diplomas-page')).toBeVisible();
    
    // Wait for diplomas to load
    const diplomaRows = page.locator('[data-testid^="diploma-row-"]');
    const count = await diplomaRows.count();
    
    if (count > 0) {
      const firstRow = diplomaRows.first();
      const diplomaId = await firstRow.getAttribute('data-testid');
      const id = diplomaId?.replace('diploma-row-', '');
      
      // Click individual checkbox
      const checkbox = page.getByTestId(`select-diploma-${id}`);
      await checkbox.click();
      
      // Bulk send button should appear
      const bulkButton = page.getByTestId('bulk-send-email-btn');
      await expect(bulkButton).toBeVisible();
    } else {
      test.skip();
    }
  });

  test('should select all diplomas with select all checkbox', async ({ page }) => {
    // Navigate to diplomas
    await page.getByTestId('nav-diplomas').click();
    await expect(page.getByTestId('diplomas-page')).toBeVisible();
    
    // Wait for diplomas to load
    const diplomaRows = page.locator('[data-testid^="diploma-row-"]');
    const count = await diplomaRows.count();
    
    if (count > 0) {
      // Click select all checkbox
      const selectAllCheckbox = page.getByTestId('select-all-checkbox');
      await selectAllCheckbox.click();
      
      // Bulk send button should appear with count
      const bulkButton = page.getByTestId('bulk-send-email-btn');
      await expect(bulkButton).toBeVisible();
      
      // Button text should contain the count
      const buttonText = await bulkButton.textContent();
      expect(buttonText).toContain(`${count}`);
    } else {
      test.skip();
    }
  });

  test('should deselect all when clicking select all again', async ({ page }) => {
    // Navigate to diplomas
    await page.getByTestId('nav-diplomas').click();
    await expect(page.getByTestId('diplomas-page')).toBeVisible();
    
    // Wait for diplomas to load
    const diplomaRows = page.locator('[data-testid^="diploma-row-"]');
    const count = await diplomaRows.count();
    
    if (count > 0) {
      // Click select all checkbox twice
      const selectAllCheckbox = page.getByTestId('select-all-checkbox');
      await selectAllCheckbox.click();
      await expect(page.getByTestId('bulk-send-email-btn')).toBeVisible();
      
      await selectAllCheckbox.click();
      
      // Bulk send button should disappear
      await expect(page.getByTestId('bulk-send-email-btn')).not.toBeVisible();
    } else {
      test.skip();
    }
  });
});

test.describe('Diplomas Page - Bulk Email', () => {
  test.beforeEach(async ({ page }) => {
    await dismissToasts(page);
    
    // Login first
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.getByTestId('login-email').fill('test@orviti.com');
    await page.getByTestId('login-password').fill('test123');
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('sidebar-logo')).toBeVisible({ timeout: 10000 });
  });

  test('bulk send button shows when diplomas selected', async ({ page }) => {
    // Navigate to diplomas
    await page.getByTestId('nav-diplomas').click();
    await expect(page.getByTestId('diplomas-page')).toBeVisible();
    
    // Wait for diplomas to load
    const diplomaRows = page.locator('[data-testid^="diploma-row-"]');
    const count = await diplomaRows.count();
    
    if (count > 0) {
      // Select first diploma
      const firstRow = diplomaRows.first();
      const diplomaId = await firstRow.getAttribute('data-testid');
      const id = diplomaId?.replace('diploma-row-', '');
      
      await page.getByTestId(`select-diploma-${id}`).click();
      
      // Bulk button should be visible
      await expect(page.getByTestId('bulk-send-email-btn')).toBeVisible();
    } else {
      test.skip();
    }
  });

  test('bulk send button shows error when email not configured', async ({ page }) => {
    // First, disable email in settings
    await page.getByTestId('nav-settings').click();
    await expect(page.getByTestId('settings-page')).toBeVisible();
    
    const emailSwitch = page.getByTestId('email-enabled-switch');
    const isChecked = await emailSwitch.isChecked();
    if (isChecked) {
      await emailSwitch.click();
    }
    await page.getByTestId('save-settings-btn').click();
    await expect(page.getByTestId('settings-page')).toBeVisible();
    
    // Navigate to diplomas
    await page.getByTestId('nav-diplomas').click();
    await expect(page.getByTestId('diplomas-page')).toBeVisible();
    
    // Wait for diplomas to load
    const diplomaRows = page.locator('[data-testid^="diploma-row-"]');
    const count = await diplomaRows.count();
    
    if (count > 0) {
      // Select first diploma
      const firstRow = diplomaRows.first();
      const diplomaId = await firstRow.getAttribute('data-testid');
      const id = diplomaId?.replace('diploma-row-', '');
      
      await page.getByTestId(`select-diploma-${id}`).click();
      await expect(page.getByTestId('bulk-send-email-btn')).toBeVisible();
      
      // Click bulk send
      await page.getByTestId('bulk-send-email-btn').click();
      
      // Should show error toast
      await expect(page.locator('[data-sonner-toast]')).toBeVisible({ timeout: 5000 });
    } else {
      test.skip();
    }
  });
});

test.describe('Cleanup', () => {
  test('should restore default settings', async ({ page }) => {
    await dismissToasts(page);
    
    // Login
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.getByTestId('login-email').fill('test@orviti.com');
    await page.getByTestId('login-password').fill('test123');
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('sidebar-logo')).toBeVisible({ timeout: 10000 });
    
    // Navigate to settings
    await page.getByTestId('nav-settings').click();
    await expect(page.getByTestId('settings-page')).toBeVisible();
    
    // Disable email
    const emailSwitch = page.getByTestId('email-enabled-switch');
    const isChecked = await emailSwitch.isChecked();
    if (isChecked) {
      await emailSwitch.click();
    }
    
    // Save
    await page.getByTestId('save-settings-btn').click();
    await page.waitForTimeout(500);
    
    // Verify email is disabled
    await page.reload();
    await expect(page.getByTestId('settings-page')).toBeVisible();
    await expect(page.getByTestId('email-enabled-switch')).not.toBeChecked();
  });
});
