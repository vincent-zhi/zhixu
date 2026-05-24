import { describe, expect, it } from "vitest";
import { TermbaseManager } from "./termbase.js";
import { FragmentCollector } from "./fragment-collector.js";
import { CrossProjectLinker } from "./cross-project.js";
import { StyleUnifier } from "./style-unifier.js";
import { FormatConverter } from "./format-converter.js";
import { ContentDeduplicator } from "./deduplicator.js";
import type { Termbase, FragmentNote, StyleProfile, CrossProjectLink } from "./types.js";

describe("TermbaseManager", () => {
  const manager = new TermbaseManager();

  it("creates a termbase", () => {
    const tb = manager.createTermbase("ws-1");
    expect(tb.id).toBeTruthy();
    expect(tb.workspaceId).toBe("ws-1");
    expect(tb.entries).toEqual([]);
  });

  it("adds an entry", () => {
    const tb = manager.createTermbase("ws-1");
    const entry = manager.addEntry(tb, {
      term: "Machine Learning",
      definition: "A subset of AI",
      domain: "CS",
      aliases: ["ML"],
      sourceProjectId: null,
    });
    expect(entry.id).toBeTruthy();
    expect(entry.term).toBe("Machine Learning");
    expect(entry.createdAt).toBeTruthy();
    expect(tb.entries).toHaveLength(1);
  });

  it("looks up by term (case-insensitive)", () => {
    const tb = manager.createTermbase("ws-1");
    manager.addEntry(tb, {
      term: "Machine Learning",
      definition: "A subset of AI",
      domain: "CS",
      aliases: ["ML"],
      sourceProjectId: null,
    });
    expect(manager.lookup(tb, "machine learning")!.term).toBe("Machine Learning");
  });

  it("looks up by alias", () => {
    const tb = manager.createTermbase("ws-1");
    manager.addEntry(tb, {
      term: "Machine Learning",
      definition: "A subset of AI",
      domain: "CS",
      aliases: ["ML"],
      sourceProjectId: null,
    });
    expect(manager.lookup(tb, "ml")!.term).toBe("Machine Learning");
  });

  it("returns null for unknown term", () => {
    const tb = manager.createTermbase("ws-1");
    expect(manager.lookup(tb, "unknown")).toBeNull();
  });

  it("unifies terms replacing aliases with canonical form", () => {
    const tb = manager.createTermbase("ws-1");
    manager.addEntry(tb, {
      term: "Machine Learning",
      definition: "A subset of AI",
      domain: "CS",
      aliases: ["ML"],
      sourceProjectId: null,
    });
    const result = manager.unifyTerms(tb, "ML is a great field. I love ML.");
    expect(result).toBe("Machine Learning is a great field. I love Machine Learning.");
  });

  it("exports termbase as CSV", () => {
    const tb = manager.createTermbase("ws-1");
    manager.addEntry(tb, {
      term: "AI",
      definition: "Artificial Intelligence",
      domain: "CS",
      aliases: [],
      sourceProjectId: null,
    });
    const csv = manager.exportTermbase(tb);
    expect(csv).toContain("id,term,definition,domain,aliases,sourceProjectId,createdAt");
    expect(csv).toContain("AI");
    expect(csv).toContain("Artificial Intelligence");
  });
});

describe("FragmentCollector", () => {
  const collector = new FragmentCollector();

  it("collects a fragment note", () => {
    const fragment = collector.collect({
      content: "Important finding about X",
      source: "paper-1",
      projectId: "proj-1",
      tags: ["finding", "X"],
    });
    expect(fragment.id).toBeTruthy();
    expect(fragment.content).toBe("Important finding about X");
    expect(fragment.source).toBe("paper-1");
    expect(fragment.tags).toEqual(["finding", "X"]);
    expect(fragment.linkedProjectIds).toEqual([]);
  });

  it("collects with default empty tags", () => {
    const fragment = collector.collect({
      content: "Some note",
      source: "src-1",
      projectId: "proj-1",
    });
    expect(fragment.tags).toEqual([]);
  });

  it("organizes fragments by tag", () => {
    const f1 = collector.collect({ content: "A", source: "s1", projectId: "p1", tags: ["x", "y"] });
    const f2 = collector.collect({ content: "B", source: "s2", projectId: "p1", tags: ["x"] });
    const f3 = collector.collect({ content: "C", source: "s3", projectId: "p1", tags: ["z"] });

    const byTag = collector.organizeByTag([f1, f2, f3]);
    expect(byTag.get("x")).toHaveLength(2);
    expect(byTag.get("y")).toHaveLength(1);
    expect(byTag.get("z")).toHaveLength(1);
  });

  it("links fragment to a project", () => {
    const fragment = collector.collect({ content: "A", source: "s1", projectId: "p1" });
    const updated = collector.linkToProject(fragment, "p2");
    expect(updated.linkedProjectIds).toContain("p2");
  });

  it("does not duplicate project links", () => {
    const fragment = collector.collect({ content: "A", source: "s1", projectId: "p1" });
    collector.linkToProject(fragment, "p2");
    collector.linkToProject(fragment, "p2");
    expect(fragment.linkedProjectIds).toHaveLength(1);
  });
});

describe("CrossProjectLinker", () => {
  const linker = new CrossProjectLinker();

  it("creates a cross-project link", () => {
    const link = linker.createLink({
      sourceProjectId: "p1",
      targetProjectId: "p2",
      linkType: "shared_knowledge",
      description: "Both use NLP",
    });
    expect(link.id).toBeTruthy();
    expect(link.sourceProjectId).toBe("p1");
    expect(link.targetProjectId).toBe("p2");
    expect(link.linkType).toBe("shared_knowledge");
    expect(link.createdAt).toBeTruthy();
  });

  it("finds related projects", () => {
    const links: CrossProjectLink[] = [
      linker.createLink({ sourceProjectId: "p1", targetProjectId: "p2", linkType: "shared_knowledge", description: "" }),
      linker.createLink({ sourceProjectId: "p3", targetProjectId: "p1", linkType: "shared_data", description: "" }),
    ];
    const related = linker.findRelatedProjects("p1", links);
    expect(related).toContain("p2");
    expect(related).toContain("p3");
    expect(related).toHaveLength(2);
  });

  it("suggests links based on title similarity", () => {
    const projects = [
      { id: "p1", title: "Deep Learning for NLP", type: "research" },
      { id: "p2", title: "Deep Learning for Vision", type: "research" },
      { id: "p3", title: "Quantum Computing", type: "research" },
    ];
    const suggestions = linker.suggestLinks("p1", projects);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((s) => s.targetProjectId === "p2")).toBe(true);
  });

  it("returns empty for unknown project", () => {
    const suggestions = linker.suggestLinks("unknown", [
      { id: "p1", title: "Test", type: "research" },
    ]);
    expect(suggestions).toEqual([]);
  });
});

describe("StyleUnifier", () => {
  const unifier = new StyleUnifier();

  it("creates a style profile", () => {
    const profile = unifier.createProfile({
      userId: "u1",
      academicLevel: "phd",
      domain: "CS",
      preferences: {
        formalityLevel: 4,
        citationStyle: "APA",
        preferredTense: "past",
        avoidFirstPerson: true,
        sentenceLengthPreference: "medium",
      },
    });
    expect(profile.id).toBeTruthy();
    expect(profile.userId).toBe("u1");
  });

  it("unifies style avoiding first person", () => {
    const profile: StyleProfile = {
      id: "sp-1",
      userId: "u1",
      academicLevel: "phd",
      domain: "CS",
      preferences: {
        formalityLevel: 4,
        citationStyle: "APA",
        preferredTense: "present",
        avoidFirstPerson: true,
        sentenceLengthPreference: "medium",
      },
    };
    const result = unifier.unifyStyle("I think this is correct.", profile);
    expect(result).not.toContain("I think");
  });

  it("expands contractions at high formality", () => {
    const profile: StyleProfile = {
      id: "sp-1",
      userId: "u1",
      academicLevel: "master",
      domain: "CS",
      preferences: {
        formalityLevel: 4,
        citationStyle: "APA",
        preferredTense: "present",
        avoidFirstPerson: false,
        sentenceLengthPreference: "medium",
      },
    };
    const result = unifier.unifyStyle("It can't be done. They don't know.", profile);
    expect(result).toContain("cannot");
    expect(result).toContain("do not");
  });

  it("converts tense to past", () => {
    const profile: StyleProfile = {
      id: "sp-1",
      userId: "u1",
      academicLevel: "phd",
      domain: "CS",
      preferences: {
        formalityLevel: 2,
        citationStyle: "APA",
        preferredTense: "past",
        avoidFirstPerson: false,
        sentenceLengthPreference: "medium",
      },
    };
    const result = unifier.unifyStyle("This is used in the experiment.", profile);
    expect(result).toContain("was used");
  });

  it("checks consistency and finds issues", () => {
    const profile: StyleProfile = {
      id: "sp-1",
      userId: "u1",
      academicLevel: "phd",
      domain: "CS",
      preferences: {
        formalityLevel: 4,
        citationStyle: "APA",
        preferredTense: "past",
        avoidFirstPerson: true,
        sentenceLengthPreference: "short",
      },
    };
    const issues = unifier.checkConsistency("I think this is used here. It can't be right.", profile);
    expect(issues.length).toBeGreaterThan(0);
  });
});

describe("FormatConverter", () => {
  const converter = new FormatConverter();

  it("converts markdown to html", () => {
    const result = converter.convert({
      content: "# Title\nSome **bold** text",
      sourceFormat: "markdown",
      targetFormat: "html",
    });
    expect(result.content).toContain("<h1>Title</h1>");
    expect(result.content).toContain("<strong>bold</strong>");
    expect(result.fidelityScore).toBeGreaterThan(0);
  });

  it("converts markdown to latex", () => {
    const result = converter.convert({
      content: "# Title\nSome *italic* text",
      sourceFormat: "markdown",
      targetFormat: "latex",
    });
    expect(result.content).toContain("\\section{Title}");
    expect(result.content).toContain("\\textit{italic}");
  });

  it("converts html to markdown", () => {
    const result = converter.convert({
      content: "<h1>Title</h1><p>Some <strong>bold</strong> text</p>",
      sourceFormat: "html",
      targetFormat: "markdown",
    });
    expect(result.content).toContain("# Title");
    expect(result.content).toContain("**bold**");
  });

  it("converts latex to markdown", () => {
    const result = converter.convert({
      content: "\\section{Title}\nSome \\textbf{bold} text",
      sourceFormat: "latex",
      targetFormat: "markdown",
    });
    expect(result.content).toContain("# Title");
    expect(result.content).toContain("**bold**");
  });

  it("returns warning for unsupported conversion", () => {
    const result = converter.convert({
      content: "test",
      sourceFormat: "docx",
      targetFormat: "pdf",
    });
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.fidelityScore).toBe(0.5);
  });
});

describe("ContentDeduplicator", () => {
  const dedup = new ContentDeduplicator();

  it("computes similarity between texts", () => {
    const sim = dedup.computeSimilarity("the cat sat on the mat", "the cat sat on the rug");
    expect(sim).toBeGreaterThan(0.5);
    expect(sim).toBeLessThan(1);
  });

  it("returns 1 for identical texts", () => {
    const sim = dedup.computeSimilarity("hello world", "hello world");
    expect(sim).toBe(1);
  });

  it("returns 0 for completely different texts", () => {
    const sim = dedup.computeSimilarity("alpha beta", "gamma delta");
    expect(sim).toBe(0);
  });

  it("deduplicates similar content", () => {
    const result = dedup.deduplicate(
      [
        "Machine learning is a subset of artificial intelligence",
        "Machine learning is a subset of AI",
        "Completely different topic here",
      ],
      0.5
    );
    expect(result.inputCount).toBe(3);
    expect(result.outputCount).toBeLessThan(3);
    expect(result.duplicates.length).toBeGreaterThan(0);
  });

  it("keeps all unique content", () => {
    const result = dedup.deduplicate(
      ["Alpha beta gamma", "Delta epsilon zeta", "Eta theta iota"],
      0.9
    );
    expect(result.outputCount).toBe(3);
    expect(result.duplicates).toEqual([]);
  });
});
