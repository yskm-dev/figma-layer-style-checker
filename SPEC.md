# Layer Style Checker 仕様書（SPEC）

## 1. 目的

Figma ドキュメント内のレイヤーをスキャンし、スタイル運用上の未適用・混在を可視化し、候補スタイルの適用まで行う。

## 2. スコープ

### 2.1 スキャン対象

- 選択レイヤーがある場合: 選択レイヤー自身 + 子孫ノード
- 選択レイヤーがない場合: 現在ページ全体

### 2.2 対象エディタ

- Figma（`manifest.json` の `editorType: ["figma"]`）

## 3. Reason と重要度

### 3.1 Reason 一覧

- `Text style`
- `Text style が混在`
- `Fill color`
- `Stroke color`

### 3.2 重要度

- 内部値: `critical` / `warning`
- UI 表示: `critical` -> 「要修正」、`warning` -> 「要確認」

### 3.3 表示順

Reason は以下の固定順で表示する。

1. `Text style`
2. `Text style が混在`
3. `Fill color`
4. `Stroke color`

## 4. Text 判定仕様

### 4.1 Text style が混在

対象: `TextNode`

`getStyledTextSegments(["fontName", "fontSize", "lineHeight"])` でセグメントごとに比較し、以下コアシグネチャが一致しなければ混在とする。

- `fontFamily`
- `fontStyleKey` / `fontWeight` / `isItalic`
- `fontSize`
- `lineHeightPx`

重要度: `warning`

### 4.2 Text style 未適用

条件: `node.textStyleId === ''`

重要度: `critical`

優先順位:

- 4.1 が成立した場合は `Text style` を追加しない（混在を優先）

### 4.3 Text style 候補一致

`Text style` 未適用時にローカル Text Style から候補検索。

有効ロジック:

1. 厳密一致（font/size/lineHeight/letterSpacing/textCase/textDecoration/paragraph 系/fills）
2. fills を無視した一致

備考:

- 主要タイポのみのフォールバック（Core/Visual）は実装なし

## 5. Fill / Stroke 判定仕様

### 5.1 未適用条件

対象ノードに対して以下を満たすと検出。

- Paint 配列が `figma.mixed` ではない
- Paint が可視（`visible !== false`）
- Paint opacity が `> 0`
- Paint type が色系（`SOLID`, `GRADIENT_LINEAR`, `GRADIENT_RADIAL`, `GRADIENT_ANGULAR`, `GRADIENT_DIAMOND`）
- 対応 styleId が未適用（`''` または `figma.mixed`）

### 5.2 重要度

- `Fill color`: 初期 `critical`
- `Stroke color`: 初期 `critical`

### 5.3 候補一致

- Paint を正規化してローカル Paint Style と比較
- 一致時に候補を `suggestedStyles` へ追加

## 6. detail / 重要度の後処理

### 6.1 候補あり detail

- Text: `候補あり （text-style: {style.name}）`
- Fill: `候補あり （fill: {style.name}）`
- Stroke: `候補あり （stroke: {style.name}）`

### 6.2 候補なし detail

対象 reason:

- `Text style`
- `Fill color`
- `Stroke color`

上記 reason について、対応 kind（`text` / `fill` / `stroke`）の候補がない場合:

- 既存 detail がなければ `スタイルの候補がありません` を設定

### 6.3 候補なし時の重要度降格

対象 reason:

- `Text style`
- `Fill color`
- `Stroke color`

上記 reason について、対応 kind の候補がない場合のみ `severity` を `warning` に変更する。

補足:

- `Text style が混在` はこの後処理の対象外（元の `warning` のまま）

## 7. スキャン結果データ

`scan-result` に含まれる主要項目:

- `scannedCount`
- `layers[]`
  - `id`, `name`, `nodeType`, `path`
  - `reasons[]`（label, severity, detail?）
  - `suggestedStyles[]`（kind, styleId, styleName）
- `textReasonCount`
- `colorReasonCount`
- `criticalCount`
- `warningCount`
- `scanScope`（`selection` / `page`）

## 8. UI 仕様（ui.html）

### 8.1 ヘッダー操作

- `スキャン`
- `自動:ON/OFF`（選択変更時の自動スキャン切替）
- `一括適用（n）`

### 8.2 サマリー

- スキャンスコープ表示（`◉ 選択レイヤー` / `□ ページ全体`）
- スキャンレイヤー数
- 要修正数
- 要確認数

### 8.3 リスト表示

- 問題あり: 「問題のあるレイヤー n件」
- 全解消: 「問題はすべて解消済み n件」
- 0件: 「問題なし」ステート

カード表示:

- レイヤー名 / node type / severity pill
- パス
- issue 行（reason バッジ + 候補名 + 適用ボタン、または `候補なし`）

### 8.4 適用後 UI 更新

- 個別適用成功時: 対応 issue 行を削除
- カードの issue が0件になった場合: `解消` 表示 + `問題なし` バッジへ置換
- サマリー件数（要修正/要確認）を再計算して更新
- 一括適用ボタン件数を更新

## 9. 操作仕様（Plugin 側）

### 9.0 スキャン実行トリガー

- 手動: UI の `scan` 受信時にスキャン
- 自動: `autoScanEnabled === true` のとき、`selectionchange` ごとにスキャン
- スキャン実行中に自動トリガーが重なった場合は、保留フラグで1回再実行する

### 9.1 フォーカス移動

`focus-node` 受信時:

- 対象ノードを取得
- 必要なら対象ページへ切替
- selection 設定 + `scrollAndZoomIntoView`

### 9.2 個別適用

`apply-style` 受信時:

- `text`: `setTextStyleIdAsync`
- `fill`: `setFillStyleIdAsync`
- `stroke`: `setStrokeStyleIdAsync`

不正対象は失敗レスポンスを返し、通知する。

### 9.3 一括適用

`apply-bulk` 受信時:

- actions を順次適用
- 集計を返却
  - `totalActions`
  - `successActions`
  - `failedActions`
  - `successLayerCount`
  - `results[]`

## 10. メッセージ仕様

### 10.1 UI -> Plugin

- `scan`
- `set-auto-scan`
- `cancel`
- `focus-node`
- `apply-style`
- `apply-bulk`

### 10.2 Plugin -> UI

- `scan-result`
- `auto-scan-state`
- `apply-style-result`
- `apply-bulk-result`

## 11. 通知仕様（figma.notify）

- スキャン完了（手動実行時のみ）: `スキャン完了（選択範囲|ページ全体）: 該当レイヤー {n}件`
- 個別適用成功: `スタイルを適用しました`
- 一括適用: `一括適用: {successLayerCount}レイヤー / {successActions}件を適用`
- 対象不正時: エラーメッセージ通知
