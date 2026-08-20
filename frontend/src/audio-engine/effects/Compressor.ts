export class CompressorFx {
  node: DynamicsCompressorNode;
  input: DynamicsCompressorNode;
  output: DynamicsCompressorNode;

  constructor(ctx: BaseAudioContext) {
    this.node = ctx.createDynamicsCompressor();
    this.node.threshold.value = -18;
    this.node.knee.value = 8;
    this.node.ratio.value = 4;
    this.node.attack.value = 0.01;
    this.node.release.value = 0.15;
    this.input = this.node;
    this.output = this.node;
  }
}

export class LimiterFx {
  node: DynamicsCompressorNode;
  input: DynamicsCompressorNode;
  output: DynamicsCompressorNode;

  constructor(ctx: BaseAudioContext) {
    this.node = ctx.createDynamicsCompressor();
    // Brickwall-ish master limiter.
    this.node.threshold.value = -1.0;
    this.node.knee.value = 0;
    this.node.ratio.value = 20;
    this.node.attack.value = 0.003;
    this.node.release.value = 0.08;
    this.input = this.node;
    this.output = this.node;
  }
}
