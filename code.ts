figma.showUI(__html__, { width: 420, height: 560 });

type UiMessage =
  | { type: 'scan' }
  | { type: 'cancel' }
  | { type: 'focus-node'; nodeId: string };

type ReasonLabel =
  | 'Text style'
  | 'Text style が混在'
  | 'Fill color'
  | 'Stroke color';

type ReasonItem = {
  label: ReasonLabel;
  severity: 'critical' | 'warning';
};

type LayerItem = {
  id: string;
  name: string;
  nodeType: SceneNode['type'];
  path: string;
  reasons: ReasonItem[];
};

const REASON_ORDER: Record<ReasonLabel, number> = {
  'Text style': 0,
  'Text style が混在': 1,
  'Fill color': 2,
  'Stroke color': 3
};

function normalizeReasonOrder(reasons: ReasonItem[]): ReasonItem[] {
  return [...reasons].sort((a, b) => {
    const orderA = REASON_ORDER[a.label] ?? Number.MAX_SAFE_INTEGER;
    const orderB = REASON_ORDER[b.label] ?? Number.MAX_SAFE_INTEGER;
    return orderA - orderB;
  });
}

function getNodePath(node: SceneNode): string {
  const parts: string[] = [node.name || node.type];
  let current: BaseNode | null = node.parent;

  while (current && current.type !== 'PAGE') {
    if ('name' in current && current.name) {
      parts.unshift(current.name);
    }
    current = current.parent;
  }

  return parts.join(' / ');
}

const COLOR_PAINT_TYPES = new Set<Paint['type']>([
  'SOLID',
  'GRADIENT_LINEAR',
  'GRADIENT_RADIAL',
  'GRADIENT_ANGULAR',
  'GRADIENT_DIAMOND'
]);

function hasColorPaints(paints: readonly Paint[]): boolean {
  return paints.some(
    (paint) => paint.visible !== false && COLOR_PAINT_TYPES.has(paint.type)
  );
}

function getColorStyleReasons(node: SceneNode): ReasonItem[] {
  const reasons: ReasonItem[] = [];

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

function getTargetNodes(): { nodes: SceneNode[]; scanScope: 'selection' | 'page' } {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    return { nodes: figma.currentPage.findAll(() => true), scanScope: 'page' };
  }

  const nodeSet = new Set<SceneNode>();
  for (const node of selection) {
    nodeSet.add(node);
    if ('findAll' in node) {
      for (const child of (node as ChildrenMixin).findAll(() => true)) {
        nodeSet.add(child);
      }
    }
  }
  return { nodes: Array.from(nodeSet), scanScope: 'selection' };
}

function scanLayers(): {
  scannedCount: number;
  layers: LayerItem[];
  textReasonCount: number;
  colorReasonCount: number;
  criticalCount: number;
  warningCount: number;
  scanScope: 'selection' | 'page';
} {
  const { nodes, scanScope } = getTargetNodes();
  const layers: LayerItem[] = [];
  let textReasonCount = 0;
  let colorReasonCount = 0;
  let criticalCount = 0;
  let warningCount = 0;

  for (const node of nodes) {
    const path = getNodePath(node);
    const reasons: ReasonItem[] = [];

    if (node.type === 'TEXT') {
      if (node.textStyleId === '') {
        reasons.push({ label: 'Text style', severity: 'critical' });
        textReasonCount += 1;
      } else if (node.textStyleId === figma.mixed) {
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
        } else {
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

function getPageNode(node: BaseNode): PageNode | null {
  let current: BaseNode | null = node;

  while (current) {
    if (current.type === 'PAGE') {
      return current;
    }
    current = current.parent;
  }

  return null;
}

async function focusNode(nodeId: string): Promise<void> {
  const node = await figma.getNodeByIdAsync(nodeId);

  if (!node || !('type' in node) || node.type === 'PAGE') {
    figma.notify('対象レイヤーが見つかりませんでした');
    return;
  }

  const page = getPageNode(node);
  if (page && page.id !== figma.currentPage.id) {
    await figma.setCurrentPageAsync(page);
  }

  const sceneNode = node as SceneNode;
  figma.currentPage.selection = [sceneNode];
  figma.viewport.scrollAndZoomIntoView([sceneNode]);
}

figma.ui.onmessage = async (msg: UiMessage) => {
  if (msg.type === 'cancel') {
    figma.closePlugin();
    return;
  }

  if (msg.type === 'scan') {
    const result = scanLayers();
    figma.ui.postMessage({ type: 'scan-result', ...result });
    const scopeLabel = result.scanScope === 'selection' ? '選択範囲' : 'ページ全体';
    figma.notify(`走査完了（${scopeLabel}）: 該当レイヤー ${result.layers.length}件`);
  }

  if (msg.type === 'focus-node') {
    await focusNode(msg.nodeId);
  }
};
