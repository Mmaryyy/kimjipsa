import { useBotCharacter } from "@/features/account";
import { cn } from "@/shared/lib";
import Image from "next/image";
const ChatAvatar = () => {
  const character = useBotCharacter();
  return (
    <Image
      src={character.avatar}
      alt=""
      width={48}
      height={48}
      className={cn(
        "size-12 shrink-0 rounded-full object-contain",
        character.avatarFramed && "bg-[var(--bot-avatar-bg)] p-1",
      )}
    />
  );
};

export default ChatAvatar;
