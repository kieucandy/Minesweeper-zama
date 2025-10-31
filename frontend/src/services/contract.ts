import { ethers } from "ethers";
import MinesweeperAbi from "../abi/Minesweeper.json";
import type { Provider } from "@reown/appkit/react";
import { SepoliaConfig } from "@zama-fhe/relayer-sdk/bundle";

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS as string;
if (!CONTRACT_ADDRESS) throw new Error("Missing VITE_CONTRACT_ADDRESS");

// Internal: get contract instance
async function getContract(walletProvider: Provider) {
  const provider = new ethers.BrowserProvider(walletProvider as any);
  const signer = await provider.getSigner();
  return new ethers.Contract(CONTRACT_ADDRESS, MinesweeperAbi.abi, signer);
}

// -------- PICK TILE (ONCHAIN) --------
export async function pickTileOnchain(
  walletProvider: Provider,
  gameId: number,
  index: number
): Promise<string> {
  const contract = await getContract(walletProvider);
  const tx = await contract.pickTile(gameId, index);
  const receipt = await tx.wait();

  const iface = new ethers.Interface(MinesweeperAbi.abi);
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === "TilePicked") {
        const cipherBytes: string = parsed.args[2]; 
        return cipherBytes;
      }
    } catch {}
  }
  throw new Error("TilePicked event not found");
}

// -------- DECRYPT TILE (IN WORKER) --------
export function decryptIsBombInWorker(
  cipherHex: string,
  userAddress: string
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const worker = new Worker("/encryptWorker.js", { type: "classic" });

    worker.onmessage = (e) => {
      if (e.data.error) reject(e.data.error);
      else resolve(Number(e.data.plaintext) === 1);
      worker.terminate();
    };

    worker.postMessage({
      mode: "decryptIsBombEq",
      cipherHex,
      userAddress,
    });
  });
}

// -------- UTIL: PACK BOARD --------
function packBoard(board: number[]): bigint {
  return board.reduce(
    (acc, v, i) => (v === 1 ? acc | (1n << BigInt(i)) : acc),
    0n
  );
}

// -------- ENCRYPT BOARD IN WORKER --------
async function encryptBoardInWorker(
  packedValue: bigint,
  contractAddress: string,
  userAddress: string,
  sdkConfig: any
): Promise<{ encryptedBoard: any; inputProof: string }> {
  return new Promise((resolve, reject) => {
    const worker = new Worker("/encryptWorker.js", { type: "classic" });

    worker.onmessage = (e) => {
      if (e.data.error) reject(e.data.error);
      else resolve(e.data);
      worker.terminate();
    };

    worker.postMessage({
      packedValue: packedValue.toString(),
      contractAddress,
      userAddress,
      sdkConfig,
    });
  });
}

// -------- CREATE NEW GAME --------
export async function createGame(walletProvider: Provider, board: number[], seed: number) {
  const provider = new ethers.BrowserProvider(walletProvider as any);
  const signer = await provider.getSigner();
  const signerAddr = await signer.getAddress();
  const contract = await getContract(walletProvider);

  const packed = packBoard(board);
  const { encryptedBoard, inputProof } = await encryptBoardInWorker(
    packed,
    CONTRACT_ADDRESS,
    signerAddr,
    SepoliaConfig
  );

  const commitHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "address", "uint8"],
      [BigInt(seed), signerAddr, board.length]
    )
  );

  const tx = await contract.createGame(
    encryptedBoard,
    inputProof,
    commitHash,
    board.length
  );

  return tx;
}