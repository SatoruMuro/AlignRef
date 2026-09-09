// SPDX-License-Identifier: Apache-2.0
// One immediate step per wheel burst. Inertia extends the quiet period.
export function wheelNavigation(quietMs = 180) {
  let last = -Infinity;
  return (delta, now) => {
    if (!Number.isFinite(delta) || !delta) return 0;
    const ready = now-last >= quietMs;
    last = now;
    return ready ? Math.sign(delta) : 0;
  };
}
