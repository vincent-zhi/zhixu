import { describe, expect, it } from "vitest";
import { CitationVerifier } from "./citation-verifier.js";

describe("CitationVerifier", () => {
  const verifier = new CitationVerifier();

  it("verifies a valid citation with DOI and title", () => {
    const result = verifier.verifyCitation({
      rawText: "Smith et al. (2023). Deep Learning. Nature.",
      doi: "10.1234/nature.2023",
      title: "Deep Learning",
      year: 2023
    });

    expect(result.status).toBe("verified");
    expect(result.issues).toEqual([]);
    expect(result.normalizedDoi).toBe("10.1234/nature.2023");
    expect(result.normalizedTitle).toBe("Deep Learning");
  });

  it("rejects citation with invalid DOI format", () => {
    const result = verifier.verifyCitation({
      rawText: "Bad DOI ref",
      doi: "not-a-doi",
      title: "Some Title"
    });

    expect(result.status).toBe("rejected");
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Invalid DOI format")
      ])
    );
  });

  it("rejects citation missing both DOI and title", () => {
    const result = verifier.verifyCitation({
      rawText: "Unknown reference"
    });

    expect(result.status).toBe("rejected");
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining("At least one of DOI or title must be provided")
      ])
    );
  });

  it("flags year out of valid range", () => {
    const result = verifier.verifyCitation({
      rawText: "Old ref",
      title: "Ancient Study",
      year: 1800
    });

    expect(result.status).toBe("rejected");
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining("out of valid range")
      ])
    );
  });

  it("flags future year beyond current year + 1", () => {
    const currentYear = new Date().getFullYear();
    const result = verifier.verifyCitation({
      rawText: "Future ref",
      title: "Future Study",
      year: currentYear + 5
    });

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining("out of valid range")
      ])
    );
  });

  it("accepts year at the upper boundary (current year + 1)", () => {
    const currentYear = new Date().getFullYear();
    const result = verifier.verifyCitation({
      rawText: "Boundary ref",
      title: "Boundary Study",
      year: currentYear + 1
    });

    expect(result.status).toBe("verified");
    expect(result.issues).toEqual([]);
  });

  it("accepts citation with only title (no DOI)", () => {
    const result = verifier.verifyCitation({
      rawText: "Title only ref",
      title: "Some Paper Title"
    });

    expect(result.status).toBe("verified");
    expect(result.issues).toEqual([]);
    expect(result.normalizedTitle).toBe("Some Paper Title");
  });

  it("accepts citation with only DOI (no title)", () => {
    const result = verifier.verifyCitation({
      rawText: "DOI only ref",
      doi: "10.5678/test.2024"
    });

    expect(result.status).toBe("verified");
    expect(result.issues).toEqual([]);
    expect(result.normalizedDoi).toBe("10.5678/test.2024");
  });

  it("detects duplicate DOIs in batch", () => {
    const results = verifier.batchVerify([
      { rawText: "Ref A", doi: "10.1234/dup.2023", title: "Paper A", year: 2023 },
      { rawText: "Ref B", doi: "10.1234/dup.2023", title: "Paper B", year: 2023 }
    ]);

    expect(results[0]!.status).toBe("needs_review");
    expect(results[1]!.status).toBe("needs_review");
    expect(results[0]!.issues).toEqual(
      expect.arrayContaining([expect.stringContaining("Duplicate DOI")])
    );
    expect(results[1]!.issues).toEqual(
      expect.arrayContaining([expect.stringContaining("Duplicate DOI")])
    );
  });

  it("detects duplicate title+year in batch", () => {
    const results = verifier.batchVerify([
      { rawText: "Ref C", title: "Same Title", year: 2022 },
      { rawText: "Ref D", title: "Same Title", year: 2022 }
    ]);

    expect(results[0]!.status).toBe("needs_review");
    expect(results[1]!.status).toBe("needs_review");
    expect(results[0]!.issues).toEqual(
      expect.arrayContaining([expect.stringContaining("Duplicate title+year")])
    );
    expect(results[1]!.issues).toEqual(
      expect.arrayContaining([expect.stringContaining("Duplicate title+year")])
    );
  });

  it("does not flag different titles as duplicates", () => {
    const results = verifier.batchVerify([
      { rawText: "Ref E", title: "Title One", year: 2022 },
      { rawText: "Ref F", title: "Title Two", year: 2022 }
    ]);

    expect(results[0]!.status).toBe("verified");
    expect(results[1]!.status).toBe("verified");
  });

  it("normalizes DOI to lowercase for duplicate detection", () => {
    const results = verifier.batchVerify([
      { rawText: "Ref G", doi: "10.1234/CAPS.2023", title: "Paper G" },
      { rawText: "Ref H", doi: "10.1234/caps.2023", title: "Paper H" }
    ]);

    expect(results[0]!.status).toBe("needs_review");
    expect(results[1]!.status).toBe("needs_review");
  });

  it("valid DOI format with prefix and suffix separated by slash", () => {
    const result = verifier.verifyCitation({
      rawText: "Valid DOI",
      doi: "10.1000/xyz123",
      title: "Test"
    });

    expect(result.status).toBe("verified");
    expect(result.normalizedDoi).toBe("10.1000/xyz123");
  });

  it("rejects DOI that does not start with 10.", () => {
    const result = verifier.verifyCitation({
      rawText: "Bad DOI prefix",
      doi: "11.1234/test",
      title: "Test"
    });

    expect(result.status).toBe("rejected");
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.stringContaining("Invalid DOI format")])
    );
  });

  it("rejects DOI without slash separator", () => {
    const result = verifier.verifyCitation({
      rawText: "No slash DOI",
      doi: "10.1234noslash",
      title: "Test"
    });

    expect(result.status).toBe("rejected");
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.stringContaining("Invalid DOI format")])
    );
  });
});
