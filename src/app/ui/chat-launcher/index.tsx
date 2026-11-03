import Link from "next/link";
import { Sparkles } from "lucide-react";
import { chatPath } from "@/shared/config";
import { Button } from "@/shared/ui";

const ChatLauncher = () => (
  <div className="fixed right-4 bottom-[calc(var(--bottom-navigation-offset)+env(safe-area-inset-bottom))] z-40 lg:right-10 lg:bottom-6">
    <Button asChild variant="glass" className="gap-2 shadow-fab">
      <Link href={chatPath} aria-label="AI 집사 채팅으로 이동">
        <Sparkles className="size-5 text-bot-text" aria-hidden="true" />
        AI 집사
      </Link>
    </Button>
  </div>
);
export default ChatLauncher;
