/**
 * Extracted stdout writer — safe to import without side effects.
 * The main entry point (src/index.ts) spawns subprocesses on load,
 * so this module exists to let tests exercise the writer in isolation.
 */
export function stdoutWrite(chunk: Uint8Array): Promise<void> {
  return new Promise<void>(resolve => {
    if (process.stdout.destroyed || !process.stdout.writable) return resolve()

    try {
      process.stdout.write(chunk, err => {
        void err
        resolve()
      })
    } catch {
      // Common: ERR_STREAM_DESTROYED ("Cannot call write after a stream was destroyed").
      resolve()
    }
  })
}
