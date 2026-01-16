import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';

export function loadEnv(envPath) {
    console.log(`[EnvLoader] Loading .env from: ${envPath}`);

    if (!fs.existsSync(envPath)) {
        console.warn('[EnvLoader] .env file not found.');
        return { loaded: false };
    }

    // 1. Try standard dotenv
    const result = dotenv.config({ path: envPath });
    const dotenvLoaded = result.parsed && Object.keys(result.parsed).length > 0;

    // 2. Manual Fallback for Encoding Issues (UTF-16 LE / BOM)
    // If dotenv didn't load anything, or specifically missing our key, try smart decode.
    let manuallyLoaded = false;
    if (!dotenvLoaded || !process.env.TWELVE_DATA_API_KEY) {
        try {
            console.log('[EnvLoader] Attempting manual read (smart decode)...');
            const buf = fs.readFileSync(envPath);
            let content = '';

            // Check BOM for UTF-16 LE
            if (buf.length >= 2 && buf[0] === 0xFF && buf[1] === 0xFE) {
                console.log('[EnvLoader] Detected UTF-16 LE encoding.');
                content = buf.toString('utf16le');
            } else {
                content = buf.toString('utf8');
            }

            // Regex to find TWELVE_DATA_API_KEY
            const match = content.match(/TWELVE_DATA_API_KEY\s*=\s*(.*?)(\r|\n|$)/i);
            if (match && match[1]) {
                let key = match[1].trim();
                key = key.replace(/^["']|["']$/g, ''); // Remove quotes
                key = key.replace(/\u0000/g, ''); // Remove null bytes
                key = key.trim();

                if (key) {
                    process.env.TWELVE_DATA_API_KEY = key;
                    manuallyLoaded = true;
                    console.log(`[EnvLoader] Manually extracted key: ${key.substring(0, 4)}...`);
                }
            }
        } catch (e) {
            console.error('[EnvLoader] Manual parse error:', e.message);
        }
    }

    const finalKey = process.env.TWELVE_DATA_API_KEY;
    console.log(`[EnvLoader] Status: dotenv=${dotenvLoaded}, manual=${manuallyLoaded}, KeyPresent=${!!finalKey}`);

    return {
        loaded: dotenvLoaded || manuallyLoaded,
        keyPresent: !!finalKey
    };
}
