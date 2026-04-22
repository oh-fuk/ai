/**
 * PDF Utilities for text processing and formatting
 */

export interface LineObj {
  text: string;
  y: number;
}

export interface BlockLine {
  segments: { text: string; bold: boolean }[];
  fontSize: number;
}

export interface TextBlock {
  type: 'heading' | 'paragraph';
  text: string;
}

/**
 * Sanitize text by removing special characters that might break PDF generation
 */
export function sanitizeText(text: string): string {
  if (!text) return '';
  
  // Remove or replace problematic characters
  return text
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
    .replace(/[\u2018\u2019]/g, "'") // Replace smart quotes with regular quotes
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2013/g, '-') // Replace en-dash
    .replace(/\u2014/g, '--') // Replace em-dash
    .replace(/\u2026/g, '...') // Replace ellipsis
    .trim();
}

/**
 * Split text into blocks (paragraphs, headings, etc.)
 */
export function splitIntoBlocks(text: string): TextBlock[] {
  if (!text) return [];
  
  // Split by double newlines (paragraphs) or single newlines
  const rawBlocks = text
    .split(/\n\n+/)
    .map(block => block.trim())
    .filter(block => block.length > 0);
  
  // Identify block types
  return rawBlocks.map(block => {
    // Check if it's a heading (starts with # or is all caps and short)
    const isHeading = block.trim().startsWith('#') || 
                     (block.length < 100 && block === block.toUpperCase() && /^[A-Z\s:]+$/.test(block));
    
    return {
      type: isHeading ? 'heading' : 'paragraph',
      text: block
    };
  });
}

/**
 * Wrap text to fit within a specified width
 */
export function wrapTextToLines(
  text: string,
  maxWidth: number,
  doc?: any,
  fontSize: number = 11
): string[] {
  if (!text) return [];
  
  // If no doc provided, do simple word wrapping based on character count
  if (!doc || typeof doc.setFontSize !== 'function') {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    const avgCharWidth = 6; // Approximate character width
    const maxChars = Math.floor(maxWidth / avgCharWidth);

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (testLine.length > maxChars && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }
  
  doc.setFontSize(fontSize);
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = doc.getTextWidth(testLine);

    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Get lines from a text block with segments (for bold/normal text)
 */
export function getLinesFromBlock(
  block: string | { type?: string; text?: string },
  maxWidth: number,
  doc?: any,
  headingFontSize: number = 16,
  bodyFontSize: number = 11
): BlockLine[] {
  // Handle both string and object block types
  const blockText = typeof block === 'string' ? block : (block.text || '');
  const blockType = typeof block === 'object' && block.type ? block.type : 'paragraph';
  
  if (!blockText) return [];
  
  // Determine if this is a heading (starts with # or is marked as heading)
  const isHeading = blockType === 'heading' || blockText.trim().startsWith('#');
  const fontSize = isHeading ? headingFontSize : bodyFontSize;
  
  // Remove markdown heading markers
  const cleanText = blockText.replace(/^#+\s*/, '').trim();
  
  // Check for bold text markers (**text**)
  const hasBold = cleanText.includes('**');
  
  if (!hasBold) {
    // Simple case: no bold text
    const lines = wrapTextToLines(cleanText, maxWidth, doc, fontSize);
    return lines.map(line => ({
      segments: [{ text: line, bold: isHeading }],
      fontSize
    }));
  }
  
  // Complex case: parse bold segments
  const lines = wrapTextToLines(cleanText, maxWidth, doc, fontSize);
  return lines.map(line => {
    const segments: { text: string; bold: boolean }[] = [];
    const parts = line.split(/(\*\*.*?\*\*)/g);
    
    for (const part of parts) {
      if (!part) continue;
      
      if (part.startsWith('**') && part.endsWith('**')) {
        // Bold text
        const text = part.slice(2, -2);
        if (text) segments.push({ text, bold: true });
      } else {
        // Normal text
        if (part) segments.push({ text: part, bold: isHeading });
      }
    }
    
    return { segments: segments.length > 0 ? segments : [{ text: line, bold: isHeading }], fontSize };
  });
}

/**
 * Calculate the height needed for a text block
 */
export function calculateBlockHeight(
  text: string,
  maxWidth: number,
  doc?: any,
  fontSize: number = 11,
  lineHeight: number = 1.5
): number {
  const lines = wrapTextToLines(text, maxWidth, doc, fontSize);
  return lines.length * fontSize * lineHeight;
}

/**
 * Add text with automatic page breaks
 */
export function addTextWithPageBreaks(
  doc: any,
  text: string,
  x: number,
  startY: number,
  maxWidth: number,
  maxHeight: number,
  fontSize: number = 11,
  lineHeight: number = 1.5
): number {
  const lines = wrapTextToLines(text, maxWidth, doc, fontSize);
  let currentY = startY;
  
  doc.setFontSize(fontSize);
  
  for (const line of lines) {
    // Check if we need a new page
    if (currentY + fontSize > maxHeight) {
      doc.addPage();
      currentY = 60; // Reset to top margin
    }
    
    doc.text(line, x, currentY);
    currentY += fontSize * lineHeight;
  }
  
  return currentY;
}
