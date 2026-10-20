// 搜索与结果展示。每次搜索使用递增令牌，避免旧请求覆盖新查询。
let __libreTvSearchToken = 0;

function __searchCore() {
    return window.LibreTVCore || {
        escapeHtml: value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
        normalizeHttpUrl: value => { try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password ? u.href : null; } catch (_) { return null; } },
        groupSearchResults: items => items
    };
}

function __getSearchSource(apiId) {
    if (String(apiId).startsWith('custom_')) {
        const index = String(apiId).slice('custom_'.length);
        const source = typeof getCustomApiInfo === 'function' ? getCustomApiInfo(index) : null;
        if (!source || !source.url) return null;
        const base = __searchCore().normalizeHttpUrl(source.url);
        if (!base) return null;
        return { id: String(apiId), name: String(source.name || `自定义源 ${index}`), base, detailBase: source.detail || base };
    }
    const source = typeof API_SITES !== 'undefined' ? API_SITES[apiId] : null;
    if (!source || !source.api) return null;
    const base = __searchCore().normalizeHttpUrl(source.api);
    if (!base) return null;
    return { id: String(apiId), name: String(source.name || apiId), base, detailBase: source.detail || base };
}

async function __requestSearchJson(url, timeoutSecs) {
    if (typeof tauriConstants === 'undefined' || !tauriConstants.invoke) {
        throw new Error('当前运行环境的网络请求接口不可用');
    }
    const response = await tauriConstants.invoke('make_http_request', {
        options: {
            url,
            method: 'GET',
            headers: API_CONFIG.search.headers,
            timeout_secs: timeoutSecs
        }
    });
    if (!response || !(response.status >= 200 && response.status < 300)) {
        throw new Error(`HTTP ${response && response.status ? response.status : '请求失败'}`);
    }
    let data;
    try { data = JSON.parse(response.body); }
    catch (_) { throw new Error('资源站返回的内容不是有效 JSON'); }
    if (!data || !Array.isArray(data.list)) throw new Error('资源站返回格式不符合点播 API 规范');
    return data;
}

async function __searchOneSource(apiId, query) {
    const source = __getSearchSource(apiId);
    if (!source) return { apiId, results: [], failed: true, error: '数据源配置无效' };
    const timeoutSecs = Math.max(3, Math.floor((typeof AGGREGATED_SEARCH_CONFIG !== 'undefined' ? AGGREGATED_SEARCH_CONFIG.timeout : 8000) / 1000) || 8);
    const maxPages = Math.max(1, Math.min(3, Number(API_CONFIG.search.maxPages) || 3));
    try {
        const firstUrl = `${source.base}${API_CONFIG.search.path}${encodeURIComponent(query)}`;
        const first = await __requestSearchJson(firstUrl, timeoutSecs);
        const results = first.list.map(item => ({ ...item, source_name: source.name, source_code: source.id, api_url: source.base }));
        const pageCount = Math.max(1, Number(first.pagecount) || 1);
        const pages = Math.min(pageCount - 1, maxPages - 1);
        if (pages > 0 && API_CONFIG.search.pagePath) {
            const pageRequests = [];
            for (let page = 2; page <= pages + 1; page++) {
                const pageUrl = `${source.base}${API_CONFIG.search.pagePath.replace('{query}', encodeURIComponent(query)).replace('{page}', String(page))}`;
                pageRequests.push(__requestSearchJson(pageUrl, timeoutSecs).then(data => data.list.map(item => ({ ...item, source_name: source.name, source_code: source.id, api_url: source.base }))).catch(error => {
                    console.warn(`数据源 ${source.name} 第 ${page} 页失败：`, error.message);
                    return [];
                }));
            }
            (await Promise.all(pageRequests)).forEach(pageItems => results.push(...pageItems));
        }
        return { apiId, results, failed: false, error: null };
    } catch (error) {
        console.warn(`数据源 ${source.name} 搜索失败：`, error.message);
        return { apiId, results: [], failed: true, error: error.message || '请求失败' };
    }
}

function __setSearchStatus(message, isError = false) {
    let status = document.getElementById('searchSourceStatus');
    const resultsArea = document.getElementById('resultsArea');
    if (!status && resultsArea) {
        status = document.createElement('p');
        status.id = 'searchSourceStatus';
        status.className = 'text-xs mt-2 text-right';
        const header = resultsArea.querySelector('.mx-auto.max-w-7xl');
        if (header) header.insertBefore(status, header.querySelector('#results'));
        else resultsArea.prepend(status);
    }
    if (status) {
        status.textContent = message;
        status.className = `text-xs mt-2 text-right ${isError ? 'text-amber-400' : 'text-gray-500'}`;
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
    }
}

function __renderSearchResults(items) {
    const resultsDiv = document.getElementById('results');
    if (!resultsDiv) return;
    resultsDiv.replaceChildren();
    const core = __searchCore();
    const fragment = document.createDocumentFragment();

    items.forEach(item => {
        const card = document.createElement('article');
        card.className = 'search-result-card card-hover bg-[#111] rounded-lg overflow-hidden transition-all shadow-sm hover:shadow-md';
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `查看 ${String(item.vod_name || '未知视频')} 的详情`);
        card.dataset.vodId = String(item.vod_id == null ? '' : item.vod_id);
        card.dataset.vodName = String(item.vod_name || '未知视频');
        card.dataset.sourceCode = String(item.source_code || '');

        const layout = document.createElement('div');
        layout.className = 'flex h-full';
        const coverUrl = item.vod_pic ? core.normalizeHttpUrl(String(item.vod_pic)) : null;
        if (coverUrl) {
            const coverWrap = document.createElement('div');
            coverWrap.className = 'relative flex-shrink-0 search-card-img-container';
            const img = document.createElement('img');
            img.src = coverUrl;
            img.alt = String(item.vod_name || '影视封面');
            img.loading = 'lazy';
            img.referrerPolicy = 'no-referrer';
            img.className = 'h-full w-full object-cover';
            img.addEventListener('error', () => { coverWrap.remove(); }, { once: true });
            coverWrap.appendChild(img);
            layout.appendChild(coverWrap);
        }

        const content = document.createElement('div');
        content.className = 'p-3 flex flex-col flex-grow min-w-0';
        const title = document.createElement('h3');
        title.className = 'font-semibold mb-2 break-words line-clamp-2';
        title.textContent = String(item.vod_name || '未知视频');
        content.appendChild(title);

        const meta = document.createElement('div');
        meta.className = 'flex flex-wrap gap-1 mb-2';
        [item.type_name, item.vod_year, item.vod_remarks].filter(value => value != null && String(value).trim()).slice(0, 3).forEach((value, index) => {
            const chip = document.createElement('span');
            chip.className = `text-xs py-0.5 px-1.5 rounded ${index === 0 ? 'bg-blue-900 text-blue-200' : 'bg-[#222] text-gray-300'}`;
            chip.textContent = String(value);
            meta.appendChild(chip);
        });
        content.appendChild(meta);

        const sourceOptions = Array.isArray(item.source_options) && item.source_options.length
            ? item.source_options
            : [{ source_code: item.source_code || '', source_name: item.source_name || item.source_code || '默认来源', vod_id: item.vod_id }];
        const sourceArea = document.createElement('div');
        sourceArea.className = 'mt-auto pt-2 border-t border-gray-800 flex flex-wrap gap-1 items-center';
        const sourceLabel = document.createElement('span');
        sourceLabel.className = 'text-xs text-gray-500 mr-1';
        sourceLabel.textContent = sourceOptions.length > 1 ? `${sourceOptions.length} 个来源：` : '来源：';
        sourceArea.appendChild(sourceLabel);
        sourceOptions.forEach(option => {
            const sourceButton = document.createElement('button');
            sourceButton.type = 'button';
            sourceButton.className = 'source-choice text-xs bg-[#222] hover:bg-[#333] text-gray-200 rounded-full px-2 py-1';
            sourceButton.textContent = String(option.source_name || option.source_code || '来源');
            sourceButton.dataset.sourceCode = String(option.source_code || '');
            sourceButton.dataset.vodId = String(option.vod_id == null ? item.vod_id || '' : option.vod_id);
            sourceButton.dataset.vodName = String(item.vod_name || '未知视频');
            sourceButton.setAttribute('aria-label', `使用${sourceButton.textContent}查看详情`);
            sourceArea.appendChild(sourceButton);
        });
        content.appendChild(sourceArea);
        layout.appendChild(content);
        card.appendChild(layout);
        fragment.appendChild(card);
    });
    resultsDiv.appendChild(fragment);
}

function __bindSearchResultEvents() {
    const resultsDiv = document.getElementById('results');
    if (!resultsDiv || resultsDiv.dataset.eventsBound === 'true') return;
    resultsDiv.dataset.eventsBound = 'true';
    const openDetails = (target, sourceOverride) => {
        const card = target.closest('.search-result-card');
        if (!card) return;
        const sourceCode = sourceOverride || card.dataset.sourceCode;
        const id = sourceOverride ? target.dataset.vodId : card.dataset.vodId;
        const name = sourceOverride ? target.dataset.vodName : card.dataset.vodName;
        if (typeof showDetails === 'function') showDetails(id, name, sourceCode);
        else if (typeof showToast === 'function') showToast('详情模块尚未就绪，请重试', 'error');
    };
    resultsDiv.addEventListener('click', event => {
        const sourceButton = event.target.closest('.source-choice');
        if (sourceButton) { event.preventDefault(); event.stopPropagation(); openDetails(sourceButton, sourceButton.dataset.sourceCode); return; }
        openDetails(event.target, null);
    });
    resultsDiv.addEventListener('keydown', event => {
        if (event.target.closest('.source-choice')) return;
        if (event.key === 'Enter' || event.key === ' ') { const card = event.target.closest('.search-result-card'); if (card) { event.preventDefault(); openDetails(card, null); } }
    });
}

async function search() {
    if (window.isPasswordProtected && window.isPasswordVerified && window.isPasswordProtected() && !window.isPasswordVerified()) {
        if (typeof showPasswordModal === 'function') showPasswordModal();
        return;
    }
    const token = ++__libreTvSearchToken;
    const input = document.getElementById('searchInput');
    const query = input ? input.value.trim() : '';
    if (!query) {
        if (typeof hideLoading === 'function') hideLoading();
        if (typeof showToast === 'function') showToast('请输入搜索内容', 'info');
        return;
    }
    if (!Array.isArray(selectedAPIs) || selectedAPIs.length === 0) {
        if (typeof hideLoading === 'function') hideLoading();
        if (typeof showToast === 'function') showToast('请至少选择一个数据源', 'warning');
        return;
    }

    if (typeof showLoading === 'function') showLoading();
    const resultsArea = document.getElementById('resultsArea');
    if (resultsArea) resultsArea.classList.remove('hidden');
    const resultsDiv = document.getElementById('results');
    if (resultsDiv) resultsDiv.replaceChildren();
    __setSearchStatus(`正在搜索 ${selectedAPIs.length} 个数据源…`);

    try {
        if (typeof saveSearchHistory === 'function') saveSearchHistory(query);
        try { sessionStorage.setItem('lastSearchQuery', query); sessionStorage.setItem('lastPageView', 'searchResults'); } catch (_) {}

        const outcomes = await Promise.all([...new Set(selectedAPIs)].map(apiId => __searchOneSource(apiId, query)));
        if (token !== __libreTvSearchToken) return; // 新查询已开始，不更新旧 UI。

        const allResults = outcomes.flatMap(outcome => outcome.results);
        const filteredResults = localStorage.getItem('yellowFilterEnabled') === 'true'
            ? allResults.filter(item => {
                const banned = ['伦理片','福利','里番动漫','门事件','萝莉少女','制服诱惑','国产传媒','cosplay','黑丝诱惑','无码','日本无码','有码','日本有码','SWAG','网红主播','色情片','同性片','福利视频','福利片'];
                const typeName = String(item.type_name || '');
                return !banned.some(keyword => typeName.includes(keyword));
            }) : allResults;
        const grouped = coreGroup(filteredResults);
        const failed = outcomes.filter(outcome => outcome.failed);
        const healthy = outcomes.length - failed.length;
        const countEl = document.getElementById('searchResultsCount');
        if (countEl) countEl.textContent = String(grouped.length);
        __bindSearchResultEvents();
        __renderSearchResults(grouped);

        if (grouped.length === 0 && failed.length === outcomes.length) {
            __setSearchStatus(`全部 ${outcomes.length} 个数据源请求失败。请检测数据源或稍后重试。`, true);
            if (resultsDiv) resultsDiv.innerHTML = '<div class="col-span-full text-center py-12 text-gray-400"><h3 class="text-lg font-medium">暂时无法获取搜索结果</h3><p class="mt-2 text-sm">所有选中的数据源均未能正常响应，请检查网络或数据源配置。</p><button type="button" id="retrySearchButton" class="mt-4 px-4 py-2 rounded bg-[#333] hover:bg-[#444]">重试搜索</button></div>';
            const retry = document.getElementById('retrySearchButton');
            if (retry) retry.addEventListener('click', () => search());
        } else if (grouped.length === 0) {
            __setSearchStatus(`已检测 ${healthy} 个正常数据源，${failed.length} 个数据源失败。`, failed.length > 0);
            if (resultsDiv) resultsDiv.innerHTML = '<div class="col-span-full text-center py-12 text-gray-400"><h3 class="text-lg font-medium">没有找到匹配的结果</h3><p class="mt-2 text-sm">请尝试其他关键词或启用更多数据源。</p></div>';
        } else {
            __setSearchStatus(`展示 ${grouped.length} 部作品（来自 ${healthy} 个正常数据源）${failed.length ? `；${failed.length} 个数据源失败` : ''}`, failed.length > 0);
        }
    } catch (error) {
        if (token !== __libreTvSearchToken) return;
        console.error('搜索流程失败：', error);
        __setSearchStatus('搜索过程发生错误，请重试。', true);
        if (typeof showToast === 'function') showToast('搜索失败，请稍后重试', 'error');
    } finally {
        if (token === __libreTvSearchToken && typeof hideLoading === 'function') hideLoading();
    }
}

function coreGroup(items) {
    const core = window.LibreTVCore;
    return core && typeof core.groupSearchResults === 'function' ? core.groupSearchResults(items) : items;
}
