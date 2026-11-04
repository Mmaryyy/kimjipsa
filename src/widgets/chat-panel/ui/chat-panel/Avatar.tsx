import Image from "next/image";
const ChatAvatar = () => (
  <Image
    src="/images/kimjipsa-avatar.png"
    alt=""
    width={48}
    height={48}
    className="row-span-2 size-12 shrink-0 rounded-full bg-[var(--bot-avatar-bg)] p-1 object-contain"
  />
);

export default ChatAvatar;
