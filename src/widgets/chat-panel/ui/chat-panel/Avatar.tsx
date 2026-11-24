import type { VariantProps } from "class-variance-authority";
import Image from "next/image";
import { useBotCharacter } from "@/features/account";
import { chatAvatarStyles } from "./chat-panel.variants";

type Props = Pick<VariantProps<typeof chatAvatarStyles>, "size">;

const ChatAvatar = ({ size }: Props) => {
  const character = useBotCharacter();
  const dimension = size === "compact" ? 16 : 48;
  return (
    <Image
      src={character.avatar}
      alt=""
      aria-hidden
      width={dimension}
      height={dimension}
      className={chatAvatarStyles({ size, framed: character.avatarFramed })}
    />
  );
};

export default ChatAvatar;
