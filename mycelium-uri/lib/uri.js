// Our URIs: absolute, '/'-separated segments of [a-z0-9-], no scheme,
// query or fragment. Every URI starts with a branch name, from the root.
//
// Validation is at the boundary: validate() (or parse) where a URI comes
// in. The other functions work on valid values and don't check again.

const SEGMENT = /^[a-z0-9-]+$/

export function isSegment (s) {
  return typeof s === 'string' && SEGMENT.test(s)
}

// The boundary: returns the URI in its canonical form, fixing accepted
// deviations, and throws when the rules are broken.
// Accepted deviations: empty parts ('//', a trailing '/'); '' is the root.
//   validate('/main//x/') → '/main/x'
export function validate (uri) {
  if (typeof uri !== 'string') throw new TypeError('uri must be a string')
  if (uri !== '' && !uri.startsWith('/')) throw new Error(`not absolute: ${uri}`)
  const segments = uri.split('/').filter(s => s !== '')
  for (const s of segments) {
    if (!isSegment(s)) throw new Error(`bad segment '${s}' in ${uri}`)
  }
  return '/' + segments.join('/')
}

export function isUri (uri) {
  try { return validate(uri) === uri } catch { return false }
}

// '/a/b' → ['a', 'b']; '/' → []. Strict: only canonical URIs.
export function parse (uri) {
  const canonical = validate(uri)
  if (canonical !== uri) throw new Error(`not canonical: ${uri} (canonical: ${canonical})`)
  return canonical === '/' ? [] : canonical.slice(1).split('/')
}

// ['a', 'b'] → '/a/b'
export function format (segments) {
  return '/' + segments.join('/')
}

// join('/a', 'b/c', 'd') → '/a/b/c/d'
export function join (uri, ...parts) {
  return format([...segmentsOf(uri), ...parts.flatMap(p => p.split('/'))])
}

// parent('/a/b') → '/a'; the root has no parent.
export function parent (uri) {
  const segments = segmentsOf(uri)
  if (segments.length === 0) throw new Error('the root has no parent')
  return format(segments.slice(0, -1))
}

// Split a URI at the branch it starts with: '/overlay/config/x' with
// branches ['main', 'overlay/config'] → { branch: 'overlay/config', path: '/x' }.
// A branch is a leaf and no name is both a branch and a prefix, so at most
// one branch matches; more than one means the rule is broken.
export function split (uri, branches) {
  const segments = segmentsOf(uri)
  const matches = []
  for (const branch of branches) {
    const b = branch.split('/')
    if (b.length <= segments.length && b.every((s, i) => s === segments[i])) {
      matches.push({ branch, path: format(segments.slice(b.length)) })
    }
  }
  if (matches.length === 0) throw new Error(`no branch for ${uri}`)
  if (matches.length > 1) {
    throw new Error(`branches overlap for ${uri}: ${matches.map(m => m.branch).join(', ')}`)
  }
  return matches[0]
}

// A valid URI's segments, without checking.
function segmentsOf (uri) {
  return uri === '/' ? [] : uri.slice(1).split('/')
}
