// Frontend configuration
// Automatically detects the appropriate API URL based on environment

const getApiUrl = () => {
    // 1. First priority: environment variable (set via .env file)
    if (import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL;
    }

    // 2. Second priority: auto-detect for production build
    // If running on same domain as backend, use relative path
    if (import.meta.env.PROD) {
        // In production, try to use the current host
        return `${window.location.protocol}//${window.location.hostname}:8000`;
    }

    // 3. Default: localhost for development
    return 'http://localhost:8000';
};

export const API_URL = getApiUrl();

// Log configuration in development
if (import.meta.env.DEV) {
    console.log('🔧 Frontend Config:', {
        apiUrl: API_URL,
        mode: import.meta.env.MODE,
        env: import.meta.env.VITE_API_URL || 'not set'
    });
}
