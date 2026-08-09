<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:project-learning-rules -->
# 功能讲解与 Git 提醒

- 每完成一个独立功能，都要在 `docs/features/` 下新增或更新一份独立的中文讲解文件，并同步更新 `docs/README.md` 索引。
- 功能文档至少包含：目标与结果、相关文件职责、数据流、关键代码解释、设计取舍、面试重点、易错点、验证方法和后续改进。
- 讲解要面向第一次做 Agent 项目的学习者，解释“为什么这样写”，不能只罗列文件名。
- 每完成一块功能后，都要明确告诉用户当前改动是否需要提交 Git；需要时给出具体的 `git add` 范围和符合仓库习惯的中文提交说明。
- 除非用户明确要求提交，否则只提醒并给出命令，不自动创建 Git commit。
<!-- END:project-learning-rules -->
