// Instrumentation: wrap plain functions so every call emits an event to a
// sink. Packages never write the audit log themselves; the sink decides.
// Values are summarised, never copied in full.

export function summarise (value) {
  if (value === undefined || value === null) return value
  if (value instanceof Uint8Array) return { bytes: value.length }
  if (typeof value === 'string' && value.length > 200) return { string: value.length }
  if (typeof value === 'object' && !Array.isArray(value)) {
    if (typeof value[Symbol.iterator] === 'function') return summarise([...value])
  }
  return value
}

export function instrument (fns, { sink, level, now = () => performance.now() }) {
  let seq = 0
  const wrapped = {}
  for (const [op, fn] of Object.entries(fns)) {
    wrapped[op] = (...args) => {
      const event = { seq: seq++, level, op, args: args.map(summarise) }
      const start = now()
      try {
        const result = fn(...args)
        event.result = summarise(result)
        return result
      } catch (err) {
        event.error = err.message
        throw err
      } finally {
        event.ms = now() - start
        sink(event)
      }
    }
  }
  return wrapped
}

export function memorySink () {
  const events = []
  const sink = event => { events.push(event) }
  sink.events = events
  return sink
}
