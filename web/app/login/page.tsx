import Link from "next/link";
import LoginActions from "@/components/login-actions";

const errors: Record<string, string> = {
  cancelled: "你已取消 GitHub 授权，可以返回游戏继续匿名试玩。",
  not_configured: "GitHub 登录尚未完成配置。",
  invalid_state: "登录请求已经过期，请重新发起。",
  github_failed: "GitHub 没有完成授权，请稍后重试。",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; returnTo?: string }> }) {
  const query = await searchParams;
  const returnTo = query.returnTo?.startsWith("/") && !query.returnTo.startsWith("//") ? query.returnTo : "/";
  return <main className="login-page"><div className="ambient"><span className="orb orb-one" /><span className="grid-fade" /></div><section className="login-card"><Link className="brand" href="/"><span className="brand-mark"><span>归</span></span><strong>归航</strong></Link><p className="eyebrow">驾驶员身份认证</p><h1>用 GitHub 账号<br />继续你的世界。</h1><p>登录后，存档会绑定你的 GitHub 身份，可以在其他设备继续。归航不会申请或读取你的代码仓库。</p>{query.error && <div className="error-banner">{errors[query.error] || "登录暂时无法完成。"}</div>}<LoginActions returnTo={returnTo} /><small>仅申请读取公开个人资料（read:user）。</small></section></main>;
}
