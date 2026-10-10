export class PocketHistory {
  constructor() { this.reset(); }

  record(id) {
    if (!Number.isInteger(id) || id < 1 || id > 15 || this.ids.includes(id)) return false;
    this.ids.push(id);
    return true;
  }

  reset() { this.ids = []; }
}
