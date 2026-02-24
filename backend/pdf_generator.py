"""
PDF Generation Service using Playwright
Generates high-quality PDF certificates from HTML templates
"""
import asyncio
import logging
import os
from pathlib import Path
from datetime import datetime
from jinja2 import Environment, FileSystemLoader
from playwright.async_api import async_playwright

# Set Playwright browsers path
os.environ['PLAYWRIGHT_BROWSERS_PATH'] = '/pw-browsers'

logger = logging.getLogger(__name__)

class CertificatePDFGenerator:
    """Service for generating PDF certificates using Playwright"""
    
    def __init__(self, templates_dir: str = None, output_dir: str = None):
        """
        Initialize PDF generator
        
        Args:
            templates_dir: Directory containing HTML templates
            output_dir: Directory for storing generated PDFs
        """
        root_dir = Path(__file__).parent
        self.templates_dir = Path(templates_dir) if templates_dir else root_dir / "templates"
        self.output_dir = Path(output_dir) if output_dir else root_dir / "generated_pdfs"
        self.output_dir.mkdir(exist_ok=True)
        
        # Initialize Jinja2 environment
        self.jinja_env = Environment(loader=FileSystemLoader(str(self.templates_dir)))
        
        # Browser instance
        self._playwright = None
        self._browser = None
    
    async def _get_browser(self):
        """Get or create browser instance"""
        if self._browser is None:
            self._playwright = await async_playwright().start()
            self._browser = await self._playwright.chromium.launch(
                headless=True,
                args=['--no-sandbox', '--disable-setuid-sandbox']
            )
            logger.info("Playwright browser launched")
        return self._browser
    
    async def generate_certificate_pdf(
        self,
        certificate_data: dict,
        template_name: str = "certificate.html"
    ) -> Path:
        """
        Generate PDF certificate from HTML template
        
        Args:
            certificate_data: Dictionary containing certificate information
                - recipient_name: Name of the recipient
                - course_name: Name of the course
                - organization_name: Name of the organization
                - instructor: Name of the instructor
                - duration_hours: Duration in hours
                - issue_date: Date of issuance
                - certificate_id: Unique certificate ID
                - qr_code_url: QR code image URL (base64 or file URL)
                - custom_template: Optional custom template data with fields_config and background
            template_name: Name of HTML template file
            
        Returns:
            Path to generated PDF file
        """
        try:
            # Check if we have a custom template
            custom_template = certificate_data.get('custom_template')
            if custom_template:
                template = self.jinja_env.get_template("custom_certificate.html")
                html_content = template.render(**certificate_data)
            else:
                # Render HTML template with certificate data
                template = self.jinja_env.get_template(template_name)
                html_content = template.render(**certificate_data)
            
            # Generate unique filename
            certificate_id = certificate_data.get("certificate_id", "unknown")
            # Sanitize filename
            safe_id = certificate_id.replace("/", "-").replace("\\", "-")
            output_filename = f"{safe_id}.pdf"
            output_path = self.output_dir / output_filename
            
            # Get browser instance
            browser = await self._get_browser()
            page = await browser.new_page()
            
            try:
                # Set viewport for landscape A4
                await page.set_viewport_size({
                    'width': 1123,  # A4 landscape at 96 DPI
                    'height': 794
                })
                
                # Set HTML content
                await page.set_content(html_content, wait_until='networkidle')
                
                # Wait a bit for fonts to load
                await asyncio.sleep(0.5)
                
                # Generate PDF with specific options
                await page.pdf(
                    path=str(output_path),
                    format='A4',
                    landscape=True,
                    print_background=True,
                    margin={
                        'top': '0',
                        'bottom': '0',
                        'left': '0',
                        'right': '0'
                    }
                )
                
                logger.info(f"PDF generated successfully: {output_filename}")
                return output_path
                
            finally:
                await page.close()
                
        except Exception as e:
            logger.error(f"Error generating PDF: {str(e)}", exc_info=True)
            raise RuntimeError(f"Failed to generate certificate PDF: {str(e)}")
    
    async def close(self):
        """Close browser instance and free resources"""
        if self._browser:
            await self._browser.close()
            self._browser = None
        if self._playwright:
            await self._playwright.stop()
            self._playwright = None
            logger.info("Playwright browser closed")
    
    def cleanup_old_certificates(self, max_age_hours: int = 24):
        """
        Clean up old generated certificates to manage disk space
        
        Args:
            max_age_hours: Delete certificates older than this many hours
        """
        current_time = datetime.now().timestamp()
        max_age_seconds = max_age_hours * 3600
        deleted = 0
        
        for pdf_file in self.output_dir.glob("*.pdf"):
            file_age_seconds = current_time - pdf_file.stat().st_mtime
            if file_age_seconds > max_age_seconds:
                try:
                    pdf_file.unlink()
                    deleted += 1
                    logger.info(f"Deleted old certificate: {pdf_file.name}")
                except Exception as e:
                    logger.warning(f"Failed to delete old certificate: {str(e)}")
        
        if deleted > 0:
            logger.info(f"Cleaned up {deleted} old certificate files")
        
        return deleted

# Global instance
_pdf_generator = None

async def get_pdf_generator() -> CertificatePDFGenerator:
    """Get or create PDF generator instance"""
    global _pdf_generator
    if _pdf_generator is None:
        _pdf_generator = CertificatePDFGenerator()
    return _pdf_generator

async def cleanup_pdf_generator():
    """Cleanup PDF generator on shutdown"""
    global _pdf_generator
    if _pdf_generator:
        await _pdf_generator.close()
        _pdf_generator = None
