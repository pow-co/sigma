import * as assert from "assert";
import { PrivateKey, Script, Transaction, TxIn, TxOut } from "bsv-wasm";
import nock from "nock"; // Import nock
import { AuthToken, Sigma } from "./";

describe("Sigma Protocol", () => {
  // Test data
  const privateKey = PrivateKey.from_wif(
    "KzmFJcMXHufPNHixgHNwXBt3mHpErEUG6WFbmuQdy525DezYAi82"
  );
  const privateKey2 = PrivateKey.from_wif(
    "L1U5FS1PzJwCiFA43hahBUSLytqVoGjSymKSz5WJ92v8YQBBsGZ1"
  );

  const outputScriptAsm = `OP_0 OP_RETURN ${Buffer.from(
    "pushdata1",
    "utf-8"
  ).toString("hex")} ${Buffer.from("pushdata2", "utf-8").toString("hex")}`;

  const script = Script.from_asm_string(outputScriptAsm);
  // Build a simple transaction with the output script
  const tx = new Transaction(1, 0);
  const txOut = new TxOut(BigInt(0), script);
  tx.add_output(txOut);

  it("signs and verifies a message correctly", () => {
    // Create a new Sigma instance with the transaction and targetVout
    const sigma = new Sigma(tx, 0, 0);
    console.log({ messageHash: sigma.getMessageHash().to_hex() });
    // Sign the message
    const { sigmaScript, address, signature, signedTx } =
      sigma.sign(privateKey);

    console.log({ address, signature, signedTx });
    // console.log({ sigmaScript: sigmaScript.to_asm_string() });

    // Verify the signature
    const isValid = sigma.verify();

    // console.log("Signature is valid:", isValid);
    assert.strictEqual(isValid, true);
  });

  it("generates a correct output script", () => {
    // Create a new Sigma instance with the transaction and targetVout
    const sigma = new Sigma(tx, 0, 0);

    const out = sigma.transaction.get_output(0);

    const asm = out?.get_script_pub_key().to_asm_string();

    // Sign the message
    const { signedTx } = sigma.sign(privateKey);

    const asmAfter = signedTx
      .get_output(0)
      ?.get_script_pub_key()
      .to_asm_string();
    // console.log({ asmAfter });

    assert.notEqual(asmAfter, asm);
  });

  it("signed tx is verified", () => {
    // Create a new Sigma instance with the transaction and targetVout
    const sigma = new Sigma(tx, 0, 0);
    // console.log({ messageHash: sigma.getMessageHash().to_hex() });

    // ... Before signing

    // console.log({ inputHashBeforeSigning: sigma.getInputHash().to_hex() });
    // console.log({ dataHashBeforeSigning: sigma.getDataHash().to_hex() });

    // Sign the message
    const { signedTx } = sigma.sign(privateKey);

    // ... After signing
    // console.log({ inputHashAfterSigning: sigma.getInputHash().to_hex() });
    // console.log({ dataHashAfterSigning: sigma.getDataHash().to_hex() });

    const inputHash = sigma.getInputHash().to_hex();
    const dataHash = sigma.getDataHash().to_hex();
    const messageHash = sigma.getMessageHash().to_hex();

    const sigma2 = new Sigma(signedTx);

    //make sure these havent changed
    const inputHash2 = sigma2.getInputHash().to_hex();
    const dataHash2 = sigma2.getDataHash().to_hex();
    const messageHash2 = sigma2.getMessageHash().to_hex();

    assert.strictEqual(inputHash2, inputHash);
    assert.strictEqual(dataHash2, dataHash);
    assert.strictEqual(messageHash2, messageHash);

    assert.strictEqual(sigma2.getSigInstanceCount(), 1);

    const isValid2 = sigma2.verify();
    assert.strictEqual(isValid2, true);
  });

  it("replace a dummy signature with a real one", () => {
    // This is useful for calculating accurate fees considering the size of the
    // signature

    // Sign before adding inputs to create a dummy signature
    const sigma = new Sigma(tx, 0, 0);

    // Get the hashes before adding inputs
    const inputHash = sigma.getInputHash();
    const dataHash = sigma.getDataHash();

    // add some inputs
    const txIn = new TxIn(
      Buffer.from(
        "810755d937913d4228e1a4d192046d96c0642e2678d6a90e1cb794b0c2aeb78b",
        "hex"
      ),
      0,
      Script.from_asm_string(
        "OP_DUP OP_HASH160 5a009731beae590247297ecee0b1b54aa4b96c5d OP_EQUALVERIFY OP_CHECKSIG"
      )
    );
    tx.add_input(txIn);
    // input hash should change after adding inputs
    assert.notEqual(sigma.getInputHash(), inputHash);

    // sign again now that inputs have been added
    sigma.sign(privateKey);

    // data hash should change after replacing dummy signature
    assert.notEqual(sigma.getDataHash(), dataHash);

    assert.strictEqual(sigma.verify(), true);
  });

  it("specity an input to sign", () => {
    // This is useful for calculating accurate fees considering the size of the
    // signature

    // add some inputs
    const txIn = new TxIn(
      Buffer.from(
        "810755d937913d4228e1a4d192046d96c0642e2678d6a90e1cb794b0c2aeb78b",
        "hex"
      ),
      0,
      Script.from_asm_string(
        "OP_DUP OP_HASH160 5a009731beae590247297ecee0b1b54aa4b96c5d OP_EQUALVERIFY OP_CHECKSIG"
      )
    );
    const txIn2 = new TxIn(
      Buffer.from(
        "810755d937913d4228e1a4d192046d96c0642e2678d6a90e1cb794b0c2aeb78c",
        "hex"
      ),
      0,
      Script.from_asm_string(
        "OP_DUP OP_HASH160 5a009731beae590247297ecee0b1b54aa4b96c5c OP_EQUALVERIFY OP_CHECKSIG"
      )
    );
    tx.add_input(txIn);
    tx.add_input(txIn2);

    const sigma = new Sigma(tx, 0, 0, 1);

    // sign again now that inputs have been added
    sigma.sign(privateKey);

    assert.strictEqual(sigma.verify(), true);
  });

  it("create a user and platform signature on the same output", () => {
    // This is useful for calculating accurate fees
    // considering the size of the signature

    const sigma = new Sigma(tx, 0, 0);

    // sign the tx
    const { signedTx } = sigma.sign(privateKey);

    // verify the signature
    assert.strictEqual(sigma.verify(), true);

    // Create another signma instance on the same tx, and same output
    const sigma2 = new Sigma(signedTx, 0, 1);

    // add a second signature with a 2nd key
    sigma2.sign(privateKey2);

    assert.strictEqual(sigma2.verify(), true);

    assert.strictEqual(sigma2.getSigInstanceCount(), 2);

    // check the address for instance 1
    sigma2.setSigmaInstance(0);
    const address = sigma2.sig?.address;
    assert.strictEqual("1ACLHVPVnB8AmLCyD5hPQtPCSCccjiUn7H", address);

    // check the address for instance 2
    sigma2.setSigmaInstance(1);
    const address2 = sigma2.sig?.address;
    assert.strictEqual("1Cz3gyTgV7QgMoU6j51pvHdzeeapXfXDtA", address2);
  });

  it("validate sig from bundled 1sat lib", () => {
    const tx = Transaction.from_hex(
      "0100000001d70d11131d80dcee954926de96d793585c6bc0ed69619a6cc761a20cef1b1bd7010000006a4730440220466ca5d42bd7a8bd2b6ea5770970b03a0c39fa29847f31e0d949dd36bf523b910220379d1c2718ae3300e833201b227ed8159c93f85bcc6eaea4028dafed2559fee24121036232d22ae556320f5a6516e6e75eab89b33760ccf7b3eb5b791a23883da6b1f5ffffffff020100000000000000a776a914c8fcb96f2f16175d37d602c438eb2f64e59e217788ac0063036f7264510a746578742f706c61696e000774657374696e67686a055349474d410342534d22314535533931716e6f4743586d36314d5931617842435a436d4d50414d5a3675457a41206798f75d8b2bc6b6f2b536a9702dac3533528574d6f46acd8e2747ba63a0e70e146adba068c93e2979d010baf9aa47a1daf501381620adc59a09e10508aff46e013015e16005000000001976a9148d3164e5ed6f5ae76d7cb3860b31af4f369e775d88ac00000000"
    );
    const sigma = new Sigma(tx, 0, 0);
    const isValid = sigma.verify();
    assert.strictEqual(isValid, true);
  });

  it("signs a message correctly with remote signing", async () => {
    const outputScriptAsm = `OP_0 OP_RETURN ${Buffer.from(
      "pushdata1",
      "utf-8"
    ).toString("hex")} ${Buffer.from("pushdata2", "utf-8").toString("hex")}`;

    const script = Script.from_asm_string(outputScriptAsm);
    const tx = new Transaction(1, 0);
    const txOut = new TxOut(BigInt(0), script);
    tx.add_output(txOut);

    const sigma = new Sigma(tx, 0, 0);

    const mockAddress = "1ACLHVPVnB8AmLCyD5hPQtPCSCccjiUn7H";
    const mockMessage =
      "234900c2e071fe9a8cc2a41a6b40d03bb3dac1475162996500b77149ab66bfd4";
    const mockSignature =
      "HxKekpndJQqQDQVAgH/SaInseYRfqtjde0eWZm+fkWc5CRnZ7ey1zJc7dssNb4I+OwcJPfTQLvUHwCxevFRP4HE=";

    // Set up mock HTTP server
    nock("http://localhost:21000").post("/sign").reply(200, {
      address: mockAddress,
      sig: mockSignature,
      message: mockMessage,
      ts: Date.now(),
    });

    // Call remoteSign method
    const result = await sigma.remoteSign("http://localhost:21000", {
      key: "Authorization",
      value: "Bearer mockToken",
    } as AuthToken);

    console.log({ result });
    // Check the result
    assert.strictEqual(result.address, mockAddress);
    assert.strictEqual(result.signature, mockSignature);
    assert.strictEqual(sigma.verify(), true);
    assert.strictEqual(sigma.sig?.address, mockAddress);
    assert.strictEqual(sigma.sig?.signature, mockSignature);
  });
});
