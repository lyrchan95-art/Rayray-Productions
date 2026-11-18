import { Fragment } from "react";

/** Tiny, safe markdown subset for assistant prose: paragraphs, line breaks, lists, **bold**, `code`. No HTML injection. */
function inline(s: string, key: string) {
  const parts = s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") && p.length > 4 ? <strong key={`${key}-${i}`}>{p.slice(2, -2)}</strong>
    : p.startsWith("`") && p.endsWith("`") && p.length > 2 ? <code key={`${key}-${i}`}>{p.slice(1, -1)}</code>
    : <Fragment key={`${key}-${i}`}>{p}</Fragment>,
  );
}

export function Prose({ text }: { text: string }) {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/).filter((b) => b.trim());
  return (
    <>
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*([-*•]|\d+\.)\s+/.test(l))) {
          return <ul key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*([-*•]|\d+\.)\s+/, ""), `${i}-${j}`)}</li>)}</ul>;
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <Fragment key={j}>{j > 0 && <br />}{inline(l, `${i}-${j}`)}</Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}
