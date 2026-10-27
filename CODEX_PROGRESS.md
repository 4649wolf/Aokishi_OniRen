# CODEX_PROGRESS

## Current goal
- v1.2：人物/VTuberカメラの緑・青クロマキー、実歌声の音高へ赤いバー、さらに緩い判定。

## Last known status
- v1.2公開・配布済み。Node21/21 PASS、配信12点一致、公開Chromeでもクロマキーと実音高バー・緩い判定を確認。

## Completed steps
- カメラ/仮想カメラ選択、一覧更新、クロマキーなし/緑/青と透過強さ。
- 背景→処理済みカメラCanvas→本番動画→音程バー。WebGL/CPU代替で共通の閾値。
- 赤は実際の検出音高に描き、白い目標を残す。無音には赤い音高を作らない。
- ±200cent、外れ1秒、無音1.5秒へ緩和。息継ぎと短い検出抜けの混在を回帰テスト。
- Chromeで+190centの全40音クリア、上/下の外れは赤と白が別位置、無音は赤0で失敗。
- 緑/青背景alpha0・人物alpha255、強さ10/90でalpha241/24。WebGLとCPUで同値。
- カメラ切替で古いトラック停止、解除でCanvas非表示・srcObject解除、390pxはみ出しなし。
- 公開374b7e0で+190centクリア、高い/低い外れの赤と白が別位置、無音時赤0、解除を確認。配布ZIP23ファイルのCRCとGit内容一致を確認。

## Important findings
- 本番動画5秒をMIDI開始に同期。40音/176BPM/10.397725秒、動画15.650227秒。
- 入力補正120ms固定。合成入力検証は入力側70ms遅延、実機受入とは区別。
- ヘッダー/説明の簡素化、18pxバー、正解黄色、歌い出しまで吹き出しは維持。

## Open issues / next steps
- 実人物・実VTuber/OBS・実マイク・モバイル実機は未受入。

## Notes for future Codex sessions
- ビルド・外部ライブラリ・サーバー不要。Pages main/root。
- 配布は親outputs/Aokishi_OniRen-v1.2.0.zip。過去版は残す。
- 詳細はdocs/verification.md、docs/design.md。
