// SPDX-License-Identifier: Apache-2.0
import { registerRigid } from "./registration.js";
self.onmessage = ({ data }) => {
  try {
    self.postMessage({ result: registerRigid(data.fixed, data.moving) });
  } catch (error) {
    self.postMessage({ error: error.message, details: { estimatedTransform: error.estimatedTransform, score: error.score } });
  }
};
