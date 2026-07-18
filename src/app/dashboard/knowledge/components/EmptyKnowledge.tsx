import { BookOpen } from "lucide-react";
import { EMPTY_KNOWLEDGE_MESSAGE } from "../constants";

export function EmptyKnowledge() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
      <BookOpen className="h-10 w-10 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{EMPTY_KNOWLEDGE_MESSAGE}</p>
    </div>
  );
}