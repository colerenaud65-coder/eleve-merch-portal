import { unsubscribeAccount } from "@/server/unsubscribe";

function page(title: string, copy: string, status = 200) {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:48px 24px;background:#f3f2ef;color:#121212;font-family:Helvetica,Arial,sans-serif;">
  <main style="max-width:28rem;">
    <p style="margin:0;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;">Élevé Select</p>
    <h1 style="margin:16px 0 0;font-family:Georgia,serif;font-weight:500;font-size:40px;line-height:1;">${title}</h1>
    <p style="margin:16px 0 0;font-size:16px;line-height:1.5;">${copy}</p>
  </main>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const done = token ? await unsubscribeAccount(token) : false;
  if (!done) return page("Link not valid", "This unsubscribe link is not valid.", 400);
  return page("Unsubscribed", "You will not get drop alerts from Élevé Select. You can turn them back on from your account.");
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  let token = url.searchParams.get("token") ?? "";
  if (!token) {
    const body = await request.text();
    const match = body.match(/(?:^|&)token=([^&]+)/);
    if (match?.[1]) token = decodeURIComponent(match[1]);
  }
  if (!token || !(await unsubscribeAccount(token))) {
    return new Response(null, { status: 400 });
  }
  return new Response(null, { status: 200 });
}
