import { Suspense } from "react";
import { HomePage } from "@/pages/home";
import { NotificationsPage } from "@/pages/notifications";
export default function Page() {
  return (
    <>
      <HomePage />
      <Suspense>
        <NotificationsPage />
      </Suspense>
    </>
  );
}
