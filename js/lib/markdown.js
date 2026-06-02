// ============================================================
// MARKDOWN.JS — tiny, safe markdown renderer.
// Supports headings (#), bold (**), italic (*), inline code (`),
// unordered lists (- ), links ([text](https://…)). Storage stays
// plain text — this only runs at display time.
// ============================================================

function renderMarkdown(src) {
    if (!src) return "";

    // 1. HTML-escape so user text can't inject markup. Quotes are
    //    important too — the link substitution below drops the
    //    captured URL straight into an href="..." attribute, and an
    //    unescaped " in the URL would let a crafted note break out
    //    of the attribute and add new ones (e.g. onclick=) — which
    //    would steal the sessionStorage vault key.
    let html = src
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    // 2. Block: headings (must come before paragraph wrapping)
    html = html.replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>');
    html = html.replace(/^## (.+)$/gm,  '<h2 class="md-h2">$1</h2>');
    html = html.replace(/^# (.+)$/gm,   '<h1 class="md-h1">$1</h1>');

    // 3. Block: unordered lists — collapse runs of "- " lines
    html = html.replace(/(^|\n)((?:- [^\n]+(?:\n|$))+)/g, function (m, lead, block) {
        const items = block
            .trim()
            .split("\n")
            .map(l => l.replace(/^- /, ""))
            .map(i => `<li>${i}</li>`)
            .join("");
        return `${lead}<ul class="md-ul">${items}</ul>`;
    });

    // 4. Inline: links — only http(s) destinations allowed
    html = html.replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    // 5. Inline: bold, italic, code
    html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*\n]+)\*/g,     '<em>$1</em>');
    html = html.replace(/`([^`\n]+)`/g,       '<code>$1</code>');

    // 6. Wrap remaining text in <p> tags, single newlines become <br>
    const blocks = html.split(/\n\n+/).map(b => {
        const t = b.trim();
        if (!t) return "";
        if (/^<(h[1-6]|ul|ol|li|p)/.test(t)) return t;
        return `<p>${t.replace(/\n/g, "<br>")}</p>`;
    });
    return blocks.filter(Boolean).join("\n");
}
