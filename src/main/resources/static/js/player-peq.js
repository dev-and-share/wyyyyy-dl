/* ==========================================================================
   🎛️ NetEase Music Downloader - 5-Band Parametric EQ Engine (player-peq.js)
   ========================================================================== */

const STORAGE_PEQ_CONFIG_KEY = "wyyyy_peq_config";
const STORAGE_PEQ_CUSTOM_PRESETS_KEY = "wyyyy_peq_custom_presets";

const DEFAULT_PEQ_BANDS = [
    { id: 1, name: 'Band 1', label: '低频下潜/共振', desc: '抑制共振 / 补偿下潜', freq: 60, gain: 0, q: 1.4, type: 'peaking', minFreq: 20, maxFreq: 300 },
    { id: 2, name: 'Band 2', label: '去箱声/去闷', desc: '清理人声箱鸣与浑浊', freq: 230, gain: 0, q: 1.4, type: 'peaking', minFreq: 80, maxFreq: 1000 },
    { id: 3, name: 'Band 3', label: '人声厚度/主体', desc: '调整人声厚度与鼻音', freq: 910, gain: 0, q: 2.0, type: 'peaking', minFreq: 300, maxFreq: 3000 },
    { id: 4, name: 'Band 4', label: '细节提亮/去齿音', desc: '缓解刺耳 / 提亮细节', freq: 3600, gain: 0, q: 2.5, type: 'peaking', minFreq: 1000, maxFreq: 8000 },
    { id: 5, name: 'Band 5', label: '空气感/高频延伸', desc: '极高频通透感与延伸', freq: 14000, gain: 0, q: 0.7, type: 'peaking', minFreq: 5000, maxFreq: 20000 }
];

const BUILTIN_PRESETS = {
    flat: {
        name: '平直原音 (Flat)',
        desc: '原汁原味无调色',
        bands: [
            { freq: 60, gain: 0, q: 1.4 },
            { freq: 230, gain: 0, q: 1.4 },
            { freq: 910, gain: 0, q: 2.0 },
            { freq: 3600, gain: 0, q: 2.5 },
            { freq: 14000, gain: 0, q: 0.7 }
        ]
    },
    macbook: {
        name: 'MacBook 外放校正 (去箱鸣)',
        desc: '削弱 130Hz 浑浊共振，补偿 60Hz 与 14kHz 空气感',
        bands: [
            { freq: 60, gain: 2.5, q: 1.4 },
            { freq: 130, gain: -3.5, q: 2.0 },
            { freq: 910, gain: 0, q: 2.0 },
            { freq: 3600, gain: 1.5, q: 2.2 },
            { freq: 14000, gain: 2.0, q: 0.7 }
        ]
    },
    vocal: {
        name: '人声毒药 (清澈温暖)',
        desc: '清理 230Hz 箱鸣，提亮 3.6kHz 人声细节并平抑齿音',
        bands: [
            { freq: 60, gain: -0.5, q: 1.4 },
            { freq: 230, gain: -2.0, q: 1.8 },
            { freq: 910, gain: 1.5, q: 1.8 },
            { freq: 3600, gain: 2.5, q: 2.2 },
            { freq: 14000, gain: -1.5, q: 1.2 }
        ]
    },
    bass: {
        name: '澎湃重低音 (Bass Boost)',
        desc: '强劲极低频下潜，适度收敛中低频防浑浊',
        bands: [
            { freq: 60, gain: 5.0, q: 1.2 },
            { freq: 230, gain: -1.0, q: 1.4 },
            { freq: 910, gain: 0, q: 2.0 },
            { freq: 3600, gain: 1.0, q: 2.0 },
            { freq: 14000, gain: 1.0, q: 0.7 }
        ]
    },
    air: {
        name: '通透耳机 (Headphone Air)',
        desc: '提升 14kHz 极高频空气感与开阔声场',
        bands: [
            { freq: 60, gain: 1.5, q: 1.4 },
            { freq: 230, gain: -1.0, q: 1.4 },
            { freq: 910, gain: 0.5, q: 2.0 },
            { freq: 3600, gain: 2.0, q: 2.5 },
            { freq: 14000, gain: 3.5, q: 0.7 }
        ]
    }
};

let peqAudioCtx = null;
let peqSourceNode = null;
let peqFilters = [];
let peqPreampNode = null;
let isPeqEnabled = true;
let currentPeqPresetKey = 'flat';
let currentPeqBands = JSON.parse(JSON.stringify(DEFAULT_PEQ_BANDS));
let customPresets = {};

/**
 * 🚀 初始化 Web Audio API 节点链路
 */
function initPeqAudioContext() {
    if (peqAudioCtx) {
        if (peqAudioCtx.state === 'suspended') {
            peqAudioCtx.resume().catch(() => {});
        }
        return true;
    }

    const player = document.getElementById("globalAudioPlayer");
    if (!player) return false;

    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return false;

        peqAudioCtx = new AudioContextClass();
        player.crossOrigin = "anonymous";

        // 创建 MediaElementSource 单例
        peqSourceNode = peqAudioCtx.createMediaElementSource(player);

        // 前级衰减保护 Node (防止多段增益叠加导致数码削波破音)
        peqPreampNode = peqAudioCtx.createGain();
        peqPreampNode.gain.value = 1.0;

        // 创建 5 个 BiquadFilter 节点
        peqFilters = [];
        for (let i = 0; i < 5; i++) {
            const filter = peqAudioCtx.createBiquadFilter();
            filter.type = currentPeqBands[i].type || 'peaking';
            filter.frequency.value = currentPeqBands[i].freq;
            filter.gain.value = isPeqEnabled ? currentPeqBands[i].gain : 0;
            filter.Q.value = currentPeqBands[i].q;
            peqFilters.push(filter);
        }

        // 串联音频节点: Source -> Preamp -> Filter1 -> ... -> Filter5 -> Destination
        let lastNode = peqSourceNode;
        lastNode.connect(peqPreampNode);
        lastNode = peqPreampNode;

        for (let i = 0; i < peqFilters.length; i++) {
            lastNode.connect(peqFilters[i]);
            lastNode = peqFilters[i];
        }
        lastNode.connect(peqAudioCtx.destination);

        if (peqAudioCtx.state === 'suspended') {
            peqAudioCtx.resume().catch(() => {});
        }

        return true;
    } catch (e) {
        console.warn("[PEQ] 初始化 Web Audio 均衡器链路失败:", e);
        return false;
    }
}

/**
 * 💾 从 LocalStorage 加载 PEQ 配置与自定义预设
 */
function loadPeqConfigFromStorage() {
    try {
        const savedCustom = localStorage.getItem(STORAGE_PEQ_CUSTOM_PRESETS_KEY);
        if (savedCustom) {
            customPresets = JSON.parse(savedCustom) || {};
        }

        const savedConfig = localStorage.getItem(STORAGE_PEQ_CONFIG_KEY);
        if (savedConfig) {
            const parsed = JSON.parse(savedConfig);
            if (parsed && typeof parsed === 'object') {
                if (typeof parsed.enabled === 'boolean') isPeqEnabled = parsed.enabled;
                if (parsed.presetKey) currentPeqPresetKey = parsed.presetKey;
                if (Array.isArray(parsed.bands) && parsed.bands.length === 5) {
                    currentPeqBands = parsed.bands;
                }
            }
        }
    } catch (e) {
        console.warn("[PEQ] 读取存储配置失败:", e);
    }
    updatePeqToggleBtnUI();
}

/**
 * 💾 保存当前 PEQ 配置到 LocalStorage
 */
function savePeqConfigToStorage() {
    try {
        const config = {
            enabled: isPeqEnabled,
            presetKey: currentPeqPresetKey,
            bands: currentPeqBands
        };
        localStorage.setItem(STORAGE_PEQ_CONFIG_KEY, JSON.stringify(config));
        if (Object.keys(customPresets).length > 0) {
            localStorage.setItem(STORAGE_PEQ_CUSTOM_PRESETS_KEY, JSON.stringify(customPresets));
        }
    } catch (e) {
        console.warn("[PEQ] 保存存储配置失败:", e);
    }
}

/**
 * ⚡ 实时同步 Filter 节点参数
 */
function applyPeqFilterParams() {
    initPeqAudioContext();
    if (!peqFilters || peqFilters.length < 5) return;

    for (let i = 0; i < 5; i++) {
        const band = currentPeqBands[i];
        const filter = peqFilters[i];
        if (filter) {
            filter.frequency.setValueAtTime(band.freq, peqAudioCtx.currentTime);
            filter.gain.setValueAtTime(isPeqEnabled ? band.gain : 0, peqAudioCtx.currentTime);
            filter.Q.setValueAtTime(band.q, peqAudioCtx.currentTime);
        }
    }

    drawPeqCurve();
    updatePeqToggleBtnUI();
    savePeqConfigToStorage();
}

/**
 * 🎛️ 切换 PEQ 开启 / 旁通 (Bypass)
 */
function togglePeqEnable(forceState) {
    if (typeof forceState === 'boolean') {
        isPeqEnabled = forceState;
    } else {
        isPeqEnabled = !isPeqEnabled;
    }

    applyPeqFilterParams();
    const chk = document.getElementById("peqMasterSwitch");
    if (chk) chk.checked = isPeqEnabled;

    showToast(isPeqEnabled ? "⚡ 已启用 5 段参量均衡器" : "⚪ 已旁通 (Bypass) 参量均衡器", "info", 2000);
}

/**
 * 🎨 更新播放器底部 PEQ 按钮高亮状态
 */
function updatePeqToggleBtnUI() {
    const btn = document.getElementById("peqToggleBtn");
    const fullBtn = document.getElementById("fullPeqToggleBtn");
    const isEffectActive = isPeqEnabled && currentPeqBands.some(b => Math.abs(b.gain) > 0.05);

    [btn, fullBtn].forEach(el => {
        if (!el) return;
        if (isPeqEnabled) {
            el.classList.add("active");
            el.style.color = isEffectActive ? "#38bdf8" : "var(--primary-color, #e11d48)";
            el.style.borderColor = isEffectActive ? "rgba(56,189,248,0.4)" : "";
        } else {
            el.classList.remove("active");
            el.style.color = "";
            el.style.borderColor = "";
        }
    });
}

/**
 * 🏷️ 应用预设
 */
function applyPeqPreset(presetKey) {
    let preset = BUILTIN_PRESETS[presetKey];
    if (!preset && customPresets[presetKey]) {
        preset = customPresets[presetKey];
    }
    if (!preset) return;

    currentPeqPresetKey = presetKey;
    for (let i = 0; i < 5; i++) {
        if (preset.bands && preset.bands[i]) {
            currentPeqBands[i].freq = preset.bands[i].freq;
            currentPeqBands[i].gain = preset.bands[i].gain;
            currentPeqBands[i].q = preset.bands[i].q;
        }
    }

    renderPeqSlidersDOM();
    applyPeqFilterParams();

    const select = document.getElementById("peqPresetSelect");
    if (select) select.value = presetKey;

    showToast(`已载入调音预设：${preset.name}`, "success", 2000);
}

/**
 * 💾 将当前参数保存为新自定义预设
 */
function saveCurrentAsCustomPreset() {
    showAppModal({
        title: '保存为新均衡器预设',
        icon: '💾',
        content: `
            <div style="text-align:left; color:var(--text-secondary); font-size:13.5px; line-height:1.6;">
                请输入预设名称（如：<strong>Sony WH-1000XM5</strong> 或 <strong>车机调音</strong>）：
                <div style="margin-top:10px;">
                    <input type="text" id="customPresetNameInput" placeholder="输入预设名称..." style="width:100%; box-sizing:border-box; padding:9px 12px; border-radius:6px; border:1px solid var(--border-color); background:var(--input-bg); color:var(--text-main); font-size:14px;">
                </div>
            </div>
        `,
        confirmText: '保存预设',
        cancelText: '取消',
        showCancel: true
    }).then(confirmed => {
        if (!confirmed) return;
        const input = document.getElementById("customPresetNameInput");
        const name = input ? input.value.trim() : '';
        if (!name) {
            showToast("预设名称不能为空", "warning");
            return;
        }

        const key = 'custom_' + Date.now();
        customPresets[key] = {
            name: name,
            desc: '用户自定义',
            bands: currentPeqBands.map(b => ({ freq: b.freq, gain: b.gain, q: b.q }))
        };

        savePeqConfigToStorage();
        refreshPeqPresetSelectOptions(key);
        currentPeqPresetKey = key;
        showToast(`已成功保存预设「${name}」！`, "success");
    });
}

/**
 * 🔄 重置为默认平直
 */
function resetPeqToFlat() {
    applyPeqPreset('flat');
    showToast("已重置所有频段为默认 0 dB 平直", "info");
}

/**
 * 📈 实时在 Canvas 上绘制 20Hz~20kHz 综合幅频曲线
 */
function drawPeqCurve() {
    const canvas = document.getElementById("peqCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1);
    const height = canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, width, height);

    // 绘制暗色背景与网格线
    const isDark = document.body.getAttribute('data-theme') !== 'light';
    const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
    const textColor = isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)";
    const centerLineColor = isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.18)";

    const minFreq = 20;
    const maxFreq = 20000;
    const minDb = -15;
    const maxDb = 15;

    function freqToX(f) {
        return (Math.log10(f / minFreq) / Math.log10(maxFreq / minFreq)) * width;
    }

    function dbToY(db) {
        return height - ((db - minDb) / (maxDb - minDb)) * height;
    }

    // 绘制 0dB 水平基准线
    const zeroY = dbToY(0);
    ctx.strokeStyle = centerLineColor;
    ctx.lineWidth = 1 * (window.devicePixelRatio || 1);
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    ctx.lineTo(width, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    // 绘制 ±6dB, ±12dB 辅助水平网格
    ctx.strokeStyle = gridColor;
    [-12, -6, 6, 12].forEach(db => {
        const y = dbToY(db);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();

        ctx.fillStyle = textColor;
        ctx.font = `${9 * (window.devicePixelRatio || 1)}px sans-serif`;
        ctx.fillText((db > 0 ? `+${db}` : db) + 'dB', 6, y - 3);
    });

    // 绘制常用频率对数竖线 (50Hz, 100Hz, 500Hz, 1kHz, 5kHz, 10kHz, 20kHz)
    const gridFreqs = [50, 100, 250, 500, 1000, 2500, 5000, 10000, 20000];
    gridFreqs.forEach(f => {
        const x = freqToX(f);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();

        ctx.fillStyle = textColor;
        ctx.font = `${9 * (window.devicePixelRatio || 1)}px sans-serif`;
        const label = f >= 1000 ? `${f / 1000}k` : `${f}Hz`;
        ctx.fillText(label, x + 3, height - 6);
    });

    // 计算各采样点幅频响应
    const sampleCount = 180;
    const freqs = new Float32Array(sampleCount);
    for (let i = 0; i < sampleCount; i++) {
        const ratio = i / (sampleCount - 1);
        freqs[i] = minFreq * Math.pow(maxFreq / minFreq, ratio);
    }

    const totalMag = new Float32Array(sampleCount).fill(1.0);

    if (peqFilters && peqFilters.length === 5 && isPeqEnabled) {
        const magResponse = new Float32Array(sampleCount);
        const phaseResponse = new Float32Array(sampleCount);

        for (let b = 0; b < 5; b++) {
            peqFilters[b].getFrequencyResponse(freqs, magResponse, phaseResponse);
            for (let i = 0; i < sampleCount; i++) {
                totalMag[i] *= magResponse[i];
            }
        }
    }

    // 绘制曲线渐变填充
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "rgba(56, 189, 248, 0.35)");
    grad.addColorStop(0.5, "rgba(56, 189, 248, 0.08)");
    grad.addColorStop(1, "rgba(56, 189, 248, 0.0)");

    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    for (let i = 0; i < sampleCount; i++) {
        const db = isPeqEnabled ? 20 * Math.log10(Math.max(totalMag[i], 0.0001)) : 0;
        const x = freqToX(freqs[i]);
        const y = dbToY(db);
        if (i === 0) ctx.lineTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.lineTo(width, zeroY);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // 绘制曲线轮廓
    ctx.beginPath();
    for (let i = 0; i < sampleCount; i++) {
        const db = isPeqEnabled ? 20 * Math.log10(Math.max(totalMag[i], 0.0001)) : 0;
        const x = freqToX(freqs[i]);
        const y = dbToY(db);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = isPeqEnabled ? "#38bdf8" : "rgba(148, 163, 184, 0.6)";
    ctx.lineWidth = 2.5 * (window.devicePixelRatio || 1);
    ctx.stroke();

    // 绘制 5 个中心频率点徽标
    currentPeqBands.forEach((band, idx) => {
        const x = freqToX(band.freq);
        const y = dbToY(isPeqEnabled ? band.gain : 0);

        ctx.beginPath();
        ctx.arc(x, y, 5.5 * (window.devicePixelRatio || 1), 0, Math.PI * 2);
        ctx.fillStyle = isPeqEnabled ? "#0284c7" : "#64748b";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2 * (window.devicePixelRatio || 1);
        ctx.stroke();

        // 标号
        ctx.fillStyle = isDark ? "#ffffff" : "#1e293b";
        ctx.font = `bold ${10 * (window.devicePixelRatio || 1)}px sans-serif`;
        ctx.fillText(`${idx + 1}`, x - 3, y - 8 * (window.devicePixelRatio || 1));
    });
}

/**
 * 🎚️ 渲染 5 个 Band 的滑块与调节控件
 */
function renderPeqSlidersDOM() {
    const container = document.getElementById("peqSlidersContainer");
    if (!container) return;

    let html = '';
    currentPeqBands.forEach((band, idx) => {
        const gainSign = band.gain > 0 ? `+${band.gain.toFixed(1)}` : band.gain.toFixed(1);
        const freqLabel = band.freq >= 1000 ? `${(band.freq / 1000).toFixed(1)} kHz` : `${band.freq} Hz`;

        html += `
            <div class="peq-band-card" id="peq-band-card-${idx}">
                <div class="peq-band-header">
                    <span class="peq-band-badge">${idx + 1}</span>
                    <div class="peq-band-title-wrap">
                        <strong class="peq-band-name">${band.label}</strong>
                        <span class="peq-band-desc">${band.desc}</span>
                    </div>
                </div>

                <!-- Gain 滑块 (核心) -->
                <div class="peq-param-row gain-row">
                    <div class="peq-param-label">
                        <span>Gain 增益</span>
                        <span class="peq-val-display" id="peq-gain-val-${idx}">${gainSign} dB</span>
                    </div>
                    <div class="peq-slider-wrap">
                        <input type="range" class="peq-slider gain-slider" min="-12" max="12" step="0.1" value="${band.gain}" 
                            oninput="onPeqGainChange(${idx}, this.value)">
                    </div>
                </div>

                <!-- Freq 与 Q 展开微调 -->
                <div class="peq-sub-params">
                    <div class="peq-sub-col">
                        <span class="peq-sub-label">中心频率 (Freq)</span>
                        <div class="peq-sub-val-row">
                            <input type="number" class="peq-num-input" min="${band.minFreq}" max="${band.maxFreq}" step="10" value="${band.freq}" 
                                onchange="onPeqFreqChange(${idx}, this.value)">
                            <span class="peq-unit">Hz</span>
                        </div>
                    </div>
                    <div class="peq-sub-col">
                        <span class="peq-sub-label">品质因数 (Q)</span>
                        <div class="peq-sub-val-row">
                            <input type="number" class="peq-num-input" min="0.5" max="10" step="0.1" value="${band.q}" 
                                onchange="onPeqQChange(${idx}, this.value)">
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function onPeqGainChange(idx, val) {
    const num = parseFloat(val) || 0;
    currentPeqBands[idx].gain = num;
    const disp = document.getElementById(`peq-gain-val-${idx}`);
    if (disp) disp.textContent = (num > 0 ? `+${num.toFixed(1)}` : num.toFixed(1)) + ' dB';
    currentPeqPresetKey = 'custom';
    const select = document.getElementById("peqPresetSelect");
    if (select) select.value = 'custom';
    applyPeqFilterParams();
}

function onPeqFreqChange(idx, val) {
    let num = parseInt(val, 10) || currentPeqBands[idx].freq;
    num = Math.max(20, Math.min(20000, num));
    currentPeqBands[idx].freq = num;
    currentPeqPresetKey = 'custom';
    applyPeqFilterParams();
}

function onPeqQChange(idx, val) {
    let num = parseFloat(val) || currentPeqBands[idx].q;
    num = Math.max(0.5, Math.min(10.0, num));
    currentPeqBands[idx].q = num;
    currentPeqPresetKey = 'custom';
    applyPeqFilterParams();
}

/**
 * 🔄 刷新预设选择下拉框列表
 */
function refreshPeqPresetSelectOptions(selectKey) {
    const select = document.getElementById("peqPresetSelect");
    if (!select) return;

    let html = `<optgroup label="官方精选调音">`;
    Object.keys(BUILTIN_PRESETS).forEach(k => {
        html += `<option value="${k}">${BUILTIN_PRESETS[k].name}</option>`;
    });
    html += `</optgroup>`;

    const customKeys = Object.keys(customPresets);
    if (customKeys.length > 0) {
        html += `<optgroup label="我的自定义预设">`;
        customKeys.forEach(k => {
            html += `<option value="${k}">⭐ ${customPresets[k].name}</option>`;
        });
        html += `</optgroup>`;
    }
    html += `<option value="custom">✏️ 自定义调节中...</option>`;

    select.innerHTML = html;
    if (selectKey) select.value = selectKey;
    else select.value = currentPeqPresetKey;
}

/**
 * 🎛️ 打开 / 关闭 PEQ 均衡器弹窗抽屉
 */
function togglePeqDrawer() {
    const drawer = document.getElementById("peqDrawerModal");
    if (!drawer) return;

    if (drawer.style.display === 'none' || !drawer.style.display) {
        drawer.style.display = 'flex';
        initPeqAudioContext();
        refreshPeqPresetSelectOptions();
        renderPeqSlidersDOM();
        setTimeout(drawPeqCurve, 60);

        const chk = document.getElementById("peqMasterSwitch");
        if (chk) chk.checked = isPeqEnabled;
    } else {
        drawer.style.display = 'none';
    }
}

function closePeqDrawer() {
    const drawer = document.getElementById("peqDrawerModal");
    if (drawer) drawer.style.display = 'none';
}

// 页面加载自动初始化
document.addEventListener("DOMContentLoaded", () => {
    loadPeqConfigFromStorage();
});

window.initPeqAudioContext = initPeqAudioContext;
window.togglePeqDrawer = togglePeqDrawer;
window.closePeqDrawer = closePeqDrawer;
window.togglePeqEnable = togglePeqEnable;
window.applyPeqPreset = applyPeqPreset;
window.saveCurrentAsCustomPreset = saveCurrentAsCustomPreset;
window.resetPeqToFlat = resetPeqToFlat;
window.onPeqGainChange = onPeqGainChange;
window.onPeqFreqChange = onPeqFreqChange;
window.onPeqQChange = onPeqQChange;
