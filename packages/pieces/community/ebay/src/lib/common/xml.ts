function firstTag({ xml, tag }: { xml: string; tag: string }): string | null {
    const match = xml.match(new RegExp(`${openTag({ tag })}([\\s\\S]*?)</${tag}>`));
    return match ? unescapeXml({ text: match[1] }) : null;
}

function blocks({ xml, tag }: { xml: string; tag: string }): string[] {
    return [...xml.matchAll(new RegExp(`${openTag({ tag })}([\\s\\S]*?)</${tag}>`, 'g'))].map((match) => match[1]);
}

function withoutBlocks({ xml, tag }: { xml: string; tag: string }): string {
    return xml.replace(new RegExp(`${openTag({ tag })}[\\s\\S]*?</${tag}>`, 'g'), '');
}

// eBay puts attributes on some elements (e.g. <StartPrice currencyID="USD">), so allow them after the tag name.
function openTag({ tag }: { tag: string }): string {
    return `<${tag}(?:\\s[^>]*)?>`;
}

function unescapeXml({ text }: { text: string }): string {
    return text
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, '\'')
        .replace(/&amp;/g, '&');
}

function escapeXml({ text }: { text: string }): string {
    return text.replace(/[<>&'"]/g, (char) => `&#${char.charCodeAt(0)};`);
}

export const xmlUtils = {
    firstTag,
    blocks,
    withoutBlocks,
    unescapeXml,
    escapeXml,
};
