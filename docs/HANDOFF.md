# 引き継ぎ書（HANDOFF）

最終更新: 2026-05-01

---

## 現在の状態

- **ブランチ**: `main`
- **HEAD**: `ebbb1a6 Refine recording cancellation and preview behavior`
- **push 状態**: `origin/main` に対して 1 commit ahead（`ebbb1a6` は未 push）
- **upstream 同期状態**: `upstream/main` の `a63c5b7` まで取り込み済み（v1.2.0 系）
- **作業ツリー**: clean
- **ステータス**: upstream 取り込み後の追加小変更として、runtime path ログ追加、`Ctrl+Escape` キャンセル、preview の conservative pause 調整、cancel 後 preview 残留修正、`Escape` ダブルクリック誤キャンセル無効化まで commit 済み。`pnpm type:check`、`SKIP_CODESIGNING=true pnpm package:arm64`、`codesign --verify --deep --strict`、`/Applications/Amical.app` 差し替えは実施済み。最新ビルドの手動起動確認は未実施

---

## 今回完了した内容

### 1. upstream 取り込み

- `upstream/main` を `main` に merge 済み
- 競合は以下の 3 ファイルのみで解消済み
  - `apps/desktop/src/db/schema.ts`
  - `apps/desktop/src/services/settings-service.ts`
  - `apps/desktop/src/trpc/routers/settings.ts`
- 解消方針:
  - fork 側の `copyToClipboard` を維持
  - upstream 側の `preserveClipboard` を追加
  - upstream 側の `history.retentionPeriod` を追加

### 2. main に残した直近の独自変更

- `2d34f32 Fix signing symlinks and load full vocabulary`
- 主な内容:
  - vocabulary の 50 件制限を外し、全文読み込みに変更
  - packaging 時に `@amical/whisper-wrapper` 配下の入れ子 symlink を再帰的に実体化するよう修正
- 関連ファイル:
  - `apps/desktop/forge.config.ts`
  - `apps/desktop/src/db/vocabulary.ts`
  - `apps/desktop/src/services/transcription-service.ts`

### 3. build / signing / 起動確認

- `pnpm build:types`
  - 理由: `@amical/types/dist` が古く、`preserveClipboard` の型が desktop 側に見えていなかったため
- `pnpm type:check`
  - 成功
- `SKIP_CODESIGNING=true pnpm package:arm64`
  - 成功
- 手動自己署名
  - `codesign --deep --force -s "Amical Dev" out/Amical-darwin-arm64/Amical.app`
- 署名検証
  - `codesign --verify --deep --strict --verbose=2 out/Amical-darwin-arm64/Amical.app`
  - `valid on disk` / `satisfies its Designated Requirement` を確認済み
- workspace の build 成果物を起動確認済み
- `/Applications/Amical.app` へ差し替え済み
  - 最新の旧アプリ退避先: `/Applications/Amical.backup-20260501-113629.app`
  - このセッション中の追加退避版:
    - `/Applications/Amical.backup-20260501-105847.app`
    - `/Applications/Amical.backup-20260501-095157.app`
    - `/Applications/Amical.backup-20260501-084453.app`
- `/Applications/Amical.app` でも `codesign --verify --deep --strict --verbose=2` を実施済み
- 最新ビルドの手動起動確認は未実施

### 4. `ebbb1a6` で commit 済みの追加小変更

- 起動時ログの強化
  - `logger.ts` / `db/index.ts` で、`runtimeMode`、`isPackaged`、`userDataPath`、`dbPath`、`logPath`、`migrationsPath`、`cwd` を info ログに出すよう変更
  - 開発 DB / 本番 DB の取り違えをログだけで即切り分けできるようにした
  - 関連ファイル:
    - `apps/desktop/src/main/logger.ts`
    - `apps/desktop/src/db/index.ts`
- 録音キャンセル shortcut の変更
  - 録音中のキャンセルを `Escape` 単独から `Ctrl+Escape` に変更
  - 左右どちらの Ctrl でも反応する
  - `Escape` ダブルクリックではキャンセルしないよう修正
  - `Ctrl+Escape` 判定は current key event の `ctrlKey` と active key exact match を併用する
  - 関連ファイル:
    - `apps/desktop/src/main/managers/shortcut-manager.ts`
    - `apps/desktop/src/main/managers/recording-manager.ts`
- 録音中 intermediate preview の forced partial / 区切り確定表示はロールバック済み
  - 原因:
    - partial を早く打ちすぎると、local Whisper が短い断片をその場で確定してしまい、後から長い文脈で再認識して置き換える処理がなかった
    - preview 専用の荒い表示ではなく、partial 結果がそのまま最終文字起こしの下書きにも積まれていたため、精度低下を招いていた
  - 現在の挙動:
    - preview は従来どおり provider が返した累積テキストを表示する
    - local / cloud ともに、silence-based の chunk 発火へ戻している
  - 現在の追加調整:
    - precision 優先のまま表示を少し早めるため、pause 判定閾値だけを保守的に短縮
    - local Whisper: `1500ms -> 1200ms`
    - Amical Cloud: `1500ms -> 1300ms`
  - cancel / stop 中に in-flight chunk が返っても stale preview を emit しないよう修正
  - widget 側でも `recording` 以外の state に遷移したら `intermediateText` を即 clear する
  - 関連ファイル:
    - `apps/desktop/src/pipeline/providers/transcription/whisper-provider.ts`
    - `apps/desktop/src/pipeline/providers/transcription/amical-cloud-provider.ts`
    - `apps/desktop/src/main/managers/recording-manager.ts`
    - `apps/desktop/src/renderer/widget/pages/widget/components/FloatingButton.tsx`

---

## 重要な注意点

### 開発 DB と本番 DB は別

- 開発起動 (`pnpm start`) の DB:
  - `apps/desktop/amical.db`
- 本番アプリの DB:
  - `~/Library/Application Support/Amical/amical.db`
- `神楽 -> CAGRA` が効かなかった主因は、開発起動と本番アプリで見ている DB が別だったため
- 本番 DB の vocabulary を開発 DB に入れると replacement は期待どおり効くことを確認済み

### ログ出力先も別

- 開発起動:
  - `~/Library/Application Support/Amical/logs/amical-dev.log`
- 本番アプリ:
  - `~/Library/Logs/Amical/amical.log`

### packaging / signing

- Apple Developer 証明書なしで package する場合、まず `SKIP_CODESIGNING=true` が必要
- その後で手動 `codesign --deep --force -s "Amical Dev"` を実行する
- macOS 向け変更で packaging に触れたら、最後に必ず以下を確認する
  - `codesign --verify --deep --strict --verbose=2`

### 署名トラブルの実原因

- `app.asar.unpacked` 内に workspace の絶対パスを向く symlink が残ると、トップレベル `.app` の署名が壊れる
- 実際には `@amical/whisper-wrapper` 配下の入れ子 symlink が原因だった
- 現在は `forge.config.ts` でコピー済み依存配下の symlink を再帰的に実体化している

### テストの注意

- `tests/services/transcriptions.test.ts` は既知バグで全件失敗する
- 失敗時は今回の変更起因と決めつけず、既知失敗かを先に切り分けること

---

## custom-system-prompt メモ

- `custom-system-prompt` は **main に未マージ**
- 関連ブランチ:
  - `feat/custom-system-prompt`
  - `wip/custom-system-prompt`
  - `feature-custom-prompt`（存在はするが今回未使用）
- 状態:
  - `feat/custom-system-prompt` には core 実装がある
    - `FormatterConfig` への field 追加
    - `formatter-prompt.ts` への `## Additional Instructions` 差し込み
    - prompt 単体テスト
  - `wip/custom-system-prompt` には UI / i18n / service 層の途中実装がある
- ただし、これらの branch は upstream 取り込み前の前提で書かれており、そのまま復活させるのは危険
- 再開するなら、**現行 `main` に最小差分で載せ直す** 方針が安全
- 想定対象ファイル:
  - `apps/desktop/src/types/formatter.ts`
  - `apps/desktop/src/db/schema.ts`
  - `apps/desktop/src/trpc/routers/settings.ts`
  - `apps/desktop/src/pipeline/core/pipeline-types.ts`
  - `apps/desktop/src/pipeline/providers/formatting/formatter-prompt.ts`
  - `apps/desktop/src/services/transcription-service.ts`
  - `apps/desktop/src/renderer/main/pages/settings/dictation/hooks/use-formatting-settings.ts`
  - `apps/desktop/src/renderer/main/pages/settings/dictation/components/FormattingSettings.tsx`
  - `apps/desktop/src/i18n/locales/*.json`
  - `apps/desktop/tests/pipeline/formatter-prompt.test.ts`
- 注意:
  - 現状確認できた範囲では、desktop 側 formatter（OpenRouter / Ollama）に custom prompt を渡す設計
  - `Amical Cloud` formatting 側に custom prompt を渡す配線は未確認
- 今回は保留。優先度を下げて、他の細かい機能追加を先に進める

---

## 関連ブランチ

| ブランチ | 状態 | 内容 |
|---------|------|------|
| `main` | push 済み | upstream 取り込み済みの最新作業基点 |
| `backup-main-before-upstream-sync-20260501` | ローカルのみ | upstream 取り込み前の退避 |
| `feat/custom-system-prompt` | ローカルのみ | custom-system-prompt の core 実装 |
| `wip/custom-system-prompt` | ローカルのみ | custom-system-prompt の UI / service WIP |
| `feature-custom-prompt` | ローカルのみ | merge 後の補助 branch。今回未使用 |

---

## 次チャットで最初に決めること

1. `pnpm start` で、最新ビルド相当の動作を手動確認する
2. 特に以下を確認する
   - `Ctrl+Escape` ではキャンセルできる
   - `Escape` ダブルクリックではキャンセルされない
   - cancel 後に前回 preview が再表示されない
   - local `1200ms` / cloud `1300ms` の pause 判定が体感上妥当か
3. 問題なければ `main` を `origin/main` へ push する

---

## Suggested First Prompt

```text
Amical リポジトリの次の小機能追加を進めたいです。現在のブランチは main、HEAD は ebbb1a6 です。origin/main に対して 1 commit ahead です。まず docs/HANDOFF.md と docs/SPECIFICATIONS.md を確認し、現在の検証済み項目、開発DBと本番DBの違い、自己署名アプリ運用の注意点を前提に、次に実装する機能の影響範囲と着手計画を整理してください。custom-system-prompt は今回は保留です。packaging/signing に触れる変更なら codesign --verify --deep --strict を検証に含めてください。
```
