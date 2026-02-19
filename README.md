# Layer Style Checker

Figma プラグイン。現在のページ（または選択範囲）を走査し、**スタイルが未適用のレイヤー**を一覧表示します。

## 検出内容

| 種別 | 内容 | 重要度 |
|------|------|--------|
| Text style | テキストスタイルが未適用 | Critical |
| Text style が混在 | 同一テキストノード内でスタイルが混在 | Warning |
| Fill color | 塗りにカラースタイルが未適用（画像・動画・パターンはスキップ） | Critical |
| Stroke color | 線にカラースタイルが未適用 | Critical |

## スキャン範囲

- **レイヤーを選択している場合** → 選択レイヤーとその子孫のみをスキャン
- **選択なしの場合** → 現在のページ全体をスキャン

## 開発環境のセットアップ

### 依存関係のインストール

```bash
npm install
```

### ビルド（watch モード）

```bash
npm run watch
```

TypeScript (`code.ts`) が変更されるたびに `code.js` へ自動コンパイルされます。

### Figma でのロード

1. Figma を開き、**Plugins → Development → Import plugin from manifest** を選択
2. このリポジトリの `manifest.json` を指定

## ファイル構成

```
├── code.ts       # プラグイン本体（Figma API）
├── code.js       # コンパイル済み（自動生成）
├── ui.html       # プラグイン UI
├── manifest.json # プラグイン設定
└── icon.png      # プラグインアイコン
```

## 技術スタック

- TypeScript
- Figma Plugin API
- HTML / CSS / Vanilla JS（UI）
