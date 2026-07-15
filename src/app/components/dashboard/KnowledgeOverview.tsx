import { Card } from "../ui/card";

interface Props {
  stats: {
    documents: number;
    prompts: number;
    conversations: number;
  };
}


const statConfig: { key: keyof Props['stats']; label: string }[] = [
  { key: "documents", label: "知识文档" },
  { key: "prompts", label: "提示词" },
  { key: "conversations", label: "历史记录" },
];

export default function KnowledgeOverview({ stats }: Props) {
  return (
    <Card className="p-6">
      <h2 className="mb-5 text-lg font-semibold">
       工作台概览
      </h2>

      <div className="space-y-4">
        {statConfig.map(({ key, label }) => (
          <div
            key={key}
            className="flex items-center justify-between rounded-lg border p-4"
          >
            <span className="text-muted-foreground">
              {label}
            </span>

            <span className="text-xl font-bold">
              {stats[key]}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}