
'use client';

import React, { useEffect, useRef } from 'react';

interface InstagramEmbedProps {
  embedCode: string;
}

const InstagramEmbed: React.FC<InstagramEmbedProps> = ({ embedCode }) => {
  const embedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Function to load the Instagram script
    const loadScript = () => {
      const existingScript = document.querySelector('script[src="//www.instagram.com/embed.js"]');
      if (existingScript) {
        if (window.instgrm) {
            window.instgrm.Embeds.process();
        }
        return;
      }
      
      const script = document.createElement('script');
      script.src = '//www.instagram.com/embed.js';
      script.async = true;
      script.onload = () => {
        // Trigger Instagram's embed processing once the script is loaded
        if (window.instgrm) {
          window.instgrm.Embeds.process();
        }
      };
      document.body.appendChild(script);
    };

    // If the script is already there, just process the embeds
    if (window.instgrm) {
      window.instgrm.Embeds.process();
    } else {
      // Otherwise, load the script
      loadScript();
    }
  }, [embedCode]);

  return (
     <div
      ref={embedRef}
      className="instagram-embed-container w-full h-full flex justify-center items-center"
      dangerouslySetInnerHTML={{ __html: embedCode }}
    />
  );
};

// Add this to your global types or a specific types file if you have one
declare global {
  interface Window {
    instgrm?: {
      Embeds: {
        process: () => void;
      };
    };
  }
}


export default InstagramEmbed;
