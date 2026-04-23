const path = require('path');
/**
 * Next.js configuration to provide a stub for the Node-only `async_hooks` module.
 * The Genkit library pulls in `@opentelemetry/context-async-hooks`, which requires
 * `async_hooks`. This module only works in a Node environment and is not needed
 * for the client bundle. We alias it to a minimal stub (async_hooks.js) for the
 * server side and mark it as false for the client side to avoid bundling.
 */
module.exports = {
    webpack: (config, { isServer }) => {
        if (isServer) {
            // Resolve `async_hooks` to our stub file when building for the server.
            config.resolve.alias = {
                ...(config.resolve.alias || {}),
                async_hooks: path.resolve(__dirname, 'async_hooks.js'),
            };
        } else {
            // Prevent the client bundle from trying to include the Node-only module.
            config.resolve.fallback = {
                ...(config.resolve.fallback || {}),
                async_hooks: false,
            };
        }
        return config;
    },
    images: {
        remotePatterns: [
            { protocol: 'https', hostname: 'tse3.mm.bing.net' },
            { protocol: 'https', hostname: 'tse1.mm.bing.net' },
            { protocol: 'https', hostname: 'tse2.mm.bing.net' },
            { protocol: 'https', hostname: 'tse4.mm.bing.net' },
            { protocol: 'https', hostname: 'images.unsplash.com' },
            { protocol: 'https', hostname: 'th.bing.com' },
            { protocol: 'https', hostname: 'cdn-thumbnails.huggingface.co' },
            { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
            { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
            { protocol: 'https', hostname: 'www.eklavvya.com' },
            { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
            { protocol: 'https', hostname: 'www.primaryworks.co.uk' },
            // From next.config.ts (were being ignored)
            { protocol: 'https', hostname: 'placehold.co' },
            { protocol: 'https', hostname: 'picsum.photos' },
            { protocol: 'https', hostname: 'www.instagram.com' },
            { protocol: 'http', hostname: 'imcb.edu.pk' },
            { protocol: 'https', hostname: 'cdn.pixabay.com' },
        ],
    },
    experimental: {
        serverActions: {
            bodySizeLimit: '50mb',
        },
    },
};
