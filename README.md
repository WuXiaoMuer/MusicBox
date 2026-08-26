# MusicBox 🎵

> 一个现代化、轻量、跨平台的桌面音乐播放器 —— 基于 Tauri 2 + Rust + 原生 JS，零前端依赖。

漂亮的毛玻璃拟态界面，支持本地曲库、在线链接播放、同步歌词、迷你播放窗、系统托盘与媒体控制，开箱即用。

## ✨ 功能特性

### 🎶 播放
- 播放/暂停/上下曲、进度拖拽、音量/静音
- 4 种播放模式：顺序 / 随机 / 单曲循环 / 列表循环
- **在线链接播放**：粘贴音频直链即可播放，支持下载到本地

### 📚 曲库
- 扫描文件夹管理、拖放添加、搜索、表头点击排序
- 三种视图：列表 / 专辑网格 / 歌手网格
- 批量选择操作（Ctrl/Shift 多选）、元数据编辑（标题/歌手/专辑写回文件）
- m3u 歌单导出、最近播放、最常播放、播放次数统计

### 🎤 歌词
- 本地 `.lrc`（UTF-8 / GBK）→ 内嵌标签 → 在线自动下载（lrclib）
- 同步滚动 + 时间轴微调（`[` / `]`）
- 「正在播放」视图：旋转大封面 + 歌词 + 沉浸式全屏

### 🖥 系统集成
- 系统托盘、关闭到托盘、系统媒体控制（SMTC / 媒体键）
- 迷你播放窗、窗口置顶、睡眠定时器、窗口位置记忆

### 🎨 个性化
- 毛玻璃拟态（模糊强度/透明度可调）、暗/亮/暖三主题
- 主题色自定义（预设 + 取色器）、封面壁纸背景
- 自定义快捷键、设置导入/导出、动效开关与速度

### ⚡ 其他
- 所有设置、歌单、收藏、队列、历史自动持久化
- 一键脚本：`run.bat` / `build.bat` / `clean.bat` 等

## 🛠 技术栈

| 层 | 技术 |
|----|------|
| 桌面框架 | [Tauri 2](https://tauri.app/)（Rust） |
| 前端 | 原生 HTML/CSS/JS（ES Modules，无框架、无构建步骤） |
| 音频 | HTML5 `<audio>` + Tauri asset 协议 |
| 元数据/封面 | [lofty](https://crates.io/crates/lofty) |
| 系统媒体控制 | [souvlaki](https://crates.io/crates/souvlaki)（SMTC） |
| 歌词下载 | [ureq](https://crates.io/crates/ureq) + lrclib |

## 🚀 开发

前置要求：Rust 工具链、[Tauri 2 依赖](https://tauri.app/start/prerequisites/)、Tauri CLI

```powershell
cargo install tauri-cli --version '^2.0.0' --locked

cargo tauri dev        # 开发模式
cargo tauri build      # 打包（生成安装包/可执行文件）
```

## ⚡ 一键脚本（Windows）

| 脚本 | 作用 |
|------|------|
| `setup.bat` | 环境检查（Rust / Tauri CLI 缺失自动安装） |
| `run.bat` | 开发模式运行 |
| `build.bat` | 打包安装程序 |
| `build-min.bat` | 仅编译 EXE（更快） |
| `run-release.bat` | 直接运行已编译版本 |
| `clean.bat` | 清理构建缓存（释放 8GB+ 磁盘空间） |

双击即可使用（自动定位项目目录、自动配置 cargo 环境）。

## 📁 项目结构

```
src/                    # 前端（HTML/CSS/JS）
├── index.html          # 主界面
├── mini.html           # 迷你播放窗
└── js/                 # 模块（audio/library/playlists/lyrics/queue/settings 等）
src-tauri/              # Rust 后端
├── src/
│   ├── library.rs      # 扫描、元数据、封面、歌词、在线下载
│   ├── store.rs        # 状态与窗口持久化
│   ├── media.rs        # 系统媒体控制
│   ├── tray.rs         # 系统托盘
│   └── models.rs       # 数据结构
└── tauri.conf.json     # 应用配置
```

## 📄 License

MIT
