export const botCharacters = {
  butler: {
    label: "집사",
    avatar: "/images/kimjipsa-avatar.png",
    full: "/images/kimjipsa-dog-bird.png",
    // 투명 배경 그림이라 하늘색 원 위에 여백을 두고 그린다.
    avatarFramed: true,
  },
  nobi: {
    label: "노비",
    avatar: "/images/nobi/nobi-avatar-dark.png",
    full: "/images/nobi/nobi-full.png",
    // 그림 자체가 어두운 원이라 배경·여백 없이 꽉 채운다.
    avatarFramed: false,
  },
} as const;
export type BotType = keyof typeof botCharacters;
export const botTypeOptions = Object.entries(botCharacters).map(
  ([value, character]) => ({
    value: value as BotType,
    label: character.label,
  }),
);
