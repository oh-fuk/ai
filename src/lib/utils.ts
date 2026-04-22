
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Fetches and embeds external font stylesheets into the document head.
 * This is a workaround for libraries like html-to-image that cannot handle
 * cross-origin stylesheets.
 * @returns A promise that resolves when all fonts are embedded.
 */
export async function embedWebFonts(): Promise<void> {
    const fontLinks = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href^="https://fonts.googleapis.com"]'));
    if (fontLinks.length === 0) {
        return Promise.resolve();
    }

    try {
        const cssText = await Promise.all(
            fontLinks.map(link => fetch(link.href).then(res => res.text()))
        ).then(res => res.join('\n'));

        const style = document.createElement('style');
        style.appendChild(document.createTextNode(cssText));
        document.head.appendChild(style);
        
        // Remove the original links after embedding
        fontLinks.forEach(link => link.remove());
    } catch (e) {
        console.error("Failed to embed web fonts", e);
    }
}

    