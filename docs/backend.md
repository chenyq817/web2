# 后端数据结构说明

本文档详细解释了“豫园回声”应用中用户数据的存储方式和位置。应用主要依赖 Google Firebase 的两项核心服务来管理用户数据：**Firebase Authentication** 和 **Firestore**。

## 1. Firebase Authentication (身份认证)

Firebase Authentication 负责管理用户的核心身份和安全凭证。

- **存储内容**:
  - **邮箱 (Email)**: 用户登录时使用的邮箱地址。
  - **密码 (Password)**: 经过哈希处理的安全密码，原始密码不会被存储。
  - **UID (User ID)**: 当用户注册时，Firebase 会为其生成一个全局唯一的字符串ID。这个 UID 是用户在整个应用生态系统中的唯一标识符，至关重要。

- **作用**:
  - 处理用户注册和登录。
  - 验证用户身份，确保只有已登录的用户才能访问受保护的资源。
  - 是连接其他 Firebase 服务（如 Firestore）中用户数据的关键。

## 2. Firestore (数据库)

Firestore 是一个 NoSQL 文档数据库，用于存储应用中几乎所有的动态数据，包括用户的个人资料、帖子、聊天记录等。

### 用户数据 (`users` 集合)

所有用户的公开和半公开信息都存储在名为 `users` 的集合中。

- **路径**: `/users/{userId}`
  - `{userId}` 实际上就是该用户在 Firebase Authentication 中的 **UID**。通过这种方式，认证信息和数据库信息被精确地关联起来。

- **数据结构 (`UserProfile`)**:
  `users` 集合中的每个文档都遵循 `UserProfile` 的结构。您可以在 `docs/backend.json` 中找到其详细定义。主要字段包括：

| 字段名                  | 类型      | 描述                                                           |
| ----------------------- | --------- | -------------------------------------------------------------- |
| `displayName`           | `string`  | 用户在应用中显示的名称（昵称）。                               |
| `displayName_lowercase` | `string`  | `displayName` 的全小写版本，主要用于不区分大小写的搜索。     |
| `avatarId`              | `string`  | 如果用户使用的是默认头像，这里会存储预设头像的ID。             |
| `imageBase64`           | `string`  | 如果用户上传了自定义头像，这里会存储图片的Base64编码字符串。   |
| `bio`                   | `string`  | 用户的个人简介或签名。                                         |
| `age`                   | `number`  | 用户的年龄。                                                   |
| `gender`                | `string`  | 用户的性别。                                                   |
| `friendIds`             | `array`   | 一个存储字符串的数组，每个字符串都是该用户好友的 UID。         |
| `friendRequestsSent`    | `array`   | 记录该用户向哪些用户发送了好友请求（存储对方的 UID）。       |
| `friendRequestsReceived`| `array`   | 记录该用户收到了哪些用户的好友请求（存储对方的 UID）。       |

---

## 总结

- **身份验证**由 **Firebase Authentication** 处理。
- **用户详细资料**（包括社交关系）存储在 **Firestore** 的 `users` 集合中。
- 两者通过 **UID** 紧密关联，构成了完整的用户数据模型。