/**
 * AudioWorklet capture processor. Copies mono input into bounded 512-frame
 * chunks stamped with the context sample frame of their first sample, and posts
 * them (transferred, not copied) to the analysis worker. No DSP, allocation-light,
 * no network, no assumption about render-quantum size.
 */
const CHUNK = 512;

class GuCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sink = null;
    this.buf = new Float32Array(CHUNK);
    this.n = 0;
    this.start = 0;
    this.active = true;
    this.emptyBlocks = 0;
    this.port.onmessage = (e) => {
      const d = e.data;
      if (d && d.type === 'port') this.sink = d.port;
      else if (d && d.type === 'stop') this.active = false;
    };
  }

  process(inputs) {
    const input = inputs[0];
    const ch = input && input[0];
    if (!ch || ch.length === 0) {
      // No connected/active input this quantum (device gone or muted track).
      this.emptyBlocks++;
      if (this.emptyBlocks % 64 === 1) this.port.postMessage({ type: 'noinput', frame: currentFrame });
      return this.active;
    }
    this.emptyBlocks = 0;
    const out = this.sink || this.port;
    for (let i = 0; i < ch.length; i++) {
      if (this.n === 0) this.start = currentFrame + i;
      this.buf[this.n++] = ch[i];
      if (this.n === CHUNK) {
        out.postMessage({ type: 'pcm', startFrame: this.start, samples: this.buf }, [this.buf.buffer]);
        this.buf = new Float32Array(CHUNK);
        this.n = 0;
      }
    }
    return this.active;
  }
}

registerProcessor('gu-capture', GuCaptureProcessor);
