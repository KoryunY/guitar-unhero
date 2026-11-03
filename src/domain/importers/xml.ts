/**
 * A small, tolerant XML reader (no dependencies) — enough for MusicXML in Node and in the
 * browser without DOMParser. Skips the prolog, comments, processing instructions and
 * DOCTYPE (including an internal subset); decodes the five named entities and numeric
 * references; reads CDATA as text; recovers from mismatched close tags. Namespace prefixes
 * are dropped from element names. External entities are never resolved.
 */

export interface XmlNode {
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  /** Concatenated direct text content (entities decoded, not trimmed). */
  text: string;
}

export class XmlError extends Error {}

export const MAX_XML_NODES = 3_000_000;
const MAX_DEPTH = 128;

const NAMED: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

export function decodeEntities(s: string): string {
  if (!s.includes('&')) return s;
  return s.replace(/&(#x[0-9a-fA-F]{1,6}|#[0-9]{1,7}|[a-zA-Z]{2,8});/g, (whole, ent: string) => {
    if (ent[0] === '#') {
      const code = ent[1] === 'x' ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    }
    return NAMED[ent] ?? whole;
  });
}

function localName(n: string): string {
  const i = n.indexOf(':');
  return i >= 0 ? n.slice(i + 1) : n;
}

/** Parse a document and return its root element. Throws XmlError when there is none. */
export function parseXml(src: string, maxNodes = MAX_XML_NODES): XmlNode {
  const docRoot: XmlNode = { name: '#document', attrs: {}, children: [], text: '' };
  const stack: XmlNode[] = [docRoot];
  let i = 0;
  let nodes = 0;
  const n = src.length;
  while (i < n) {
    const lt = src.indexOf('<', i);
    if (lt < 0) {
      stack[stack.length - 1]!.text += decodeEntities(src.slice(i));
      break;
    }
    if (lt > i) stack[stack.length - 1]!.text += decodeEntities(src.slice(i, lt));
    if (src.startsWith('<!--', lt)) {
      const end = src.indexOf('-->', lt + 4);
      i = end < 0 ? n : end + 3;
      continue;
    }
    if (src.startsWith('<![CDATA[', lt)) {
      const end = src.indexOf(']]>', lt + 9);
      stack[stack.length - 1]!.text += src.slice(lt + 9, end < 0 ? n : end);
      i = end < 0 ? n : end + 3;
      continue;
    }
    if (src.startsWith('<?', lt)) {
      const end = src.indexOf('?>', lt + 2);
      i = end < 0 ? n : end + 2;
      continue;
    }
    if (src.startsWith('<!', lt)) {
      // DOCTYPE / other declarations; skip an internal subset in [ ].
      let j = lt + 2;
      let depth = 0;
      while (j < n) {
        const c = src[j];
        if (c === '[') depth++;
        else if (c === ']') depth--;
        else if (c === '>' && depth <= 0) break;
        j++;
      }
      i = j + 1;
      continue;
    }
    if (src[lt + 1] === '/') {
      const end = src.indexOf('>', lt + 2);
      const name = localName(src.slice(lt + 2, end < 0 ? n : end).trim());
      i = end < 0 ? n : end + 1;
      // Pop to the matching element; ignore a stray close tag.
      for (let k = stack.length - 1; k > 0; k--) {
        if (stack[k]!.name === name) {
          stack.length = k;
          break;
        }
      }
      continue;
    }
    // Start tag: scan to '>' outside quotes.
    let j = lt + 1;
    let quote = '';
    while (j < n) {
      const c = src[j]!;
      if (quote) {
        if (c === quote) quote = '';
      } else if (c === '"' || c === "'") quote = c;
      else if (c === '>') break;
      j++;
    }
    if (j >= n) break;
    let inner = src.slice(lt + 1, j);
    i = j + 1;
    const selfClosing = inner.endsWith('/');
    if (selfClosing) inner = inner.slice(0, -1);
    const nameMatch = /^\s*([^\s/>]+)/.exec(inner);
    if (!nameMatch) continue;
    if (++nodes > maxNodes) throw new XmlError('too many elements');
    const node: XmlNode = { name: localName(nameMatch[1]!), attrs: {}, children: [], text: '' };
    const attrRe = /([^\s=/]+)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
    attrRe.lastIndex = nameMatch[0].length;
    let a: RegExpExecArray | null;
    while ((a = attrRe.exec(inner))) node.attrs[localName(a[1]!)] = decodeEntities(a[2] ?? a[3] ?? a[4] ?? '');
    stack[stack.length - 1]!.children.push(node);
    if (!selfClosing) {
      if (stack.length > MAX_DEPTH) throw new XmlError('nested too deeply');
      stack.push(node);
    }
  }
  const root = docRoot.children[0];
  if (!root) throw new XmlError('no root element');
  return root;
}

export function child(node: XmlNode | undefined, name: string): XmlNode | undefined {
  return node?.children.find((c) => c.name === name);
}

export function childrenNamed(node: XmlNode | undefined, name: string): XmlNode[] {
  return node ? node.children.filter((c) => c.name === name) : [];
}

/** Trimmed text of a descendant path, e.g. textAt(note, 'pitch', 'step'). */
export function textAt(node: XmlNode | undefined, ...path: string[]): string | null {
  let cur = node;
  for (const p of path) cur = child(cur, p);
  if (!cur) return null;
  const t = cur.text.trim();
  return t || null;
}

export function numAt(node: XmlNode | undefined, ...path: string[]): number | null {
  const t = textAt(node, ...path);
  if (t === null) return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

/** Depth-first search for the first descendant with this name. */
export function findDeep(node: XmlNode | undefined, name: string, maxDepth = 6): XmlNode | undefined {
  if (!node || maxDepth < 0) return undefined;
  for (const c of node.children) {
    if (c.name === name) return c;
    const f = findDeep(c, name, maxDepth - 1);
    if (f) return f;
  }
  return undefined;
}
