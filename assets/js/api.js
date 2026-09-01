/**
 * Freebuff — API Helper (Ajax)
 * No jQuery, pure vanilla JS
 */

const API = {
    /**
     * POST request
     */
    async post(endpoint, data = {}) {
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            return await response.json();
        } catch (err) {
            return { success: false, error: 'Network error: ' + err.message };
        }
    },

    /**
     * GET request
     */
    async get(endpoint, params = {}) {
        try {
            const query = new URLSearchParams(params).toString();
            const url = query ? `${endpoint}?${query}` : endpoint;
            const response = await fetch(url);
            return await response.json();
        } catch (err) {
            return { success: false, error: 'Network error: ' + err.message };
        }
    },

    /**
     * POST with FormData (for file uploads)
     */
    async postForm(endpoint, formData) {
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                body: formData,
            });
            return await response.json();
        } catch (err) {
            return { success: false, error: 'Network error: ' + err.message };
        }
    },
};
