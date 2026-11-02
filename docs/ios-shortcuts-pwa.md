# 📱 iOS 快捷指令自动唤醒独立全屏 PWA 指南 (iOS Shortcuts Standalone PWA Guide)

[🇨🇳 简体中文](#-简体中文-simplified-chinese) | [🇺🇸 English](#-english) | [🇯🇵 日本語](#-日本語-japanese) | [🇰🇷 한국어](#-한국어-korean) | [🇹🇼 繁體中文](#-繁體中文-traditional-chinese)

---

## 🇨🇳 简体中文 (Simplified Chinese)

### 1. 为什么需要这个技巧？
- **系统痛点 1（找不到 App）**：iOS 系统「快捷指令 (Shortcuts)」中的「打开 App」动作只能读取 App Store 下载或安装包自带 `CFBundleIdentifier` 的原生应用。通过 Safari「添加到主屏幕」生成的 PWA（WebClip）**不会**出现在应用候选列表中。
- **系统痛点 2（普通 URL 有白边与地址栏）**：如果在快捷指令中使用「打开 URL」并填入 `https://...`，系统默认会以普通 Safari 网页标签形式打开，带有烦人的顶部地址栏与底部工具栏，无法获得沉浸式全屏原生体验，且切换后台时可能受到更严格的音频限制。
- **💡 核心技巧**：iOS 内部支持私有 `webapp://` 协议！只要在快捷指令「打开 URL」中使用：
  ```text
  webapp://music.yourdomain.com
  # 若在局域网内使用 IP 与端口：
  webapp://192.168.1.100:8080
  ```
  iOS 会精准索引桌面上匹配的 PWA WebClip，直接以**独立全屏模式 (Standalone Mode)** 打开，无任何浏览器工具栏，体验与原生 App 完全一致！

---

### 2. 配置步骤

#### 第 1 步：将应用添加到 iPhone 主屏幕
1. 在 iPhone / iPad 上打开 **Safari** 浏览器，访问你的网易云音乐播放器地址；
2. 点击 Safari 底部中央的 **分享** 按钮（方框带向上箭头）；
3. 在弹出的菜单中下滑，点击 **「添加到主屏幕」** (Add to Home Screen)；
4. 点击右上角「添加」，此时桌面将生成一个独立的播放器图标。

#### 第 2 步：创建快捷指令个人自动化
1. 打开 iOS 自带的 **「快捷指令」** (Shortcuts) App；
2. 点击底部中间的 **「自动化」** (Automation) 标签；
3. 点击右上角 **「+」** 创建新自动化；
4. 选择触发条件，推荐常用场景：
   - 🎧 **蓝牙**：当连接到你的 AirPods、耳机或车载蓝牙时；
   - 🚗 **CarPlay**：连接 CarPlay 时自动打开；
   - 🏷️ **NFC**：用手机碰一下车上的 NFC 贴纸。
5. 在设置触发器时：
   - 勾选 **「立即运行」** (Run Immediately)；
   - 关闭 **「运行前询问」** (去掉勾选)。

#### 第 3 步：添加「打开 URL」动作
1. 点击「下一步」，点击 **「新建空白自动化」**；
2. 点击 **「添加操作」** (Add Action)；
3. 搜索 **「打开 URL」** (Open URL) 并点击添加；
4. 在 URL 输入框中填入：
   `webapp://` + 你的播放器域名或 IP（**注意：千万不要带 `http://` 或 `https://`**）
   - 例如：`webapp://music.example.com`
   - 局域网示例：`webapp://192.168.1.10:8080`
5. 点击右上角 **「完成」** 保存。

🎉 **大功告成**！现在只要你的手机连上蓝牙耳机或坐进车内连上车载，手机就会立即全屏唤起网易云音乐独立 PWA，配合锁屏 MediaSession 控制，上车即听！

---

## 🇺🇸 English

### 1. Why is this trick needed?
- **Issue 1 ("Open App" cannot find PWAs)**: The iOS Shortcuts action "Open App" only lists native applications with registered `CFBundleIdentifier`s. WebClips added via Safari's "Add to Home Screen" **never** appear in the application picker.
- **Issue 2 (Standard URLs open in Safari with navigation chrome)**: Using "Open URL" with `https://...` forces iOS to open Safari as a normal browser tab with top and bottom address toolbars, breaking the clean standalone immersion and potentially restricting background audio sessions.
- **💡 The Secret**: iOS supports an internal `webapp://` protocol! When you execute:
  ```text
  webapp://music.yourdomain.com
  # Or LAN IP:port:
  webapp://192.168.1.100:8080
  ```
  iOS matches the corresponding Home Screen WebClip and directly launches the PWA in **Standalone Mode** (completely borderless, full-screen, identical to a native app).

---

### 2. Setup Guide

#### Step 1: Add the PWA to your Home Screen
1. Open **Safari** on your iPhone / iPad and navigate to your music server URL.
2. Tap the **Share** button (the square with an arrow pointing upward).
3. Scroll down and tap **"Add to Home Screen"**.
4. Tap **"Add"** in the top right. A standalone web app icon is now on your home screen.

#### Step 2: Create a Personal Automation in Shortcuts
1. Launch Apple's built-in **Shortcuts** app.
2. Switch to the **Automation** tab at the bottom.
3. Tap **"+"** in the top-right corner to create a personal automation.
4. Select your preferred trigger:
   - 🎧 **Bluetooth**: When connected to your AirPods, headphones, or car audio;
   - 🚗 **CarPlay**: When connected to CarPlay;
   - 🏷️ **NFC**: When tapping a custom NFC sticker on your desk or car mount.
5. In the trigger options:
   - Select **"Run Immediately"**;
   - Disable **"Notify When Run"** (optional, recommended for silent launch).

#### Step 3: Add the "Open URL" Action
1. Tap "Next" and select **"New Blank Automation"**.
2. Tap **"Add Action"**.
3. Search for and select **"Open URL"**.
4. In the URL field, input:
   `webapp://` + your domain or IP without `http://` or `https://`
   - Example: `webapp://music.example.com`
   - LAN Example: `webapp://192.168.1.10:8080`
5. Tap **"Done"** to save.

🎉 **All Set!** Whenever your Bluetooth headphones or car connect, your standalone music player PWA will automatically pop up in full-screen mode!

---

## 🇯🇵 日本語 (Japanese)

### 1. この裏技が必要な理由
- **課題 1 (「Appを開く」でPWAが見つからない)**: iOSのショートカットにある「Appを開く」アクションは、ネイティブアプリ（App Store製）のみが対象であり、Safariの「ホーム画面に追加」で作ったPWA (WebClip) はリストに表示されません。
- **課題 2 (通常のURLではSafariのツールバーが表示される)**: 「URLを開く」で `https://...` を指定すると、通常のSafariタブとして起動し、上下のURLバーやツールバーが表示されてしまいます。
- **💡 解決策**: iOSには内部プロトコル `webapp://` が存在します！「URLを開く」アクションで次のように指定します：
  ```text
  webapp://music.yourdomain.com
  # LAN内IPの場合:
  webapp://192.168.1.100:8080
  ```
  iOSがホーム画面に追加されたWebClipを検出し、**スタンドアロン（全画面・アドレスバーなし）** モードで直接起動します。

---

### 2. 設定手順

#### ステップ 1: ホーム画面に追加
1. iPhone / iPad の **Safari** で音楽プレイヤーのURLを開きます。
2. 画面下部中央の **共有** アイコン（四角から上矢印）をタップします。
3. **「ホーム画面に追加」** を選択し、右上の「追加」をタップします。

#### ステップ 2: ショートカットでオートメーションを作成
1. **「ショートカット」** アプリを開き、下部の **「オートメーション」** タブを選択します。
2. 右上の **「+」** をタップして新しい個人用オートメーションを作成します。
3. トリガーを選択します：
   - 🎧 **Bluetooth**: AirPodsやイヤホン、カーオーディオに接続したとき；
   - 🚗 **CarPlay**: CarPlayに接続したとき。
4. **「すぐに実行」** にチェックを入れます（「実行前に尋ねる」はオフ）。

#### ステップ 3: 「URLを開く」アクションを追加
1. 「次へ」をタップし、**「新規の空のオートメーション」** を選択します。
2. **「アクションを追加」** をタップし、**「URLを開く」** を検索して選択します。
3. URL入力欄に以下のように入力します：
   `webapp://` + ドメインまたはIP（**注：`http://` や `https://` は含めないでください**）
   - 例: `webapp://music.example.com`
   - LAN内例: `webapp://192.168.1.10:8080`
4. 右上の **「完了」** をタップして保存します。

🎉 **設定完了！** イヤホンや車に接続するだけで、自動的に全画面PWAプレイヤーが立ち上がります。

---

## 🇰🇷 한국어 (Korean)

### 1. 이 방법이 필요한 이유
- **문제점 1 ('앱 열기'에서 PWA를 찾을 수 없음)**: iOS 단축어의 '앱 열기' 동작은 네이티브 앱만 인식하므로, Safari의 '홈 화면에 추가'로 설치한 PWA는 앱 목록에 나타나지 않습니다.
- **문제점 2 (일반 URL은 Safari 도구 모음이 표시됨)**: 단축어에서 일반 `https://...` 링크로 'URL 열기'를 실행하면 Safari 브라우저 탭으로 열려 상/하단 주소창이 노출되고 독립형 전체화면 몰입감이 사라집니다.
- **💡 핵심 비결**: iOS 내부 전용 `webapp://` 프로토콜을 사용하면 완벽히 해결됩니다!
  ```text
  webapp://music.yourdomain.com
  # 내부망 IP 사용 시:
  webapp://192.168.1.100:8080
  ```
  단축어 실행 시 iOS가 홈 화면의 PWA WebClip을 찾아 **독립형 전체화면(Standalone Mode)** 모드로 바로 실행합니다.

---

### 2. 설정 방법

#### 1단계: 홈 화면에 PWA 추가
1. iPhone / iPad의 **Safari**에서 음악 서버 주소로 접속합니다.
2. 하단 중앙의 **공유** 버튼(위로 향한 화살표 네모 아이콘)을 탭합니다.
3. **'홈 화면에 추가'**를 선택한 후 오른쪽 상단의 '추가'를 누릅니다.

#### 2단계: 단축어 개인용 자동화 생성
1. **'단축어'** 앱을 실행하고 하단 **'자동화'** 탭을 누릅니다.
2. 오른쪽 상단의 **'+'** 버튼을 눌러 개인용 자동화를 만듭니다.
3. 원하는 트리거를 선택합니다:
   - 🎧 **Bluetooth**: AirPods, 무선 이어폰 또는 차량 블루투스 연결 시;
   - 🚗 **CarPlay**: CarPlay 연결 시.
4. 옵션에서 **'확인하지 않고 실행' (즉시 실행)**을 선택합니다.

#### 3단계: 'URL 열기' 동작 추가
1. '다음'을 누르고 **'새로운 빈 자동화'**를 선택합니다.
2. **'동작 추가'**를 누르고 **'URL 열기'**를 검색하여 추가합니다.
3. URL 입력란에 아래와 같이 입력합니다:
   `webapp://` + 도메인 또는 IP (**주의: `http://` 또는 `https://`는 제거해야 합니다**)
   - 예시: `webapp://music.example.com`
   - 내부망 예시: `webapp://192.168.1.10:8080`
4. 오른쪽 상단의 **'완료'**를 눌러 저장합니다.

🎉 **완료!** 이제 이어폰을 끼거나 차량에 탑승하는 즉시 깔끔한 전체화면 PWA 플레이어가 자동으로 실행됩니다!

---

## 🇹🇼 繁體中文 (Traditional Chinese)

### 1. 為什麼需要這個技巧？
- **系統痛點 1（找不到 App）**：iOS「捷徑 (Shortcuts)」中的「打開 App」動作僅能索引具有原生 `CFBundleIdentifier` 的 App。透過 Safari「加入主畫面」所建立的 PWA（WebClip）**不會**出現在應用程式選單中。
- **系統痛点 2（一般網址會帶有 Safari 網址列）**：若在捷徑中使用「打開 URL」並填入 `https://...`，系統會預設使用 Safari 分頁開啟，具有頂部與底部工具列，無法獲得全螢幕原生 App 的沉浸體驗。
- **💡 核心技巧**：iOS 內建支援私有 `webapp://` 協定！只要在捷徑「打開 URL」中填寫：
  ```text
  webapp://music.yourdomain.com
  # 區域網路 IP 與連接埠範例：
  webapp://192.168.1.100:8080
  ```
  iOS 將會精準比對桌面上的 PWA WebClip，直接以**獨立全螢幕模式 (Standalone Mode)** 啟動，完全無 Safari 工具列！

---

### 2. 設定步驟

#### 第 1 步：將應用程式加入 iPhone 主畫面
1. 在 iPhone / iPad 上使用 **Safari** 瀏覽器開啟播放器；
2. 點擊 Safari 底部中央的 **分享** 按鈕（方框帶向上箭頭）；
3. 向下滑動並點選 **「加入主畫面」** (Add to Home Screen)；
4. 點擊右上角「新增」，桌面隨即建立獨立圖示。

#### 第 2 步：建立捷徑個人自動化
1. 打開 iOS 內建的 **「捷徑」** (Shortcuts) App；
2. 切換至底部中央的 **「自動化」** (Automation) 標籤；
3. 點選右上角 **「+」** 建立新自動化；
4. 選擇觸發情境：
   - 🎧 **藍牙**：連線至 AirPods、耳機或車用藍牙時；
   - 🚗 **CarPlay**：連線至 CarPlay 時。
5. 設定觸發選項：
   - 勾選 **「立即執行」** (Run Immediately)；
   - 關閉 **「執行前先詢問」**。

#### 第 3 步：新增「打開 URL」動作
1. 點擊「下一步」，選擇 **「新增空白自動化」**；
2. 點擊 **「加入動作」** (Add Action)；
3. 搜尋並加入 **「打開 URL」** (Open URL)；
4. 在網址欄位中填入：
   `webapp://` + 您的播放器網域名稱或 IP（**注意：請勿包含 `http://` 或 `https://`**）
   - 範例：`webapp://music.example.com`
   - 區域網路範例：`webapp://192.168.1.10:8080`
5. 點擊右上角 **「完成」** 儲存。

🎉 **設定完成！** 當耳機或車載藍牙連線時，手機會自動全螢幕啟動獨立 PWA，搭配鎖定畫面控制，享受無縫音樂體驗！
