# 中文输入与流式回答收尾

## 目标与结果

输入法确认候选字不发送消息；普通 Enter 发送、Shift+Enter 换行。SSE 必须收到业务 done 才视为成功，提前断流会显示可重试提示。离开聊天页面会取消请求，旧回调不会写入后来打开的聊天状态。

## 文件职责与数据流

ChatComposer.tsx 判断组合输入事件。src/lib/chat-stream.ts 解码字节、拼接 SSE 并执行运行时校验。ChatWorkspace.tsx 管理本次 AbortController 和 Zustand 更新。tests/chat-stream.test.ts 覆盖拆帧和错误终止。

键盘 → 输入框 → POST → ReadableStream → UTF-8 解码 → 完整帧 → 校验事件 → 更新回答；服务端完成落库后发 done，客户端再正常结束。

## 关键代码解释

reader.read().done 只表示连接关闭；业务事件才表示服务端已经保存最终回答。两者不能混用。TextDecoder 的 stream 模式保留半个中文字符，buffer 保留半帧，并兼容 CRLF。error 事件进入统一错误分支，不再重复拼接错误提示。

effect 清理时先清空当前控制器引用，再 abort。异步回调比较控制器身份，避免前一页请求的 finally 把新请求的 streaming 状态清掉。同一引用也防止快速连续点击重复发送。

## 设计取舍

失败或主动停止时可在当前页面保留部分文本，但不声称其已保存。服务器原策略仍删除失败的 assistant 占位。没有自动重发：网络结束与数据库完成之间存在窗口，自动重发可能重复收费；先刷新历史再决定重试。

## 面试重点与易错点

区分网络 EOF 和业务提交成功；解释 UTF-8 字符与网络 chunk 边界无关；说明组件卸载为什么需要取消和阻止陈旧回调。不要对每个 chunk 单独 JSON.parse，也不要仅靠按钮 disabled 防止重复请求。

## 验证方法

自动测试逐字节发送中文与 CRLF、正常 done、半帧、无 done、非法字段和服务端 error。浏览器分别测试中文选字、Enter/Shift+Enter、停止后再发送、生成中离页再返回，以及断流后的提示和历史刷新。完整检查运行 npm test、lint、typecheck 和生产构建。

## 后续改进

将来可以增加消息状态持久化与请求幂等键；当前不增加新表或自动重试协议。
