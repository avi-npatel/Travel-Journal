import sanitizeHtml from "sanitize-html";

// The rich text editor in /admin only produces these tags. Sanitising again
// on the way out means a bad paste or a direct database edit can never put
// scripts or stray markup on the public site.
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "strong", "em", "h2", "h3", "a", "ul", "ol", "li", "blockquote"],
  allowedAttributes: { a: ["href", "rel", "target"] },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
    b: "strong",
    i: "em",
    h1: "h2",
  },
};

export function sanitizeRichText(html: string): string {
  const clean = sanitizeHtml(html, OPTIONS).trim();
  // An editor that was clicked into but left empty saves "<p></p>".
  return clean.replace(/<p>\s*<\/p>/g, "") === "" ? "" : clean;
}

/** Plain text, for meta descriptions. */
export function htmlToText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, " ").trim();
}
