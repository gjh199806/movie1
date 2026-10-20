// 全局变量
// 坏损或旧版本的本地配置不能阻止应用启动。
const __safeStoredJson = (key, fallback) => {
    try {
        const raw = localStorage.getItem(key);
        return window.LibreTVCore ? window.LibreTVCore.safeJsonParse(raw, fallback) : (raw ? JSON.parse(raw) : fallback);
    } catch (_) { return fallback; }
};
let selectedAPIs = __safeStoredJson('selectedAPIs', ['tyyszy', 'xiaomaomi', 'dyttzy', 'bfzy', 'ruyi']);
if (!Array.isArray(selectedAPIs)) selectedAPIs = ['tyyszy', 'xiaomaomi', 'dyttzy', 'bfzy', 'ruyi'];
selectedAPIs = selectedAPIs.filter(item => typeof item === 'string' && /^[\w-]+$/.test(item));
let customAPIs = __safeStoredJson('customAPIs', []);
if (!Array.isArray(customAPIs)) customAPIs = [];
customAPIs = customAPIs.filter(item => item && typeof item === 'object' && typeof item.name === 'string' && typeof item.url === 'string');

// 添加当前播放的集数索引
let currentEpisodeIndex = 0;
// 添加当前视频的所有集数
let currentEpisodes = [];
// 添加当前视频的标题
let currentVideoTitle = '';
// 全局变量用于倒序状态
let episodesReversed = false;

// Note: window.currentDetailContext was removed as per previous comments in the original app.js
// If any other global variables are identified as needed during further refactoring, they can be added here.
