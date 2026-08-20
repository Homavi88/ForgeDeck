class BitcrusherProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "bits", defaultValue: 6, minValue: 1, maxValue: 16 },
      { name: "normfreq", defaultValue: 0.15, minValue: 0.0, maxValue: 1 },
    ];
  }

  constructor() {
    super();
    this._phaser = 0;
    this._last = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input[0] || !output || !output[0]) return true;
    const bits = parameters.bits[0];
    const normfreq = parameters.normfreq[0];
    const step = Math.pow(0.5, bits);
    for (let ch = 0; ch < output.length; ch++) {
      const inp = input[ch] || input[0];
      const out = output[ch];
      for (let i = 0; i < out.length; i++) {
        this._phaser += normfreq;
        if (this._phaser >= 1.0) {
          this._phaser -= 1.0;
          this._last = step * Math.floor(inp[i] / step + 0.5);
        }
        out[i] = this._last;
      }
    }
    return true;
  }
}

registerProcessor("bitcrusher-processor", BitcrusherProcessor);
