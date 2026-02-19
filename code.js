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
figma.showUI(__html__, { width: 420, height: 560 });
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
    return paints.some((paint) => paint.visible !== false && COLOR_PAINT_TYPES.has(paint.type));
}
function getColorStyleReasons(node) {
    const reasons = [];
    if ('fills' in node && 'fillStyleId' in node) {
        const fills = node.fills;
        const fillStyleId = node.fillStyleId;
        if (fills !== figma.mixed && fills.length > 0 && hasColorPaints(fills)) {
            if (fillStyleId === '' || fillStyleId === figma.mixed) {
                reasons.push({ label: 'Fill color', severity: 'critical' });
            }
        }
    }
    if ('strokes' in node && 'strokeStyleId' in node) {
        const strokes = node.strokes;
        const strokeStyleId = node.strokeStyleId;
        if (strokes.length > 0 && hasColorPaints(strokes)) {
            if (strokeStyleId === '') {
                reasons.push({ label: 'Stroke color', severity: 'critical' });
            }
        }
    }
    return reasons;
}
function getTargetNodes() {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
        return { nodes: figma.currentPage.findAll(() => true), scanScope: 'page' };
    }
    const nodeSet = new Set();
    for (const node of selection) {
        nodeSet.add(node);
        if ('findAll' in node) {
            for (const child of node.findAll(() => true)) {
                nodeSet.add(child);
            }
        }
    }
    return { nodes: Array.from(nodeSet), scanScope: 'selection' };
}
function scanLayers() {
    const { nodes, scanScope } = getTargetNodes();
    const layers = [];
    let textReasonCount = 0;
    let colorReasonCount = 0;
    let criticalCount = 0;
    let warningCount = 0;
    for (const node of nodes) {
        const path = getNodePath(node);
        const reasons = [];
        if (node.type === 'TEXT') {
            if (node.textStyleId === '') {
                reasons.push({ label: 'Text style', severity: 'critical' });
                textReasonCount += 1;
            }
            else if (node.textStyleId === figma.mixed) {
                reasons.push({ label: 'Text style が混在', severity: 'warning' });
                textReasonCount += 1;
            }
        }
        const colorReasons = getColorStyleReasons(node);
        if (colorReasons.length > 0) {
            reasons.push(...colorReasons);
            colorReasonCount += colorReasons.length;
        }
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
                reasons: normalizeReasonOrder(reasons)
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
        scanScope
    };
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
figma.ui.onmessage = (msg) => __awaiter(void 0, void 0, void 0, function* () {
    if (msg.type === 'cancel') {
        figma.closePlugin();
        return;
    }
    if (msg.type === 'scan') {
        const result = scanLayers();
        figma.ui.postMessage(Object.assign({ type: 'scan-result' }, result));
        const scopeLabel = result.scanScope === 'selection' ? '選択範囲' : 'ページ全体';
        figma.notify(`走査完了（${scopeLabel}）: 該当レイヤー ${result.layers.length}件`);
    }
    if (msg.type === 'focus-node') {
        yield focusNode(msg.nodeId);
    }
});
