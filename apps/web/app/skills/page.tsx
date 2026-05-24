"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  listSkills,
  invokeSkill,
  listAgentJobs,
  ApiClientError,
} from "../api-client";
import type { SkillManifest } from "../api-client";
import type { AgentJobSummary } from "@zhixu/core";

const RUNTIME_LABELS: Record<string, string> = {
  native: "原生运行",
  workflow: "工作流",
  sandbox: "沙箱运行",
  external_api: "外部 API",
  local_only: "仅本地",
};

const JOB_TYPE_LABELS: Record<string, string> = {
  parse_source: "解析资料",
  build_index: "构建索引",
  generate_summary: "生成摘要",
  detect_task: "检测任务",
  generate_plan: "生成计划",
  verify_output: "验证输出",
  export_artifact: "导出交付物",
  create_capsule: "创建知识胶囊",
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SkillsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [skills, setSkills] = useState<SkillManifest[]>([]);
  const [agentJobs, setAgentJobs] = useState<AgentJobSummary[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<SkillManifest | null>(null);
  const [invoking, setInvoking] = useState(false);
  const [invokeResult, setInvokeResult] = useState<Record<string, unknown> | null>(null);
  const [showInvokeConfirm, setShowInvokeConfirm] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [skillData, jobData] = await Promise.all([
        listSkills().catch(() => [] as SkillManifest[]),
        listAgentJobs().catch(() => [] as AgentJobSummary[]),
      ]);
      setSkills(skillData);
      setAgentJobs(jobData);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "加载技能数据失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeJobTypes = new Set(agentJobs.filter((j) => j.status === "running").map((j) => j.jobType));
  const activeSkills = skills.filter((s) => {
    const name = s.name.toLowerCase();
    for (const jobType of activeJobTypes) {
      if (name.includes(jobType.replaceAll("_", " ")) || jobType.replaceAll("_", " ").includes(name)) {
        return true;
      }
    }
    return false;
  });

  const highRiskSkills = skills.filter((s) => s.riskLevel === "L3" || s.riskLevel === "L2");
  const otherSkills = skills.filter((s) => s.riskLevel !== "L3" && s.riskLevel !== "L2");

  const handleInvoke = async (skill: SkillManifest) => {
    const isHighRisk = skill.riskLevel === "L3" || skill.riskLevel === "L2";
    if (isHighRisk) {
      setSelectedSkill(skill);
      setShowInvokeConfirm(true);
      return;
    }
    await executeInvoke(skill.id);
  };

  const executeInvoke = async (skillId: string) => {
    try {
      setInvoking(true);
      setShowInvokeConfirm(false);
      const result = await invokeSkill(skillId, {
        userId: "current_user",
      });
      setInvokeResult(result);
      await loadData();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "技能调用失败");
    } finally {
      setInvoking(false);
    }
  };

  if (loading) {
    return (
      <main className="shell">
        <div className="page-loading">加载技能数据中…</div>
      </main>
    );
  }

  return (
    <main className="shell">
      <Link href="/" className="back-link">← 返回首页</Link>

      <div className="skills-shell">
        <header className="skills-header">
          <p className="eyebrow">Skills Capability</p>
          <h1>技能能力面板</h1>
        </header>

        {activeSkills.length > 0 && (
          <section className="skills-active" aria-label="当前活跃技能">
            <h2>当前活跃技能</h2>
            <div className="skills-active-list">
              {activeSkills.map((skill) => (
                <div key={skill.id} className="skill-active-badge">
                  <span className="skill-active-dot" />
                  <strong>{skill.name}</strong>
                  <span>{skill.provider}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="skills-body">
          <section className="skills-catalog" aria-label="技能目录">
            <h2>技能目录</h2>

            {highRiskSkills.length > 0 && (
              <div className="skill-risk-group">
                <h3 className="skill-risk-group-title">高风险技能</h3>
                <div className="skills-grid">
                  {highRiskSkills.map((skill) => (
                    <article key={skill.id} className="skill-card skill-card-highrisk">
                      <div className="skill-card-header">
                        <div className="skill-card-identity">
                          <h4>{skill.name}</h4>
                          <span className="skill-card-provider">{skill.provider} · v{skill.version}</span>
                        </div>
                        <span className={`risk-badge risk-${skill.riskLevel.toLowerCase()}`}>
                          {skill.riskLevel}
                        </span>
                      </div>
                      <p className="skill-card-desc">{skill.description}</p>
                      <div className="skill-card-meta">
                        <span>运行方式：{RUNTIME_LABELS[skill.runtimeType] ?? skill.runtimeType}</span>
                      </div>
                      <div className="skill-card-permissions">
                        <h5>权限要求</h5>
                        {skill.permissions.map((perm, i) => (
                          <div key={i} className="skill-permission-item">
                            <span className={`risk-badge risk-${perm.riskLevel.toLowerCase()}`}>
                              {perm.riskLevel}
                            </span>
                            <span className="skill-perm-scope">{perm.scope}</span>
                            <span className="skill-perm-desc">{perm.description}</span>
                            {perm.defaultGranted ? (
                              <span className="skill-perm-granted">已授权</span>
                            ) : (
                              <span className="skill-perm-pending">需授权</span>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="skill-card-actions">
                        <button
                          className="btn-primary btn-sm"
                          onClick={() => handleInvoke(skill)}
                          disabled={invoking}
                        >
                          {invoking ? "调用中…" : "调用（需确认）"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}

            <div className="skill-risk-group">
              {highRiskSkills.length > 0 && <h3 className="skill-risk-group-title">标准技能</h3>}
              {otherSkills.length === 0 && skills.length === 0 && (
                <p className="empty-state">暂无可用技能</p>
              )}
              <div className="skills-grid">
                {otherSkills.map((skill) => (
                  <article key={skill.id} className="skill-card">
                    <div className="skill-card-header">
                      <div className="skill-card-identity">
                        <h4>{skill.name}</h4>
                        <span className="skill-card-provider">{skill.provider} · v{skill.version}</span>
                      </div>
                      <span className={`risk-badge risk-${skill.riskLevel.toLowerCase()}`}>
                        {skill.riskLevel}
                      </span>
                    </div>
                    <p className="skill-card-desc">{skill.description}</p>
                    <div className="skill-card-meta">
                      <span>运行方式：{RUNTIME_LABELS[skill.runtimeType] ?? skill.runtimeType}</span>
                    </div>
                    <div className="skill-card-permissions">
                      <h5>权限要求</h5>
                      {skill.permissions.map((perm, i) => (
                        <div key={i} className="skill-permission-item">
                          <span className={`risk-badge risk-${perm.riskLevel.toLowerCase()}`}>
                            {perm.riskLevel}
                          </span>
                          <span className="skill-perm-scope">{perm.scope}</span>
                          <span className="skill-perm-desc">{perm.description}</span>
                          {perm.defaultGranted ? (
                            <span className="skill-perm-granted">已授权</span>
                          ) : (
                            <span className="skill-perm-pending">需授权</span>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="skill-card-actions">
                      <button
                        className="btn-primary btn-sm"
                        onClick={() => handleInvoke(skill)}
                        disabled={invoking}
                      >
                        {invoking ? "调用中…" : "调用"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <aside className="invocation-logs" aria-label="调用记录">
            <h2>调用记录</h2>
            {agentJobs.length === 0 && (
              <p className="empty-state">暂无调用记录</p>
            )}
            <div className="invocation-log-list">
              {agentJobs
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 30)
                .map((job) => (
                  <div key={job.id} className="invocation-log-item">
                    <div className="invocation-log-top">
                      <strong>{JOB_TYPE_LABELS[job.jobType] ?? job.jobType}</strong>
                      <span className={`status-badge status-${job.status}`}>
                        {job.status.replaceAll("_", " ")}
                      </span>
                    </div>
                    <div className="invocation-log-meta">
                      <span>{formatTime(job.createdAt)}</span>
                      {job.output?.confidence != null && (
                        <span>置信度：{Math.round(job.output.confidence * 100)}%</span>
                      )}
                    </div>
                    {job.output?.riskFlags && job.output.riskFlags.length > 0 && (
                      <div className="invocation-log-flags">
                        {job.output.riskFlags.map((flag, i) => (
                          <span key={i} className="invocation-flag">{flag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
            </div>

            {invokeResult && (
              <div className="invoke-result">
                <h3>最近调用结果</h3>
                <pre>{JSON.stringify(invokeResult, null, 2)}</pre>
              </div>
            )}
          </aside>
        </div>

        {showInvokeConfirm && selectedSkill && (
          <div className="modal-overlay" onClick={() => setShowInvokeConfirm(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2>确认调用高风险技能</h2>
              <p>技能 <strong>{selectedSkill.name}</strong> 风险等级为 <span className={`risk-badge risk-${selectedSkill.riskLevel.toLowerCase()}`}>{selectedSkill.riskLevel}</span>，调用前请确认以下权限：</p>
              <ul className="confirm-perm-list">
                {selectedSkill.permissions.map((perm, i) => (
                  <li key={i}>
                    <span className={`risk-badge risk-${perm.riskLevel.toLowerCase()}`}>{perm.riskLevel}</span>
                    <strong>{perm.scope}</strong>：{perm.description}
                  </li>
                ))}
              </ul>
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setShowInvokeConfirm(false)}>取消</button>
                <button
                  className="btn-primary"
                  onClick={() => executeInvoke(selectedSkill.id)}
                  disabled={invoking}
                >
                  {invoking ? "调用中…" : "确认调用"}
                </button>
              </div>
            </div>
          </div>
        )}

        {error && <p className="page-error-inline">{error}</p>}
      </div>
    </main>
  );
}
