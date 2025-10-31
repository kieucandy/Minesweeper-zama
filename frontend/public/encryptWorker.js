/* eslint-disable no-undef */
importScripts("/fhevm-worker.js"); // MUST remain

let fhevm = null;

/**
 * Ensure SDK instance exists (lazy init)
 */
async function ensureSDK(sdkConfig) {
  const PossibleSDK =
    self.RelayerSDK ||
    self.relayerSDK ||
    self.fhevm ||
    self.FHE ||
    self.Zama ||
    null;

  if (!PossibleSDK) {
    throw new Error("FHE SDK global not found in worker");
  }

  if (!fhevm) {
    let inst = null;

    if (typeof PossibleSDK === "function") {
      inst = new PossibleSDK();
      if (typeof inst.initSDK === "function") {
        await inst.initSDK();
      }
    } else {
      inst = PossibleSDK;
      if (typeof inst.initSDK === "function") {
        await inst.initSDK();
      }
    }

    if (!inst || typeof inst.createInstance !== "function") {
      throw new Error("createInstance() not found in SDK");
    }

    fhevm = await inst.createInstance(sdkConfig);
  }
}

/**
 * Encrypt full board
 */
async function handleEncryptBoard({ packedValue, contractAddress, userAddress, sdkConfig }) {
  await ensureSDK(sdkConfig);

  const buf = fhevm.createEncryptedInput(contractAddress, userAddress);

  buf.add64(BigInt(packedValue));

  const result = await buf.encrypt();

  return {
    encryptedBoard: result.handles[0],
    inputProof: result.inputProof,
  };
}

/**
 * Decrypt bomb check
 */
async function handleDecryptTile({ cipherHex, userAddress }) {
  await ensureSDK(); // reuse existing instance

  // Convert hex → Uint8Array 
  const bytes =
    typeof cipherHex === "string"
      ? fhevm.utils.hexToBytes(cipherHex)
      : cipherHex;

  // Create a decrypt handle (this is the original ConfBomb flow)
  const handle = fhevm.createDecryptionHandle(bytes, userAddress);

  // plaintext = "0" or "1" (string), convert to boolean
  const plaintext = await handle.decrypt();

  return { plaintext: Number(plaintext) }; // 0 | 1
}

/**
 * Worker router
 */
self.onmessage = async (e) => {
  const data = e.data;
  try {
    if (data.mode === "decryptIsBombEq") {
      const result = await handleDecryptTile(data);
      self.postMessage(result);
    } else {
      const result = await handleEncryptBoard(data);
      self.postMessage(result);
    }
  } catch (err) {
    console.error("Worker error:", err);
    self.postMessage({ error: err?.message || String(err) });
  }
};