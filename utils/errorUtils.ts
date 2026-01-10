export function parseErrorMessage(error: unknown): string {
    const defaultMessage = 'An unexpected error occurred. Please check the console for details.';
    
    if (!(error instanceof Error)) {
        if (typeof error === 'string') return error;
        return defaultMessage;
    }
    
    const errorMessage = error.message.toLowerCase();
    const errorName = error.name;
    
    // Check for Abort errors
    if (errorName === 'AbortError' || errorMessage.includes('aborted')) {
        return 'Aborted';
    }

    // CRITICAL: Handle "Failed to fetch" - this is the most common error in browser-based AI apps
    // It usually points to invalid API keys, incorrect URLs, or CORS/CSP blocks.
    if (errorMessage.includes('failed to fetch') || errorName === 'TypeError') {
        return "Connection Error: The request was blocked or failed to reach the server. This usually happens if your Gemini API Key or Supabase URL is incorrect, your quota is exceeded, or your network is blocking the request. Please verify your credentials.";
    }

    if (errorMessage.includes('the caller does not have permission')) {
        return "API Key error: Your selected key does not have permission for this model. Ensure the Generative AI API is enabled in your Google Cloud Project.";
    }

    try {
        const parsed = JSON.parse(error.message);
        if (parsed.error) {
            if (parsed.error.message) {
                 if (typeof parsed.error.message === 'string' && parsed.error.message.toLowerCase().includes('quota')) {
                    return `Quota exceeded. ${parsed.error.message}`;
                }
                return parsed.error.message;
            }
            if (parsed.error.code === 500) {
                return 'Internal server error. The model is currently overloaded. Please try again in a few moments.';
            }
        }
    } catch (e) {
        // Not a JSON error message, continue to other checks
    }

    if (errorMessage.includes('blocked') || errorMessage.includes('safety')) {
        return 'Content blocked by safety policy. Please try a different prompt.';
    }
    
    if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
        return "Rate limit reached. Please wait a moment before trying again.";
    }

    if (errorMessage.includes("requested entity was not found")) {
        return "API Key error. The selected API key project might not have this model enabled. Please check your AI Studio project settings.";
    }
    
    return error.message || defaultMessage;
}