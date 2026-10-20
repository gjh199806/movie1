/* Shared, dependency-free helpers for LibreTV-App. Keep this file safe for browser WebView and Node tests. */
(function (root) {
    'use strict';

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function safeJsonParse(value, fallback) {
        if (typeof value !== 'string' || value.length === 0) return fallback;
        try { return JSON.parse(value); } catch (_) { return fallback; }
    }

    function normalizeHttpUrl(value) {
        if (typeof value !== 'string' || !value.trim()) return null;
        try {
            const url = new URL(value.trim());
            if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
            url.hash = '';
            return url.toString().replace(/\/$/, '');
        } catch (_) { return null; }
    }

    function normalizeTitle(value) {
        return String(value || '')
            .normalize('NFKC')
            .toLocaleLowerCase()
            .replace(/[\s\p{P}\p{S}]+/gu, '');
    }

    function groupSearchResults(items) {
        const groups = new Map();
        const seenSourceItems = new Set();
        (Array.isArray(items) ? items : []).forEach((item) => {
            if (!item || !item.vod_name) return;
            const title = normalizeTitle(item.vod_name);
            if (!title) return;
            const year = String(item.vod_year || '').trim();
            const type = normalizeTitle(item.type_name || '');
            const key = `${title}|${year}|${type}`;
            const sourceCode = String(item.source_code || 'unknown');
            const itemId = String(item.vod_id == null ? '' : item.vod_id);
            const uniqueKey = `${key}|${sourceCode}|${itemId}`;
            if (seenSourceItems.has(uniqueKey)) return;
            seenSourceItems.add(uniqueKey);
            if (!groups.has(key)) {
                groups.set(key, { ...item, source_options: [], source_count: 0 });
            }
            const group = groups.get(key);
            if (!group.source_options.some((option) => option.source_code === sourceCode)) {
                group.source_options.push({
                    source_code: sourceCode,
                    source_name: String(item.source_name || sourceCode),
                    vod_id: item.vod_id,
                    api_url: item.api_url || null
                });
            }
            // Prefer an item with a cover or a longer useful description as the card representative.
            if ((!group.vod_pic && item.vod_pic) || (String(item.vod_content || '').length > String(group.vod_content || '').length)) {
                const options = group.source_options;
                Object.assign(group, item);
                group.source_options = options;
            }
            group.source_count = group.source_options.length;
        });
        return Array.from(groups.values());
    }

    function readJsonStorage(key, fallback) {
        try { return safeJsonParse(root.localStorage.getItem(key), fallback); }
        catch (_) { return fallback; }
    }

    const api = { escapeHtml, safeJsonParse, normalizeHttpUrl, normalizeTitle, groupSearchResults, readJsonStorage };
    root.LibreTVCore = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
