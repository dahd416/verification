import { test, expect } from '@playwright/test';
import { waitForAppReady, dismissToasts } from '../fixtures/helpers';

// Test credentials
const TEST_EMAIL = 'test@orviti.com';
const TEST_PASSWORD = 'test123';

// Helper to login
async function login(page) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  
  // Fill login form
  await page.getByRole('textbox', { name: /correo/i }).fill(TEST_EMAIL);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  
  // Click login button
  await page.getByRole('button', { name: /iniciar sesión/i }).click();
  
  // Wait for dashboard - use more specific selector
  await expect(page.getByRole('heading', { name: /bienvenido a orviti academy/i })).toBeVisible({ timeout: 10000 });
}

// Helper to navigate to email templates page
async function navigateToEmailTemplates(page) {
  // Click on Email Templates in sidebar
  const emailTemplatesNav = page.locator('[data-testid="nav-email-templates"]');
  await expect(emailTemplatesNav).toBeVisible({ timeout: 5000 });
  await emailTemplatesNav.click();
  
  // Wait for page to load
  await expect(page.getByTestId('email-templates-page')).toBeVisible({ timeout: 10000 });
}

test.describe('Email Templates Feature', () => {
  test.beforeEach(async ({ page }) => {
    await dismissToasts(page);
  });

  test('should navigate to email templates page and see default template', async ({ page }) => {
    await login(page);
    await navigateToEmailTemplates(page);
    
    // Verify page elements - use first() for strict mode
    await expect(page.getByRole('heading', { name: 'Plantillas de Email' })).toBeVisible();
    await expect(page.getByTestId('new-template-btn')).toBeVisible();
    
    // Should have at least one template card with "Por defecto" badge
    const defaultBadge = page.locator('text=Por defecto');
    await expect(defaultBadge.first()).toBeVisible();
    
    await page.screenshot({ path: 'email-templates-page.jpeg', quality: 20 });
  });

  test('should display template editor when template is selected', async ({ page }) => {
    await login(page);
    await navigateToEmailTemplates(page);
    
    // Editor should be visible with default template selected
    await expect(page.getByTestId('template-name-input')).toBeVisible();
    await expect(page.getByTestId('subject-input')).toBeVisible();
    await expect(page.getByTestId('html-editor')).toBeVisible();
    await expect(page.getByTestId('save-template-btn')).toBeVisible();
  });

  test('should enable editing mode when Edit button is clicked', async ({ page }) => {
    await login(page);
    await navigateToEmailTemplates(page);
    
    // Click Edit button (initially shows "Editar")
    const editButton = page.getByTestId('save-template-btn');
    await expect(editButton).toBeVisible();
    await expect(editButton).toContainText(/editar/i);
    
    await editButton.click();
    
    // Now button should show "Guardar"
    await expect(editButton).toContainText(/guardar/i);
    
    // Input fields should be enabled
    const nameInput = page.getByTestId('template-name-input');
    await expect(nameInput).toBeEnabled();
  });

  test('should show available template variables', async ({ page }) => {
    await login(page);
    await navigateToEmailTemplates(page);
    
    // Check that variable badges are visible - use exact match for badge elements
    const recipientBadge = page.getByText('{{recipient_name}}', { exact: true });
    await expect(recipientBadge).toBeVisible();
    
    // Check for other important variables - use exact match
    await expect(page.getByText('{{course_name}}', { exact: true })).toBeVisible();
    await expect(page.getByText('{{instructor}}', { exact: true })).toBeVisible();
    await expect(page.getByText('{{certificate_id}}', { exact: true })).toBeVisible();
  });

  test('should create a new template', async ({ page }) => {
    await login(page);
    await navigateToEmailTemplates(page);
    
    // Click new template button
    await page.getByTestId('new-template-btn').click();
    
    // Dialog should appear
    await expect(page.getByText('Crear Nueva Plantilla')).toBeVisible();
    
    // Click create button in dialog
    await page.getByRole('button', { name: /crear plantilla/i }).click();
    
    // Should show success toast and new template should be selected
    await expect(page.getByText(/plantilla creada/i)).toBeVisible({ timeout: 5000 });
  });

  test('should edit template name and save', async ({ page }) => {
    await login(page);
    await navigateToEmailTemplates(page);
    
    // Enter edit mode
    const editButton = page.getByTestId('save-template-btn');
    await editButton.click();
    await expect(editButton).toContainText(/guardar/i);
    
    // Get current name and modify it
    const nameInput = page.getByTestId('template-name-input');
    const currentName = await nameInput.inputValue();
    const timestamp = Date.now();
    const newName = `TEST_${timestamp}`;
    
    await nameInput.clear();
    await nameInput.fill(newName);
    
    // Save
    await editButton.click();
    
    // Should show success toast
    await expect(page.getByText(/plantilla guardada/i)).toBeVisible({ timeout: 5000 });
    
    // Restore original name
    await editButton.click();
    await nameInput.clear();
    await nameInput.fill(currentName);
    await editButton.click();
  });

  test('should switch between editor and preview tabs', async ({ page }) => {
    await login(page);
    await navigateToEmailTemplates(page);
    
    // Check editor tab is active by default
    const editorTab = page.getByRole('tab', { name: /editor html/i });
    const previewTab = page.getByRole('tab', { name: /vista previa/i });
    
    await expect(editorTab).toBeVisible();
    await expect(previewTab).toBeVisible();
    
    // Click preview tab
    await previewTab.click();
    
    // Preview content area should be visible
    await expect(page.getByText(/vista previa del email/i)).toBeVisible();
    
    await page.screenshot({ path: 'email-templates-preview.jpeg', quality: 20 });
  });

  test('should generate preview with sample data', async ({ page }) => {
    await login(page);
    await navigateToEmailTemplates(page);
    
    // Click preview tab - this triggers the preview API call
    const previewTab = page.getByRole('tab', { name: /vista previa/i });
    await previewTab.click();
    
    // Wait for preview to load - should show sample data like "Juan Pérez"
    await expect(page.getByText('Juan Pérez')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Curso de Ejemplo')).toBeVisible();
  });

  test('should duplicate a template', async ({ page }) => {
    await login(page);
    await navigateToEmailTemplates(page);
    
    // Find the dropdown menu button on a template card
    const moreButton = page.locator('[data-testid^="template-card-"]').first().locator('button').last();
    await moreButton.click();
    
    // Click duplicate
    await page.getByRole('menuitem', { name: /duplicar/i }).click();
    
    // Should show success toast
    await expect(page.getByText(/plantilla duplicada/i)).toBeVisible({ timeout: 5000 });
  });

  test('should toggle default switch', async ({ page }) => {
    await login(page);
    await navigateToEmailTemplates(page);
    
    // Enter edit mode
    const editButton = page.getByTestId('save-template-btn');
    await editButton.click();
    
    // Find the default switch
    const defaultSwitch = page.getByTestId('default-switch');
    await expect(defaultSwitch).toBeVisible();
    
    // Get current state
    const isChecked = await defaultSwitch.isChecked();
    
    // Toggle it (click the switch container since the switch itself might be styled differently)
    await defaultSwitch.click({ force: true });
    
    // Should reflect the change
    const newState = await defaultSwitch.isChecked();
    expect(newState).not.toBe(isChecked);
    
    // Cancel to avoid actually changing
    await page.getByRole('button', { name: /cancelar/i }).click();
  });

  test('should edit subject with variables', async ({ page }) => {
    await login(page);
    await navigateToEmailTemplates(page);
    
    // Enter edit mode
    const editButton = page.getByTestId('save-template-btn');
    await editButton.click();
    
    // Get subject input
    const subjectInput = page.getByTestId('subject-input');
    await expect(subjectInput).toBeEnabled();
    
    // Subject should contain variables
    const subjectValue = await subjectInput.inputValue();
    expect(subjectValue).toContain('{{');
    
    // Cancel edit
    await page.getByRole('button', { name: /cancelar/i }).click();
  });

  test('should edit HTML content in editor', async ({ page }) => {
    await login(page);
    await navigateToEmailTemplates(page);
    
    // Enter edit mode
    const editButton = page.getByTestId('save-template-btn');
    await editButton.click();
    
    // Get HTML editor
    const htmlEditor = page.getByTestId('html-editor');
    await expect(htmlEditor).toBeEnabled();
    
    // HTML content should contain template structure
    const htmlContent = await htmlEditor.inputValue();
    expect(htmlContent).toContain('<!DOCTYPE html>');
    expect(htmlContent).toContain('{{recipient_name}}');
    
    // Cancel edit
    await page.getByRole('button', { name: /cancelar/i }).click();
  });

  test('should show delete confirmation dialog', async ({ page }) => {
    await login(page);
    await navigateToEmailTemplates(page);
    
    // First create a template to have something to delete
    await page.getByTestId('new-template-btn').click();
    await page.getByRole('button', { name: /crear plantilla/i }).click();
    await expect(page.getByText(/plantilla creada/i)).toBeVisible({ timeout: 5000 });
    
    // Now try to delete it - find the new template card's dropdown
    const newTemplateCard = page.locator('[data-testid^="template-card-"]').first();
    const moreButton = newTemplateCard.locator('button').last();
    await moreButton.click();
    
    // Click delete
    await page.getByRole('menuitem', { name: /eliminar/i }).click();
    
    // Should show confirmation dialog
    await expect(page.getByText(/eliminar plantilla/i)).toBeVisible();
    await expect(page.getByText(/esta acción no se puede deshacer/i)).toBeVisible();
    
    // Cancel the deletion
    await page.getByRole('button', { name: /cancelar/i }).last().click();
  });
});
