import { Card } from "../ui/card";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
interface RecentConversation {
  id: string;
  title: string;
  updatedAt: Date;
}

interface Props {
  conversations: RecentConversation[];
}


function formatTime(date: Date) {
  const now = new Date();

  const diff =
    now.getTime() - new Date(date).getTime();

  const minutes = Math.floor(diff / 1000 / 60);

  if (minutes < 1) {
    return "刚刚";
  }

  if (minutes < 60) {
    return `${minutes} 分钟前`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} 小时前`;
  }

  const days = Math.floor(hours / 24);

  if (days < 30) {
    return `${days} 天前`;
  }

  return new Date(date).toLocaleDateString("zh-CN");
}


export default function RecentConversations({
  conversations,
}: Props) {

  return (
    <Card className="p-6">

      <h2 className="mb-5 text-lg font-semibold">
        最近对话
      </h2>


      {
        conversations.length === 0 ? (

          <div className="flex flex-col items-center justify-center py-10 text-center">

            <MessageSquare
              className="mb-3 h-8 w-8 text-muted-foreground"
            />

            <p className="text-sm text-muted-foreground">
              暂无对话记录
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              开始一次 AI 对话吧
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {
              conversations.map((conversation)=>(

                <Link
                  key={conversation.id}
                  href={`/dashboard/chat/${conversation.id}`}
                  className="block"
                >
                  <div
                    className="
                    flex items-center justify-between
                    rounded-lg border p-4
                    transition
                    hover:bg-muted/40
                    "
                  >
                  <div className="flex items-center gap-3">

                      <MessageSquare
                        className="h-5 w-5 text-muted-foreground"
                      />
                      <div>
                       <p className="font-medium">
                          {conversation.title}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatTime(conversation.updatedAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            }
          </div>
        )
      }
    </Card>
  );
}