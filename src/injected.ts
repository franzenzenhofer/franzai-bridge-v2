/**
 * FranzAI Bridge - Injected Script (MAIN WORLD)
 */

import { captureGlobals } from "./injected/capture";
import { initBridge } from "./injected/init";

const capture = captureGlobals();
initBridge(capture);
