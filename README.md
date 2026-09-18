# Handy Cloud

基于 [Handy](https://github.com/cjpais/Handy) 的跨平台桌面语音输入工具。按快捷键录音，松开或再次按下后，使用阿里云百炼（DashScope）**Qwen3.5-Omni Flash / Plus** 转写，并将文字粘贴到当前应用。支持 Linux、Windows 和 macOS；本项目优先验证 Linux。

本项目使用云端转写，需要网络和你自己的百炼 API Key。语音活动检测（Silero VAD）在本机运行，转写音频会发送到设置中的服务地址。模型调用可能产生百炼费用。

## 安装和首次使用

从 [Handy Cloud Releases](https://github.com/tianzheng-zhou/handy-cloud/releases) 手动下载适合系统的安装包；没有对应资产时，可按 [BUILD.md](BUILD.md) 从源码构建。私有仓库的下载链接需要仓库访问权限。

1. 启动 Handy Cloud，按系统提示授予麦克风权限；macOS 还需要辅助功能权限。
2. 填写百炼 API Key。默认地址为 `https://dashscope.aliyuncs.com/compatible-mode/v1`。
3. 在语音识别设置中选择 Flash 或 Plus，在通用设置中配置快捷键和麦克风。
4. 将光标放到目标输入框，使用快捷键录音并转写。可以通过悬浮窗、托盘或 `handy-cloud --cancel` 取消当前操作。

默认构建关闭自动更新，使用手动下载安装。自动更新实现仍保留；维护者配置本项目的 HTTPS 更新地址、公钥及签名流程后才能启用。

## 功能和数据

- 保留按住说话、切换录音、VAD、音量悬浮窗、提示音、剪贴板/粘贴、历史记录和历史重试。
- 支持自定义词、语言提示、英文翻译、可选文本后处理、应用主题及 24 种界面语言。
- 可选屏幕上下文：启用后采集截图，并随音频发送给支持图像的 Omni 模型。仅用于帮助识别上下文。默认关闭；只在需要时启用。
- Linux 屏幕采集使用桌面 portal；ScreenCast 方式还需要 PipeWire 和 GStreamer 的 `pipewiresrc` 插件。可在设置中切换采集方式。
- API Key 保存在本地设置文件中，**不是系统钥匙串**。不要分享设置文件、录音或包含私人内容的调试日志。

应用标识为 `com.tianzhengzhou.handy-cloud`，数据位置按 [Tauri 的平台路径规则](https://v2.tauri.app/reference/javascript/api/namespacepath/#appdatadir) 推导：

| 系统    | 默认数据目录                                                                                          |
| ------- | ----------------------------------------------------------------------------------------------------- |
| Linux   | `$XDG_DATA_HOME/com.tianzhengzhou.handy-cloud`，通常为 `~/.local/share/com.tianzhengzhou.handy-cloud` |
| Windows | `%APPDATA%\com.tianzhengzhou.handy-cloud`                                                             |
| macOS   | `~/Library/Application Support/com.tianzhengzhou.handy-cloud`                                         |

设置文件为 `settings_store.json`，历史数据库为 `history.db`，录音位于 `recordings/`。在“关于”中可打开实际数据和日志目录。

首次启动时，如果新应用还没有数据，会自动复制原 `com.pais.handy` 目录中的设置（包括 Key）、SQLite 历史、录音和 `custom_start.wav` / `custom_stop.wav`。复制使用暂存目录，SQLite 通过备份接口读取一致快照；中断后可重新启动继续。原目录保持不变，已有新数据不会被覆盖。失败时应用停止初始化并保留原数据，修复磁盘空间或访问权限后重试。

屏幕授权 token 不跨应用迁移；请重新授予系统权限。便携安装继续使用可执行文件旁原有的 `Data/` 目录，保留原 `portable` 标记的识别规则，不执行跨目录导入。

## 命令行

命令名改为 `handy-cloud`；原有参数和 `HANDY_*` 环境变量保持兼容。

```bash
handy-cloud --start-hidden
handy-cloud --toggle-transcription
handy-cloud --toggle-post-process
handy-cloud --cancel
handy-cloud --no-tray
handy-cloud --debug
handy-cloud --list-models
handy-cloud --transcribe-file sample.wav --json
```

`--transcribe-file` 接受 16 kHz 单声道 WAV，读取已保存的云端设置，可搭配 `--model`、`--repeat`。`--repeat` 会多次调用云端并可能多次计费。远程控制参数通过单实例机制交给正在运行的应用。启动参数不会改写持久设置。旧 `--device-index`、`--list-devices` 参数仍可解析，但已无本地 ASR GPU 设备。

## 开发与验证

```bash
bun install --frozen-lockfile
bun run dev             # 前端开发；桌面功能需要 Tauri
bun run tauri dev       # 完整桌面应用
bun run build
bun run lint
bun run check:translations
bun test tests/unit
bun run test:playwright
```

完整依赖、Rust 检查、绑定生成和打包说明见 [BUILD.md](BUILD.md)。贡献流程见 [CONTRIBUTING.md](CONTRIBUTING.md)，语言回退说明见 [CONTRIBUTING_TRANSLATIONS.md](CONTRIBUTING_TRANSLATIONS.md)。

## Troubleshooting

- **401/403**：检查百炼 Key、服务地域和网关地址。
- **无声音**：检查系统麦克风权限、选中的设备和静音状态。
- **Linux 快捷键不可用**：Wayland 支持取决于桌面环境；可在桌面快捷键设置中调用 `handy-cloud --toggle-transcription`。不要通过放宽整个输入设备的权限来排查。
- **Linux 悬浮窗异常**：尝试 `HANDY_NO_GTK_LAYER_SHELL=1 handy-cloud`。
- **无法粘贴**：检查目标应用权限和所选粘贴方式；Wayland 的外部输入工具需要单独安装。
- **macOS Secure Input**：密码输入框或终端的 Secure Keyboard Entry 会阻止全局快捷键；退出密码输入状态或关闭该终端选项后重试。
- **屏幕上下文不可用**：重新授权桌面 portal / 屏幕录制；缺少截图时仍可仅发送音频。
- **录音无法保存**：应用会提示，继续转写，但不会生成缺少音频、无法重试的历史记录。

## 来源与许可证

基于 [cjpais/Handy](https://github.com/cjpais/Handy)，保留原作者与贡献者的版权、MIT [LICENSE](LICENSE) 和关于页致谢。Handy Cloud 是独立维护的云端版本，项目问题请提交到 [本仓库](https://github.com/tianzheng-zhou/handy-cloud/issues)。
