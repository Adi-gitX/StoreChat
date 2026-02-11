import { vi } from 'vitest';
import 'fake-indexeddb/auto'; // Polyfills indexedDB

// Mock TextEncoder/TextDecoder
if (typeof TextEncoder === 'undefined') {
    global.TextEncoder = class {
        encode(str) { return Buffer.from(str); }
    };
}
if (typeof TextDecoder === 'undefined') {
    global.TextDecoder = class {
        decode(arr) { return Buffer.from(arr).toString(); }
    };
}

// Mock Chrome API
global.chrome = {
    runtime: {
        id: 'test-extension-id',
        sendMessage: vi.fn((msg, cb) => cb && cb()),
        onMessage: { addListener: vi.fn() },
        getURL: vi.fn(path => `chrome-extension://test-id/${path}`),
    },
    storage: {
        local: {
            get: vi.fn((keys, cb) => cb({})),
            set: vi.fn((items, cb) => cb && cb()),
            clear: vi.fn((cb) => cb && cb()),
            remove: vi.fn((keys, cb) => cb && cb()),
        },
        onChanged: { addListener: vi.fn() }
    },
    alarms: {
        create: vi.fn(),
        onAlarm: { addListener: vi.fn() }
    },
    action: {
        setBadgeText: vi.fn(),
        setBadgeBackgroundColor: vi.fn()
    }
};

// Mock pako (compression)
global.pako = {
    gzip: vi.fn(data => new TextEncoder().encode(data)),
    ungzip: vi.fn((data, options) => {
        const str = new TextDecoder().decode(data);
        return options && options.to === 'string' ? str : JSON.parse(str);
    })
};

// Mock fetch
global.fetch = vi.fn();
