class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.started = false;

    //this.bufferSize = 16000 * 2; // ~2 sec
      this.bufferSize = 16000 * 8; // ~8 sec
    this.buffer = new Float32Array(this.bufferSize);

    this.writeIndex = 0;
    this.readIndex = 0;


    this.port.onmessage = (e) => {
       if (e.data.type === "reset") {
          this.readIndex = 0;
          this.writeIndex = 0;
          this.started = false;
          
          return;
        }
      const data = e.data;
     

      for (let i = 0; i < data.length; i++) {
          const nextWrite = (this.writeIndex + 1) % this.bufferSize;

          // only write if buffer not full
          if (nextWrite !== this.readIndex) {
            
            this.buffer[this.writeIndex] = data[i];
            this.writeIndex = nextWrite;
          } else {
            // buffer full → DROP NEWEST SAMPLE
            break;
          }
        }
    };
  }

  process(inputs, outputs) {
    const out = outputs[0][0];
        if (!this.started) {
         // if (this.getAvailableSamples() > 16000 * 0.6) {
          if (this.getAvailableSamples() > 16000 * 3) {
            this.started = true;
          } else {
            outputs[0][0].fill(0);
            return true;
          }
        }

        if (this.getAvailableSamples() < out.length) {
            // not enough samples → pause playback
            this.started = false;
            out.fill(0);
            return true;
          }

    // for (let i = 0; i < out.length; i++) {
    //   if (this.readIndex !== this.writeIndex) {
    //     out[i] = this.buffer[this.readIndex];
    //     this.readIndex = (this.readIndex + 1) % this.bufferSize;
    //   } else {
    //     out[i] = 0; // silence if empty
    //   }
    // }
    for (let i = 0; i < out.length; i++) {
    out[i] = this.buffer[this.readIndex];
    this.readIndex = (this.readIndex + 1) % this.bufferSize;
  }

    return true;
  }

  getAvailableSamples() {
  return (
    (this.writeIndex - this.readIndex + this.bufferSize)
    % this.bufferSize
  );
}

}

registerProcessor("pcm-player", PCMProcessor);