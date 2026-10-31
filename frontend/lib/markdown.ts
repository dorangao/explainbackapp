// A small Markdown reader for the documents the app ships from `docs/`: headings,
// paragraphs, bullet and numbered lists, pipe tables, fenced code, and inline code,
// bold and links. It produces data, not HTML, so the renderer never injects markup.
export type Inline =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string }
  | { kind: "strong"; children: Inline[] }
  | { kind: "link"; href: string; external: boolean; children: Inline[] };
export type Block =
  | { kind: "heading"; level: 1 | 2 | 3; id: string; children: Inline[] }
  | { kind: "paragraph"; children: Inline[] }
  | { kind: "list"; ordered: boolean; items: Inline[][] }
  | { kind: "table"; header: Inline[][]; rows: Inline[][][] }
  | { kind: "code"; text: string; language: string };

export const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

export const plainText = (nodes: Inline[]): string =>
  nodes
    .map((node) =>
      node.kind === "text" || node.kind === "code"
        ? node.text
        : plainText(node.children),
    )
    .join("");

// Relative links in a document point at its sibling files; they are resolved against
// the published copy of that folder. Absolute links and in-page anchors stay as written.
const resolve = (href: string, linkBase: string) =>
  /^(https?:)?\/\//.test(href) || href.startsWith("#") || href.startsWith("/")
    ? href
    : linkBase + href;

const inlinePattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)\s]+\))/g;
export function parseInline(text: string, linkBase = ""): Inline[] {
  const nodes: Inline[] = [];
  let last = 0;
  for (const match of text.matchAll(inlinePattern)) {
    const index = match.index ?? 0;
    if (index > last)
      nodes.push({ kind: "text", text: text.slice(last, index) });
    const token = match[0];
    if (token.startsWith("`"))
      nodes.push({ kind: "code", text: token.slice(1, -1) });
    else if (token.startsWith("**"))
      nodes.push({
        kind: "strong",
        children: parseInline(token.slice(2, -2), linkBase),
      });
    else {
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token);
      if (link) {
        const href = resolve(link[2], linkBase);
        nodes.push({
          kind: "link",
          href,
          external: /^https?:\/\//.test(href),
          children: parseInline(link[1], linkBase),
        });
      }
    }
    last = index + token.length;
  }
  if (last < text.length) nodes.push({ kind: "text", text: text.slice(last) });
  return nodes;
}

const cells = (line: string, linkBase: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => parseInline(cell.trim(), linkBase));
const isSeparator = (line: string) =>
  /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$/.test(line.trim());

export function parseMarkdown(source: string, linkBase = ""): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const fence = /^```(\w*)\s*$/.exec(line);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i]))
        body.push(lines[i++]);
      i++;
      blocks.push({ kind: "code", text: body.join("\n"), language: fence[1] });
      continue;
    }
    const heading = /^(#{1,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      const children = parseInline(heading[2], linkBase);
      blocks.push({
        kind: "heading",
        level: heading[1].length as 1 | 2 | 3,
        id: slugify(plainText(children)),
        children,
      });
      i++;
      continue;
    }
    if (
      line.trim().startsWith("|") &&
      i + 1 < lines.length &&
      isSeparator(lines[i + 1])
    ) {
      const header = cells(line, linkBase);
      const rows: Inline[][][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|"))
        rows.push(cells(lines[i++], linkBase));
      blocks.push({ kind: "table", header, rows });
      continue;
    }
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line),
      number = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (bullet || number) {
      const ordered = Boolean(number);
      const pattern = ordered ? /^\s*\d+\.\s+(.*)$/ : /^\s*[-*]\s+(.*)$/;
      const items: Inline[][] = [];
      while (i < lines.length) {
        const item = pattern.exec(lines[i]);
        if (!item) break;
        let text = item[1];
        i++;
        // A wrapped item continues on indented lines until the next item or a blank line.
        while (
          i < lines.length &&
          /^\s{2,}\S/.test(lines[i]) &&
          !pattern.test(lines[i])
        )
          text += " " + lines[i++].trim();
        items.push(parseInline(text, linkBase));
      }
      blocks.push({ kind: "list", ordered, items });
      continue;
    }
    const paragraph: string[] = [line.trim()];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,3}\s|```|\s*[-*]\s|\s*\d+\.\s|\|)/.test(lines[i])
    )
      paragraph.push(lines[i++].trim());
    blocks.push({
      kind: "paragraph",
      children: parseInline(paragraph.join(" "), linkBase),
    });
  }
  return blocks;
}
