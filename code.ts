figma.showUI(__html__, { width: 420, height: 560 });

type UiMessage =
  | { type: 'scan' }
  | { type: 'set-auto-scan'; enabled: boolean }
  | { type: 'cancel' }
  | { type: 'focus-node'; nodeId: string }
  | {
      type: 'apply-style';
      nodeId: string;
      kind: 'text' | 'fill' | 'stroke';
      styleId: string;
    }
  | {
      type: 'apply-bulk';
      actions: ApplyStyleAction[];
    };

type ApplyStyleAction = {
  nodeId: string;
  kind: 'text' | 'fill' | 'stroke';
  styleId: string;
};

type ApplyStyleResult = {
  ok: boolean;
  nodeId: string;
  kind: 'text' | 'fill' | 'stroke';
  styleId: string;
  message: string;
};

type ApplyBulkResult = {
  totalActions: number;
  successActions: number;
  failedActions: number;
  successLayerCount: number;
  results: ApplyStyleResult[];
};

type ReasonLabel =
  | 'Text style'
  | 'Text style が混在'
  | 'Fill color'
  | 'Stroke color';

type ReasonItem = {
  label: ReasonLabel;
  severity: 'critical' | 'warning';
  detail?: string;
};

type LayerItem = {
  id: string;
  name: string;
  nodeType: SceneNode['type'];
  path: string;
  reasons: ReasonItem[];
  suggestedStyles: SuggestedStyleAction[];
};

type SuggestedStyleAction = {
  kind: 'text' | 'fill' | 'stroke';
  styleId: string;
  styleName: string;
};

// TextStyle から型安全にプロパティへアクセスするためのヘルパー型
type TextStyleAttrs = {
  fontName: FontName;
  fontSize: number;
  lineHeight: LineHeight;
  letterSpacing: LetterSpacing;
  textCase: TextCase;
  textDecoration: TextDecoration;
  paragraphIndent: number;
  paragraphSpacing: number;
  listSpacing: number;
  fills: Paint[] | typeof figma.mixed;
};

type TextSignature = {
  fontFamily: string;
  fontStyle: string;
  fontSize: number;
  lineHeight: string;
  letterSpacing: string;
  textCase: TextCase;
  textDecoration: TextDecoration;
  paragraphIndent: number;
  paragraphSpacing: number;
  listSpacing: number;
  fills: string;
};

// hasMixedFontSettingsInTextNode が使用するコアシグネチャ型
type CoreTextSignature = {
  fontFamily: string;
  fontStyleKey: string;
  fontWeight: number | null;
  isItalic: boolean;
  fontSize: number;
  lineHeightPx: number | null;
};

const ENABLE_TEXT_STYLE_MIXED_WARNING = true;

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

function isMissingStyleId(styleId: unknown): boolean {
  return styleId === '' || styleId === figma.mixed;
}

function getTextStyleAttrs(style: TextStyle): TextStyleAttrs {
  return style as unknown as TextStyleAttrs;
}

function getPaintArray(value: unknown): readonly Paint[] | null {
  if (value === figma.mixed || !Array.isArray(value)) {
    return null;
  }
  return value as readonly Paint[];
}

function normalizePaint(paint: Paint): unknown {
  const common = {
    type: paint.type,
    visible: paint.visible !== false,
    opacity: paint.opacity ?? 1,
    blendMode: paint.blendMode
  };

  if (paint.type === 'SOLID') {
    return {
      ...common,
      color: paint.color
    };
  }

  if (
    paint.type === 'GRADIENT_LINEAR' ||
    paint.type === 'GRADIENT_RADIAL' ||
    paint.type === 'GRADIENT_ANGULAR' ||
    paint.type === 'GRADIENT_DIAMOND'
  ) {
    return {
      ...common,
      gradientStops: paint.gradientStops,
      gradientTransform: paint.gradientTransform
    };
  }

  return common;
}

function paintsEqual(a: readonly Paint[], b: readonly Paint[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  const left = JSON.stringify(a.map(normalizePaint));
  const right = JSON.stringify(b.map(normalizePaint));
  return left === right;
}

function roundNumber(value: number, precision = 4): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function normalizeNumber(value: unknown, defaultValue = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return defaultValue;
  }

  return roundNumber(value);
}

function normalizeFontName(
  value: unknown
): { family: string; style: string } | null {
  if (!value || value === figma.mixed || typeof value !== 'object') {
    return null;
  }

  const obj = value as Record<string, unknown>;
  const family = typeof obj.family === 'string' ? obj.family : '';
  const style = typeof obj.style === 'string' ? obj.style : '';
  if (!family || !style) {
    return null;
  }

  return { family, style };
}

function normalizeLineHeight(value: unknown): string | null {
  if (value === figma.mixed) {
    return null;
  }

  if (!value || typeof value !== 'object') {
    return 'AUTO';
  }

  const obj = value as Record<string, unknown>;
  const unit = typeof obj.unit === 'string' ? obj.unit : 'AUTO';

  if (unit === 'AUTO') {
    return 'AUTO';
  }

  const numeric = normalizeNumber(obj.value);
  return `${unit}:${numeric}`;
}

function normalizeLetterSpacing(value: unknown): string | null {
  if (value === figma.mixed) {
    return null;
  }

  if (!value || typeof value !== 'object') {
    return 'PIXELS:0';
  }

  const obj = value as Record<string, unknown>;
  const unit = typeof obj.unit === 'string' ? obj.unit : 'PIXELS';
  const numeric = normalizeNumber(obj.value);
  return `${unit}:${numeric}`;
}

function normalizeTextCase(value: unknown): TextCase {
  if (
    value === 'UPPER' ||
    value === 'LOWER' ||
    value === 'TITLE' ||
    value === 'SMALL_CAPS' ||
    value === 'SMALL_CAPS_FORCED' ||
    value === 'ORIGINAL'
  ) {
    return value;
  }
  return 'ORIGINAL';
}

function normalizeTextDecoration(value: unknown): TextDecoration {
  if (value === 'NONE' || value === 'UNDERLINE' || value === 'STRIKETHROUGH') {
    return value;
  }
  return 'NONE';
}

function normalizeFontStyleMeta(styleName: string): {
  styleKey: string;
  weight: number | null;
  isItalic: boolean;
} {
  const lower = styleName.trim().toLowerCase();
  const isItalic = /italic|oblique/.test(lower);
  const keySource = lower.replace(/italic|oblique/g, '').replace(/\s+/g, ' ').trim();

  const weightMap: Array<{ token: string; weight: number }> = [
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
    { token: 'heavy', weight: 900 }
  ];

  for (const item of weightMap) {
    if (keySource.includes(item.token)) {
      return {
        styleKey: keySource,
        weight: item.weight,
        isItalic
      };
    }
  }

  return {
    styleKey: keySource,
    weight: null,
    isItalic
  };
}

function resolveLineHeightPx(lineHeight: unknown, fontSize: number): number | null {
  if (lineHeight === figma.mixed) {
    return null;
  }

  if (!lineHeight || typeof lineHeight !== 'object') {
    return null;
  }

  const obj = lineHeight as Record<string, unknown>;
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

function createCoreTextSignature(input: {
  fontName: unknown;
  fontSize: unknown;
  lineHeight: unknown;
}): CoreTextSignature | null {
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

function sameCoreTextSignature(a: CoreTextSignature, b: CoreTextSignature): boolean {
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
  } else if (Math.abs(a.lineHeightPx - b.lineHeightPx) > 0.05) {
    return false;
  }

  if (a.fontWeight !== null && b.fontWeight !== null) {
    return a.fontWeight === b.fontWeight;
  }

  return a.fontStyleKey === b.fontStyleKey;
}

function hasMixedFontSettingsInTextNode(node: TextNode): boolean {
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

function createTextSignature(
  input: {
    fontName: unknown;
    fontSize: unknown;
    lineHeight: unknown;
    letterSpacing: unknown;
    textCase: unknown;
    textDecoration: unknown;
    paragraphIndent: unknown;
    paragraphSpacing: unknown;
    listSpacing: unknown;
    fills: unknown;
  },
  options?: {
    ignoreFills?: boolean;
  }
): TextSignature | null {
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
  if (!options?.ignoreFills) {
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

function sameTextSignature(a: TextSignature, b: TextSignature): boolean {
  return (
    a.fontFamily === b.fontFamily &&
    a.fontStyle === b.fontStyle &&
    a.fontSize === b.fontSize &&
    a.lineHeight === b.lineHeight &&
    a.letterSpacing === b.letterSpacing &&
    a.textCase === b.textCase &&
    a.textDecoration === b.textDecoration &&
    a.paragraphIndent === b.paragraphIndent &&
    a.paragraphSpacing === b.paragraphSpacing &&
    a.listSpacing === b.listSpacing &&
    a.fills === b.fills
  );
}

function getTextNodeSignature(
  node: TextNode,
  options?: { ignoreFills?: boolean }
): TextSignature | null {
  const direct = createTextSignature(
    {
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
    },
    options
  );

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

  const base = createTextSignature(
    {
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
    },
    options
  );

  if (!base) {
    return null;
  }

  for (let i = 1; i < segments.length; i += 1) {
    const sig = createTextSignature(
      {
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
      },
      options
    );

    if (!sig || !sameTextSignature(sig, base)) {
      return null;
    }
  }

  return base;
}

function getMatchingPaintStyle(
  paints: readonly Paint[],
  paintStyles: readonly PaintStyle[]
): PaintStyle | null {
  for (const style of paintStyles) {
    if (paintsEqual(paints, style.paints)) {
      return style;
    }
  }
  return null;
}

function getMatchingTextStyle(
  node: TextNode,
  textStyles: readonly TextStyle[]
): TextStyle | null {
  const nodeSignature = getTextNodeSignature(node);
  const nodeSignatureIgnoringFills = getTextNodeSignature(node, { ignoreFills: true });

  if (!nodeSignature && !nodeSignatureIgnoringFills) {
    return null;
  }

  let fallbackMatch: TextStyle | null = null;

  for (const style of textStyles) {
    const attrs = getTextStyleAttrs(style);
    const styleSignature = createTextSignature({
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
    });

    if (
      nodeSignature &&
      styleSignature &&
      sameTextSignature(styleSignature, nodeSignature)
    ) {
      return style;
    }

    if (nodeSignatureIgnoringFills) {
      const styleSignatureIgnoringFills = createTextSignature(
        {
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
        },
        { ignoreFills: true }
      );

      if (
        styleSignatureIgnoringFills &&
        sameTextSignature(styleSignatureIgnoringFills, nodeSignatureIgnoringFills) &&
        !fallbackMatch
      ) {
        fallbackMatch = style;
      }
    }
  }

  return fallbackMatch;
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
    (paint) =>
      paint.visible !== false &&
      (paint.opacity ?? 1) > 0 &&
      COLOR_PAINT_TYPES.has(paint.type)
  );
}

function getColorStyleReasons(node: SceneNode): ReasonItem[] {
  const reasons: ReasonItem[] = [];

  if ('fills' in node && 'fillStyleId' in node) {
    const fills = getPaintArray(node.fills);
    const fillStyleId = node.fillStyleId;

    if (fills && fills.length > 0 && hasColorPaints(fills)) {
      if (isMissingStyleId(fillStyleId)) {
        reasons.push({ label: 'Fill color', severity: 'critical' });
      }
    }
  }

  if ('strokes' in node && 'strokeStyleId' in node) {
    const strokes = getPaintArray(node.strokes);
    const strokeStyleId = node.strokeStyleId;

    if (strokes && strokes.length > 0 && hasColorPaints(strokes)) {
      if (isMissingStyleId(strokeStyleId)) {
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

// ── スキャン：各ノードの分析関数 ─────────────────────────────────────────

function analyzeTextNode(
  node: TextNode,
  textStyles: readonly TextStyle[]
): { reasons: ReasonItem[]; suggestedStyles: SuggestedStyleAction[] } {
  const reasons: ReasonItem[] = [];
  const suggestedStyles: SuggestedStyleAction[] = [];

  const hasMixedTextStyle =
    ENABLE_TEXT_STYLE_MIXED_WARNING && hasMixedFontSettingsInTextNode(node);

  if (hasMixedTextStyle) {
    reasons.push({ label: 'Text style が混在', severity: 'warning' });
  } else if (node.textStyleId === '') {
    reasons.push({ label: 'Text style', severity: 'critical' });

    const textStyle = getMatchingTextStyle(node, textStyles);
    if (textStyle) {
      const textReason = reasons.find((r) => r.label === 'Text style');
      if (textReason) {
        textReason.detail = `候補あり （text-style: ${textStyle.name}）`;
      }
      suggestedStyles.push({
        kind: 'text',
        styleId: textStyle.id,
        styleName: textStyle.name
      });
    }
  }

  return { reasons, suggestedStyles };
}

function analyzeColorNode(
  node: SceneNode,
  paintStyles: readonly PaintStyle[]
): { reasons: ReasonItem[]; suggestedStyles: SuggestedStyleAction[] } {
  const reasons = getColorStyleReasons(node);
  const suggestedStyles: SuggestedStyleAction[] = [];

  if (reasons.length === 0) {
    return { reasons, suggestedStyles };
  }

  if ('fills' in node && 'fillStyleId' in node && isMissingStyleId(node.fillStyleId)) {
    const fills = getPaintArray(node.fills);
    if (fills && fills.length > 0 && hasColorPaints(fills)) {
      const fillStyle = getMatchingPaintStyle(fills, paintStyles);
      if (fillStyle) {
        const fillReason = reasons.find((r) => r.label === 'Fill color');
        if (fillReason) {
          fillReason.detail = `候補あり （fill: ${fillStyle.name}）`;
        }
        suggestedStyles.push({
          kind: 'fill',
          styleId: fillStyle.id,
          styleName: fillStyle.name
        });
      }
    }
  }

  if (
    'strokes' in node &&
    'strokeStyleId' in node &&
    isMissingStyleId(node.strokeStyleId)
  ) {
    const strokes = getPaintArray(node.strokes);
    if (strokes && strokes.length > 0 && hasColorPaints(strokes)) {
      const strokeStyle = getMatchingPaintStyle(strokes, paintStyles);
      if (strokeStyle) {
        const strokeReason = reasons.find((r) => r.label === 'Stroke color');
        if (strokeReason) {
          strokeReason.detail = `候補あり （stroke: ${strokeStyle.name}）`;
        }
        suggestedStyles.push({
          kind: 'stroke',
          styleId: strokeStyle.id,
          styleName: strokeStyle.name
        });
      }
    }
  }

  return { reasons, suggestedStyles };
}

function postProcessReasons(
  reasons: ReasonItem[],
  suggestedStyles: SuggestedStyleAction[]
): void {
  if (reasons.length === 0) {
    return;
  }

  const suggestedKindSet = new Set(suggestedStyles.map((style) => style.kind));
  for (const reason of reasons) {
    const kind =
      reason.label === 'Text style'
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

async function scanLayers(): Promise<{
  scannedCount: number;
  layers: LayerItem[];
  textReasonCount: number;
  colorReasonCount: number;
  criticalCount: number;
  warningCount: number;
  scanScope: 'selection' | 'page';
}> {
  const { nodes, scanScope } = getTargetNodes();
  const paintStyles = await figma.getLocalPaintStylesAsync();
  const textStyles = await figma.getLocalTextStylesAsync();
  const layers: LayerItem[] = [];
  let textReasonCount = 0;
  let colorReasonCount = 0;
  let criticalCount = 0;
  let warningCount = 0;

  for (const node of nodes) {
    const path = getNodePath(node);
    const reasons: ReasonItem[] = [];
    const suggestedStyles: SuggestedStyleAction[] = [];

    if (node.type === 'TEXT') {
      const textResult = analyzeTextNode(node, textStyles);
      reasons.push(...textResult.reasons);
      suggestedStyles.push(...textResult.suggestedStyles);
      textReasonCount += textResult.reasons.length;
    }

    const colorResult = analyzeColorNode(node, paintStyles);
    reasons.push(...colorResult.reasons);
    suggestedStyles.push(...colorResult.suggestedStyles);
    colorReasonCount += colorResult.reasons.length;

    postProcessReasons(reasons, suggestedStyles);

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

async function applyStyle(
  nodeId: string,
  kind: 'text' | 'fill' | 'stroke',
  styleId: string,
  notify = true
): Promise<ApplyStyleResult> {
  const node = await figma.getNodeByIdAsync(nodeId);

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
    await node.setTextStyleIdAsync(styleId);
  }

  if (kind === 'fill') {
    if (!('fillStyleId' in node)) {
      const message = '塗りスタイルを適用できないレイヤーです';
      if (notify) {
        figma.notify(message);
      }
      return { ok: false, nodeId, kind, styleId, message };
    }
    await (node as SceneNode & MinimalFillsMixin).setFillStyleIdAsync(styleId);
  }

  if (kind === 'stroke') {
    if (!('strokeStyleId' in node)) {
      const message = '線スタイルを適用できないレイヤーです';
      if (notify) {
        figma.notify(message);
      }
      return { ok: false, nodeId, kind, styleId, message };
    }
    await (node as SceneNode & MinimalStrokesMixin).setStrokeStyleIdAsync(styleId);
  }

  const message = 'スタイルを適用しました';
  if (notify) {
    figma.notify(message);
  }
  return { ok: true, nodeId, kind, styleId, message };
}

async function applyBulkStyles(actions: ApplyStyleAction[]): Promise<ApplyBulkResult> {
  const results: ApplyStyleResult[] = [];

  for (const action of actions) {
    const result = await applyStyle(action.nodeId, action.kind, action.styleId, false);
    results.push(result);
  }

  const successResults = results.filter((result) => result.ok);
  const successLayerCount = new Set(successResults.map((result) => result.nodeId)).size;
  const summary: ApplyBulkResult = {
    totalActions: actions.length,
    successActions: successResults.length,
    failedActions: results.length - successResults.length,
    successLayerCount,
    results
  };

  figma.notify(`一括適用: ${summary.successLayerCount}レイヤー / ${summary.successActions}件を適用`);
  return summary;
}

let autoScanEnabled = false;
let isScanRunning = false;
let hasPendingAutoScan = false;

function postAutoScanState(): void {
  figma.ui.postMessage({ type: 'auto-scan-state', enabled: autoScanEnabled });
}

async function runScan(trigger: 'manual' | 'auto'): Promise<void> {
  if (isScanRunning) {
    if (trigger === 'auto') {
      hasPendingAutoScan = true;
    }
    return;
  }

  isScanRunning = true;
  try {
    const result = await scanLayers();
    figma.ui.postMessage({ type: 'scan-result', ...result, trigger });
    if (trigger === 'manual') {
      const scopeLabel = result.scanScope === 'selection' ? '選択範囲' : 'ページ全体';
      figma.notify(`スキャン完了（${scopeLabel}）: 該当レイヤー ${result.layers.length}件`);
    }
  } finally {
    isScanRunning = false;
    if (hasPendingAutoScan) {
      hasPendingAutoScan = false;
      void runScan('auto');
    }
  }
}

figma.on('selectionchange', () => {
  if (!autoScanEnabled) {
    return;
  }
  void runScan('auto');
});

figma.ui.onmessage = async (msg: UiMessage) => {
  if (msg.type === 'cancel') {
    figma.closePlugin();
    return;
  }

  if (msg.type === 'scan') {
    await runScan('manual');
    return;
  }

  if (msg.type === 'set-auto-scan') {
    autoScanEnabled = msg.enabled;
    postAutoScanState();
    if (autoScanEnabled) {
      void runScan('auto');
    }
    return;
  }

  if (msg.type === 'focus-node') {
    await focusNode(msg.nodeId);
  }

  if (msg.type === 'apply-style') {
    const result = await applyStyle(msg.nodeId, msg.kind, msg.styleId);
    figma.ui.postMessage({ type: 'apply-style-result', ...result });
  }

  if (msg.type === 'apply-bulk') {
    const result = await applyBulkStyles(msg.actions);
    figma.ui.postMessage({ type: 'apply-bulk-result', ...result });
  }
};
