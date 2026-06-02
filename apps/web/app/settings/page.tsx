"use client";

import { useState, useEffect, useCallback } from "react";
import {
  IconPrivacy,
  IconMemory,
  IconKey,
  IconDatabase,
  IconBell,
  IconModel,
  IconImage,
  IconDownload,
  IconTrash,
  IconRefresh,
  IconEye,
  IconEyeOff,
} from "../icons";
import {
  listProjects,
  listCapsules,
  listSkills,
  listMemoryCandidates,
  getLLMConfig,
  updateLLMConfig,
  deleteLLMConfig,
  getImageConfig,
  saveImageConfig,
  deleteImageConfig,
  ApiClientError,
} from "../api-client";
import type {
  KnowledgeCapsuleSummary,
  MemoryCandidate,
  SkillManifest,
  LLMConfigStatus,
  UpdateLLMConfigInput,
  ImageConfigStatus,
} from "../api-client";

type SettingsSection =
  | "privacy"
  | "memory"
  | "skill_permissions"
  | "data"
  | "notifications"
  | "model"
  | "image";

interface LocalSettings {
  privacyMode: string;
  notificationStrength: string;
  dailySummary: boolean;
  doNotDisturb: boolean;
  modelPriority: string;
  disabledSkills: string[];
}

const SETTINGS_NAV: { key: SettingsSection; label: string; icon: React.ReactNode }[] = [
  { key: "model", label: "Agent 模型", icon: <IconModel size={16} /> },
  { key: "image", label: "图像生成", icon: <IconImage size={16} /> },
  { key: "privacy", label: "隐私模式", icon: <IconPrivacy size={16} /> },
  { key: "memory", label: "记忆管理", icon: <IconMemory size={16} /> },
  { key: "skill_permissions", label: "Skill 权限", icon: <IconKey size={16} /> },
  { key: "data", label: "数据管理", icon: <IconDatabase size={16} /> },
  { key: "notifications", label: "通知设置", icon: <IconBell size={16} /> },
];

const PRIVACY_OPTIONS = [
  {
    value: "cloud",
    label: "云端模式",
    description: "数据存储在云端，支持跨设备同步和完整 AI 能力。适合对便捷性要求较高的场景。",
  },
  {
    value: "local_first",
    label: "本地优先",
    description: "数据优先存储在本地设备，仅在必要时同步到云端。AI 处理在本地优先执行，减少数据传输。",
  },
  {
    value: "private_org",
    label: "组织隔离",
    description: "数据在组织专属空间内隔离存储，不与其他组织共享。适合团队或实验室使用。",
  },
];

const STORAGE_KEY = "zhixu_settings";

function loadLocalSettings(): LocalSettings {
  if (typeof window === "undefined") {
    return {
      privacyMode: "local_first",
      notificationStrength: "normal",
      dailySummary: true,
      doNotDisturb: false,
      modelPriority: "quality",
      disabledSkills: [],
    };
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return {
    privacyMode: "local_first",
    notificationStrength: "normal",
    dailySummary: true,
    doNotDisturb: false,
    modelPriority: "quality",
    disabledSkills: [],
  };
}

function saveLocalSettings(settings: LocalSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function SkeletonBlock({ width, height }: { width: string; height: string }) {
  return (
    <div
      className="skeleton-block"
      style={{ width, height }}
    />
  );
}

function SettingsSkeleton() {
  return (
    <div className="settings-shell">
      <header className="settings-header">
        <p className="eyebrow">Settings & Privacy</p>
        <h1>设置与隐私</h1>
      </header>
      <div className="settings-layout">
        <nav className="settings-sidebar" aria-label="设置导航">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton-nav-item">
              <SkeletonBlock width="16px" height="16px" />
              <SkeletonBlock width="64px" height="14px" />
            </div>
          ))}
        </nav>
        <div className="settings-content">
          <div className="settings-section">
            <SkeletonBlock width="120px" height="24px" />
            <div style={{ height: 12 }} />
            <SkeletonBlock width="100%" height="16px" />
            <SkeletonBlock width="80%" height="16px" />
            <div style={{ height: 20 }} />
            <SkeletonBlock width="100%" height="80px" />
            <div style={{ height: 12 }} />
            <SkeletonBlock width="100%" height="80px" />
            <div style={{ height: 12 }} />
            <SkeletonBlock width="100%" height="80px" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>("model");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [capsules, setCapsules] = useState<KnowledgeCapsuleSummary[]>([]);
  const [memoryCandidates, setMemoryCandidates] = useState<MemoryCandidate[]>([]);
  const [skills, setSkills] = useState<SkillManifest[]>([]);
  const [localSettings, setLocalSettings] = useState<LocalSettings>(loadLocalSettings());
  const [llmConfig, setLLMConfig] = useState<LLMConfigStatus | null>(null);
  const [llmForm, setLLMForm] = useState({ apiKey: "", baseURL: "", model: "", enableThinking: false });
  const [llmSaving, setLLMSaving] = useState(false);
  const [llmError, setLLMError] = useState<string | null>(null);
  const [llmSuccess, setLLMSuccess] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  // Image generation config
  const [imageConfig, setImageConfig] = useState<{ configured: boolean; provider: string; model: string; apiKeySet: boolean } | null>(null);
  const [imageProvider, setImageProvider] = useState<"sensenova" | "dashscope">("sensenova");
  const [imageForm, setImageForm] = useState({ apiKey: "", baseURL: "https://token.sensenova.cn/v1", model: "sensenova-u1-fast" });
  const [imageSaving, setImageSaving] = useState(false);
  const [imageSaveError, setImageSaveError] = useState<string | null>(null);
  const [imageSaveSuccess, setImageSaveSuccess] = useState<string | null>(null);
  const [showImageApiKey, setShowImageApiKey] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const projects = await listProjects().catch(() => []);
      const [capsuleResults, memoryResults, skillData, llmData, imgData] = await Promise.all([
        Promise.all(projects.map((p) => listCapsules(p.id).catch(() => [] as KnowledgeCapsuleSummary[]))).then(
          (r) => r.flat()
        ),
        Promise.all(projects.map((p) => listMemoryCandidates(p.id).catch(() => [] as MemoryCandidate[]))).then(
          (r) => r.flat()
        ),
        listSkills().catch(() => [] as SkillManifest[]),
        getLLMConfig().catch(() => null as LLMConfigStatus | null),
        getImageConfig().catch(() => null as ImageConfigStatus | null),
      ]);

      setCapsules(capsuleResults);
      setMemoryCandidates(memoryResults);
      setSkills(skillData);
      if (llmData) {
        setLLMConfig(llmData);
        setLLMForm((prev) => ({
          ...prev,
          baseURL: llmData.baseURL || prev.baseURL,
          model: llmData.model || prev.model,
          enableThinking: llmData.enableThinking,
        }));
      }
      if (imgData) {
        setImageConfig(imgData);
        if (imgData.provider) setImageProvider(imgData.provider as "sensenova" | "dashscope");
      }
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "加载设置数据失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateSetting = <K extends keyof LocalSettings>(key: K, value: LocalSettings[K]) => {
    const updated = { ...localSettings, [key]: value };
    setLocalSettings(updated);
    saveLocalSettings(updated);
  };

  const toggleSkillDisabled = (skillId: string) => {
    const disabled = localSettings.disabledSkills.includes(skillId)
      ? localSettings.disabledSkills.filter((id) => id !== skillId)
      : [...localSettings.disabledSkills, skillId];
    updateSetting("disabledSkills", disabled);
  };

  const handleExportData = () => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      settings: localSettings,
      capsules: capsules.map((c) => ({
        id: c.id,
        title: c.title,
        type: c.capsuleType,
        summary: c.summary,
        privacyScope: c.privacyScope,
        reuseCount: c.reuseCount,
      })),
      memoryCandidates: memoryCandidates.map((m) => ({
        id: m.id,
        type: m.memoryType,
        title: m.title,
        summary: m.summary,
        status: m.status,
      })),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zhixu-data-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <main className="shell">
        <SettingsSkeleton />
      </main>
    );
  }

  const authorizedSkills = skills.filter(
    (s) => s.permissions.every((p) => p.defaultGranted) && !localSettings.disabledSkills.includes(s.id)
  );
  const pendingSkills = skills.filter(
    (s) => s.permissions.some((p) => !p.defaultGranted) && !localSettings.disabledSkills.includes(s.id)
  );
  const disabledSkills = skills.filter((s) => localSettings.disabledSkills.includes(s.id));

  const userPreferences = memoryCandidates.filter((m) => m.memoryType === "user_preference");
  const mentorPreferences = memoryCandidates.filter((m) => m.memoryType === "mentor_preference");
  const knowledgeCapsules = memoryCandidates.filter((m) => m.memoryType === "knowledge_capsule");

  return (
    <main className="shell">
      <div className="settings-shell">
        <header className="settings-header">
          <p className="eyebrow">Settings & Privacy</p>
          <h1>设置与隐私</h1>
        </header>

        <div className="settings-layout">
          <nav className="settings-sidebar" aria-label="设置导航">
            {SETTINGS_NAV.map((item) => (
              <button
                key={item.key}
                className={`settings-nav-item ${activeSection === item.key ? "settings-nav-item-active" : ""}`}
                onClick={() => setActiveSection(item.key)}
              >
                <span className="settings-nav-icon">{item.icon}</span>
                <span className="settings-nav-label">{item.label}</span>
                {activeSection === item.key && <span className="settings-nav-indicator" />}
              </button>
            ))}
          </nav>

          <div className="settings-content">
            {activeSection === "privacy" && (
              <section className="settings-section">
                <h2>隐私模式</h2>
                <p className="settings-explanation">
                  隐私模式决定你的数据存储位置和处理方式。更改后，新内容将按新模式处理，已有内容不受影响。
                </p>
                <div className="settings-radio-group">
                  {PRIVACY_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={`settings-radio ${localSettings.privacyMode === opt.value ? "settings-radio-active" : ""}`}
                    >
                      <input
                        type="radio"
                        name="privacyMode"
                        value={opt.value}
                        checked={localSettings.privacyMode === opt.value}
                        onChange={() => updateSetting("privacyMode", opt.value)}
                      />
                      <div className="settings-radio-content">
                        <strong>{opt.label}</strong>
                        <p>{opt.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </section>
            )}

            {activeSection === "memory" && (
              <section className="settings-section">
                <h2>记忆管理</h2>
                <p className="settings-explanation">
                  知序会从你的使用过程中提取偏好和知识胶囊。你可以查看、确认或删除这些记忆。
                </p>

                <div className="memory-group">
                  <h3>用户偏好</h3>
                  {userPreferences.length === 0 ? (
                    <p className="empty-state">暂无用户偏好记录</p>
                  ) : (
                    <div className="memory-list">
                      {userPreferences.map((m) => (
                        <div key={m.id} className="memory-item">
                          <div className="memory-item-main">
                            <strong>{m.title}</strong>
                            <span className={`status-badge status-${m.status}`}>
                              {m.status === "pending_confirmation" ? "待确认" : m.status === "saved" ? "已保存" : "已拒绝"}
                            </span>
                          </div>
                          <p>{m.summary}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="memory-group">
                  <h3>导师偏好</h3>
                  {mentorPreferences.length === 0 ? (
                    <p className="empty-state">暂无导师偏好记录</p>
                  ) : (
                    <div className="memory-list">
                      {mentorPreferences.map((m) => (
                        <div key={m.id} className="memory-item">
                          <div className="memory-item-main">
                            <strong>{m.title}</strong>
                            <span className={`status-badge status-${m.status}`}>
                              {m.status === "pending_confirmation" ? "待确认" : m.status === "saved" ? "已保存" : "已拒绝"}
                            </span>
                          </div>
                          <p>{m.summary}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="memory-group">
                  <h3>知识胶囊</h3>
                  {capsules.length === 0 && knowledgeCapsules.length === 0 ? (
                    <p className="empty-state">暂无知识胶囊</p>
                  ) : (
                    <div className="memory-list">
                      {capsules.map((c) => (
                        <div key={c.id} className="memory-item">
                          <div className="memory-item-main">
                            <strong>{c.title}</strong>
                            <span className="status-badge">{c.capsuleType}</span>
                            <span className="memory-reuse">复用 {c.reuseCount} 次</span>
                          </div>
                          <p>{c.summary}</p>
                          <div className="memory-item-meta">
                            <span>隐私范围：{c.privacyScope}</span>
                            <span>创建于：{formatDate(c.createdAt)}</span>
                          </div>
                        </div>
                      ))}
                      {knowledgeCapsules.map((m) => (
                        <div key={m.id} className="memory-item">
                          <div className="memory-item-main">
                            <strong>{m.title}</strong>
                            <span className={`status-badge status-${m.status}`}>
                              {m.status === "pending_confirmation" ? "待确认" : m.status === "saved" ? "已保存" : "已拒绝"}
                            </span>
                          </div>
                          <p>{m.summary}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}

            {activeSection === "skill_permissions" && (
              <section className="settings-section">
                <h2>Skill 权限</h2>
                <p className="settings-explanation">
                  每个技能在运行前需要获得相应权限。高风险技能的权限需要逐次确认。你可以在此管理已授权、待授权和已禁用的技能。
                </p>

                <div className="perm-group">
                  <h3>已授权 ({authorizedSkills.length})</h3>
                  {authorizedSkills.length === 0 ? (
                    <p className="empty-state">暂无已授权技能</p>
                  ) : (
                    <div className="perm-list">
                      {authorizedSkills.map((s) => (
                        <div key={s.id} className="perm-item">
                          <div className="perm-item-main">
                            <strong>{s.name}</strong>
                            <span className="skill-perm-granted">已授权</span>
                          </div>
                          <p>{s.description}</p>
                          <button
                            className="btn-secondary btn-sm"
                            onClick={() => toggleSkillDisabled(s.id)}
                          >
                            禁用
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="perm-group">
                  <h3>待授权 ({pendingSkills.length})</h3>
                  {pendingSkills.length === 0 ? (
                    <p className="empty-state">暂无待授权技能</p>
                  ) : (
                    <div className="perm-list">
                      {pendingSkills.map((s) => (
                        <div key={s.id} className="perm-item">
                          <div className="perm-item-main">
                            <strong>{s.name}</strong>
                            <span className="skill-perm-pending">需授权</span>
                          </div>
                          <p>{s.description}</p>
                          <div className="perm-item-perms">
                            {s.permissions
                              .filter((p) => !p.defaultGranted)
                              .map((p, i) => (
                                <span key={i} className="perm-pending-badge">
                                  {p.scope}: {p.description}
                                </span>
                              ))}
                          </div>
                          <button
                            className="btn-secondary btn-sm"
                            onClick={() => toggleSkillDisabled(s.id)}
                          >
                            禁用
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="perm-group">
                  <h3>已禁用 ({disabledSkills.length})</h3>
                  {disabledSkills.length === 0 ? (
                    <p className="empty-state">暂无已禁用技能</p>
                  ) : (
                    <div className="perm-list">
                      {disabledSkills.map((s) => (
                        <div key={s.id} className="perm-item perm-item-disabled">
                          <div className="perm-item-main">
                            <strong>{s.name}</strong>
                            <span className="skill-perm-disabled">已禁用</span>
                          </div>
                          <p>{s.description}</p>
                          <button
                            className="btn-primary btn-sm"
                            onClick={() => toggleSkillDisabled(s.id)}
                          >
                            启用
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}

            {activeSection === "data" && (
              <section className="settings-section">
                <h2>数据管理</h2>
                <p className="settings-explanation">
                  管理你在知序平台上的数据。你可以导出所有数据或请求删除。删除操作不可逆，请谨慎操作。
                </p>

                <div className="data-actions">
                  <div className="data-action-card">
                    <div className="data-action-icon">
                      <IconDownload size={20} />
                    </div>
                    <div className="data-action-body">
                      <h3>导出数据</h3>
                      <p>将你的所有设置、知识胶囊和记忆候选导出为 JSON 文件。</p>
                    </div>
                    <button className="btn-primary" onClick={handleExportData}>
                      导出全部数据
                    </button>
                  </div>

                  <div className="data-action-card data-action-danger">
                    <div className="data-action-icon data-action-icon-danger">
                      <IconTrash size={20} />
                    </div>
                    <div className="data-action-body">
                      <h3>删除数据</h3>
                      <p>删除你的所有本地设置和缓存数据。此操作不可逆，服务器端数据需要联系管理员删除。</p>
                    </div>
                    <button
                      className="btn-danger"
                      onClick={() => {
                        if (window.confirm("确认删除所有本地数据？此操作不可撤销。")) {
                          localStorage.removeItem(STORAGE_KEY);
                          setLocalSettings(loadLocalSettings());
                        }
                      }}
                    >
                      删除本地数据
                    </button>
                  </div>

                  <div className="data-action-card">
                    <div className="data-action-icon data-action-icon-sync">
                      <IconRefresh size={20} />
                    </div>
                    <div className="data-action-body">
                      <h3>同步状态</h3>
                      <p>本地设置已保存至浏览器存储。知识胶囊和记忆数据存储在服务器端，随项目自动同步。</p>
                      <div className="sync-status">
                        <span className="sync-dot" />
                        <span>本地存储正常</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeSection === "notifications" && (
              <section className="settings-section">
                <h2>通知设置</h2>
                <p className="settings-explanation">
                  控制知序如何向你发送提醒。强提醒会通过系统通知推送，弱提醒仅在页面内显示。
                </p>

                <div className="notif-group">
                  <h3>提醒强度</h3>
                  <div className="settings-radio-group">
                    {[
                      { value: "strong", label: "强提醒", desc: "所有事项通过系统通知推送，包括 Human Gate 确认、截止日期提醒等。" },
                      { value: "normal", label: "弱提醒", desc: "仅在页面内显示提醒横幅，不推送系统通知。适合专注工作时使用。" },
                      { value: "minimal", label: "极简提醒", desc: "仅显示关键风险和截止日期提醒，其余事项静默处理。" },
                    ].map((opt) => (
                      <label
                        key={opt.value}
                        className={`settings-radio ${localSettings.notificationStrength === opt.value ? "settings-radio-active" : ""}`}
                      >
                        <input
                          type="radio"
                          name="notificationStrength"
                          value={opt.value}
                          checked={localSettings.notificationStrength === opt.value}
                          onChange={() => updateSetting("notificationStrength", opt.value)}
                        />
                        <div className="settings-radio-content">
                          <strong>{opt.label}</strong>
                          <p>{opt.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="notif-group">
                  <h3>每日摘要</h3>
                  <p className="settings-explanation">
                    开启后，知序会在每天早上推送一份项目进展摘要，包含待处理事项和风险提醒。
                  </p>
                  <label className="settings-toggle">
                    <input
                      type="checkbox"
                      checked={localSettings.dailySummary}
                      onChange={(e) => updateSetting("dailySummary", e.target.checked)}
                    />
                    <span className="settings-toggle-slider" />
                    <span className="settings-toggle-label">
                      {localSettings.dailySummary ? "已开启" : "已关闭"}
                    </span>
                  </label>
                </div>

                <div className="notif-group">
                  <h3>免打扰模式</h3>
                  <p className="settings-explanation">
                    开启后，知序不会发送任何通知。你仍可以在页面内查看所有提醒。
                  </p>
                  <label className="settings-toggle">
                    <input
                      type="checkbox"
                      checked={localSettings.doNotDisturb}
                      onChange={(e) => updateSetting("doNotDisturb", e.target.checked)}
                    />
                    <span className="settings-toggle-slider" />
                    <span className="settings-toggle-label">
                      {localSettings.doNotDisturb ? "免打扰中" : "未开启"}
                    </span>
                  </label>
                </div>
              </section>
            )}

            {activeSection === "model" && (
              <section className="settings-section">
                <h2>Agent 模型提供商</h2>
                <p className="settings-explanation">
                  配置知序 AI Agent 使用的大语言模型。支持所有 OpenAI 兼容接口。
                  配置完成后，所有 AI 对话、Agent 调度和 Skill 执行将使用此模型。
                </p>

                {llmConfig?.configured && llmConfig.isLLMGateway && (
                  <div className="llm-status-card llm-status-connected">
                    <div className="llm-status-indicator">
                      <span className="llm-status-dot llm-status-dot-active" />
                      <strong>模型已连接</strong>
                    </div>
                    <div className="llm-status-details">
                      <div className="llm-status-row">
                        <span className="llm-status-label">接口地址</span>
                        <span className="llm-status-value">{llmConfig.baseURL}</span>
                      </div>
                      <div className="llm-status-row">
                        <span className="llm-status-label">模型</span>
                        <span className="llm-status-value">{llmConfig.model}</span>
                      </div>
                      <div className="llm-status-row">
                        <span className="llm-status-label">API Key</span>
                        <span className="llm-status-value">{llmConfig.apiKeySet ? "已设置" : "未设置"}</span>
                      </div>
                      <div className="llm-status-row">
                        <span className="llm-status-label">深度思考</span>
                        <span className="llm-status-value">{llmConfig.enableThinking ? "已开启" : "已关闭"}</span>
                      </div>
                    </div>
                  </div>
                )}

                {llmConfig?.configured && !llmConfig.isLLMGateway && (
                  <div className="llm-status-card llm-status-mock">
                    <div className="llm-status-indicator">
                      <span className="llm-status-dot llm-status-dot-mock" />
                      <strong>模拟模式</strong>
                    </div>
                    <p>当前使用模拟网关，AI 功能不可用。请配置真实模型接口以启用全部功能。</p>
                  </div>
                )}

                {!llmConfig?.configured && (
                  <div className="llm-status-card llm-status-disconnected">
                    <div className="llm-status-indicator">
                      <span className="llm-status-dot llm-status-dot-inactive" />
                      <strong>未配置</strong>
                    </div>
                    <p>尚未配置 AI 模型接口，所有 AI 功能使用模拟响应。请填写下方配置以启用。</p>
                  </div>
                )}

                <div className="llm-form">
                  <div className="form-group">
                    <label className="form-label" htmlFor="llm-api-key">API Key</label>
                    <div className="llm-input-with-toggle">
                      <input
                        id="llm-api-key"
                        type={showApiKey ? "text" : "password"}
                        className="form-input"
                        placeholder="sk-xxxxxxxxxxxxxxxx"
                        value={llmForm.apiKey}
                        onChange={(e) => setLLMForm((f) => ({ ...f, apiKey: e.target.value }))}
                      />
                      <button
                        type="button"
                        className="btn-secondary btn-sm llm-toggle-visibility"
                        onClick={() => setShowApiKey((v) => !v)}
                      >
                        {showApiKey ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                      </button>
                    </div>
                    <p className="form-hint">你的 API Key 仅存储在服务器内存中，不会写入磁盘或日志。</p>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="llm-base-url">接口地址 (Base URL)</label>
                    <input
                      id="llm-base-url"
                      type="text"
                      className="form-input"
                      placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
                      value={llmForm.baseURL}
                      onChange={(e) => setLLMForm((f) => ({ ...f, baseURL: e.target.value }))}
                    />
                    <p className="form-hint">
                      OpenAI 兼容接口地址。阿里云百炼：https://dashscope.aliyuncs.com/compatible-mode/v1；商汤 SenseNova：https://token.sensenova.cn/v1
                    </p>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="llm-model">模型名称</label>
                    <input
                      id="llm-model"
                      type="text"
                      className="form-input"
                      placeholder="qwen-plus"
                      value={llmForm.model}
                      onChange={(e) => setLLMForm((f) => ({ ...f, model: e.target.value }))}
                    />
                    <p className="form-hint">
                      模型标识符。阿里云百炼推荐：qwen-plus、qwen-max；商汤 SenseNova 推荐：sensenova-6.7-flash-lite
                    </p>
                  </div>

                  <div className="form-group">
                    <label className="settings-toggle">
                      <input
                        type="checkbox"
                        checked={llmForm.enableThinking}
                        onChange={(e) => setLLMForm((f) => ({ ...f, enableThinking: e.target.checked }))}
                      />
                      <span className="settings-toggle-slider" />
                      <span className="settings-toggle-label">
                        深度思考模式
                      </span>
                    </label>
                    <p className="form-hint">
                      开启后，模型在回答前会进行深度推理。适合复杂分析任务，但响应时间更长、Token 消耗更高。
                    </p>
                  </div>

                  {llmError && <p className="page-error-inline">{llmError}</p>}
                  {llmSuccess && <p className="llm-success-msg">{llmSuccess}</p>}

                  <div className="llm-form-actions">
                    <button
                      className="btn-primary"
                      disabled={llmSaving || !llmForm.baseURL || !llmForm.model || (!llmConfig?.configured && !llmForm.apiKey)}
                      onClick={async () => {
                        setLLMSaving(true);
                        setLLMError(null);
                        setLLMSuccess(null);
                        try {
                          const payload: UpdateLLMConfigInput = {
                            baseURL: llmForm.baseURL,
                            model: llmForm.model,
                            enableThinking: llmForm.enableThinking,
                          };
                          if (llmForm.apiKey) {
                            payload.apiKey = llmForm.apiKey;
                          } else if (!llmConfig?.configured) {
                            setLLMError("首次配置需要填写 API Key");
                            setLLMSaving(false);
                            return;
                          }
                          const result = await updateLLMConfig(payload);
                          setLLMConfig(result);
                          setLLMSuccess("模型配置已保存并生效");
                          setLLMForm((f) => ({ ...f, apiKey: "" }));
                        } catch (e) {
                          if (e instanceof ApiClientError) {
                            setLLMError(`${e.message} (${e.code})`);
                          } else if (e instanceof TypeError) {
                            setLLMError(`网络错误：${e.message}（请确认后端服务 http://localhost:4000 正在运行）`);
                          } else {
                            setLLMError(`保存配置失败：${e instanceof Error ? e.message : String(e)}`);
                          }
                        } finally {
                          setLLMSaving(false);
                        }
                      }}
                    >
                      {llmSaving ? "保存中…" : llmConfig?.configured ? "更新配置" : "保存并连接"}
                    </button>

                    {llmConfig?.configured && (
                      <button
                        className="btn-danger"
                        disabled={llmSaving}
                        onClick={async () => {
                          if (!window.confirm("确认断开模型连接？断开后所有 AI 功能将回退到模拟模式。")) return;
                          setLLMSaving(true);
                          setLLMError(null);
                          setLLMSuccess(null);
                          try {
                            const result = await deleteLLMConfig();
                            setLLMConfig(result);
                            setLLMForm({ apiKey: "", baseURL: "", model: "", enableThinking: false });
                            setLLMSuccess("模型连接已断开");
                          } catch (e) {
                            setLLMError(e instanceof ApiClientError ? e.message : "断开连接失败");
                          } finally {
                            setLLMSaving(false);
                          }
                        }}
                      >
                        断开连接
                      </button>
                    )}
                  </div>
                </div>

                <div className="llm-presets">
                  <h3>常用配置预设</h3>
                  <div className="llm-preset-list">
                    <button
                      className="llm-preset-card"
                      onClick={() => setLLMForm((f) => ({
                        ...f,
                        baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
                        model: "qwen-plus",
                      }))}
                    >
                      <span className="llm-preset-provider">阿里云百炼</span>
                      <span className="llm-preset-model">qwen-plus</span>
                    </button>
                    <button
                      className="llm-preset-card"
                      onClick={() => setLLMForm((f) => ({
                        ...f,
                        baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
                        model: "qwen-max",
                      }))}
                    >
                      <span className="llm-preset-provider">阿里云百炼</span>
                      <span className="llm-preset-model">qwen-max</span>
                    </button>
                    <button
                      className="llm-preset-card"
                      onClick={() => setLLMForm((f) => ({
                        ...f,
                        baseURL: "https://api.deepseek.com/v1",
                        model: "deepseek-chat",
                      }))}
                    >
                      <span className="llm-preset-provider">DeepSeek</span>
                      <span className="llm-preset-model">deepseek-chat</span>
                    </button>
                    <button
                      className="llm-preset-card"
                      onClick={() => setLLMForm((f) => ({
                        ...f,
                        baseURL: "https://api.openai.com/v1",
                        model: "gpt-4o",
                      }))}
                    >
                      <span className="llm-preset-provider">OpenAI</span>
                      <span className="llm-preset-model">gpt-4o</span>
                    </button>
                    <button
                      className="llm-preset-card"
                      onClick={() => setLLMForm((f) => ({
                        ...f,
                        baseURL: "https://token.sensenova.cn/v1",
                        model: "sensenova-6.7-flash-lite",
                      }))}
                    >
                      <span className="llm-preset-provider">商汤 SenseNova</span>
                      <span className="llm-preset-model">6.7 Flash-Lite（免费）</span>
                    </button>
                    <button
                      className="llm-preset-card"
                      onClick={() => setLLMForm((f) => ({
                        ...f,
                        baseURL: "https://token.sensenova.cn/v1",
                        model: "deepseek-v4-flash",
                      }))}
                    >
                      <span className="llm-preset-provider">商汤 SenseNova</span>
                      <span className="llm-preset-model">DeepSeek V4 Flash（免费）</span>
                    </button>
                  </div>
                </div>
              </section>
            )}

            {activeSection === "image" && (
              <section className="settings-section">
                <h2>图像生成提供商</h2>
                <p className="settings-explanation">
                  配置知序的图像生成能力。用于报告插图、信息图、学术海报、PPT 配图等场景。
                  目前支持商汤 SenseNova U1 Fast（免费）和阿里云百炼万相。
                </p>

                <div className="llm-presets">
                  <h3>选择提供商</h3>
                  <div className="llm-preset-list">
                    <button
                      className={`llm-preset-card ${imageProvider === "sensenova" ? "llm-preset-card-active" : ""}`}
                      onClick={() => setImageProvider("sensenova")}
                    >
                      <span className="llm-preset-provider">商汤 SenseNova</span>
                      <span className="llm-preset-model">U1 Fast（免费，2K 分辨率）</span>
                    </button>
                    <button
                      className={`llm-preset-card ${imageProvider === "dashscope" ? "llm-preset-card-active" : ""}`}
                      onClick={() => setImageProvider("dashscope")}
                    >
                      <span className="llm-preset-provider">阿里云百炼</span>
                      <span className="llm-preset-model">万相（wanx）</span>
                    </button>
                  </div>
                </div>

                {imageProvider === "sensenova" && (
                  <div className="llm-form" style={{ marginTop: 16 }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="sn-api-key">SenseNova API Key</label>
                      <div className="llm-input-with-toggle">
                        <input
                          id="sn-api-key"
                          type={showImageApiKey ? "text" : "password"}
                          className="form-input"
                          placeholder="sk-..."
                          value={imageForm.apiKey}
                          onChange={(e) => setImageForm((f) => ({ ...f, apiKey: e.target.value }))}
                        />
                        <button type="button" className="llm-toggle-visibility" onClick={() => setShowImageApiKey(!showImageApiKey)}>
                          {showImageApiKey ? "隐藏" : "显示"}
                        </button>
                      </div>
                      <p className="form-hint">
                        免费申请：<a href="https://platform.sensenova.cn/token-plan" target="_blank" rel="noopener">platform.sensenova.cn/token-plan</a>
                      </p>
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="sn-img-base-url">接口地址</label>
                      <input
                        id="sn-img-base-url"
                        type="text"
                        className="form-input"
                        value={imageForm.baseURL}
                        onChange={(e) => setImageForm((f) => ({ ...f, baseURL: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="sn-img-model">模型</label>
                      <input
                        id="sn-img-model"
                        type="text"
                        className="form-input"
                        value={imageForm.model}
                        onChange={(e) => setImageForm((f) => ({ ...f, model: e.target.value }))}
                      />
                      <p className="form-hint">商汤 U1 Fast：sensenova-u1-fast（文生图）</p>
                    </div>
                    <div className="llm-form-actions">
                      <button
                        className="btn-primary"
                        disabled={imageSaving || !imageForm.apiKey}
                        onClick={async () => {
                          setImageSaving(true);
                          setImageSaveError(null);
                          try {
                            await saveImageConfig({
                              provider: "sensenova",
                              apiKey: imageForm.apiKey,
                              baseURL: imageForm.baseURL,
                              model: imageForm.model,
                            });
                            setImageSaveSuccess("图像生成配置已保存");
                            setTimeout(() => setImageSaveSuccess(null), 3000);
                          } catch (e) {
                            setImageSaveError(e instanceof Error ? e.message : "保存失败");
                          } finally {
                            setImageSaving(false);
                          }
                        }}
                      >
                        {imageSaving ? "保存中..." : "保存配置"}
                      </button>
                    </div>
                    {imageSaveError && <p className="form-error">{imageSaveError}</p>}
                    {imageSaveSuccess && <p className="form-success">{imageSaveSuccess}</p>}

                    <div style={{ marginTop: 16, padding: "12px 16px", background: "var(--color-gold-light)", borderRadius: 8, fontSize: 13 }}>
                      <strong>支持的图像尺寸（SenseNova U1 Fast）：</strong>
                      <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                        {["16:9 (2752×1536)", "9:16 (1536×2752)", "1:1 (2048×2048)", "3:2 (2496×1664)", "4:3 (2368×1760)", "5:4 (2272×1824)", "21:9 (3072×1376)"].map(s => (
                          <span key={s} style={{ opacity: 0.8 }}>{s}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {imageProvider === "dashscope" && (
                  <div className="llm-form" style={{ marginTop: 16 }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="ds-img-api-key">阿里云百炼 API Key</label>
                      <div className="llm-input-with-toggle">
                        <input
                          id="ds-img-api-key"
                          type={showImageApiKey ? "text" : "password"}
                          className="form-input"
                          placeholder="sk-..."
                          value={imageForm.apiKey}
                          onChange={(e) => setImageForm((f) => ({ ...f, apiKey: e.target.value }))}
                        />
                        <button type="button" className="llm-toggle-visibility" onClick={() => setShowImageApiKey(!showImageApiKey)}>
                          {showImageApiKey ? "隐藏" : "显示"}
                        </button>
                      </div>
                      <p className="form-hint">
                        与 Agent 模型共用同一 API Key（阿里云百炼）
                      </p>
                    </div>
                    <div className="llm-form-actions">
                      <button
                        className="btn-primary"
                        disabled={imageSaving || !imageForm.apiKey}
                        onClick={async () => {
                          setImageSaving(true);
                          setImageSaveError(null);
                          try {
                            await saveImageConfig({
                              provider: "dashscope",
                              apiKey: imageForm.apiKey,
                              baseURL: "https://dashscope.aliyuncs.com/api/v1",
                              model: "wanx-v1",
                            });
                            setImageSaveSuccess("图像生成配置已保存");
                            setTimeout(() => setImageSaveSuccess(null), 3000);
                          } catch (e) {
                            setImageSaveError(e instanceof Error ? e.message : "保存失败");
                          } finally {
                            setImageSaving(false);
                          }
                        }}
                      >
                        {imageSaving ? "保存中..." : "保存配置"}
                      </button>
                    </div>
                    {imageSaveError && <p className="form-error">{imageSaveError}</p>}
                    {imageSaveSuccess && <p className="form-success">{imageSaveSuccess}</p>}
                  </div>
                )}

                {imageConfig?.configured && (
                  <div className="llm-status-card llm-status-connected" style={{ marginTop: 16 }}>
                    <div className="llm-status-indicator">
                      <span className="llm-status-dot llm-status-dot-active" />
                      <strong>图像生成已配置</strong>
                    </div>
                    <div className="llm-status-details">
                      <div className="llm-status-row">
                        <span className="llm-status-label">提供商</span>
                        <span className="llm-status-value">{imageConfig.provider === "sensenova" ? "商汤 SenseNova" : "阿里云百炼"}</span>
                      </div>
                      <div className="llm-status-row">
                        <span className="llm-status-label">模型</span>
                        <span className="llm-status-value">{imageConfig.model}</span>
                      </div>
                      <div className="llm-status-row">
                        <span className="llm-status-label">API Key</span>
                        <span className="llm-status-value">{imageConfig.apiKeySet ? "已设置" : "未设置"}</span>
                      </div>
                    </div>
                    <button
                      className="btn-danger"
                      style={{ marginTop: 8 }}
                      onClick={async () => {
                        await deleteImageConfig();
                        setImageConfig(null);
                        setImageProvider("sensenova");
                      }}
                    >
                      清除配置
                    </button>
                  </div>
                )}
              </section>
            )}
          </div>
        </div>

        {error && <p className="page-error-inline">{error}</p>}
      </div>
    </main>
  );
}
