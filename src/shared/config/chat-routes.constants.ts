export const chatRoutes = {
  messages: "/api/chat",
  settings: "/api/chat/settings",
  memories: "/api/chat/memories",
  actions: (id: string) => `/api/chat/actions/${id}`,
  attachments: "/api/chat/attachments",
  retryRun: (id: string) => `/api/chat/runs/${id}/retry`,
  cancelRun: (id: string) => `/api/chat/runs/${id}/cancel`,
  attachment: (id: string) => `/api/chat/attachments/${id}`,
  receipt: (id: string, cancel = false) =>
    `/api/receipt-imports/${id}/${cancel ? "cancel" : "confirm"}`,
} as const;
