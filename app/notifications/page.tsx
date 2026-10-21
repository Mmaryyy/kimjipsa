import { redirect } from "next/navigation";
import { notificationsPath } from "@/shared/config";
export default function NotificationsRedirect() {
  redirect(notificationsPath);
}
