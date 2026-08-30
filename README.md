# MusicBox 🎵

一个现代化、跨平台的桌面音乐播放器，基于 [Tauri 2](https://tauri.app/) + 原生 Rust 后端 + 纯 Vanilla JS 前端（零前端依赖、无构建步骤）。

## ✨ 功能特性

- **播放核心**：播放/暂停/上下曲、进度拖拽、音量/静音、4 种播放模式（顺序/随机/单曲循环/列表循环）
- **曲库管理**：扫描文件夹、搜索、表头排序、元数据与封面读取（lofty）
- **歌单**：新建/重命名/删除、收藏「我喜欢」、拖拽排序
- **播放队列**：下一首播放、加入队列、队列面板管理
- **歌词**：本地 `.lrc` / 内嵌标签 / 在线自动下载（lrclib），同步滚动 + 时间轴微调
- **多种视图**：列表 / 专辑网格 / 歌手网格
- **正在播放视图**：大封面旋转 + 同步歌词 + 沉浸式全屏
- **系统集成**：系统托盘、关闭到托盘、系统媒体控制（SMTC/媒体键）、迷你播放窗、窗口置顶、睡眠定时器
- **现代化 UI**：毛玻璃拟态（可调模糊强度/透明度）、暗/亮/暖三主题、主题色、封面壁纸背景、列表密度等 15+ 项个性化设置
- **持久化**：所有设置、歌单、收藏、队列、播放历史、窗口位置均自动保存
- **快捷键**：空格播放、方向键切歌/快进/音量、`L` 歌词、`Q` 队列、`F` 收藏、`[ ]` 歌词偏移、`Shift+?` 帮助

## 🛠 技术栈

| 层 | 技术 |
|----|------|
| 桌面框架 | Tauri 2（Rust） |
| 前端 | 原生 HTML/CSS/JS（ES Modules，无框架） |
| 音频 | HTML5 `<audio>` + Tauri asset 协议 |
| 元数据/封面 | [lofty](https://crates.io/crates/lofty) |
| 媒体控制 | [souvlaki](https://crates.io/crates/souvlaki)（SMTC） |
| 歌词下载 | [ureq](https://crates.io/crates/ureq) + lrclib |

## 🚀 开发

前置要求：Rust 工具链、[Tauri 2 依赖](https://tauri.app/start/prerequisites/)、Tauri CLI

```powershell
cargo install tauri-cli --version '^2.0.0' --locked

cd musicbox
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

双击即可使用（自动定位到项目目录、自动配置 cargo 环境）。

## 📁 项目结构

```
src/                    # 前端（HTML/CSS/JS）
├── index.html          # 主界面
├── mini.html           # 迷你播放窗
└── js/                 # 模块（audio/library/playlists/lyrics/queue/settings 等）
src-tauri/              # Rust 后端
├── src/
│   ├── library.rs      # 扫描、元数据、封面、歌词
│   ├── store.rs        # 状态与窗口持久化
│   ├── media.rs        # 系统媒体控制
│   ├── tray.rs         # 系统托盘
│   └── models.rs       # 数据结构
└── tauri.conf.json     # 应用配置
```

## 📄 License

MIT
