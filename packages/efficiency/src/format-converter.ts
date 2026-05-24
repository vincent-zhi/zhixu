import type { FormatConversionResult } from "./types.js";

export class FormatConverter {
  convert(input: { content: string; sourceFormat: string; targetFormat: string }): FormatConversionResult {
    const { content, sourceFormat, targetFormat } = input;
    const key = `${sourceFormat}->${targetFormat}`;
    const warnings: string[] = [];

    let result: string;
    let fidelityScore: number;

    switch (key) {
      case "markdown->html":
        result = this.markdownToHtml(content);
        fidelityScore = 0.85;
        break;
      case "markdown->latex":
        result = this.markdownToLatex(content);
        fidelityScore = 0.8;
        break;
      case "html->markdown":
        result = this.htmlToMarkdown(content);
        fidelityScore = 0.8;
        break;
      case "latex->markdown":
        result = this.latexToMarkdown(content);
        fidelityScore = 0.75;
        break;
      default:
        result = content;
        fidelityScore = 0.5;
        warnings.push(`Unsupported conversion: ${key}`);
    }

    return {
      id: crypto.randomUUID(),
      sourceFormat,
      targetFormat,
      content: result,
      fidelityScore,
      warnings,
    };
  }

  private markdownToHtml(md: string): string {
    let html = md;
    html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
    html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
    html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
    html = html.replace(/`(.+?)`/g, "<code>$1</code>");
    html = html.replace(/^\- (.+)$/gm, "<li>$1</li>");
    html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>\n${match}</ul>\n`);
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
    html = html.replace(/\n{2,}/g, "</p>\n<p>");
    html = `<p>${html}</p>`;
    html = html.replace(/<p>\s*<(h[1-3]|ul|img)/g, "<$1");
    html = html.replace(/<\/(h[1-3]|ul)>\s*<\/p>/g, "</$1>");
    return html;
  }

  private markdownToLatex(md: string): string {
    let latex = md;
    latex = latex.replace(/^### (.+)$/gm, "\\subsubsection{$1}");
    latex = latex.replace(/^## (.+)$/gm, "\\subsection{$1}");
    latex = latex.replace(/^# (.+)$/gm, "\\section{$1}");
    latex = latex.replace(/\*\*(.+?)\*\*/g, "\\textbf{$1}");
    latex = latex.replace(/\*(.+?)\*/g, "\\textit{$1}");
    latex = latex.replace(/`(.+?)`/g, "\\texttt{$1}");
    latex = latex.replace(/^\- (.+)$/gm, "\\item $1");
    latex = latex.replace(/(\\item .+\n?)+/g, (match) => `\\begin{itemize}\n${match}\\end{itemize}\n`);
    latex = latex.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "\\href{$2}{$1}");
    return latex;
  }

  private htmlToMarkdown(html: string): string {
    let md = html;
    md = md.replace(/<h1[^>]*>(.+?)<\/h1>/gi, "# $1");
    md = md.replace(/<h2[^>]*>(.+?)<\/h2>/gi, "## $1");
    md = md.replace(/<h3[^>]*>(.+?)<\/h3>/gi, "### $1");
    md = md.replace(/<strong>(.+?)<\/strong>/gi, "**$1**");
    md = md.replace(/<b>(.+?)<\/b>/gi, "**$1**");
    md = md.replace(/<em>(.+?)<\/em>/gi, "*$1*");
    md = md.replace(/<i>(.+?)<\/i>/gi, "*$1*");
    md = md.replace(/<code>(.+?)<\/code>/gi, "`$1`");
    md = md.replace(/<li>(.+?)<\/li>/gi, "- $1");
    md = md.replace(/<\/?(ul|ol|div|p|br|hr)[^>]*>/gi, "\n");
    md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.+?)<\/a>/gi, "[$2]($1)");
    md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, "![$2]($1)");
    md = md.replace(/<[^>]+>/g, "");
    md = md.replace(/\n{3,}/g, "\n\n");
    return md.trim();
  }

  private latexToMarkdown(latex: string): string {
    let md = latex;
    md = md.replace(/\\section\{(.+?)\}/g, "# $1");
    md = md.replace(/\\subsection\{(.+?)\}/g, "## $1");
    md = md.replace(/\\subsubsection\{(.+?)\}/g, "### $1");
    md = md.replace(/\\textbf\{(.+?)\}/g, "**$1**");
    md = md.replace(/\\textit\{(.+?)\}/g, "*$1*");
    md = md.replace(/\\texttt\{(.+?)\}/g, "`$1`");
    md = md.replace(/\\item\s+/g, "- ");
    md = md.replace(/\\begin\{itemize\}/g, "");
    md = md.replace(/\\end\{itemize\}/g, "");
    md = md.replace(/\\href\{([^}]+)\}\{([^}]+)\}/g, "[$2]($1)");
    md = md.replace(/\\[a-zA-Z]+\{[^}]*\}/g, "");
    return md.trim();
  }
}
