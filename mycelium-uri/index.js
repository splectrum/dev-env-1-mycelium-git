// mycelium-uri — our URIs: parse, validate, split at known prefixes.
//
// Plain functions, and create({ sink }) for the same functions instrumented.

import * as uri from './lib/uri.js'
import { instrument } from './lib/instrument.js'

export { isSegment, isUri, parse, format, join, parent, split } from './lib/uri.js'
export { instrument, memorySink, summarise } from './lib/instrument.js'

export function create ({ sink }) {
  return instrument({ ...uri }, { sink, level: 'uri' })
}
