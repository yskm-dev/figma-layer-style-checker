"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
figma.showUI(__html__, { width: 340, height: 560 });
const ENABLE_TEXT_STYLE_MIXED_WARNING = true;
const REASON_ORDER = {
    'Text style': 0,
    'Text style が混在': 1,
    'Fill color': 2,
    'Stroke color': 3
};
function normalizeReasonOrder(reasons) {
    return [...reasons].sort((a, b) => {
        var _a, _b;
        const orderA = (_a = REASON_ORDER[a.label]) !== null && _a !== void 0 ? _a : Number.MAX_SAFE_INTEGER;
        const orderB = (_b = REASON_ORDER[b.label]) !== null && _b !== void 0 ? _b : Number.MAX_SAFE_INTEGER;
        return orderA - orderB;
    });
}
function isMissingStyleId(styleId) {
    return styleId === '' || styleId === figma.mixed;
}
function getTextStyleAttrs(style) {
    return style;
}
function getPaintArray(value) {
    if (value === figma.mixed || !Array.isArray(value)) {
        return null;
    }
    return value;
}
function normalizePaint(paint) {
    var _a;
    const common = {
        type: paint.type,
        visible: paint.visible !== false,
        opacity: (_a = paint.opacity) !== null && _a !== void 0 ? _a : 1,
        blendMode: paint.blendMode
    };
    if (paint.type === 'SOLID') {
        return Object.assign(Object.assign({}, common), { color: paint.color });
    }
    if (paint.type === 'GRADIENT_LINEAR' ||
        paint.type === 'GRADIENT_RADIAL' ||
        paint.type === 'GRADIENT_ANGULAR' ||
        paint.type === 'GRADIENT_DIAMOND') {
        return Object.assign(Object.assign({}, common), { gradientStops: paint.gradientStops, gradientTransform: paint.gradientTransform });
    }
    return common;
}
function paintsEqual(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    const left = JSON.stringify(a.map(normalizePaint));
    const right = JSON.stringify(b.map(normalizePaint));
    return left === right;
}
function roundNumber(value, precision = 4) {
    const factor = Math.pow(10, precision);
    return Math.round(value * factor) / factor;
}
function normalizeNumber(value, defaultValue = 0) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return defaultValue;
    }
    return roundNumber(value);
}
function normalizeFontName(value) {
    if (!value || value === figma.mixed || typeof value !== 'object') {
        return null;
    }
    const obj = value;
    const family = typeof obj.family === 'string' ? obj.family : '';
    const style = typeof obj.style === 'string' ? obj.style : '';
    if (!family || !style) {
        return null;
    }
    return { family, style };
}
function normalizeLineHeight(value) {
    if (value === figma.mixed) {
        return null;
    }
    if (!value || typeof value !== 'object') {
        return 'AUTO';
    }
    const obj = value;
    const unit = typeof obj.unit === 'string' ? obj.unit : 'AUTO';
    if (unit === 'AUTO') {
        return 'AUTO';
    }
    const numeric = normalizeNumber(obj.value);
    return `${unit}:${numeric}`;
}
function normalizeLetterSpacing(value) {
    if (value === figma.mixed) {
        return null;
    }
    if (!value || typeof value !== 'object') {
        return 'PIXELS:0';
    }
    const obj = value;
    const unit = typeof obj.unit === 'string' ? obj.unit : 'PIXELS';
    const numeric = normalizeNumber(obj.value);
    return `${unit}:${numeric}`;
}
function normalizeTextCase(value) {
    if (value === 'UPPER' ||
        value === 'LOWER' ||
        value === 'TITLE' ||
        value === 'SMALL_CAPS' ||
        value === 'SMALL_CAPS_FORCED' ||
        value === 'ORIGINAL') {
        return value;
    }
    return 'ORIGINAL';
}
function normalizeTextDecoration(value) {
    if (value === 'NONE' || value === 'UNDERLINE' || value === 'STRIKETHROUGH') {
        return value;
    }
    return 'NONE';
}
const WEIGHT_MAP = [
    { token: 'thin', weight: 100 },
    { token: 'extra light', weight: 200 },
    { token: 'ultra light', weight: 200 },
    { token: 'light', weight: 300 },
    { token: 'book', weight: 400 },
    { token: 'regular', weight: 400 },
    { token: 'normal', weight: 400 },
    { token: 'medium', weight: 500 },
    { token: 'semi bold', weight: 600 },
    { token: 'demi bold', weight: 600 },
    { token: 'bold', weight: 700 },
    { token: 'extra bold', weight: 800 },
    { token: 'ultra bold', weight: 800 },
    { token: 'black', weight: 900 },
    { token: 'heavy', weight: 900 },
];
function normalizeFontStyleMeta(styleName) {
    const lower = styleName.trim().toLowerCase();
    const isItalic = /italic|oblique/.test(lower);
    const keySource = lower.replace(/italic|oblique/g, '').replace(/\s+/g, ' ').trim();
    for (const item of WEIGHT_MAP) {
        if (keySource.includes(item.token)) {
            return { styleKey: keySource, weight: item.weight, isItalic };
        }
    }
    return { styleKey: keySource, weight: null, isItalic };
}
function resolveLineHeightPx(lineHeight, fontSize) {
    if (lineHeight === figma.mixed) {
        return null;
    }
    if (!lineHeight || typeof lineHeight !== 'object') {
        return null;
    }
    const obj = lineHeight;
    const unit = typeof obj.unit === 'string' ? obj.unit : 'AUTO';
    const value = normalizeNumber(obj.value, Number.NaN);
    if (unit === 'AUTO') {
        return null;
    }
    if (Number.isNaN(value)) {
        return null;
    }
    if (unit === 'PERCENT') {
        return roundNumber((fontSize * value) / 100, 4);
    }
    return roundNumber(value, 4);
}
// ── Text 混在判定用（hasMixedFontSettingsInTextNode のみが使用） ────────────
function createCoreTextSignature(input) {
    const font = normalizeFontName(input.fontName);
    if (!font) {
        return null;
    }
    const fontSize = normalizeNumber(input.fontSize, Number.NaN);
    if (Number.isNaN(fontSize)) {
        return null;
    }
    const styleMeta = normalizeFontStyleMeta(font.style);
    const lineHeightPx = resolveLineHeightPx(input.lineHeight, fontSize);
    return {
        fontFamily: font.family.trim().toLowerCase(),
        fontStyleKey: styleMeta.styleKey,
        fontWeight: styleMeta.weight,
        isItalic: styleMeta.isItalic,
        fontSize,
        lineHeightPx
    };
}
function sameCoreTextSignature(a, b) {
    if (a.fontFamily !== b.fontFamily) {
        return false;
    }
    if (a.isItalic !== b.isItalic) {
        return false;
    }
    if (Math.abs(a.fontSize - b.fontSize) > 0.01) {
        return false;
    }
    if (a.lineHeightPx === null || b.lineHeightPx === null) {
        if (a.lineHeightPx !== b.lineHeightPx) {
            return false;
        }
    }
    else if (Math.abs(a.lineHeightPx - b.lineHeightPx) > 0.05) {
        return false;
    }
    if (a.fontWeight !== null && b.fontWeight !== null) {
        return a.fontWeight === b.fontWeight;
    }
    return a.fontStyleKey === b.fontStyleKey;
}
function hasMixedFontSettingsInTextNode(node) {
    const segments = node.getStyledTextSegments([
        'fontName',
        'fontSize',
        'lineHeight'
    ]);
    if (segments.length <= 1) {
        return false;
    }
    const base = createCoreTextSignature({
        fontName: segments[0].fontName,
        fontSize: segments[0].fontSize,
        lineHeight: segments[0].lineHeight
    });
    if (!base) {
        return false;
    }
    for (let i = 1; i < segments.length; i += 1) {
        const current = createCoreTextSignature({
            fontName: segments[i].fontName,
            fontSize: segments[i].fontSize,
            lineHeight: segments[i].lineHeight
        });
        if (!current || !sameCoreTextSignature(base, current)) {
            return true;
        }
    }
    return false;
}
// ── Text style 一致判定 ───────────────────────────────────────────────────
function createTextSignature(input, options) {
    const font = normalizeFontName(input.fontName);
    if (!font) {
        return null;
    }
    const fontSize = normalizeNumber(input.fontSize, Number.NaN);
    if (Number.isNaN(fontSize)) {
        return null;
    }
    const lineHeight = normalizeLineHeight(input.lineHeight);
    const letterSpacing = normalizeLetterSpacing(input.letterSpacing);
    if (!lineHeight || !letterSpacing) {
        return null;
    }
    let normalizedFills = '';
    if (!(options === null || options === void 0 ? void 0 : options.ignoreFills)) {
        const fills = getPaintArray(input.fills);
        if (!fills) {
            return null;
        }
        normalizedFills = JSON.stringify(fills.map(normalizePaint));
    }
    return {
        fontFamily: font.family,
        fontStyle: font.style,
        fontSize,
        lineHeight,
        letterSpacing,
        textCase: normalizeTextCase(input.textCase),
        textDecoration: normalizeTextDecoration(input.textDecoration),
        paragraphIndent: normalizeNumber(input.paragraphIndent),
        paragraphSpacing: normalizeNumber(input.paragraphSpacing),
        listSpacing: normalizeNumber(input.listSpacing),
        fills: normalizedFills
    };
}
function sameTextSignature(a, b) {
    return (a.fontFamily === b.fontFamily &&
        a.fontStyle === b.fontStyle &&
        a.fontSize === b.fontSize &&
        a.lineHeight === b.lineHeight &&
        a.letterSpacing === b.letterSpacing &&
        a.textCase === b.textCase &&
        a.textDecoration === b.textDecoration &&
        a.paragraphIndent === b.paragraphIndent &&
        a.paragraphSpacing === b.paragraphSpacing &&
        a.listSpacing === b.listSpacing &&
        a.fills === b.fills);
}
function getTextNodeSignature(node, options) {
    const direct = createTextSignature({
        fontName: node.fontName,
        fontSize: node.fontSize,
        lineHeight: node.lineHeight,
        letterSpacing: node.letterSpacing,
        textCase: node.textCase,
        textDecoration: node.textDecoration,
        paragraphIndent: node.paragraphIndent,
        paragraphSpacing: node.paragraphSpacing,
        listSpacing: node.listSpacing,
        fills: node.fills
    }, options);
    if (direct) {
        return direct;
    }
    const segments = node.getStyledTextSegments([
        'fontName',
        'fontSize',
        'lineHeight',
        'letterSpacing',
        'textCase',
        'textDecoration',
        'paragraphIndent',
        'paragraphSpacing',
        'listSpacing',
        'fills'
    ]);
    if (segments.length === 0) {
        return null;
    }
    const base = createTextSignature({
        fontName: segments[0].fontName,
        fontSize: segments[0].fontSize,
        lineHeight: segments[0].lineHeight,
        letterSpacing: segments[0].letterSpacing,
        textCase: segments[0].textCase,
        textDecoration: segments[0].textDecoration,
        paragraphIndent: segments[0].paragraphIndent,
        paragraphSpacing: segments[0].paragraphSpacing,
        listSpacing: segments[0].listSpacing,
        fills: segments[0].fills
    }, options);
    if (!base) {
        return null;
    }
    for (let i = 1; i < segments.length; i += 1) {
        const sig = createTextSignature({
            fontName: segments[i].fontName,
            fontSize: segments[i].fontSize,
            lineHeight: segments[i].lineHeight,
            letterSpacing: segments[i].letterSpacing,
            textCase: segments[i].textCase,
            textDecoration: segments[i].textDecoration,
            paragraphIndent: segments[i].paragraphIndent,
            paragraphSpacing: segments[i].paragraphSpacing,
            listSpacing: segments[i].listSpacing,
            fills: segments[i].fills
        }, options);
        if (!sig || !sameTextSignature(sig, base)) {
            return null;
        }
    }
    return base;
}
// ── スキャン前に1回だけ構築するスタイルインデックス ─────────────────────
function buildPaintStyleIndex(paintStyles) {
    const index = new Map();
    for (const style of paintStyles) {
        const key = JSON.stringify(style.paints.map(normalizePaint));
        if (!index.has(key)) {
            index.set(key, style);
        }
    }
    return index;
}
function getMatchingPaintStyle(paints, paintStyleIndex) {
    var _a;
    const key = JSON.stringify(paints.map(normalizePaint));
    return (_a = paintStyleIndex.get(key)) !== null && _a !== void 0 ? _a : null;
}
function buildTextStyleEntries(textStyles) {
    return textStyles.map((style) => {
        const attrs = getTextStyleAttrs(style);
        const input = {
            fontName: attrs.fontName,
            fontSize: attrs.fontSize,
            lineHeight: attrs.lineHeight,
            letterSpacing: attrs.letterSpacing,
            textCase: attrs.textCase,
            textDecoration: attrs.textDecoration,
            paragraphIndent: attrs.paragraphIndent,
            paragraphSpacing: attrs.paragraphSpacing,
            listSpacing: attrs.listSpacing,
            fills: attrs.fills
        };
        return {
            style,
            signature: createTextSignature(input),
            signatureIgnoringFills: createTextSignature(input, { ignoreFills: true })
        };
    });
}
function getMatchingTextStyle(node, textStyleEntries) {
    const nodeSignature = getTextNodeSignature(node);
    const nodeSignatureIgnoringFills = getTextNodeSignature(node, { ignoreFills: true });
    if (!nodeSignature && !nodeSignatureIgnoringFills) {
        return null;
    }
    let fallbackMatch = null;
    for (const entry of textStyleEntries) {
        if (nodeSignature && entry.signature && sameTextSignature(entry.signature, nodeSignature)) {
            return entry.style;
        }
        if (nodeSignatureIgnoringFills &&
            entry.signatureIgnoringFills &&
            sameTextSignature(entry.signatureIgnoringFills, nodeSignatureIgnoringFills) &&
            !fallbackMatch) {
            fallbackMatch = entry.style;
        }
    }
    return fallbackMatch;
}
function getNodePath(node) {
    const parts = [node.name || node.type];
    let current = node.parent;
    while (current && current.type !== 'PAGE') {
        if ('name' in current && current.name) {
            parts.unshift(current.name);
        }
        current = current.parent;
    }
    return parts.join(' / ');
}
const COLOR_PAINT_TYPES = new Set([
    'SOLID',
    'GRADIENT_LINEAR',
    'GRADIENT_RADIAL',
    'GRADIENT_ANGULAR',
    'GRADIENT_DIAMOND'
]);
function hasColorPaints(paints) {
    return paints.some((paint) => {
        var _a;
        return paint.visible !== false &&
            ((_a = paint.opacity) !== null && _a !== void 0 ? _a : 1) > 0 &&
            COLOR_PAINT_TYPES.has(paint.type);
    });
}
function getTargetNodes() {
    const nodeSet = new Set();
    for (const node of figma.currentPage.selection) {
        nodeSet.add(node);
        if ('findAll' in node) {
            for (const child of node.findAll(() => true)) {
                nodeSet.add(child);
            }
        }
    }
    return { nodes: Array.from(nodeSet) };
}
// ── スキャン：各ノードの分析関数 ─────────────────────────────────────────
function analyzeTextNode(node, textStyleEntries) {
    const reasons = [];
    const suggestedStyles = [];
    const hasMixedTextStyle = ENABLE_TEXT_STYLE_MIXED_WARNING && hasMixedFontSettingsInTextNode(node);
    if (hasMixedTextStyle) {
        reasons.push({ label: 'Text style が混在', severity: 'warning' });
    }
    else if (node.textStyleId === '') {
        const textReason = { label: 'Text style', severity: 'critical' };
        reasons.push(textReason);
        const textStyle = getMatchingTextStyle(node, textStyleEntries);
        if (textStyle) {
            textReason.detail = `候補あり （text-style: ${textStyle.name}）`;
            suggestedStyles.push({
                kind: 'text',
                styleId: textStyle.id,
                styleName: textStyle.name
            });
        }
    }
    return { reasons, suggestedStyles };
}
function analyzeColorNode(node, paintStyleIndex) {
    const reasons = [];
    const suggestedStyles = [];
    if ('fills' in node && 'fillStyleId' in node) {
        const fills = getPaintArray(node.fills);
        if (fills && fills.length > 0 && hasColorPaints(fills) && isMissingStyleId(node.fillStyleId)) {
            const fillReason = { label: 'Fill color', severity: 'critical' };
            reasons.push(fillReason);
            const fillStyle = getMatchingPaintStyle(fills, paintStyleIndex);
            if (fillStyle) {
                fillReason.detail = `候補あり （fill: ${fillStyle.name}）`;
                suggestedStyles.push({ kind: 'fill', styleId: fillStyle.id, styleName: fillStyle.name });
            }
        }
    }
    if ('strokes' in node && 'strokeStyleId' in node) {
        const strokes = getPaintArray(node.strokes);
        if (strokes && strokes.length > 0 && hasColorPaints(strokes) && isMissingStyleId(node.strokeStyleId)) {
            const strokeReason = { label: 'Stroke color', severity: 'critical' };
            reasons.push(strokeReason);
            const strokeStyle = getMatchingPaintStyle(strokes, paintStyleIndex);
            if (strokeStyle) {
                strokeReason.detail = `候補あり （stroke: ${strokeStyle.name}）`;
                suggestedStyles.push({ kind: 'stroke', styleId: strokeStyle.id, styleName: strokeStyle.name });
            }
        }
    }
    return { reasons, suggestedStyles };
}
function postProcessReasons(reasons, suggestedStyles) {
    if (reasons.length === 0) {
        return;
    }
    const suggestedKindSet = new Set(suggestedStyles.map((style) => style.kind));
    for (const reason of reasons) {
        const kind = reason.label === 'Text style'
            ? 'text'
            : reason.label === 'Fill color'
                ? 'fill'
                : reason.label === 'Stroke color'
                    ? 'stroke'
                    : null;
        if (!kind) {
            continue;
        }
        if (suggestedKindSet.has(kind)) {
            continue;
        }
        if (typeof reason.detail !== 'string' || reason.detail.length === 0) {
            reason.detail = 'スタイルの候補がありません';
        }
        reason.severity = 'warning';
    }
}
function scanLayers() {
    return __awaiter(this, void 0, void 0, function* () {
        const { nodes } = getTargetNodes();
        const [paintStyles, textStyles] = yield Promise.all([
            figma.getLocalPaintStylesAsync(),
            figma.getLocalTextStylesAsync()
        ]);
        const paintStyleIndex = buildPaintStyleIndex(paintStyles);
        const textStyleEntries = buildTextStyleEntries(textStyles);
        const layers = [];
        let textReasonCount = 0;
        let colorReasonCount = 0;
        let criticalCount = 0;
        let warningCount = 0;
        for (const node of nodes) {
            const path = getNodePath(node);
            const reasons = [];
            const suggestedStyles = [];
            if (node.type === 'TEXT') {
                const textResult = analyzeTextNode(node, textStyleEntries);
                reasons.push(...textResult.reasons);
                suggestedStyles.push(...textResult.suggestedStyles);
                textReasonCount += textResult.reasons.length;
            }
            const hasMixedText = reasons.some((r) => r.label === 'Text style が混在');
            if (!hasMixedText) {
                const colorResult = analyzeColorNode(node, paintStyleIndex);
                reasons.push(...colorResult.reasons);
                suggestedStyles.push(...colorResult.suggestedStyles);
                colorReasonCount += colorResult.reasons.length;
            }
            postProcessReasons(reasons, suggestedStyles);
            if (reasons.length > 0) {
                for (const reason of reasons) {
                    if (reason.severity === 'critical') {
                        criticalCount += 1;
                    }
                    else {
                        warningCount += 1;
                    }
                }
                layers.push({
                    id: node.id,
                    name: node.name,
                    nodeType: node.type,
                    path,
                    reasons: normalizeReasonOrder(reasons),
                    suggestedStyles
                });
            }
        }
        return {
            scannedCount: nodes.length,
            layers,
            textReasonCount,
            colorReasonCount,
            criticalCount,
            warningCount,
            textStyleOptions: textStyles.map((s) => ({ id: s.id, name: s.name })),
            paintStyleOptions: paintStyles.map((s) => ({ id: s.id, name: s.name })),
        };
    });
}
function getPageNode(node) {
    let current = node;
    while (current) {
        if (current.type === 'PAGE') {
            return current;
        }
        current = current.parent;
    }
    return null;
}
function focusNode(nodeId) {
    return __awaiter(this, void 0, void 0, function* () {
        const node = yield figma.getNodeByIdAsync(nodeId);
        if (!node || !('type' in node) || node.type === 'PAGE') {
            figma.notify('対象レイヤーが見つかりませんでした');
            return;
        }
        const page = getPageNode(node);
        if (page && page.id !== figma.currentPage.id) {
            yield figma.setCurrentPageAsync(page);
        }
        const sceneNode = node;
        figma.currentPage.selection = [sceneNode];
        figma.viewport.scrollAndZoomIntoView([sceneNode]);
    });
}
function applyStyle(nodeId_1, kind_1, styleId_1) {
    return __awaiter(this, arguments, void 0, function* (nodeId, kind, styleId, notify = true) {
        const node = yield figma.getNodeByIdAsync(nodeId);
        if (!node || !('type' in node) || node.type === 'PAGE') {
            const message = '対象レイヤーが見つかりませんでした';
            if (notify) {
                figma.notify(message);
            }
            return { ok: false, nodeId, kind, styleId, message };
        }
        if (kind === 'text') {
            if (node.type !== 'TEXT') {
                const message = 'テキストスタイルを適用できないレイヤーです';
                if (notify) {
                    figma.notify(message);
                }
                return { ok: false, nodeId, kind, styleId, message };
            }
            yield node.setTextStyleIdAsync(styleId);
        }
        if (kind === 'fill') {
            if (!('fillStyleId' in node)) {
                const message = '塗りスタイルを適用できないレイヤーです';
                if (notify) {
                    figma.notify(message);
                }
                return { ok: false, nodeId, kind, styleId, message };
            }
            yield node.setFillStyleIdAsync(styleId);
        }
        if (kind === 'stroke') {
            if (!('strokeStyleId' in node)) {
                const message = '線スタイルを適用できないレイヤーです';
                if (notify) {
                    figma.notify(message);
                }
                return { ok: false, nodeId, kind, styleId, message };
            }
            yield node.setStrokeStyleIdAsync(styleId);
        }
        const message = 'スタイルを適用しました';
        if (notify) {
            figma.notify(message);
        }
        return { ok: true, nodeId, kind, styleId, message };
    });
}
function applyBulkStyles(actions) {
    return __awaiter(this, void 0, void 0, function* () {
        const results = [];
        for (const action of actions) {
            const result = yield applyStyle(action.nodeId, action.kind, action.styleId, false);
            results.push(result);
        }
        const successResults = results.filter((result) => result.ok);
        const successLayerCount = new Set(successResults.map((result) => result.nodeId)).size;
        const summary = {
            totalActions: actions.length,
            successActions: successResults.length,
            failedActions: results.length - successResults.length,
            successLayerCount,
            results
        };
        figma.notify(`一括適用: ${summary.successLayerCount}レイヤー / ${summary.successActions}件を適用`);
        return summary;
    });
}
let autoScanEnabled = false;
let isScanRunning = false;
let hasPendingAutoScan = false;
function postAutoScanState() {
    figma.ui.postMessage({ type: 'auto-scan-state', enabled: autoScanEnabled });
}
function runScan(trigger) {
    return __awaiter(this, void 0, void 0, function* () {
        if (figma.currentPage.selection.length === 0) {
            if (trigger === 'manual') {
                figma.ui.postMessage({ type: 'no-selection' });
            }
            return;
        }
        if (isScanRunning) {
            if (trigger === 'auto') {
                hasPendingAutoScan = true;
            }
            return;
        }
        isScanRunning = true;
        try {
            const result = yield scanLayers();
            figma.ui.postMessage(Object.assign(Object.assign({ type: 'scan-result' }, result), { trigger }));
            if (trigger === 'manual') {
                figma.notify(`スキャン完了（選択範囲）: 該当レイヤー ${result.layers.length}件`);
            }
        }
        finally {
            isScanRunning = false;
            if (hasPendingAutoScan) {
                hasPendingAutoScan = false;
                void runScan('auto');
            }
        }
    });
}
figma.on('selectionchange', () => {
    if (!autoScanEnabled) {
        return;
    }
    void runScan('auto');
});
figma.ui.onmessage = (msg) => __awaiter(void 0, void 0, void 0, function* () {
    if (msg.type === 'cancel') {
        figma.closePlugin();
        return;
    }
    if (msg.type === 'scan') {
        yield runScan('manual');
        return;
    }
    if (msg.type === 'set-auto-scan') {
        autoScanEnabled = msg.enabled;
        postAutoScanState();
        if (autoScanEnabled && !msg.initial) {
            void runScan('auto');
        }
        return;
    }
    if (msg.type === 'focus-node') {
        yield focusNode(msg.nodeId);
    }
    if (msg.type === 'apply-style') {
        const result = yield applyStyle(msg.nodeId, msg.kind, msg.styleId);
        figma.ui.postMessage(Object.assign({ type: 'apply-style-result' }, result));
    }
    if (msg.type === 'apply-bulk') {
        const result = yield applyBulkStyles(msg.actions);
        figma.ui.postMessage(Object.assign({ type: 'apply-bulk-result' }, result));
    }
});
