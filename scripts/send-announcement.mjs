// 운영 공지를 푸시를 켠 모든 기기에 보낸다. 앱 안 알림 목록에는 남지 않는다.
// 사용: yarn announce [--file announce.md] [--url /] [--at "2026-11-13 09:00"] [--send]
//       yarn announce --title "제목" --body "내용" ... (--title·--body 가 파일 값보다 우선)
// --send 없이 실행하면 받을 기기 수만 보여 주고 보내지 않는다. --at 은 KST이며 그 시각까지 기다린다.
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { setTimeout as sleep } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";
import webPush from "web-push";

const { values } = parseArgs({
  options: {
    file: { type: "string" },
    title: { type: "string" },
    body: { type: "string" },
    url: { type: "string", default: "/" },
    at: { type: "string" },
    send: { type: "boolean", default: false },
  },
});

function fail(message) {
  console.error(message);
  process.exit(1);
}

// --file: 첫 줄이 제목, 그 아래(빈 줄 다음부터)가 내용. 이모지·줄바꿈을 그대로 쓴다.
// 아무 것도 주지 않으면 저장소 루트의 announce.md(.gitignore 대상)를 읽는다.
const file =
  values.file ?? (values.title || values.body ? undefined : "announce.md");
let fromFile = {};
if (file) {
  const text = await readFile(file, "utf8").catch(() =>
    fail(`${file} 파일을 읽지 못했어요.`),
  );
  const [first = "", ...rest] = text.replace(/\r\n/g, "\n").split("\n");
  // 마크다운 제목처럼 "# 제목"으로 써도 된다.
  fromFile = { title: first.replace(/^#+\s*/, ""), body: rest.join("\n") };
}
const title = (values.title ?? fromFile.title)?.trim();
const body = (values.body ?? fromFile.body)?.trim();
if (!title || !body)
  fail('--file <파일> 또는 --title "제목" --body "내용" 이 필요해요.');
if (!values.url.startsWith("/") || values.url.startsWith("//"))
  fail("--url 은 앱 안 경로(/로 시작)만 쓸 수 있어요.");

let sendAt = Date.now();
if (values.at) {
  const match = values.at.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})$/);
  if (!match) fail('--at 은 "YYYY-MM-DD HH:mm"(KST) 형식이에요.');
  sendAt = Date.parse(`${match[1]}T${match[2]}:00+09:00`);
  if (Number.isNaN(sendAt)) fail("--at 날짜를 읽을 수 없어요.");
  if (sendAt <= Date.now()) fail("--at 이 이미 지난 시각이에요.");
}

const env = process.env;
for (const name of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
])
  if (!env[name]) fail(`${name} 이 .env.local 에 없어요.`);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

async function loadSubscriptions() {
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("user_id, endpoint, keys");
  if (error) fail(`구독 목록을 읽지 못했어요: ${error.message}`);
  return data;
}

const kst = (time) =>
  new Date(time).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

const preview = await loadSubscriptions();
const users = new Set(preview.map((row) => row.user_id)).size;
console.log(`제목: ${title}\n내용: ${body}\n열 경로: ${values.url}`);
console.log(`받을 기기 ${preview.length}대 (사용자 ${users}명)`);
// 날짜 실수(오늘 대신 내일 등)가 바로 보이게 남은 시간을 같이 찍는다.
function remaining(ms) {
  const minutes = Math.ceil(ms / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const parts = [
    days && `${days}일`,
    hours && `${hours}시간`,
    minutes % 60 && `${minutes % 60}분`,
  ].filter(Boolean);
  return parts.join(" ") || "1분 안";
}
console.log(
  `발송 시각: ${values.at ? `${kst(sendAt)} (지금부터 ${remaining(sendAt - Date.now())} 뒤)` : "즉시"}`,
);
if (!values.send) {
  console.log("미리보기만 했어요. 보내려면 --send 를 붙여 주세요.");
  process.exit(0);
}

// 긴 대기는 나눠서 기다린다(setTimeout 최대 약 24.8일, 잠자기 후 시계 보정).
while (Date.now() < sendAt) {
  await sleep(Math.min(sendAt - Date.now(), 60_000));
}

// 기다리는 동안 구독이 바뀌었을 수 있으니 보내기 직전에 다시 읽는다.
const subscriptions = await loadSubscriptions();
const payload = JSON.stringify({
  id: `announcement-${sendAt}`,
  title,
  body: Array.from(body).slice(0, 600).join(""),
  url: values.url,
});
const counts = { sent: 0, expired: 0, failed: 0 };
await Promise.all(
  subscriptions.map(async ({ endpoint, keys }) => {
    try {
      await webPush.sendNotification({ endpoint, keys }, payload, {
        vapidDetails: {
          subject: env.VAPID_SUBJECT,
          publicKey: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
          privateKey: env.VAPID_PRIVATE_KEY,
        },
        TTL: 60 * 60 * 24,
        timeout: 5000,
      });
      counts.sent += 1;
    } catch (error) {
      // 오류 객체에는 endpoint·인증값이 들어 있으니 상태 코드만 남긴다.
      const status = Number(error?.statusCode ?? 0);
      if (status === 404 || status === 410) counts.expired += 1;
      else {
        counts.failed += 1;
        console.error(`발송 실패 (status ${status || "없음"})`);
      }
    }
  }),
);
console.log(
  `${kst(Date.now())} 발송: 성공 ${counts.sent}, 만료된 구독 ${counts.expired}, 실패 ${counts.failed}`,
);
process.exit(counts.failed > 0 ? 1 : 0);
