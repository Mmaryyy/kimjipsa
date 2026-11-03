export const chatRoutes = {
  messages: "/api/chat",
  settings: "/api/chat/settings",
  memories: "/api/chat/memories",
  attachments: "/api/chat/attachments",
  cancelRun: (id: string) => `/api/chat/runs/${id}/cancel`,
  attachment: (id: string) => `/api/chat/attachments/${id}`,
  receipt: (id: string, cancel = false) =>
    `/api/receipt-imports/${id}/${cancel ? "cancel" : "confirm"}`,
} as const;
