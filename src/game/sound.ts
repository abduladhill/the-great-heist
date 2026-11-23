// Small procedural cues; no external audio downloads or autoplay before interaction.
export class Soundscape {
  private context: AudioContext | null = null;
  enabled = true;
  unlock() {
    if (!this.context) this.context = new AudioContext();
    void this.context.resume();
  }
  play(kind: "loot" | "alarm" | "win" | "lose") {
    if (!this.enabled || !this.context || this.context.state !== "running")
      return;
    const notes =
      kind === "loot"
        ? [660, 880]
        : kind === "win"
          ? [440, 554, 660, 880]
          : kind === "lose"
            ? [330, 247, 165]
            : [440, 330];
    notes.forEach((hz, i) => {
      const o = this.context!.createOscillator(),
        g = this.context!.createGain(),
        at = this.context!.currentTime + i * 0.14;
      o.type = kind === "alarm" ? "triangle" : "sine";
      o.frequency.value = hz;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.06, at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
      o.connect(g);
      g.connect(this.context!.destination);
      o.start(at);
      o.stop(at + 0.22);
    });
  }
  dispose() {
    void this.context?.close();
  }
}
