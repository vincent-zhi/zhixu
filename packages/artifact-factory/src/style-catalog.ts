import type { StylePreset, StyleTriple } from "./schemas.js";

const DESIGN_STYLES: StyleTriple["designStyle"][] = [
  "classic",
  "modern",
  "minimalist",
  "vibrant",
  "ink_chinese",
  "infographic",
  "dashboard",
  "ultra_minimal",
];

const COLOR_TONES: StyleTriple["colorTone"][] = [
  "warm",
  "cool",
  "neutral",
  "vivid",
  "muted",
  "monochrome",
];

const PRIMARY_COLORS: string[] = [
  "#0D1B2F",
  "#2E7D32",
  "#1565C0",
  "#6A1B9A",
  "#BF360C",
  "#00695C",
  "#37474F",
  "#F57F17",
  "#1A237E",
  "#880E4F",
];

const STYLE_PRESETS: StylePreset[] = [
  {
    id: "academic_classic",
    nameZh: "学术经典",
    scenario: "course_presentation",
    designStyleId: 0,
    colorToneId: 2,
    primaryColorId: 0,
  },
  {
    id: "fresh_academic",
    nameZh: "清新学术",
    scenario: "course_presentation",
    designStyleId: 1,
    colorToneId: 0,
    primaryColorId: 2,
  },
  {
    id: "tech_frontier",
    nameZh: "科技前沿",
    scenario: "course_presentation",
    designStyleId: 1,
    colorToneId: 3,
    primaryColorId: 8,
  },
  {
    id: "minimal_elegant",
    nameZh: "简约大气",
    scenario: "course_presentation",
    designStyleId: 2,
    colorToneId: 2,
    primaryColorId: 6,
  },
  {
    id: "ink_chinese",
    nameZh: "水墨中国",
    scenario: "course_presentation",
    designStyleId: 4,
    colorToneId: 4,
    primaryColorId: 6,
  },
  {
    id: "infographic_rich",
    nameZh: "信息图表",
    scenario: "course_presentation",
    designStyleId: 5,
    colorToneId: 3,
    primaryColorId: 5,
  },
  {
    id: "lab_dashboard",
    nameZh: "简报仪表盘",
    scenario: "lab_meeting",
    designStyleId: 6,
    colorToneId: 1,
    primaryColorId: 6,
  },
  {
    id: "ultra_minimal",
    nameZh: "极简主义",
    scenario: "lab_meeting",
    designStyleId: 7,
    colorToneId: 5,
    primaryColorId: 6,
  },
  {
    id: "vibrant_lab",
    nameZh: "活力实验",
    scenario: "lab_meeting",
    designStyleId: 3,
    colorToneId: 3,
    primaryColorId: 4,
  },
  {
    id: "warm_seminar",
    nameZh: "温暖研讨",
    scenario: "lab_meeting",
    designStyleId: 0,
    colorToneId: 0,
    primaryColorId: 7,
  },
];

function derivePalette(primaryColor: string, colorTone: StyleTriple["colorTone"]): string[] {
  const palette: string[] = [primaryColor];

  const r = parseInt(primaryColor.slice(1, 3), 16);
  const g = parseInt(primaryColor.slice(3, 5), 16);
  const b = parseInt(primaryColor.slice(5, 7), 16);

  const lighten = (factor: number) => {
    const lr = Math.min(255, Math.round(r + (255 - r) * factor));
    const lg = Math.min(255, Math.round(g + (255 - g) * factor));
    const lb = Math.min(255, Math.round(b + (255 - b) * factor));
    return `#${lr.toString(16).padStart(2, "0")}${lg.toString(16).padStart(2, "0")}${lb.toString(16).padStart(2, "0")}`;
  };

  const darken = (factor: number) => {
    const dr = Math.max(0, Math.round(r * (1 - factor)));
    const dg = Math.max(0, Math.round(g * (1 - factor)));
    const db = Math.max(0, Math.round(b * (1 - factor)));
    return `#${dr.toString(16).padStart(2, "0")}${dg.toString(16).padStart(2, "0")}${db.toString(16).padStart(2, "0")}`;
  };

  palette.push(lighten(0.3));
  palette.push(lighten(0.6));
  palette.push(darken(0.3));
  palette.push(darken(0.6));

  if (colorTone === "warm") {
    palette.push("#B89B5E");
  } else if (colorTone === "cool") {
    palette.push("#5E8BB8");
  } else {
    palette.push("#8B8B8B");
  }

  return palette.slice(0, 6);
}

export function getRecommendedPresets(scenario: string): StylePreset[] {
  return STYLE_PRESETS.filter((p) => p.scenario === scenario);
}

export function getStyleTriple(preset: StylePreset): StyleTriple {
  const designStyle = DESIGN_STYLES[preset.designStyleId] ?? "modern";
  const colorTone = COLOR_TONES[preset.colorToneId] ?? "neutral";
  const primaryColor = PRIMARY_COLORS[preset.primaryColorId] ?? "#0D1B2F";

  const typographyMap: Record<StyleTriple["designStyle"], StyleTriple["typography"]> = {
    classic: { heading: "Georgia", body: "Georgia", monospace: "Courier New" },
    modern: { heading: "Arial", body: "Arial" },
    minimalist: { heading: "Arial", body: "Arial" },
    vibrant: { heading: "Arial", body: "Arial" },
    ink_chinese: { heading: "SimSun", body: "SimSun" },
    infographic: { heading: "Arial", body: "Arial" },
    dashboard: { heading: "Arial", body: "Arial" },
    ultra_minimal: { heading: "Arial", body: "Arial" },
  };

  return {
    designStyle,
    colorTone,
    primaryColor,
    palette: derivePalette(primaryColor, colorTone),
    typography: typographyMap[designStyle],
  };
}

export class StyleCatalog {
  getAllPresets(): StylePreset[] {
    return [...STYLE_PRESETS];
  }

  getRecommendedPresets(scenario: string): StylePreset[] {
    return getRecommendedPresets(scenario);
  }

  getStyleTriple(preset: StylePreset): StyleTriple {
    return getStyleTriple(preset);
  }

  getPresetById(id: string): StylePreset | undefined {
    return STYLE_PRESETS.find((p) => p.id === id);
  }
}
