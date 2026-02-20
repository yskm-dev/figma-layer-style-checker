# Layer Style Checker

Figma プラグイン。現在のページまたは選択範囲をスキャンし、スタイル未適用レイヤーを検出し、候補スタイルの適用まで行えます。

## 主な機能

- Text / Fill / Stroke のスタイル未適用を検出
- Text ノード内のフォント設定混在（`Text style が混在`）を検出
- 一致候補スタイル（Text/Fill/Stroke）を提示して個別適用
- 候補があるレイヤーを一括適用
- 自動スキャントグル（`自動:ON/OFF`）
- カードクリックで該当レイヤーへフォーカス移動

## 検出ルール

| 種別 | 内容 | 初期重要度 |
| --- | --- | --- |
| Text style | テキストスタイルが未適用（`textStyleId === ''`） | critical（候補なし時は warning へ降格） |
| Text style が混在 | 同一 Text ノード内で `fontName / fontSize / lineHeight` が混在 | warning |
| Fill color | 色系 Fill（SOLID/GRADIENT）にカラースタイル未適用 | critical |
| Stroke color | 色系 Stroke（SOLID/GRADIENT）にカラースタイル未適用 | critical |

補足:

- `Text style が混在` が成立した Text ノードでは `Text style` は出しません。
- Fill / Stroke は `visible !== false` かつ `opacity > 0` の色系 Paint のみ判定します。
- 各 reason（`Text style` / `Fill color` / `Stroke color`）は、対応する候補がない場合に `warning` へ降格します。

## スキャン範囲

- 選択レイヤーあり: 選択ノード + 子孫ノード
- 選択なし: 現在ページ全体

UI サマリーにスコープを表示します（`◉ 選択レイヤー` / `□ ページ全体`）。

## スキャン実行方法

- 手動: `スキャン` ボタン押下で実行
- 自動: `自動:ON` 時、レイヤー選択変更のたびに実行

## 候補スタイルの一致判定

### Text style

1. 厳密一致（文字装飾・段落設定・fills を含む）
2. fills を除いた一致

### Fill / Stroke

- Paint 配列を正規化して、ローカル Paint Style と一致比較

## 適用操作

- 個別適用: `Text適用` / `Fill適用` / `Stroke適用`
- 一括適用: `一括適用（n）`（候補があるレイヤー数）

適用結果は UI に即時反映され、理由がなくなったカードは `解消` 表示になります。

## 開発環境

```bash
npm install
npm run watch
```

`code.ts` の変更は `code.js` に自動コンパイルされます。

## Figma でのロード

1. Figma で **Plugins → Development → Import plugin from manifest**
2. このリポジトリの `manifest.json` を指定

## ファイル構成

```text
├── code.ts       # プラグイン本体（Figma API）
├── code.js       # コンパイル済み（自動生成）
├── ui.html       # プラグイン UI
├── manifest.json # プラグイン設定
└── icon.png      # プラグインアイコン
```
