"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getDashboard, listSchedule, type ExamCountdown, type ScheduleEvent } from "../api-client";

async function fetchSchedule(): Promise<ScheduleEvent[]> {
  return listSchedule();
}

async function fetchExamCountdowns(): Promise<ExamCountdown[]> {
  const dashboard = await getDashboard();
  return dashboard.examCountdowns ?? [];
}

const TYPE_LABELS: Record<string, string> = {
  task: "任务",
  exam: "考试",
  meeting: "会议",
  deadline: "截止",
  review: "审阅",
};

const DAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function formatEventTime(isoDate: string): string {
  const d = new Date(isoDate);
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

function formatShortDate(isoDate: string): string {
  const d = new Date(isoDate);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const start = new Date(now);
  start.setDate(now.getDate() + mondayOffset);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function groupEventsByWeekday(events: ScheduleEvent[]): Map<number, ScheduleEvent[]> {
  const grouped = new Map<number, ScheduleEvent[]>();
  for (let i = 1; i <= 7; i++) grouped.set(i, []);

  for (const event of events) {
    const d = new Date(event.dueAt);
    const day = d.getDay();
    const key = day === 0 ? 7 : day;
    grouped.get(key)!.push(event);
  }

  for (const [, list] of grouped) {
    list.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  }

  return grouped;
}

function getDaysRemaining(isoDate: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(isoDate);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

function getCalendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  return days;
}

function SkeletonBlock({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skeleton ${className ?? ""}`} style={style} />;
}

function ScheduleSkeleton() {
  return (
    <main className="shell">
      <div className="schedule-header">
        <SkeletonBlock style={{ width: 80, height: 12, marginBottom: 8 }} />
        <SkeletonBlock style={{ width: 200, height: 28 }} />
      </div>

      <div className="schedule-stats">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="schedule-stat">
            <SkeletonBlock style={{ width: 48, height: 32, borderRadius: 8, marginBottom: 8 }} />
            <SkeletonBlock style={{ width: 64, height: 12, borderRadius: 6 }} />
          </div>
        ))}
      </div>

      <div className="schedule-body">
        <div className="schedule-week">
          {[0, 1, 2, 3].map((d) => (
            <div key={d} className="schedule-day-group">
              <SkeletonBlock style={{ width: "40%", height: 16, marginBottom: 12 }} />
              {[0, 1].map((r) => (
                <div key={r} style={{ display: "flex", gap: 12, padding: "8px 0" }}>
                  <SkeletonBlock style={{ width: 40, height: 14, borderRadius: 6 }} />
                  <SkeletonBlock style={{ width: "60%", height: 14 }} />
                  <SkeletonBlock style={{ width: 48, height: 14, borderRadius: 6 }} />
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="schedule-sidebar">
          <div className="schedule-exam-card">
            <SkeletonBlock style={{ width: "60%", height: 16, marginBottom: 12 }} />
            {[0, 1].map((e) => (
              <div key={e} style={{ marginBottom: 16 }}>
                <SkeletonBlock style={{ width: 56, height: 40, borderRadius: 8, marginBottom: 8 }} />
                <SkeletonBlock style={{ width: "80%", height: 14, marginBottom: 4 }} />
                <SkeletonBlock style={{ width: "100%", height: 4, borderRadius: 2 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

export default function SchedulePage() {
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [exams, setExams] = useState<ExamCountdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [eventsData, examsData] = await Promise.all([
        fetchSchedule(),
        fetchExamCountdowns(),
      ]);
      setEvents(eventsData);
      setExams(examsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "数据加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return <ScheduleSkeleton />;
  }

  if (error) {
    return (
      <main className="shell">
        <div className="today-error">
          <div className="today-error-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p className="today-error-msg">{error}</p>
          <button className="btn-primary" onClick={fetchData}>
            重新加载
          </button>
        </div>
      </main>
    );
  }

  const now = new Date();
  const { start: weekStart, end: weekEnd } = getWeekRange();

  const upcomingEvents = events.filter((e) => new Date(e.dueAt) >= now);
  const thisWeekEvents = upcomingEvents.filter((e) => {
    const d = new Date(e.dueAt);
    return d >= weekStart && d <= weekEnd;
  });
  const overdueEvents = events.filter(
    (e) => new Date(e.dueAt) < now && e.status !== "completed"
  );
  const nearestExam = exams.length > 0 ? exams[0] : null;

  const weekEventsGrouped = groupEventsByWeekday(thisWeekEvents);
  const overdueUrgent = overdueEvents.slice(0, 5);

  const calYear = now.getFullYear();
  const calMonth = now.getMonth();
  const calDays = getCalendarDays(calYear, calMonth);
  const eventDaysSet = new Set(
    events.map((e) => {
      const d = new Date(e.dueAt);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    })
  );

  const weekdayLabels = ["一", "二", "三", "四", "五", "六", "日"];

  return (
    <main className="shell">
      <div className="schedule-header">
        <p className="eyebrow">日程管理</p>
        <h1>考试与安排</h1>
      </div>

      <div className="schedule-stats">
        <div className="schedule-stat">
          <div className="schedule-stat-value">{upcomingEvents.length}</div>
          <div className="schedule-stat-label">即将到期</div>
        </div>
        <div className="schedule-stat">
          <div className="schedule-stat-value">{thisWeekEvents.length}</div>
          <div className="schedule-stat-label">本周安排</div>
        </div>
        <div className="schedule-stat">
          <div className="schedule-stat-value" style={{ color: overdueEvents.length > 0 ? "var(--color-risk-red)" : undefined }}>
            {overdueEvents.length}
          </div>
          <div className="schedule-stat-label">已过期</div>
        </div>
        <div className="schedule-stat">
          <div className="schedule-stat-value" style={{ color: "var(--color-gold)" }}>
            {nearestExam ? nearestExam.daysRemaining : "--"}
          </div>
          <div className="schedule-stat-label">距下次考试</div>
        </div>
      </div>

      <div className="schedule-body">
        <div className="schedule-week">
          <h2 className="schedule-section-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            本周日程
          </h2>

          {[1, 2, 3, 4, 5, 6, 7].map((dayNum) => {
            const dayEvents = weekEventsGrouped.get(dayNum) ?? [];
            const dayDate = new Date(weekStart);
            dayDate.setDate(weekStart.getDate() + dayNum - 1);
            const isToday = isSameDay(dayDate, now);

            return (
              <div key={dayNum} className="schedule-day-group">
                <div className="schedule-day-title">
                  <span className="day-name">{DAY_NAMES[dayNum === 7 ? 0 : dayNum]}</span>
                  <span>{formatShortDate(dayDate.toISOString())}</span>
                  {isToday && (
                    <span style={{
                      fontSize: "var(--fs-caption)",
                      background: "var(--color-gold-light)",
                      color: "var(--color-gold)",
                      padding: "1px 8px",
                      borderRadius: "var(--radius-pill)",
                      fontWeight: 600,
                    }}>
                      今天
                    </span>
                  )}
                </div>

                {dayEvents.length === 0 ? (
                  <div className="schedule-empty-day">暂无安排</div>
                ) : (
                  dayEvents.map((event) => (
                    <div key={event.id} className="schedule-event">
                      <span className="schedule-event-time">{formatEventTime(event.dueAt)}</span>
                      <span className={`schedule-type-badge schedule-type-${event.type}`}>
                        {TYPE_LABELS[event.type] ?? event.type}
                      </span>
                      <span className="schedule-event-title">{event.title}</span>
                      <Link href={`/projects/${event.projectId}`} className="schedule-event-project">
                        {event.projectTitle}
                      </Link>
                    </div>
                  ))
                )}
              </div>
            );
          })}

          {thisWeekEvents.length === 0 && (
            <div className="empty-state" style={{ marginTop: "var(--space-4)" }}>
              <div className="empty-state-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <span>本周暂无日程安排</span>
            </div>
          )}

          <div style={{ marginTop: "var(--space-6)" }}>
            <h3 className="schedule-section-title" style={{ fontSize: "var(--fs-body)" }}>
              {calYear}年{calMonth + 1}月
            </h3>
            <div className="schedule-calendar">
              <div className="schedule-calendar-header">
                {weekdayLabels.map((label) => (
                  <div key={label} className="schedule-calendar-weekday">{label}</div>
                ))}
              </div>
              <div className="schedule-calendar-grid">
                {calDays.map((day, idx) => {
                  if (day === null) return <div key={`empty-${idx}`} className="schedule-calendar-day schedule-calendar-day-empty" />;
                  const dateKey = `${calYear}-${calMonth}-${day}`;
                  const hasEvents = eventDaysSet.has(dateKey);
                  const isToday = isSameDay(new Date(calYear, calMonth, day), now);
                  return (
                    <div
                      key={day}
                      className={`schedule-calendar-day ${isToday ? "schedule-calendar-today" : ""}`}
                    >
                      <span>{day}</span>
                      {hasEvents && <span className="schedule-calendar-dot" />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="schedule-sidebar">
          <div className="schedule-exam-card">
            <h2 className="schedule-section-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                <polyline points="10 9 11.5 10.5 14 7.5" />
              </svg>
              考试倒计时
            </h2>

            {exams.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <span>暂无考试安排</span>
              </div>
            )}

            {exams.map((exam) => (
              <div key={exam.id} style={{ marginBottom: "var(--space-4)" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)", marginBottom: "var(--space-1)" }}>
                  <div className="schedule-exam-countdown">
                    {exam.daysRemaining}
                  </div>
                  <div className="schedule-exam-countdown-label">天</div>
                </div>
                <Link href={`/projects/${exam.projectId}`} style={{ fontSize: "var(--fs-body-sm)", color: "var(--color-text-title)", fontWeight: 600, textDecoration: "none" }}>
                  {exam.projectTitle}
                </Link>
                {exam.subject && (
                  <div style={{ fontSize: "var(--fs-caption)", color: "var(--color-text-secondary)", marginTop: 2 }}>
                    {exam.subject}
                  </div>
                )}
                <div style={{ fontSize: "var(--fs-caption)", color: "var(--color-text-hint)", marginTop: 2 }}>
                  {formatShortDate(exam.examDate)}
                </div>
                {exam.progress != null && (
                  <div className="schedule-exam-progress">
                    <div className="schedule-exam-progress-bar" style={{ width: `${exam.progress}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="schedule-exam-card">
            <h2 className="schedule-section-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-risk-red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              待处理提醒
            </h2>

            {overdueUrgent.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <span>暂无过期事项</span>
              </div>
            )}

            {overdueUrgent.map((event) => {
              const daysOverdue = getDaysRemaining(event.dueAt);
              return (
                <div key={event.id} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-3)",
                  padding: "var(--space-2) 0",
                  borderBottom: "1px solid var(--color-border-card)",
                }}>
                  <span style={{
                    fontSize: "var(--fs-caption)",
                    color: "var(--color-risk-red)",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}>
                    {Math.abs(daysOverdue)}天前
                  </span>
                  <span style={{ flex: 1, fontSize: "var(--fs-body-sm)", color: "var(--color-text-body)" }}>
                    {event.title}
                  </span>
                  <Link
                    href={`/projects/${event.projectId}`}
                    style={{ fontSize: "var(--fs-caption)", color: "var(--color-gold)", textDecoration: "none", whiteSpace: "nowrap" }}
                  >
                    处理
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
