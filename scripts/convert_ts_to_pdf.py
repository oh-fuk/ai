"""
Convert a TypeScript file to a PDF using FPDF.

Usage (PowerShell):
C:/Users/HP/OneDrive/Desktop/Athena-AI/.venv/Scripts/python.exe scripts\convert_ts_to_pdf.py

This script reads `src/ai/flows/generate-chat-response.ts` and writes `generate-chat-response.pdf` in the repo root.
"""
from fpdf import FPDF
from pathlib import Path

# Source TypeScript file path (update if you want a different file)
src_path = Path("src/ai/flows/generate-chat-response.ts")
if not src_path.exists():
    print(f"Source file not found: {src_path}")
    raise SystemExit(1)

out_pdf = Path("generate-chat-response.pdf")

with src_path.open("r", encoding="utf-8") as f:
    content = f.read()

pdf = FPDF(format="A4")
pdf.set_auto_page_break(True, margin=12)
pdf.add_page()
# Use monospaced font for code readability
pdf.set_font("Courier", size=9)
line_height = 5
# Write each line using multi_cell to wrap long lines
for line in content.splitlines():
    # Replace tabs with 2 spaces to keep layout consistent
    safe_line = line.replace("\t", "  ")
    # Replace common unicode punctuation with ASCII equivalents so fpdf (latin-1) can encode
    replacements = {
        '\u2014': '-', '\u2013': '-', '\u2018': "'", '\u2019': "'",
        '\u201c': '"', '\u201d': '"', '\u2026': '...', '\u2010': '-', '\u2011': '-'
    }
    for k, v in replacements.items():
        safe_line = safe_line.replace(k, v)
    # As a last resort, drop any remaining non-latin1 chars
    try:
        safe_line.encode('latin-1')
    except Exception:
        safe_line = safe_line.encode('latin-1', 'ignore').decode('latin-1')
    pdf.multi_cell(0, line_height, safe_line)

pdf.output(str(out_pdf))
print(f"Saved PDF: {out_pdf.resolve()}")
