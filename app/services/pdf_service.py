"""PDF certificate generation using ReportLab."""

from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas


class PDFService:
    """Renders professional certificate PDFs."""

    BORDER = HexColor("#1a365d")
    ACCENT = HexColor("#c9a227")
    TEXT = HexColor("#1a202c")
    MUTED = HexColor("#4a5568")

    def generate(
        self,
        *,
        output_path: Path,
        recipient_name: str,
        title: str,
        body_text: str,
        issuer_name: str,
        certificate_code: str,
        issued_date: str,
    ) -> Path:
        """Create a landscape certificate PDF and return its path."""
        output_path.parent.mkdir(parents=True, exist_ok=True)

        width, height = landscape(letter)
        c = canvas.Canvas(str(output_path), pagesize=landscape(letter))

        # Outer border
        c.setStrokeColor(self.BORDER)
        c.setLineWidth(4)
        c.rect(0.4 * inch, 0.4 * inch, width - 0.8 * inch, height - 0.8 * inch)

        # Inner accent border
        c.setStrokeColor(self.ACCENT)
        c.setLineWidth(1.5)
        c.rect(0.55 * inch, 0.55 * inch, width - 1.1 * inch, height - 1.1 * inch)

        # Header
        c.setFillColor(self.BORDER)
        c.setFont("Times-Bold", 18)
        c.drawCentredString(width / 2, height - 1.2 * inch, issuer_name.upper())

        c.setStrokeColor(self.ACCENT)
        c.setLineWidth(1)
        c.line(width / 2 - 2.5 * inch, height - 1.4 * inch, width / 2 + 2.5 * inch, height - 1.4 * inch)

        # Title
        c.setFillColor(self.BORDER)
        c.setFont("Times-Bold", 32)
        c.drawCentredString(width / 2, height - 2.1 * inch, title)

        # Intro line
        c.setFillColor(self.MUTED)
        c.setFont("Helvetica", 12)
        c.drawCentredString(width / 2, height - 2.7 * inch, "This is to certify that")

        # Recipient name
        c.setFillColor(self.TEXT)
        c.setFont("Times-BoldItalic", 28)
        c.drawCentredString(width / 2, height - 3.4 * inch, recipient_name)

        # Body
        c.setFillColor(self.MUTED)
        c.setFont("Helvetica", 12)
        self._draw_wrapped_centered(
            c, body_text, width / 2, height - 4.0 * inch, max_width=6.5 * inch, leading=16
        )

        # Date and code
        c.setFillColor(self.TEXT)
        c.setFont("Helvetica", 10)
        c.drawString(1.0 * inch, 1.0 * inch, f"Issued: {issued_date}")
        c.drawRightString(width - 1.0 * inch, 1.0 * inch, f"ID: {certificate_code}")

        # Signature line
        c.setStrokeColor(self.BORDER)
        c.line(width / 2 - 1.5 * inch, 1.5 * inch, width / 2 + 1.5 * inch, 1.5 * inch)
        c.setFont("Helvetica-Oblique", 10)
        c.setFillColor(self.MUTED)
        c.drawCentredString(width / 2, 1.25 * inch, "Authorized Signature")

        c.save()
        return output_path

    def _draw_wrapped_centered(
        self,
        c: canvas.Canvas,
        text: str,
        x: float,
        y: float,
        max_width: float,
        leading: float,
    ) -> None:
        """Draw centered multi-line text within max_width."""
        words = text.split()
        lines: list[str] = []
        current = ""

        for word in words:
            candidate = f"{current} {word}".strip()
            if c.stringWidth(candidate, "Helvetica", 12) <= max_width:
                current = candidate
            else:
                if current:
                    lines.append(current)
                current = word
        if current:
            lines.append(current)

        for index, line in enumerate(lines):
            c.drawCentredString(x, y - index * leading, line)
