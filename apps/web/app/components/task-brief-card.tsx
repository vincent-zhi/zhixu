"use client";

import type { PresentationBrief } from "../chat-context";

const DELIVERABLE_LABEL: Record<PresentationBrief["deliverableType"], string> = {
  course_ppt: "课程 PPT",
  lab_meeting: "组会报告",
  exam_review: "考试复习",
};

interface TaskBriefCardProps {
  brief: PresentationBrief;
}

export function TaskBriefCard({ brief }: TaskBriefCardProps) {
  return (
    <div className="task-brief-card">
      <div className="task-brief-card__header">
        <span className="task-brief-card__type">{DELIVERABLE_LABEL[brief.deliverableType]}</span>
        {brief.detectedCourseName && (
          <span className="task-brief-card__course">{brief.detectedCourseName}</span>
        )}
      </div>

      <div className="task-brief-card__details">
        <div className="task-brief-card__detail">
          <span className="task-brief-card__detail-label">时长</span>
          <span className="task-brief-card__detail-value">{brief.presentationDuration} 分钟</span>
        </div>

        {brief.deadline && (
          <div className="task-brief-card__detail">
            <span className="task-brief-card__detail-label">截止时间</span>
            <span className="task-brief-card__detail-value">
              {new Date(brief.deadline).toLocaleString()}
            </span>
          </div>
        )}

        <div className="task-brief-card__detail">
          <span className="task-brief-card__detail-label">受众</span>
          <span className="task-brief-card__detail-value">{brief.targetAudience}</span>
        </div>

        <div className="task-brief-card__detail">
          <span className="task-brief-card__detail-label">素材</span>
          <span className="task-brief-card__detail-value">{brief.sourceIds.length} 份</span>
        </div>

        {brief.pageRequirement && (
          <div className="task-brief-card__detail">
            <span className="task-brief-card__detail-label">页数要求</span>
            <span className="task-brief-card__detail-value">{brief.pageRequirement} 页</span>
          </div>
        )}

        <div className="task-brief-card__detail">
          <span className="task-brief-card__detail-label">演讲备注</span>
          <span className="task-brief-card__detail-value">
            {brief.requiresSpeakerNotes ? "需要" : "不需要"}
          </span>
        </div>

        <div className="task-brief-card__detail">
          <span className="task-brief-card__detail-label">英文</span>
          <span className="task-brief-card__detail-value">
            {brief.requiresEnglish ? "需要" : "不需要"}
          </span>
        </div>
      </div>

      {brief.missingInfo.length > 0 && (
        <div className="task-brief-card__missing">
          <div className="task-brief-card__missing-title">⚠️ 缺失信息</div>
          {brief.missingInfo.map((info, i) => (
            <div key={i} className="task-brief-card__missing-item">{info}</div>
          ))}
        </div>
      )}
    </div>
  );
}
