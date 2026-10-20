// 配置文件导入功能
async function importConfig() {
    // showImportBox is assumed to be global or in ui.js
    if (typeof showImportBox !== 'function') {
        console.error("showImportBox function not found.");
        if (typeof showToast === 'function') showToast('导入功能不可用', 'error');
        return;
    }

    showImportBox(async (file) => {
        try {
            if (!(file.type === 'application/json' || file.name.endsWith('.json'))) throw '文件类型不正确';
            if(file.size > 1024 * 1024 * 10) throw new Error('文件大小超过 10MB'); // Corrected error throwing
            const content = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject('文件读取失败'); // Corrected error throwing
                reader.readAsText(file);
            });
            const config = JSON.parse(content);
            if (config.name !== 'LibreTV-Settings') throw '配置文件格式不正确'; // Corrected error throwing
            
            // sha256 is assumed to be global or in a utility file (e.g., sha256.js)
            if (typeof sha256 !== 'function') {
                console.error("sha256 function not found. Cannot verify config hash.");
                throw "无法验证配置文件哈希"; // Corrected error throwing
            }
            const dataHash = await sha256(JSON.stringify(config.data));
            if (dataHash !== config.hash) throw new Error('配置文件哈希值不匹配');
            if (!config.data || typeof config.data !== 'object' || Array.isArray(config.data)) throw new Error('配置数据格式不正确');

            // 仅允许导入应用明确支持的键，防止配置文件覆盖无关的本地存储。
            const allowedKeys = new Set([
                'selectedAPIs', 'customAPIs', 'yellowFilterEnabled', 'adFilteringEnabled',
                'doubanEnabled', 'doubanApiMode', 'hasInitializedDefaults',
                'viewingHistory', 'videoSearchHistory', 'SEARCH_HISTORY_KEY'
            ]);
            const validated = {};
            for (const [key, rawValue] of Object.entries(config.data)) {
                if (!allowedKeys.has(key)) continue;
                if (typeof rawValue !== 'string') throw new Error(`配置项 ${key} 必须是字符串`);
                if (key === 'selectedAPIs') {
                    const ids = JSON.parse(rawValue);
                    if (!Array.isArray(ids) || !ids.every(id => typeof id === 'string' && /^[\w-]+$/.test(id))) throw new Error('所选数据源配置无效');
                } else if (key === 'customAPIs') {
                    const sources = JSON.parse(rawValue);
                    if (!Array.isArray(sources) || !sources.every(source => source && typeof source.name === 'string' && typeof source.url === 'string' && (window.LibreTVCore ? window.LibreTVCore.normalizeHttpUrl(source.url) : /^https?:\/\//.test(source.url)) && (!source.detail || (window.LibreTVCore ? window.LibreTVCore.normalizeHttpUrl(source.detail) : /^https?:\/\//.test(source.detail))))) throw new Error('自定义数据源配置无效');
                } else if (['yellowFilterEnabled', 'adFilteringEnabled', 'doubanEnabled', 'doubanApiMode', 'hasInitializedDefaults'].includes(key) && !['true', 'false'].includes(rawValue)) {
                    throw new Error(`配置项 ${key} 的布尔值无效`);
                }
                validated[key] = rawValue;
            }
            if (Object.keys(validated).length === 0) throw new Error('配置文件中没有可导入的设置');
            Object.entries(validated).forEach(([key, value]) => localStorage.setItem(key, value));
            if (typeof showToast === 'function') showToast('配置文件导入成功，3 秒后自动刷新本页面。', 'success'); else console.log("Config imported successfully.");
            setTimeout(() => {
                window.location.reload();
            }, 3000);
        } catch (error) {
            const message = (typeof error === 'string' ? error : (error instanceof Error ? error.message : '配置文件格式错误'));
            if (typeof showToast === 'function') showToast(`配置文件读取出错 (${message})`, 'error'); else console.error(`Config import error: ${message}`);
        }
    });
}

// 配置文件导出功能
async function exportConfig() {
    const config = {};
    const items = {};
    const settingsToExport = [
        'selectedAPIs',
        'customAPIs',
        'yellowFilterEnabled',
        // 'adFilteringEnabled', // This key was in the original list but might be PLAYER_CONFIG.adFilteringStorage
        PLAYER_CONFIG.adFilteringStorage, // Using the constant from original app.js
        'doubanEnabled',
        'doubanApiMode', // Added from initializeApp defaults
        'hasInitializedDefaults'
    ];
    settingsToExport.forEach(key => {
        const value = localStorage.getItem(key);
        if (value !== null) {
            items[key] = value;
        }
    });
    const viewingHistory = localStorage.getItem('viewingHistory'); // Assuming 'viewingHistory' is the key
    if (viewingHistory) {
        items['viewingHistory'] = viewingHistory;
    }
    // SEARCH_HISTORY_KEY is assumed to be global or defined elsewhere
    const searchHistory = localStorage.getItem(SEARCH_HISTORY_KEY); 
    if (searchHistory) {
        items[SEARCH_HISTORY_KEY] = searchHistory;
    }
    const times = Date.now().toString();
    config['name'] = 'LibreTV-Settings';
    config['time'] = times;
    config['cfgVer'] = '1.0.0';
    config['data'] = items;

    // sha256 is assumed to be global or in a utility file
    if (typeof sha256 !== 'function') {
        console.error("sha256 function not found. Cannot generate config hash for export.");
        if (typeof showToast === 'function') showToast('导出功能无法生成哈希。', 'error');
        return;
    }
    config['hash'] = await sha256(JSON.stringify(config['data']));
    saveStringAsFile(JSON.stringify(config), 'LibreTV-Settings_' + times + '.json');
}

// 将字符串保存为文件
function saveStringAsFile(content, fileName) {
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' }); // Changed type to application/json
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}
