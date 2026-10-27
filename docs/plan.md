# 青騎士さん専用鬼レンチャン Implementation Plan

**Goal:** 指定曲のMIDI同期・音程判定・クロマキー合成をGitHub Pagesで提供する。
**Architecture:** 素材をローカル同梱し、動画currentTimeを唯一の進行時計にする。MIDI・判定・描画を小さいESモジュールに分割。
**Tech Stack:** HTML, CSS, ES modules, Web Audio, WebGL, Node標準test。
**Spec:** design.md

## Global Constraints
- 単曲固定、タイトル固定、日本語、暗色、音程バー白／外れ赤。
- カメラは背景と動画の間。外部への音声映像送信なし。

## Review Focus
- 無音、短い連続音、オクターブ違い、再挑戦時の前回状態。
- 権限拒否・切断・非表示・動画停止で誤クリアしない。
- リポジトリ配下URL、素材HTTP、WebGL透過、画面幅390px。

## Tasks
- [x] MIDIパーサー／ピッチ推定／判定の期待テストを先に作り、失敗を確認。
- [x] tempo mapとnote on/offから40音を復元。YINで音高を検出、判定をテスト。
- [x] 暗色UI・試聴・独立したカメラ／マイク接続・中断と再挑戦。
- [x] グリーン透過、黒い下部内のページ式MIDIバー、現在地、失敗／クリア。
- [x] 実ブラウザーで合成・権限拒否・合成音声の成功／失敗・レスポンシブを検証。
- [x] README・受入境界・ZIP・GitHub Pages公開と公開URL検証。
