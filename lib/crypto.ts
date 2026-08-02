async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passphraseKey = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    passphraseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptVaultItem(plaintext: string, passphrase: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);

  const encryptedContent = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    encoder.encode(plaintext)
  );

  const payload = {
    salt: Array.from(salt),
    iv: Array.from(iv),
    ciphertext: Array.from(new Uint8Array(encryptedContent)),
  };

  return btoa(JSON.stringify(payload));
}

export async function decryptVaultItem(base64Payload: string, passphrase: string): Promise<string> {
  const decoder = new TextDecoder();
  const payload = JSON.parse(atob(base64Payload));

  const salt = new Uint8Array(payload.salt);
  const iv = new Uint8Array(payload.iv);
  const ciphertext = new Uint8Array(payload.ciphertext);

  const key = await deriveKey(passphrase, salt);

  const decryptedContent = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    key,
    ciphertext
  );

  return decoder.decode(decryptedContent);
}