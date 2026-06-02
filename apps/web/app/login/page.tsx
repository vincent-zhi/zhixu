"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login, register } from "../api-client";

const EDUCATION_STAGES = [
  { value: "high_school", label: "高中" },
  { value: "undergraduate", label: "本科" },
  { value: "master", label: "硕士" },
  { value: "phd", label: "博士" },
  { value: "postdoc", label: "博士后" },
  { value: "other", label: "其他" },
];

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [educationStage, setEducationStage] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        const result = await login({ email, password });
        localStorage.setItem("zhixu_token", result.token);
        localStorage.setItem("zhixu_user", JSON.stringify(result.user));
      } else {
        const result = await register({ email, password, name, educationStage: educationStage || undefined, discipline: discipline || undefined });
        localStorage.setItem("zhixu_token", result.token);
        localStorage.setItem("zhixu_user", JSON.stringify(result.user));
      }
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-brand">
        <div className="login-brand-logo">
          <img
            src="/brand/zhixu-wordmark-transparent-v2.png"
            alt="知序"
            className="login-brand-img"
          />
        </div>
        <h1 className="login-brand-title">知序 ZHIXU</h1>
        <p className="login-brand-subtitle">AI 学习科研管家</p>
        <div className="login-features">
          <div className="login-feature-item">
            <span className="login-feature-icon">📝</span>
            <span>三色溯源 · 内容可信可追溯</span>
          </div>
          <div className="login-feature-item">
            <span className="login-feature-icon">🤖</span>
            <span>AI 协作 · 人机共责推进</span>
          </div>
          <div className="login-feature-item">
            <span className="login-feature-icon">📚</span>
            <span>知识沉淀 · 长期学术积累</span>
          </div>
          <div className="login-feature-item">
            <span className="login-feature-icon">🔒</span>
            <span>合规核验 · 学术诚信保障</span>
          </div>
        </div>
      </div>

      <div className="login-form-panel">
        <form className="login-form" onSubmit={handleSubmit}>
          <h2 className="login-form-title">
            {mode === "login" ? "登录" : "注册"}
          </h2>
          <p className="login-form-subtitle">
            {mode === "login"
              ? "登录你的知序账户"
              : "创建新的知序账户"}
          </p>

          {error && <div className="login-error">{error}</div>}

          {mode === "register" && (
            <div className="form-group">
              <label className="form-label" htmlFor="name">姓名</label>
              <input
                id="name"
                type="text"
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="输入你的姓名"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="email">邮箱</label>
            <input
              id="email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="输入邮箱地址"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">密码</label>
            <input
              id="password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="输入密码"
              required
              minLength={6}
            />
          </div>

          {mode === "register" && (
            <>
              <div className="form-group">
                <label className="form-label" htmlFor="educationStage">学习阶段</label>
                <select
                  id="educationStage"
                  className="form-input"
                  value={educationStage}
                  onChange={(e) => setEducationStage(e.target.value)}
                >
                  <option value="">选择学习阶段</option>
                  {EDUCATION_STAGES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="discipline">学科方向</label>
                <input
                  id="discipline"
                  type="text"
                  className="form-input"
                  value={discipline}
                  onChange={(e) => setDiscipline(e.target.value)}
                  placeholder="如：计算机科学、物理学"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            className="btn-primary login-submit-btn"
            disabled={loading}
          >
            {loading ? "处理中…" : mode === "login" ? "登录" : "注册"}
          </button>

          <div className="login-toggle">
            {mode === "login" ? (
              <span>
                还没有账户？{" "}
                <button type="button" onClick={() => { setMode("register"); setError(null); }}>
                  注册
                </button>
              </span>
            ) : (
              <span>
                已有账户？{" "}
                <button type="button" onClick={() => { setMode("login"); setError(null); }}>
                  登录
                </button>
              </span>
            )}
          </div>

          {mode === "login" && (
            <div className="login-demo-hint">
              演示账户：demo@zhixu.ai / demo123
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
