# ORVITI Academy - Digital Certificate Management Platform

## Project Overview
A full-stack web application for digital diploma/certificate management with drag-and-drop template building, course/recipient management, QR code generation, and public verification.

## Architecture
- **Frontend**: React + Tailwind CSS + shadcn/ui + Konva.js (canvas)
- **Backend**: FastAPI (Python) + MongoDB
- **Auth**: JWT tokens + bcrypt password hashing
- **File Storage**: Local filesystem (/uploads)
- **PDF Generation**: Playwright (server-side) with custom templates
- **i18n**: react-i18next (Spanish/English)

## User Personas
1. **Academy Administrator** - Creates courses, templates, manages recipients, generates certificates
2. **Certificate Recipient** - Receives and shares their digital certificates
3. **Verifier** - Anyone checking certificate authenticity via public verification page

## Core Requirements (Static)
1. Template Builder (drag & drop with Konva.js)
2. Course & Recipient Management with CSV import
3. Diploma Generation with unique certificate IDs and QR codes
4. Public Verification Page at /verify/{certificate_id}
5. Admin Panel with dashboard, search/filter, revoke/reactivate/delete
6. Light/Dark theme toggle
7. Spanish and English language support
8. User management (admin only)
9. Platform branding customization
10. Optional email sending for diplomas with bulk support

## What's Been Implemented

### February 24, 2026 - Email Templates Editor (COMPLETED)
- [x] **Módulo completo de Plantillas de Email**
  - CRUD completo (crear, editar, duplicar, eliminar)
  - Editor HTML con área de texto grande
  - Vista previa con datos de ejemplo
  - Sistema de variables: {{recipient_name}}, {{course_name}}, {{instructor}}, etc.
  - **Insertar imágenes PNG, SVG, JPG** con configuración de ancho y texto alternativo
  - Selección de plantilla por defecto
  - Integración automática con envío de emails
- [x] **Backend endpoints**
  - GET/POST /api/email-templates
  - GET/PUT/DELETE /api/email-templates/{id}
  - POST /api/email-templates/{id}/duplicate
  - POST /api/email-templates/preview
- [x] **Navegación** agregada al sidebar con icono de Mail

### February 24, 2026 - Verification Page Updates (COMPLETED)
- [x] **Logo rectangular del login** en lugar del icono genérico
- [x] **"Emitido por ORVITI"** en lugar de "ORVITI Academy"
- [x] **Botón redirige a orviti.com** en nueva pestaña
- [x] **Footer dinámico**: "© {año} ORVITI. Todos los derechos reservados."
- [x] **Siempre modo claro** - La página fuerza tema claro

### February 24, 2026 - Email Status & Bulk Send (COMPLETED)
- [x] **Email Status Column in Diplomas Table**
  - New "EMAIL" column showing sent/pending status
  - Green badge with checkmark for sent emails
  - Gray badge for pending emails
  - email_sent and email_sent_at fields in diploma model
- [x] **Bulk Email Selection & Sending**
  - Checkbox selection for individual diplomas
  - "Select all" checkbox in table header
  - Dynamic "Enviar X seleccionados" button when items selected
  - POST /api/diplomas/send-bulk-email endpoint
  - Single SMTP connection for batch efficiency
  - Progress tracking with success/failure counts
- [x] **Individual Email Updates**
  - Email sending now marks diploma as sent
  - "Reenviar Email" option for already sent diplomas

### February 24, 2026 - Email Sending Feature (COMPLETED)
- [x] **SMTP Configuration in Settings Page**
- [x] **Backend Email Endpoints**
- [x] **Frontend Integration**

### February 24, 2026 - Google Fonts, QR Editor & Custom Images
- [x] **105 Google Fonts in Template Builder**
- [x] **Visual QR Code Editor** with color/style customization
- [x] **Custom Images in Templates** (PNG, JPG, SVG)

### February 24, 2026 - Users, Settings & Template Fix
- [x] **Remove "Crear Cuenta" from Login** when users exist
- [x] **Users Management Module** (/users)
- [x] **Settings/Configuration Module** (/settings)
- [x] **Fixed Custom Template Bug** in PDF generation

### February 23, 2026 - Delete Diploma & Clear Scan Logs
- [x] **Delete Individual Diplomas**
- [x] **Clear All Scan Logs**

### Previous Implementation
- [x] ZIP Download for all course diplomas
- [x] PDF Generation with Playwright
- [x] Complete UI Redesign with glassmorphism
- [x] Authentication (Login/Register with JWT)
- [x] Dashboard with stats
- [x] Courses/Templates/Recipients CRUD
- [x] Diploma generation with QR codes
- [x] Public verification page
- [x] Scan Logs tracking

## API Endpoints
- Auth: POST /api/auth/register, POST /api/auth/login, GET /api/auth/me
- Courses: GET/POST /api/courses, GET/PUT/DELETE /api/courses/{id}, GET /api/courses/{id}/download-all-diplomas
- Templates: GET/POST /api/templates, GET/PUT/DELETE /api/templates/{id}, POST /api/templates/{id}/duplicate
- Recipients: GET/POST /api/recipients, DELETE /api/recipients/{id}, POST /api/recipients/bulk
- Diplomas: GET /api/diplomas, POST /api/diplomas/generate, POST /api/diplomas/{id}/revoke, POST /api/diplomas/{id}/reactivate, DELETE /api/diplomas/{id}, POST /api/diplomas/{id}/send-email, **POST /api/diplomas/send-bulk-email**
- Verification: GET /api/verify/{certificate_id}
- Dashboard: GET /api/dashboard
- Scan Logs: GET /api/scan-logs, DELETE /api/scan-logs/clear
- Upload: POST /api/upload, GET /api/uploads/{filename}
- Users: GET /api/users, POST /api/users, PUT /api/users/{id}, DELETE /api/users/{id}
- Settings: GET /api/settings, PUT /api/settings, GET /api/settings/public, POST /api/settings/test-email
- First User Check: GET /api/check-first-user

## Prioritized Backlog

### P1 (Future)
- [ ] Template thumbnails generation
- [ ] Enhanced scan analytics
- [ ] Template duplication feature (backend ready)
- [ ] CSV downloadable template for recipient import

### P2 (Nice to Have)
- [ ] Custom email templates with HTML editor
- [ ] Social sharing (LinkedIn, Twitter)
- [ ] Certificate expiration dates
- [ ] Server-side progress tracking for bulk generation (WebSocket)
- [ ] Bulk revocation/reactivation

## Test Credentials
- **Test User**: test@orviti.com / test123

## Test Reports
- `/app/test_reports/iteration_7.json` - Latest test results (100% pass rate - 36/36 tests)

## UI Design System
- **Font**: Urbanist
- **Primary Color**: Indigo (#6366f1) to Purple (#a855f7) gradient
- **Style**: Glassmorphism with backdrop blur
- **Border Radius**: 1rem (rounded-2xl)
- **Animations**: fade-in-up on page load, hover scale effects
