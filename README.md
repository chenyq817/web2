# 豫园回声 - 校园社交圈

这是一个在 Firebase Studio 中构建的 Next.js 入门项目，旨在成为一个多功能一体的校园伴侣应用。它包含了社交发帖、好友管理、私人聊天、社区墙和新闻订阅等功能。

## 功能特性

- **仪表盘 (Dashboard)**：一个集中的信息中心，用于展示校园新闻并提供各项功能的快速入口。
- **校园帖子 (Campus Posts)**：一个时间线，用户可以在此分享文字和图片。
- **社交中心 (Social Hub)**：查找和管理好友、发送好友请求并发起聊天。
- **私人聊天 (Private Chat)**：与好友进行实时的一对一私信，支持发送图片和表情符号。
- **社区墙 (Community Wall)**：一个公共空间，可以为所有人留下有趣的短消息。
- **新闻订阅 (News Feed)**：按“学术”、“体育”和“校园生活”分类，随时了解最新的校园新闻。
- **用户资料 (User Profiles)**：可定制的用户个人资料，包括头像和个人信息。
- **管理后台 (Admin Dashboard)**：一个供管理员用户进行内容审核的特殊板块。

## 本地开发环境设置

要在您的本地计算机上运行此项目，请按照以下步骤操作。

### 1. 先决条件

- [Node.js](https://nodejs.org/) (推荐 v18 或更高版本)
- [npm](https://www.npmjs.com/) (通常随 Node.js 一起安装)

### 2. 安装项目依赖

这是**最重要的一步**。在项目根目录下，打开您的命令行工具，然后运行以下命令来安装所有必需的软件包：

```bash
npm install
```
> **注意**: 必须先成功运行此命令，否则后续步骤会因找不到 `next` 等命令而失败。

### 3. 环境变量

本项目使用 Google 的生成式 AI (Gemini) 功能，因此需要一个 API 密钥。

1.  在您的项目根目录下创建一个名为 `.env.local` 的新文件。
2.  从 [Google AI Studio](https://aistudio.google.com/app/apikey) 获取一个 `GEMINI_API_KEY`。
3.  将此密钥添加到您的 `.env.local` 文件中，格式如下：

    ```
    GEMINI_API_KEY=your_api_key_here
    ```

### 4. 运行开发服务器

安装完依赖并设置好环境变量后，您就可以运行本地开发服务器了：

```bash
npm run dev
```

这将在 `http://localhost:9003` 上启动应用程序。

### 5. Firebase 连接

该项目已预先配置好与一个 Firebase 项目的连接。连接详细信息位于 `src/firebase/config.ts`。当您在本地运行应用时，它将读写指定 Firebase 项目中的数据。您可以直接在 [Firebase 控制台](https://console.firebase.google.com/) 中查看这些数据。

## 可用脚本

以下是 `package.json` 中定义的主要脚本：

- `npm run dev`: 启动 Next.js 开发服务器。
- `npm run build`: 为生产环境构建应用程序。
- `npm run start`: 在构建后启动生产服务器。
- `npm run lint`: 运行 ESLint 检查代码质量问题。
- `npm run typecheck`: 运行 TypeScript 编译器检查类型错误。
