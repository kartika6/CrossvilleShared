// A synchronous unit of work loaded from the hosted database. The Worker commits
// its resulting state with a compare-and-swap revision check.
export class MemoryStore {
  constructor(state) { this.state = structuredClone(state); }
  read() { return structuredClone(this.state); }
  transaction(operation) {
    const next = this.read();
    const result = operation(next);
    this.state = next;
    return structuredClone(result);
  }
}
