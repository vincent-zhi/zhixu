import { deflateSync } from "node:zlib";
import type { ArtifactRenderer } from "./renderer.js";
import type { DocExportInput, ExportResult } from "./schemas.js";

function computeResponsibilitySummary(
  input: DocExportInput
): ExportResult["responsibilitySummary"] {
  const summary = { green: 0, yellow: 0, gray: 0 };
  for (const section of input.sections) {
    summary[section.responsibilityColor]++;
  }
  return summary;
}

function buildDocumentXml(input: DocExportInput): string {
  const headingLevels = new Map<number, string>([
    [1, "Heading1"],
    [2, "Heading2"],
    [3, "Heading3"],
    [4, "Heading4"],
    [5, "Heading5"],
    [6, "Heading6"],
  ]);

  const paragraphs: string[] = [];

  paragraphs.push(
    `<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>${escapeXml(input.title)}</w:t></w:r></w:p>`
  );

  for (const section of input.sections) {
    if (section.type === "heading") {
      const style = headingLevels.get(section.level ?? 1) ?? "Heading1";
      paragraphs.push(
        `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr><w:r><w:t>${escapeXml(section.text)}</w:t></w:r></w:p>`
      );
    } else if (section.type === "bullet_list") {
      const items = section.text.split("\n");
      for (const item of items) {
        paragraphs.push(
          `<w:p><w:pPr><w:pStyle w:val="ListBullet"/></w:pPr><w:r><w:t>${escapeXml(item.replace(/^[-*]\s*/, ""))}</w:t></w:r></w:p>`
        );
      }
    } else if (section.type === "citation") {
      paragraphs.push(
        `<w:p><w:r><w:rPr><w:i/></w:rPr><w:t>[cite] ${escapeXml(section.text)}</w:t></w:r></w:p>`
      );
    } else if (section.type === "formula") {
      paragraphs.push(
        `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>${escapeXml(section.text)}</w:t></w:r></w:p>`
      );
    } else {
      paragraphs.push(
        `<w:p><w:r><w:t>${escapeXml(section.text)}</w:t></w:r></w:p>`
      );
    }
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${paragraphs.join("")}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body>
</w:document>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildContentTypesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
}

function buildRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
}

function buildDocumentRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`;
}

function buildWordStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:sz w:val="56"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="ListBullet"><w:name w:val="List Bullet"/></w:style>
</w:styles>`;
}

interface ZipEntry {
  path: string;
  data: Buffer;
}

function createZip(entries: ZipEntry[]): Buffer {
  const localHeaders: Buffer[] = [];
  const centralHeaders: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const pathBytes = Buffer.from(entry.path, "utf8");
    const compressed = deflateSync(entry.data);
    const crc = crc32(entry.data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0008, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(pathBytes.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const localEntry = Buffer.concat([localHeader, pathBytes, compressed]);
    localHeaders.push(localEntry);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0008, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(entry.data.length, 24);
    centralHeader.writeUInt16LE(pathBytes.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(offset, 38);

    centralHeaders.push(Buffer.concat([centralHeader, pathBytes]));
    offset += localEntry.length;
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const ch of centralHeaders) {
    centralDirSize += ch.length;
  }

  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(entries.length, 8);
  endRecord.writeUInt16LE(entries.length, 10);
  endRecord.writeUInt32LE(centralDirSize, 12);
  endRecord.writeUInt32LE(centralDirOffset, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([...localHeaders, ...centralHeaders, endRecord]);
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    const byte = data[i]!;
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export class DocxRenderer implements ArtifactRenderer<DocExportInput> {
  readonly format = "docx";

  async render(input: DocExportInput): Promise<ExportResult> {
    const entries: ZipEntry[] = [
      {
        path: "[Content_Types].xml",
        data: Buffer.from(buildContentTypesXml(), "utf8"),
      },
      {
        path: "_rels/.rels",
        data: Buffer.from(buildRelsXml(), "utf8"),
      },
      {
        path: "word/_rels/document.xml.rels",
        data: Buffer.from(buildDocumentRelsXml(), "utf8"),
      },
      {
        path: "word/document.xml",
        data: Buffer.from(buildDocumentXml(input), "utf8"),
      },
      {
        path: "word/styles.xml",
        data: Buffer.from(buildWordStylesXml(), "utf8"),
      },
    ];

    const buffer = createZip(entries);

    return {
      buffer,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileName: `${input.title}.docx`,
      responsibilitySummary: computeResponsibilitySummary(input),
    };
  }
}
