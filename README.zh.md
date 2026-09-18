# dsh-download-button

[English](README.md) | 中文

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）Web 端的**交付物文件卡片**补一个「下载」按钮。

## 问题

Agent 产出一个文件后，`dsh` 的卡片只有两个动作：

| 动作 | 行为 | 为什么不够用 |
|---|---|---|
| `打开` | 让**宿主机器**用默认应用打开 | 无桌面的服务器上必然失败 |
| `在侧边栏打开` | 纯文本预览 | docx / xlsx / pdf / zip 等会回你「非文本文件，暂时无法预览」 |

结果就是：agent 刚写好的 docx，**在浏览器里没有任何出口**。

## 这个插件做什么

给每张交付物卡片追加一个**下载**链接，点击即从服务端直接存盘。

```
[ 下载 ] [ 打开 ▾ ]
```

在**无桌面的宿主**上，它还会顺手隐藏那句 *「此主机没有可用的桌面，无法打开文件或文件夹」*。
那句话的来历：dsh 为「跑在你自己电脑上」的场景提供了一套桌面集成（用宿主应用打开文件 /
在 Finder·Explorer 里定位）。服务器没有这种桌面，提示纯属噪音——真正的出口是下载。
判定用的是 dsh 自己在 Linux 上的同一规则（存在 `DISPLAY` 或 `WAYLAND_DISPLAY`）；
在 macOS/Windows 桌面模式下什么都不隐藏（那时该提示本来也不会出现）。

## 设计（为什么升级不会丢）

- **不改 vendor**：`node_modules` 下任何文件都不动，插件只对服务端渲染的 index 页做一次注入。
- **不自建服务端路由**：直接复用 dsh 自带的认证原始字节接口
  `GET /api/file?path=<绝对路径>`（Content-Type 正确、走 cookie 认证），文件名交给 HTML 的 `download` 属性。
- **不依赖打包后的类名**：按钮的 `className` 从**同一张卡片上已有的兄弟按钮**抄，跟随主题/样式变化。
- 绝对路径来自卡片自身的 `title` 属性（dsh 本来就把它设成解析后的工作区路径）。

## 安装

```sh
dsh plugin --profile web add github:maxesisnclaw/dsh-download-button
```

手工安装：

1. 把本目录放到 `<dsh 安装目录>/plugins/dsh-download-button/`
2. 在 `$DSH_HOME/cordis.patch.yml` 追加：

   ```yaml
   - insert:
       - id: download-button
         name: /绝对路径/dsh-download-button/index.js
   ```

3. 重启服务：`systemctl restart dsh`（或重启你的 `dsh web` 进程）

如果本包是被列进 profile 的 `dsh.profile.bundles`，随包附带的
[`cordis.patch.yml`](cordis.patch.yml) 会自动完成同样的注册。

## 验证

- 打开 Web UI，让 agent 产出任意非文本文件（docx / xlsx / pdf），卡片上应出现「下载」，点击应能存盘。
- 服务端自检底层接口：

  ```sh
  curl -b "<你的会话 cookie>" \
    "http://127.0.0.1:3080/api/file?path=/绝对路径/file.docx" -o out.docx
  # out.docx 必须与源文件字节一致
  ```

- 单元测试：`npm test`（校验注入只发生一次且幂等）

## 限制

- 依赖卡片用 `title` 暴露绝对路径（当前版本 dsh 就是这么渲染交付物的）。若将来卡片结构变了，改注入脚本里的选择器即可。
- 只覆盖交付物卡片；其它界面（例如侧边栏的文本预览）不动。

## License

MIT
