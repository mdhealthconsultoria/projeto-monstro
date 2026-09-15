// Rest timer that survives backgrounding: only a target end-timestamp is persisted
// (via the provided get/set callbacks), remaining time is always recomputed from Date.now().
export class RestTimer {
  constructor({ getEndAt, setEndAt, onTick, onDone }) {
    this.getEndAt = getEndAt;
    this.setEndAt = setEndAt;
    this.onTick = onTick;
    this.onDone = onDone;
    this.intervalId = null;
    this._boundVisibility = () => this._onVisibilityChange();
    document.addEventListener('visibilitychange', this._boundVisibility);
  }

  start(durationSeconds) {
    const endAt = Date.now() + durationSeconds * 1000;
    this.setEndAt(endAt);
    this._runLoop();
  }

  addSeconds(seconds) {
    const endAt = this.getEndAt();
    if (!endAt) return;
    const next = endAt + seconds * 1000;
    this.setEndAt(next);
    this._tick();
  }

  skip() {
    this.setEndAt(null);
    this._stopLoop();
    this.onDone();
  }

  stop() {
    this.setEndAt(null);
    this._stopLoop();
  }

  // Called on app init / view mount to pick back up a rest that was already running.
  resumeIfActive() {
    const endAt = this.getEndAt();
    if (endAt && endAt > Date.now()) {
      this._runLoop();
      return true;
    } else if (endAt) {
      this.setEndAt(null);
    }
    return false;
  }

  remainingSeconds() {
    const endAt = this.getEndAt();
    if (!endAt) return 0;
    return Math.max(0, (endAt - Date.now()) / 1000);
  }

  _runLoop() {
    this._stopLoop();
    this._tick();
    this.intervalId = setInterval(() => this._tick(), 250);
  }

  _stopLoop() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
  }

  _tick() {
    const remaining = this.remainingSeconds();
    this.onTick(remaining);
    if (remaining <= 0 && this.getEndAt()) {
      this.setEndAt(null);
      this._stopLoop();
      this.onDone();
    }
  }

  _onVisibilityChange() {
    if (document.visibilityState === 'visible') {
      const endAt = this.getEndAt();
      if (endAt) {
        if (endAt > Date.now()) this._runLoop();
        else { this.setEndAt(null); this._stopLoop(); this.onDone(); }
      }
    }
  }

  destroy() {
    this._stopLoop();
    document.removeEventListener('visibilitychange', this._boundVisibility);
  }
}
