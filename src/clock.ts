let source = () => new Date();
export function now(): Date { return source(); }
export function setClockForTests(next: () => Date): void { source = next; }
