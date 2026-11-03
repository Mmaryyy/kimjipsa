"use client";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { photoUrl } from "@/entities/chat-message";
import { Text } from "@/shared/ui";
interface Props {
  id: string;
  expired: boolean;
}
const ChatPhoto = ({ id, expired }: Props) => {
  const query = useQuery({
    queryKey: ["chat", "photo", id],
    queryFn: () => photoUrl(id),
    enabled: !expired,
    staleTime: 30000,
    retry: false,
  });
  if (expired || query.isError)
    return (
      <Text as="p" variant="caption">
        사진 보관 기간이 끝났어요.
      </Text>
    );
  if (!query.data)
    return (
      <Text as="p" variant="caption">
        사진을 불러오는 중…
      </Text>
    );
  // Signed private URLs cannot pass through Next's public image optimizer.
  return (
    <Image
      unoptimized
      width={600}
      height={800}
      src={query.data.url}
      alt="첨부한 영수증"
      className="max-h-60 max-w-full object-contain"
      referrerPolicy="no-referrer"
    />
  );
};
export default ChatPhoto;
