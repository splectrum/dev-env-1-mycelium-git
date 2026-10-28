// Our URIs: absolute, '/'-separated segments of [a-z0-9-], no scheme,
// query or fragment. Every URI starts with a branch name, from the root.

const SEGMENT = /^[a-z0-9-]+$/

export function isSegment (s) {
  return typeof s === 'string' && SEGMENT.test(s)
}

// '/a/b' → ['a', 'b']; '/' → []. Throws on anything else.
export function parse (uri) {
  if (typeof uri !== 'string') throw new TypeError('uri must be a string')
  if (!uri.startsWith('/')) throw new Error(`not absolute: ${uri}`)
  if (uri === '/') return []
  const segments = uri.slice(1).split('/')
  for (const s of segments) {
    if (!isSegment(s)) throw new Error(`bad segment '${s}' in ${uri}`)
  }
  return segments
}

export function isUri (uri) {
  try { parse(uri); return true } catch { return false }
}

// ['a', 'b'] → '/a/b'
export function format (segments) {
  for (const s of segments) {
    if (!isSegment(s)) throw new Error(`bad segment '${s}'`)
  }
  return '/' + segments.join('/')
}

// join('/a', 'b/c', 'd') → '/a/b/c/d'. Each part is one or more segments,
// '/'-separated: no empty segments, no leading or trailing '/'.
export function join (uri, ...parts) {
  const extra = parts.flatMap(p => {
    if (typeof p !== 'string') throw new TypeError('parts must be strings')
    return p.split('/')
  })
  return format([...parse(uri), ...extra])
}

// parent('/a/b') → '/a'; the root has no parent.
export function parent (uri) {
  const segments = parse(uri)
  if (segments.length === 0) throw new Error('the root has no parent')
  return format(segments.slice(0, -1))
}

// Split a URI at the branch it starts with: '/overlay/config/x' with
// branches ['main', 'overlay/config'] → { branch: 'overlay/config', path: '/x' }.
// A branch is a leaf and no name is both a branch and a prefix, so at most
// one branch matches; more than one means the rule is broken.
export function split (uri, branches) {
  const segments = parse(uri)
  const matches = []
  for (const branch of branches) {
    if (typeof branch !== 'string' || !branch.split('/').every(isSegment)) {
      throw new Error(`bad branch name: ${branch}`)
    }
    const b = branch.split('/')
    if (b.length > 0 && b.length <= segments.length && b.every((s, i) => s === segments[i])) {
      matches.push({ branch, path: format(segments.slice(b.length)) })
    }
  }
  if (matches.length === 0) throw new Error(`no branch for ${uri}`)
  if (matches.length > 1) {
    throw new Error(`branches overlap for ${uri}: ${matches.map(m => m.branch).join(', ')}`)
  }
  return matches[0]
}
