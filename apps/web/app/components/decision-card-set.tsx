"use client";

import type { DecisionCardSet, DecisionCardOption } from "../chat-context";

const RISK_LEVEL_CLASS: Record<string, string> = {
  low: "decision-card__risk--low",
  medium: "decision-card__risk--medium",
  high: "decision-card__risk--high",
};

const RISK_LABEL: Record<string, string> = {
  low: "低风险",
  medium: "中风险",
  high: "高风险",
};

function OptionCard({
  option,
  isRecommended,
  onSelect,
}: {
  option: DecisionCardOption;
  isRecommended: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      className={`decision-card__option ${isRecommended ? "decision-card__option--recommended" : ""}`}
      onClick={() => onSelect(option.id)}
    >
      {isRecommended && (
        <div className="decision-card__recommended-badge">⭐ 推荐</div>
      )}
      <div className="decision-card__option-title">{option.title}</div>
      <div className="decision-card__option-desc">{option.description}</div>
      <div className="decision-card__option-tradeoff">
        <span className="decision-card__option-tradeoff-label">权衡</span>
        {option.tradeoff}
      </div>
      <div className="decision-card__option-meta">
        <span className="decision-card__option-time">⏱ {option.estimatedUserTime}</span>
        <span className={`decision-card__risk ${RISK_LEVEL_CLASS[option.riskLevel] ?? ""}`}>
          {RISK_LABEL[option.riskLevel] ?? option.riskLevel}
        </span>
      </div>
      <div className="decision-card__option-quality">
        质量上限: {option.qualityCeiling}%
      </div>
    </div>
  );
}

interface DecisionCardSetProps {
  data: DecisionCardSet;
  onSelect: (optionId: string) => void;
}

export function DecisionCardSet({ data, onSelect }: DecisionCardSetProps) {
  return (
    <div className="decision-card-set">
      <div className="decision-card-set__title">{data.title}</div>
      <div className="decision-card-set__options">
        {data.options.map((option) => (
          <OptionCard
            key={option.id}
            option={option}
            isRecommended={option.id === data.recommendedOptionId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
