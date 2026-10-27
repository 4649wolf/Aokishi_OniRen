# CODEX_PROGRESS

## Current goal
- 提供素材1曲専用「青騎士さん専用鬼レンチャン」をGitHub Pagesで公開。

## Last known status
- 公開・配布完了。Nodeテスト12/12成功、公開Chromeで合成音声クリア／外れ／無音失敗と再挑戦を確認。

## Completed steps
- MIDI40音を原本から解析。動画5.000秒へ同期。
- 暗色画面、背景→カメラ→緑透過動画→白い音程バー・赤い外れ・現在地。
- WAV試聴／リピート、マイク音程判定、成功・失敗・中断、調整UI、マイクfavicon。
- 連打・古いplay Promise競合と動画停止の回帰テストを追加して修正。
- resume待ち中のページ離脱・復帰で接続操作がロックされる問題も再現テスト付きで修正。
- GitHub Pages初回ビルド成功、公開11素材のバイト一致、公開Chromeで40音クリアとコンソール0件を確認。
- WebGLなしのCanvas 2D代替も透過と黒帯不透明を確認。
- 最新実装ccd6f58の公開11点のバイト一致と公開ブラウザー一連動作を再確認、エラー・警告0件。
- 配布ZIP：親outputs/Aokishi_OniRen-v1.0.0.zip。21ファイルのCRCとGitコミット内容一致を確認。SHA256ファイルも同梱場所に保存。

## Important findings
- MIDI176BPM/10.397725秒、動画15.650227秒、WAV10.633333秒。
- 許容±100cent、外れ250ms、入力補正120ms初期値。
- 合成音声のブラウザー検証時は補正50ms。実機初期値の受入とは区別。

## Open issues / next steps
- 実歌声・実マイク・実カメラ・モバイル実機は未検証。

## Notes for future Codex sessions
- サーバー・ビルド・外部ライブラリ不要。main / rootをPagesソースにする。
- 検証の詳細はdocs/verification.md、仕様はdocs/design.md。
