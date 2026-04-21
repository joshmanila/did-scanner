import { randomBytes } from "node:crypto";
import { encryptToken, decryptToken } from "../src/lib/crypto";

if (!process.env.APP_ENCRYPTION_KEY) {
  process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString("base64");
}

const plain = "hello";
const encrypted = encryptToken(plain);
const decrypted = decryptToken(encrypted);

if (decrypted !== plain) {
  console.error(
    `FAIL: roundtrip mismatch. expected=${plain} got=${decrypted}`
  );
  process.exit(1);
}

console.log(
  `OK: encryptToken/decryptToken roundtrip succeeded (ciphertext length=${encrypted.length})`
);
