import React from "react";

// Render inline markdown: **bold**, *italic* within a plain text segment.
export function renderInline(text: string, keyPrefix: string) {
  const nodes: React.ReactNode[] = [];
  const regex = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1]) {
      nodes.push(
        <strong key={`${keyPrefix}-b-${i++}`} className="font-bold">
          {m[2]}
        </strong>
      );
    } else {
      nodes.push(
        <em key={`${keyPrefix}-i-${i++}`} className="italic">
          {m[4]}
        </em>
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

// Render content: images ![](url), links [t](url), ### headings, **bold**, *italic*.
export function renderContent(text: string) {
  if (!text) return null;
  const lines = text.split("\n");

  return lines.map((line, lineIdx) => {
    const headingMatch = line.match(/^\s*#{1,6}\s+(.*)$/);
    const isHeading = !!headingMatch;
    const lineContent = isHeading ? headingMatch![1] : line;

    const parts: Array<{ type: "text" | "img" | "link"; value: string; href?: string }> = [];
    const regex = /(!\[[^\]]*\]\(([^)]+)\))|(\[([^\]]+)\]\(([^)]+)\))/g;
    let lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(lineContent)) !== null) {
      if (m.index > lastIndex)
        parts.push({ type: "text", value: lineContent.slice(lastIndex, m.index) });
      if (m[1]) parts.push({ type: "img", value: "", href: m[2] });
      else parts.push({ type: "link", value: m[4], href: m[5] });
      lastIndex = m.index + m[0].length;
    }
    if (lastIndex < lineContent.length)
      parts.push({ type: "text", value: lineContent.slice(lastIndex) });

    const rendered = parts.map((p, i) => {
      if (p.type === "img") {
        return (
          <img
            key={`${lineIdx}-${i}`}
            src={p.href}
            alt=""
            className="my-3 rounded-lg border border-border max-h-96 w-auto"
            loading="lazy"
          />
        );
      }
      if (p.type === "link") {
        return (
          <a
            key={`${lineIdx}-${i}`}
            href={p.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:text-primary/80 break-all"
          >
            {p.value}
          </a>
        );
      }
      return (
        <span key={`${lineIdx}-${i}`}>
          {renderInline(p.value, `${lineIdx}-${i}`)}
        </span>
      );
    });

    if (isHeading) {
      return (
        <p key={lineIdx} className="font-bold text-base my-1">
          {rendered}
        </p>
      );
    }
    return (
      <p key={lineIdx} className="whitespace-pre-wrap">
        {rendered}
        {line === "" ? "\u00A0" : null}
      </p>
    );
  });
}
