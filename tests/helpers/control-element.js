export class ControlElement extends EventTarget {
  constructor() {
    super();
    this.attributes = new Map();
    this.captures = new Set();
    this.style = { setProperty() {} };
    this.classList = { toggle() {} };
    this.parts = {
      '.power-track': { getBoundingClientRect: () => ({ height: 204 }) },
      output: { innerHTML: '', textContent: '' },
      '.power-hint': { textContent: '' },
    };
  }
  querySelector(selector) { return this.parts[selector]; }
  setAttribute(name, value) { this.attributes.set(name, value); }
  focus() {}
  setPointerCapture(id) { this.captures.add(id); }
  hasPointerCapture(id) { return this.captures.has(id); }
  releasePointerCapture(id) {
    this.captures.delete(id);
    this.dispatchEvent(new Event('lostpointercapture'));
  }
  send(type, properties = {}) {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { pointerId: 1, isPrimary: true, button: 0, clientX: 100, clientY: 100 }, properties);
    this.dispatchEvent(event);
    return event;
  }
}
