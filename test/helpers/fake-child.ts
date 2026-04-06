import { EventEmitter } from 'node:events'
import { Readable, Writable } from 'node:stream'
import type { ChildProcessWithoutNullStreams, SendHandle } from 'node:child_process'

/**
 * Fake child process for testing PiRpcProcess without spawning real subprocesses.
 * Implements ChildProcessWithoutNullStreams interface with controllable behavior.
 */
export class FakeChildProcess extends EventEmitter implements ChildProcessWithoutNullStreams {
  stdin: Writable
  stdout: Readable
  stderr: Readable
  stdio: [Writable, Readable, Readable, Readable | Writable | null | undefined, Readable | Writable | null | undefined]
  pid: number | undefined = 1000
  killed = false
  connected = false
  exitCode: number | null = null
  signalCode: NodeJS.Signals | null = null
  spawnargs: string[] = []
  spawnfile: string = 'pi'

  /** Captured stdin writes for test assertions */
  readonly stdinWrites: string[] = []

  constructor() {
    super()

    // Create mock stdin that captures writes
    this.stdin = new Writable({
      write: (chunk: Buffer | string, _encoding: string, callback: (error?: Error | null) => void) => {
        const data = typeof chunk === 'string' ? chunk : chunk.toString()
        this.stdinWrites.push(data)
        callback(null)
      }
    })

    // Create mock stdout that can be pushed to from tests
    this.stdout = new Readable({ read() {} })

    // Create mock stderr
    this.stderr = new Readable({ read() {} })

    // stdio array with 5 elements (stdin, stdout, stderr, fd3, fd4)
    this.stdio = [this.stdin, this.stdout, this.stderr, null, null]
  }

  /**
   * Emit a line on stdout (simulating pi RPC response).
   * newline is automatically appended if not present.
   */
  emitStdoutLine(line: string): void {
    const data = line.endsWith('\n') ? line : line + '\n'
    this.stdout.push(data)
  }

  /**
   * Emit a JSON object on stdout (simulating pi RPC response/event).
   */
  emitStdoutJson(obj: unknown): void {
    this.emitStdoutLine(JSON.stringify(obj))
  }

  /**
   * Simulate spawn success (triggers 'spawn' event).
   */
  simulateSpawn(): void {
    this.emit('spawn')
  }

  /**
   * Simulate spawn error (triggers 'error' event during spawn).
   */
  simulateSpawnError(error: Error & { code?: string }): void {
    this.emit('error', error)
  }

  /**
   * Simulate process exit.
   */
  simulateExit(code: number | null, signal: NodeJS.Signals | null): void {
    this.emit('exit', code, signal)
  }

  /**
   * Simulate process error after spawn.
   */
  simulateError(error: Error): void {
    this.emit('error', error)
  }

  /**
   * Kill the process (marks killed and optionally emits exit).
   */
  kill(_signal?: NodeJS.Signals | number): boolean {
    if (this.killed) return false
    this.killed = true
    // Don't automatically emit exit - tests control that
    return true
  }

  /**
   * Ref the process (noop for fake).
   */
  ref(): void {}

  /**
   * Unref the process (noop for fake).
   */
  unref(): void {}

  /**
   * Disconnect IPC (noop for fake - no IPC).
   */
  disconnect(): void {}

  /**
   * Send a message via IPC (noop for fake - no IPC).
   */
  send(_message: any, _callback?: (error: Error | null) => void): boolean
  send(_message: any, _sendHandle?: SendHandle, _callback?: (error: Error | null) => void): boolean
  send(_message: any, _sendHandle?: SendHandle, _options?: { keepOpen?: boolean }, _callback?: (error: Error | null) => void): boolean
  send(..._args: any[]): boolean {
    // Noop - fake doesn't support IPC
    return false
  }

  /**
   * Symbol.dispose for resource cleanup.
   */
  [Symbol.dispose](): void {
    this.kill()
  }
}

/**
 * Create a FakeChildProcess that automatically simulates spawn success.
 */
export function createFakeChildProcess(autoSpawn = true): FakeChildProcess {
  const child = new FakeChildProcess()
  if (autoSpawn) {
    // Emit spawn asynchronously to match real child_process behavior
    setTimeout(() => child.simulateSpawn(), 0)
  }
  return child
}