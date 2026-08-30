<div align="center">

# 🎵 MusicBox

**一个现代化、轻量、跨平台的桌面音乐播放器**

基于 Tauri 2 + Rust 构建，零前端依赖，颜值与性能兼顾。

<br>

<img src="assets/screenshot.png" alt="MusicBox 正在播放视图" width="900" />

<br><br>

[![GitHub release](https://img.shields.io/github/v/release/WuXiaoMu/MusicBox?style=flat-square&color=1db954&logo=github)](https://github.com/WuXiaoMu/MusicBox/releases)
[![Build](https://img.shields.io/github/actions/workflow/status/WuXiaoMu/MusicBox/release.yml?style=flat-square&logo=github-actions&logoColor=white)](https://github.com/WuXiaoMu/MusicBox/actions)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=flat-square)](#-下载安装)
[![License](https://img.shields.io/github/license/WuXiaoMu/MusicBox?style=flat-square)](LICENSE)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-24C8DB?style=flat-square&logo=tauri&logoColor=white)](https://tauri.app)

</div>

---

## ✨ 为什么选择 MusicBox

<br>

| 🎨 **颜值在线** | ⚡ **极致轻量** | 🌐 **完全开源** |
|:---:|:---:|:---:|
| 毛玻璃拟态 · 暗/亮/暖三主题 · 主题色自定义 | Rust 原生性能 · 安装包仅 ~14MB · 零前端依赖 | 代码完全开源 · 多平台安装包 · 欢迎贡献 |

<br>

---

## 🎶 核心特性

<br>

**🎵 播放与曲库**
- 播放控制：上一首 / 下一首 / 进度拖拽 / 音量 / 4 种播放模式
- 文件夹扫描、拖放添加、3 种视图（列表 / 专辑 / 歌手）
- 实时搜索、表头排序、批量选择、批量从曲库移除
- 元数据编辑（标题 / 歌手 / 专辑直接写回音频文件）
- 歌单、收藏、最近播放、最常播放、播放次数

**🎤 歌词**
- 本地 `.lrc`（UTF-8 / GBK）→ 内嵌标签 → 在线自动下载（lrclib）
- 同步滚动 + 时间轴微调 `[` / `]`
- 沉浸式「正在播放」全屏视图

**🌐 高级功能**
- **在线链接播放** + 一键下载到本地
- **自定义背景图片**，毛玻璃模糊强度 / 面板透明度可调
- **完全可自定义快捷键**
- 设置**导入 / 导出**（JSON）
- 开机自启动、系统托盘、SMTC、迷你播放窗、睡眠定时

**🖥 系统集成**
- 关闭到托盘、窗口置顶、系统媒体控制（媒体键）
- m3u 歌单导出、显示文件所在位置

<br>

---

## 📥 下载安装

> 各平台安装包由 [GitHub Actions CI](https://github.com/WuXiaoMu/MusicBox/actions) 自动构建并发布。

<br>

| 平台 | 安装包 | 说明 |
|:---:|:---|:---|
| 🪟 **Windows** | `.exe` NSIS 安装包 / `.msi` | Windows 10 / 11（WebView2 运行时 Win11 自带） |
| 🍎 **macOS** | `.dmg` | 同时发布 Apple Silicon (M1+) 与 Intel 版本 |
| 🐧 **Linux** | `.deb` / `.AppImage` | 需 `webkit2gtk-4.1` 等系统库 |

前往 [**Releases 页面**](https://github.com/WuXiaoMu/MusicBox/releases) 下载最新版本。

<br>

---

## 🛠 技术栈

<br>

| 层 | 技术 |
|:---|:---|
| 桌面框架 | [Tauri 2](https://tauri.app/)（Rust） |
| 前端 | 原生 HTML / CSS / JS（ES Modules，**无 npm、无构建步骤**） |
| 音频 | HTML5 `<audio>` + Tauri asset 协议 |
| 元数据 / 封面 | [lofty](https://crates.io/crates/lofty) |
| 系统媒体控制 | [souvlaki](https://crates.io/crates/souvlaki)（SMTC） |
| 歌词下载 | [ureq](https://crates.io/crates/ureq) + lrclib |
| 自动启动 | [tauri-plugin-autostart](https://crates.io/crates/tauri-plugin-autostart) |

<br>

---

## 🚀 本地开发

<br>

```powershell
# 安装 Tauri CLI（一次性）
cargo install tauri-cli --version '^2.0.0' --locked

# 克隆并运行开发模式
git clone https://github.com/WuXiaoMu/MusicBox
cd MusicBox
cargo tauri dev
```

**Windows 用户**还可以使用仓库根目录的一键脚本：

| 脚本 | 用途 |
|:---|:---|
| `setup.bat` | 环境检查（Rust / Tauri CLI 缺失自动安装） |
| `run.bat` | 开发模式运行 |
| `build.bat` | 打包安装程序 |
| `build-min.bat` | 仅编译 EXE（更快） |
| `run-release.bat` | 直接运行已编译版本 |
| `clean.bat` | 清理构建缓存 |

<br>

---

## 📁 项目结构

<br>

```
MusicBox/
├── src/                    # 前端 (HTML / CSS / JS)
│   ├── index.html          # 主界面
│   ├── mini.html           # 迷你播放窗
│   └── js/                 # 模块化前端代码
├── src-tauri/              # Rust 后端
│   ├── src/
│   │   ├── library.rs      # 扫描 / 元数据 / 封面 / 歌词 / 在线下载
│   │   ├── store.rs        # 状态与窗口持久化
│   │   ├── media.rs        # 系统媒体控制
│   │   ├── tray.rs         # 系统托盘
│   │   ├── models.rs       # 数据结构
│   │   └── lib.rs          # 命令与插件
│   └── tauri.conf.json
├── .github/
│   └── workflows/
│       └── release.yml     # 多平台自动构建 CI
├── assets/
│   └── screenshot.png      # README 演示截图
├── *.bat                   # Windows 一键脚本
└── README.md
```

<br>

---

## 📄 License

<br>

[MIT](LICENSE) © **WuXiaoMu**

<br>

<div align="center">

<sub>如果觉得不错，欢迎 ⭐ Star 支持一下！</sub>

</div>