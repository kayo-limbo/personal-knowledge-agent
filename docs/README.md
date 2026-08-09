# 项目学习文档索引

这个目录用于记录每个已完成功能的设计和代码讲解。推荐先阅读总览，再按照功能实现顺序阅读 `features` 下的独立文档。

## 总览

- [`chat-deepseek-interview-guide.md`](chat-deepseek-interview-guide.md)：聊天模块、DeepSeek 接入、SSE、持久化和 Agent 演进路线的综合面试指南。

## 功能讲解

- [`features/chat-multi-model-thinking.md`](features/chat-multi-model-thinking.md)：Flash/Pro 多模型切换与普通/深度思考模式。

## 后续文档约定

以后每完成一个独立功能，都新增一份 `docs/features/<功能名>.md`，至少回答以下问题：

1. 这个功能解决了什么问题？
2. 修改了哪些文件，各自负责什么？
3. 数据从哪里来，经过什么处理，最后到哪里？
4. 关键代码为什么这样写？
5. 有哪些安全、性能和一致性风险？
6. 面试官可能怎样提问？
7. 如何验证功能正确？
8. 下一步还能怎样改进？

功能完成后还要更新本索引，并提醒是否需要 Git 提交。
