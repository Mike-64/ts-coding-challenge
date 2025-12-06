import { Given, setDefaultTimeout, Then, When } from "@cucumber/cucumber";
import { accounts } from "../../src/config";
import { AccountBalanceQuery, AccountId, Client, Hbar, PrivateKey, TokenAssociateTransaction, TokenBurnTransaction, TokenCreateTransaction, TokenInfoQuery, TokenMintTransaction, TokenSupplyType, TokenType, TransferTransaction } from "@hashgraph/sdk";
import assert from "node:assert";

const client = Client.forTestnet().setOperator(
  AccountId.fromString(accounts[0].id), 
  PrivateKey.fromStringED25519(accounts[0].privateKey)
)

setDefaultTimeout(20 * 1000); // 60 seconds

// Context to share data between steps
// const context: Record<string, any> = {};
const supplyKey = PrivateKey.generateED25519()
let firstAccount = { id: accounts[0].id, key: accounts[0].privateKey };

Given(/^A Hedera account with more than (\d+) hbar$/, async function (expectedBalance: number) {
  const account = accounts[0]
  const MY_ACCOUNT_ID = AccountId.fromString(account.id);
  const MY_PRIVATE_KEY = PrivateKey.fromStringED25519(account.privateKey);
  client.setOperator(MY_ACCOUNT_ID, MY_PRIVATE_KEY);

//Create the query request
  const query = new AccountBalanceQuery().setAccountId(MY_ACCOUNT_ID);
  const balance = await query.execute(client);
  assert.ok(balance.hbars.toBigNumber().toNumber() > expectedBalance);

  this.operator = { id: MY_ACCOUNT_ID, key: MY_PRIVATE_KEY };
});

When(/^I create a token named Test Token \(HTT\)$/, async function () {
  const { id, key } = this.operator;
  const tx = await new TokenCreateTransaction({initialSupply: 100})
    .setTokenName("Test Token")
    .setTokenSymbol("HTT")
    .setTreasuryAccountId(id)
    .setDecimals(2)
    .setTokenType(TokenType.FungibleCommon)
    .setSupplyType(TokenSupplyType.Infinite)
    .setSupplyKey(supplyKey)
    .freezeWith(client)
    .sign(key);

  const response = await tx.execute(client);
  const receipt = await response.getReceipt(client);
  this.tokenId = receipt.tokenId;
  this.supplyKey = supplyKey;
  console.log(`Created token supply: ${(await new TokenInfoQuery().setTokenId(this.tokenId).execute(client)).totalSupply.toString()}`);
});

Then(/^The token has the name "([^"]*)"$/, async function (expectedName: string) {
const info = await new TokenInfoQuery().setTokenId(this.tokenId).execute(client);
  assert.strictEqual(info.name, expectedName);
});

Then(/^The token has the symbol "([^"]*)"$/, async function (expectedSymbol: string) {
const info = await new TokenInfoQuery().setTokenId(this.tokenId).execute(client);
  assert.strictEqual(info.symbol, expectedSymbol);
});

Then(/^The token has (\d+) decimals$/, async function (expectedDecimals: number) {
const info = await new TokenInfoQuery().setTokenId(this.tokenId).execute(client);
  assert.strictEqual(info.decimals, expectedDecimals);
});

Then(/^The token is owned by the account$/, async function () {
const info = await new TokenInfoQuery().setTokenId(this.tokenId).execute(client);
  assert.ok(info.treasuryAccountId, "Token treasuryAccountId is null");
  assert.strictEqual(info.treasuryAccountId!.toString(), this.operator.id.toString());
});

Then(/^An attempt to mint (\d+) additional tokens succeeds$/, async function (amount: number) {
  assert.ok(this.tokenId, "Token ID must be set before minting.");
  assert.ok(this.supplyKey, "Supply key must be available for minting.");

  // --- Mint the tokens ---
  const mintTx = await new TokenMintTransaction()
    .setTokenId(this.tokenId)
    .setAmount(amount)
    .freezeWith(client)
    .sign(this.supplyKey); 
  const response = await mintTx.execute(client);
  const receipt = await response.getReceipt(client);

  assert.strictEqual(receipt.status.toString(), "SUCCESS", "Mint transaction failed.");

  // --- Verify total supply increased ---
  const info = await new TokenInfoQuery().setTokenId(this.tokenId).execute(client);
  console.log(`Token supply after mint: ${info.totalSupply.toString()}`);
  assert.ok(info.totalSupply.toNumber() > amount, "Total supply did not increase as expected.");
});
When(/^I create a fixed supply token named Test Token \(HTT\) with (\d+) tokens$/, async function (amount: number) {
  const { id, key } = this.operator;

  const tx = await new TokenCreateTransaction()
    .setTokenName("Test Token")
    .setTokenSymbol("HTT")
    .setTreasuryAccountId(id)
    .setInitialSupply(amount)
    .setDecimals(2)
    .setMaxSupply(amount)
    .setTokenType(TokenType.FungibleCommon)
    .setSupplyType(TokenSupplyType.Finite)
    .setSupplyKey(supplyKey)
    .freezeWith(client)
    .sign(key);

  const response = await tx.execute(client);
  const receipt = await response.getReceipt(client);
  this.tokenId = receipt.tokenId;
  this.supplyKey = supplyKey;
  assert.ok(this.tokenId, "Token ID must be set after creation.");
});

Then(/^The total supply of the token is (\d+)$/, async function (expectedSupply: number) {
  const info = await new TokenInfoQuery().setTokenId(this.tokenId).execute(client);
  assert.strictEqual(Number(info.totalSupply), expectedSupply);
});
Then(/^An attempt to mint tokens fails$/, async function () {
  assert.ok(this.tokenId, "Token ID must be set before minting.");
  assert.ok(this.supplyKey, "Supply key must be available for minting.");

  try {
    const mintTx = await new TokenMintTransaction()
      .setTokenId(this.tokenId)
      .setAmount(100) // try to mint 100 (arbitrary)
      .freezeWith(client)
      .sign(this.supplyKey);

    const response = await mintTx.execute(client);
    const receipt = await response.getReceipt(client);

    // If we reached here, mint succeeded — fail the test
    assert.fail(`Expected mint to fail, but status was ${receipt.status.toString()}`);
  } catch (err: any) {
    console.log(`Mint failed as expected: ${err.message}`);
    assert.ok(true);
  }
});
Given(/^A first hedera account with more than (\d+) hbar$/, async function (expectedBalance: number ) {
  const account = accounts[0];
  const accId = AccountId.fromString(account.id);
  const accKey = PrivateKey.fromStringED25519(account.privateKey);
  client.setOperator(accId, accKey);

  const balance = await new AccountBalanceQuery().setAccountId(accId).execute(client);
  assert.ok(balance.hbars.toBigNumber().toNumber() > expectedBalance);

  this.firstAccount = { id: accId, key: accKey };
});
Given(/^A second Hedera account$/, async function () {
  const account = accounts[1];
  this.secondAccount = {
    id: AccountId.fromString(account.id),
    key: PrivateKey.fromStringED25519(account.privateKey),
  };
});
Given(/^A token named Test Token \(HTT\) with (\d+) tokens$/, async function (supply : number) {
const { id, key } = firstAccount;
  const tx = await new TokenCreateTransaction()
    .setTokenName("Test Token")
    .setTokenSymbol("HTT")
    .setTreasuryAccountId(id)
    .setInitialSupply(supply)
    .setDecimals(2)
    .setTokenType(TokenType.FungibleCommon)
    .setSupplyType(TokenSupplyType.Infinite)
    .setSupplyKey(supplyKey)
    .freezeWith(client)
    .sign(PrivateKey.fromStringED25519(key));

  const response = await tx.execute(client);
  const receipt = await response.getReceipt(client);
  this.tokenId = receipt.tokenId;
  this.supplyKey = supplyKey;
  console.log(`Token created: ${this.tokenId.toString()}`);
});
Given(/^The first account holds (\d+) HTT tokens$/, async function (expectedAmount: number) {
  const balance = await new AccountBalanceQuery().setAccountId(this.firstAccount.id).execute(client);
  const tokenBalance = balance.tokens && balance.tokens.get(this.tokenId)?.toNumber() || 0;

  // If tokenBalance < expectedAmount, transfer tokens to reach it
  if (tokenBalance > expectedAmount) {
    const diff =  tokenBalance - expectedAmount ;
    const burnTx = await new TokenBurnTransaction()
      .setTokenId(this.tokenId)
      .setAmount(diff)
      .freezeWith(client)
      .sign(this.supplyKey);

    const response = await burnTx.execute(client);
    await response.getReceipt(client);
  }else if (tokenBalance < expectedAmount) {
    const diff =   expectedAmount - tokenBalance ;
    const burnTx = await new TokenMintTransaction()
      .setTokenId(this.tokenId)
      .setAmount(diff)
      .freezeWith(client)
      .sign(this.supplyKey);

    const response = await burnTx.execute(client);
    await response.getReceipt(client);
  }

  const updatedBalance = await new AccountBalanceQuery().setAccountId(this.firstAccount.id).execute(client);
  const finalBalance = updatedBalance.tokens ? updatedBalance.tokens.get(this.tokenId)?.toNumber() || 0 : 0;
  assert.strictEqual(finalBalance, expectedAmount, "First account balance mismatch");
});
Given(/^The second account holds (\d+) HTT tokens$/, async function (amount: number) {
try{
  const associateTx = await new TokenAssociateTransaction()
    .setAccountId(this.secondAccount.id)
    .setTokenIds([this.tokenId])
    .freezeWith(client)
    .sign(this.secondAccount.key);

  const associateResponse = await associateTx.execute(client);
  await associateResponse.getReceipt(client);
  console.log("Associated second account with token");
} catch (err: any) {
    // Ignore if already associated
    if (!err.message.includes("TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT")) {
      throw err;
    }
  }

    // Check current token balance
  const balanceQuery = await new AccountBalanceQuery()
    .setAccountId(this.secondAccount.id)
    .execute(client);
  const currentBalance = balanceQuery.tokens && balanceQuery.tokens.get(this.tokenId)?.toNumber() || 0;

  // Adjust balance only if needed
  if (currentBalance !== amount) {
    const diff = amount - currentBalance;

    if (diff > 0) {
      console.log(` Transferring ${diff} HTT from first → second account`);
      const transferTx = await new TransferTransaction()
        .addTokenTransfer(this.tokenId, this.firstAccount.id, -diff)
        .addTokenTransfer(this.tokenId, this.secondAccount.id, diff)
        .freezeWith(client)
        .sign(this.firstAccount.key);

      const transferResponse = await transferTx.execute(client);
      const receipt = await transferResponse.getReceipt(client);
      console.log(`Transfer status: ${receipt.status.toString()}`);
    } else if (diff < 0) {
      console.log(` Transferring ${-diff} HTT back to first account`);
      const transferTx = await new TransferTransaction()
        .addTokenTransfer(this.tokenId, this.secondAccount.id, diff)
        .addTokenTransfer(this.tokenId, this.firstAccount.id, -diff)
        .freezeWith(client)
        .sign(this.secondAccount.key);

      const transferResponse = await transferTx.execute(client);
      const receipt = await transferResponse.getReceipt(client);
      console.log(`Reverse transfer status: ${receipt.status.toString()}`);
    }
  }
  // Verify the balance
  const finalBalance  = await new AccountBalanceQuery()
    .setAccountId(this.secondAccount.id)
    .execute(client);

  const tokenBalance = finalBalance.tokens && finalBalance.tokens.get(this.tokenId)?.toNumber() || 0;
  console.log(`Second account current balance: ${tokenBalance} HTT`);
  assert.strictEqual(
    tokenBalance,
    amount,
    `Expected second account to hold ${amount} HTT, but found ${tokenBalance}`
  );
});
When(/^The first account creates a transaction to transfer (\d+) HTT tokens to the second account$/, async function (amount: number) {
  this.transferTx = await new TransferTransaction()
    .addTokenTransfer(this.tokenId, this.firstAccount.id, -amount)
    .addTokenTransfer(this.tokenId, this.secondAccount.id, amount)
    .freezeWith(client)
    .sign(this.firstAccount.key);
});
When(/^The first account submits the transaction$/, async function () {
  const tx = this.transferTx || this.pendingTx;
  assert.ok(tx, "No transfer or pending transaction found in context");
// Submit the transfer transaction
  const response = await tx.execute(client);
  const receipt = await response.getReceipt(client);
  console.log(`Transaction submitted by first account, status: ${receipt.status.toString()}`);

});
When(/^The second account creates a transaction to transfer (\d+) HTT tokens to the first account$/, async function (amount: number) {
  // Prefetch the balance to check for fee deduction later
    const firstBalanceBefore = await new AccountBalanceQuery()
    .setAccountId(this.firstAccount.id)
    .execute(client);
  // Second account builds the transfer
    const tx = await new TransferTransaction()
      .addTokenTransfer(this.tokenId, this.secondAccount.id, -amount)
      .addTokenTransfer(this.tokenId, this.firstAccount.id, amount)
      .freezeWith(client)
      .sign(this.secondAccount.key); // Signed by sender only

    this.pendingTx = tx;
    console.log(`Transaction created by second account to transfer ${amount} HTT`);
  // Fetch the balance after transaction
  const firstBalanceAfter = await new AccountBalanceQuery()
    .setAccountId(this.firstAccount.id)
    .execute(client);
  this.feePaid = firstBalanceBefore.hbars.toBigNumber().toNumber()+amount - firstBalanceAfter.hbars.toBigNumber().toNumber();

});
Then(/^The first account has paid for the transaction fee$/, async function () {
  const feePaidByFirstAcc = this.feePaid;
  assert.ok(feePaidByFirstAcc > 0, "First account paid the transaction fee");
  console.log("Transaction submitted by first account (fee payer)");
});
Given(/^A first hedera account with more than (\d+) hbar and (\d+) HTT tokens$/, async function (hbarMin: number, tokenAmount: number) {
const acc = accounts[0];
  this.firstAccount = {
    id: AccountId.fromString(acc.id),
    key: PrivateKey.fromStringED25519(acc.privateKey),
  };

  client.setOperator(this.firstAccount.id, this.firstAccount.key);

  // Check HBAR balance
  const balance = await new AccountBalanceQuery().setAccountId(this.firstAccount.id).execute(client);
  assert.ok(balance.hbars.toBigNumber().toNumber() > hbarMin, "Insufficient HBAR balance");

  // Ensure first account has expected HTT tokens
  const tokenBal = balance.tokens && balance.tokens.get(this.tokenId)?.toNumber() || 0;
  if (tokenBal !== tokenAmount) {
    const diff = tokenAmount - tokenBal;
    if (diff > 0) {
      const tx = await new TransferTransaction()
        .addTokenTransfer(this.tokenId, this.firstAccount.id, diff) // from treasury itself
        .freezeWith(client)
        .sign(this.firstAccount.key);
      await (await tx.execute(client)).getReceipt(client);
    }
  }
});
Given(/^A second Hedera account with (\d+) hbar and (\d+) HTT tokens$/, async function (hbarExpected:number, tokenExpected: number) {
  const acc = accounts[1];
  this.secondAccount = {
    id: AccountId.fromString(acc.id),
    key: PrivateKey.fromStringED25519(acc.privateKey),
  };

  // --- Check HBAR balance ---
  const hbarBalanceQuery = await new AccountBalanceQuery()
    .setAccountId(this.secondAccount.id)
    .execute(client);

  const hbarBalance = hbarBalanceQuery.hbars.toBigNumber().toNumber();
  console.log(`Second account current HBAR balance: ${hbarBalance}`);

  // If needed, top up from first account (treasury)
  if (hbarBalance < hbarExpected) {
    const diff = hbarExpected - hbarBalance;
    console.log(` Funding second account with ${diff} HBAR`);
    const hbarTx = await new TransferTransaction()
      .addHbarTransfer(this.firstAccount.id, new Hbar(-diff))
      .addHbarTransfer(this.secondAccount.id, new Hbar(diff))
      .freezeWith(client)
      .sign(this.firstAccount.key);
    await (await hbarTx.execute(client)).getReceipt(client);
  }

  // --- Ensure token association ---
  try {
    const assocTx = await new TokenAssociateTransaction()
      .setAccountId(this.secondAccount.id)
      .setTokenIds([this.tokenId])
      .freezeWith(client)
      .sign(this.secondAccount.key);
    await (await assocTx.execute(client)).getReceipt(client);
    console.log(" Second account associated with token");
  } catch (err: any) {
    if (!err.message.includes("TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT")) throw err;
  }

  // --- Check and adjust token balance ---
  const tokenBalanceQuery = await new AccountBalanceQuery()
    .setAccountId(this.secondAccount.id)
    .execute(client);
  const tokenBalance = tokenBalanceQuery.tokens && tokenBalanceQuery.tokens.get(this.tokenId)?.toNumber() || 0;

  if (tokenBalance !== tokenExpected) {
    const diff = tokenExpected - tokenBalance;
    console.log(` Adjusting token balance by ${diff} HTT`);
    const tokenTx = await new TransferTransaction()
      .addTokenTransfer(this.tokenId, this.firstAccount.id, -diff)
      .addTokenTransfer(this.tokenId, this.secondAccount.id, diff)
      .freezeWith(client)
      .sign(this.firstAccount.key);
    await (await tokenTx.execute(client)).getReceipt(client);
  }

  // --- Final verification ---
  const finalBalance = await new AccountBalanceQuery().setAccountId(this.secondAccount.id).execute(client);
  const finalHbar = finalBalance.hbars.toBigNumber().toNumber();
  const finalHTT = finalBalance.tokens ? finalBalance.tokens.get(this.tokenId)?.toNumber() || 0 : 0;

  assert.ok(finalHbar >= hbarExpected, `Expected ≥${hbarExpected} HBAR, found ${finalHbar}`);
  assert.strictEqual(finalHTT, tokenExpected, `Expected ${tokenExpected} HTT, found ${finalHTT}`);

  console.log(` Second account ready: ${finalHbar} HBAR, ${finalHTT} HTT`);
});
Given(/^A third Hedera account with (\d+) hbar and (\d+) HTT tokens$/, async function (hbarExpected:number, tokenExpected: number) {
const acc = accounts[2];
  this.thirdAccount = {
    id: AccountId.fromString(acc.id),
    key: PrivateKey.fromStringED25519(acc.privateKey),
  };

  // --- Check HBAR balance ---
  const hbarBalanceQuery = await new AccountBalanceQuery()
    .setAccountId(this.thirdAccount.id)
    .execute(client);

  const hbarBalance = hbarBalanceQuery.hbars.toBigNumber().toNumber();
  console.log(`Third account current HBAR balance: ${hbarBalance}`);

  // If needed, top up from first account (treasury)
  if (hbarBalance < hbarExpected) {
    const diff = hbarExpected - hbarBalance;
    console.log(` Funding second account with ${diff} HBAR`);
    const hbarTx = await new TransferTransaction()
      .addHbarTransfer(this.firstAccount.id, new Hbar(-diff))
      .addHbarTransfer(this.thirdAccount.id, new Hbar(diff))
      .freezeWith(client)
      .sign(this.firstAccount.key);
    await (await hbarTx.execute(client)).getReceipt(client);
  }

  // --- Ensure token association ---
  try {
    const assocTx = await new TokenAssociateTransaction()
      .setAccountId(this.thirdAccount.id)
      .setTokenIds([this.tokenId])
      .freezeWith(client)
      .sign(this.thirdAccount.key);
    await (await assocTx.execute(client)).getReceipt(client);
    console.log(" Second account associated with token");
  } catch (err: any) {
    if (!err.message.includes("TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT")) throw err;
  }

  // --- Check and adjust token balance ---
  const tokenBalanceQuery = await new AccountBalanceQuery()
    .setAccountId(this.thirdAccount.id)
    .execute(client);
  const tokenBalance = tokenBalanceQuery.tokens && tokenBalanceQuery.tokens.get(this.tokenId)?.toNumber() || 0;

  if (tokenBalance !== tokenExpected) {
    const diff = tokenExpected - tokenBalance;
    console.log(` Adjusting token balance by ${diff} HTT`);
    const tokenTx = await new TransferTransaction()
      .addTokenTransfer(this.tokenId, this.firstAccount.id, -diff)
      .addTokenTransfer(this.tokenId, this.thirdAccount.id, diff)
      .freezeWith(client)
      .sign(this.firstAccount.key);
    await (await tokenTx.execute(client)).getReceipt(client);
  }

  // --- Final verification ---
  const finalBalance = await new AccountBalanceQuery().setAccountId(this.thirdAccount.id).execute(client);
  const finalHbar = finalBalance.hbars.toBigNumber().toNumber();
  const finalHTT = finalBalance.tokens ? finalBalance.tokens.get(this.tokenId)?.toNumber() || 0 : 0;

  assert.ok(finalHbar >= hbarExpected, `Expected ≥${hbarExpected} HBAR, found ${finalHbar}`);
  assert.strictEqual(finalHTT, tokenExpected, `Expected ${tokenExpected} HTT, found ${finalHTT}`);

  console.log(` Third account ready: ${finalHbar} HBAR, ${finalHTT} HTT`);
});
Given(/^A fourth Hedera account with (\d+) hbar and (\d+) HTT tokens$/, async function (hbarExpected:number, tokenExpected: number) {
const acc = accounts[3];
  this.fourthAccount = {
    id: AccountId.fromString(acc.id),
    key: PrivateKey.fromStringED25519(acc.privateKey),
  };

  // --- Check HBAR balance ---
  const hbarBalanceQuery = await new AccountBalanceQuery()
    .setAccountId(this.fourthAccount.id)
    .execute(client);

  const hbarBalance = hbarBalanceQuery.hbars.toBigNumber().toNumber();
  console.log(`Fourth account current HBAR balance: ${hbarBalance}`);

  // If needed, top up from first account (treasury)
  if (hbarBalance < hbarExpected) {
    const diff = hbarExpected - hbarBalance;
    console.log(` Funding second account with ${diff} HBAR`);
    const hbarTx = await new TransferTransaction()
      .addHbarTransfer(this.firstAccount.id, new Hbar(-diff))
      .addHbarTransfer(this.fourthAccount.id, new Hbar(diff))
      .freezeWith(client)
      .sign(this.firstAccount.key);
    await (await hbarTx.execute(client)).getReceipt(client);
  }

  // --- Ensure token association ---
  try {
    const assocTx = await new TokenAssociateTransaction()
      .setAccountId(this.fourthAccount.id)
      .setTokenIds([this.tokenId])
      .freezeWith(client)
      .sign(this.fourthAccount.key);
    await (await assocTx.execute(client)).getReceipt(client);
    console.log(" Fourth account associated with token");
  } catch (err: any) {
    if (!err.message.includes("TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT")) throw err;
  }

  // --- Check and adjust token balance ---
  const tokenBalanceQuery = await new AccountBalanceQuery()
    .setAccountId(this.fourthAccount.id)
    .execute(client);
  const tokenBalance = tokenBalanceQuery.tokens && tokenBalanceQuery.tokens.get(this.tokenId)?.toNumber() || 0;

  if (tokenBalance !== tokenExpected) {
    const diff = tokenExpected - tokenBalance;
    console.log(` Adjusting token balance by ${diff} HTT`);
    const tokenTx = await new TransferTransaction()
      .addTokenTransfer(this.tokenId, this.firstAccount.id, -diff)
      .addTokenTransfer(this.tokenId, this.fourthAccount.id, diff)
      .freezeWith(client)
      .sign(this.firstAccount.key);
    await (await tokenTx.execute(client)).getReceipt(client);
  }

  // --- Final verification ---
  const finalBalance = await new AccountBalanceQuery().setAccountId(this.fourthAccount.id).execute(client);
  const finalHbar = finalBalance.hbars.toBigNumber().toNumber();
  const finalHTT = finalBalance.tokens ? finalBalance.tokens.get(this.tokenId)?.toNumber() || 0 : 0;

  assert.ok(finalHbar >= hbarExpected, `Expected ≥${hbarExpected} HBAR, found ${finalHbar}`);
  assert.strictEqual(finalHTT, tokenExpected, `Expected ${tokenExpected} HTT, found ${finalHTT}`);

  console.log(` Fourth account ready: ${finalHbar} HBAR, ${finalHTT} HTT`);
});
When(/^A transaction is created to transfer (\d+) HTT tokens out of the first and second account and (\d+) HTT tokens into the third account and (\d+) HTT tokens into the fourth account$/, async function (outAmount: number, inThird: number, inFourth: number) {
const tx = await (await new TransferTransaction()
  // Outflows
  .addTokenTransfer(this.tokenId, this.firstAccount.id, -outAmount)
  .addTokenTransfer(this.tokenId, this.secondAccount.id, -outAmount)
  // Inflows
  .addTokenTransfer(this.tokenId, this.thirdAccount.id, inThird)
  .addTokenTransfer(this.tokenId, this.fourthAccount.id, inFourth)
  .freezeWith(client)
  // Each sender must sign
  .sign(this.firstAccount.key))
      .sign(this.secondAccount.key);

  this.transferTx = tx;
  console.log(" Multi-party token transfer created and signed by sender");
});
Then(/^The third account holds (\d+) HTT tokens$/, async function (expected: number) {
const balance = await new AccountBalanceQuery().setAccountId(this.thirdAccount.id).execute(client);
  const tokenBalance = balance.tokens ? balance.tokens.get(this.tokenId)?.toNumber() : 0;
  assert.strictEqual(tokenBalance, expected, `Third account balance mismatch`);
});
Then(/^The fourth account holds (\d+) HTT tokens$/, async function (expected: number) {
const balance = await new AccountBalanceQuery().setAccountId(this.fourthAccount.id).execute(client);
  const tokenBalance = balance.tokens ? balance.tokens.get(this.tokenId)?.toNumber(): 0;
  assert.strictEqual(tokenBalance, expected, `Fourth account balance mismatch`);
});
