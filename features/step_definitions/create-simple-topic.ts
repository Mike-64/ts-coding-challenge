import { Given, Then, When } from "@cucumber/cucumber";
import {
  AccountBalanceQuery,
  AccountId,
  Client,
  KeyList,
  PrivateKey, PublicKey, RequestType,
  TopicCreateTransaction, TopicInfoQuery,
  TopicMessageQuery, TopicMessageSubmitTransaction
} from "@hashgraph/sdk";
import { accounts } from "../../src/config";
import assert from "node:assert";
import ConsensusSubmitMessage = RequestType.ConsensusSubmitMessage;

// Pre-configured client for test network (testnet)
const client = Client.forTestnet()

//Set the operator with the account ID and private key

Given(/^a first account with more than (\d+) hbars$/, async function (expectedBalance: number) {
  const acc = accounts[0]
  const account: AccountId = AccountId.fromString(acc.id);
  this.account = account
  const privKey: PrivateKey = PrivateKey.fromStringED25519(acc.privateKey);
  this.privKey = privKey
  client.setOperator(this.account, privKey);

//Create the query request
  const query = new AccountBalanceQuery().setAccountId(account);
  const balance = await query.execute(client)
  assert.ok(balance.hbars.toBigNumber().toNumber() > expectedBalance)
});

Given(/^A second account with more than (\d+) hbars$/, async function (expectedBalance: number) {
  const acc = accounts[0]
  const account: AccountId = AccountId.fromString(acc.id);
  this.account2 = account
  const privKey: PrivateKey = PrivateKey.fromStringED25519(acc.privateKey);
  this.privKey2 = privKey

//Create the query request
  const balance = await new AccountBalanceQuery().setAccountId(account).execute(client)
  assert.ok(balance.hbars.toBigNumber().toNumber() > expectedBalance)
});

Given(/^A (\d+) of (\d+) threshold key with the first and second account$/, async function (threshold: number, totalKeys: number) {
if (!this.privKey || !this.privKey2) throw new Error("missing private keys for threshold key creation");
  const pk1 = this.privKey.publicKey as PublicKey;
  const pk2 = this.privKey2.publicKey as PublicKey;

  // Build KeyList and set threshold if supported by SDK
  const publicKeyList = [pk1, pk2];

  const thresholdKey =  new KeyList(publicKeyList,1); 
  const keyList = KeyList.from(publicKeyList);
  this.keyList = keyList;
  this.thresholdKey = thresholdKey;
  console.log(`Built threshold key: threshold=${thresholdKey.threshold}, keys=${thresholdKey._keys.length}`);
});

When(/^A topic is created with the memo "([^"]*)" with the first account as the submit key$/, async function (memo: string) {
if (!this.privKey) throw new Error("first account private key not set");
const submitKey = this.privKey.publicKey as PublicKey;
const transaction = new TopicCreateTransaction()
    .setTopicMemo(memo)
    .setSubmitKey(submitKey)
const txResponse = await transaction.execute(client);
const receipt = await txResponse.getReceipt(client);
const topicId = receipt.topicId;
this.topicId = topicId;
if (topicId) {
  console.log(`Created topic with ID: ${topicId.toString()}`);
} else {
  throw new Error("Failed to create topic: topicId is null");
}
});

When(/^The message "([^"]*)" is published to the topic$/, async function (message: string) {
if (!this.topicId) throw new Error("topicId not set");
  // Build the submit transaction
  let tx = await new TopicMessageSubmitTransaction({
    topicId: this.topicId,
    message:message,
  })
    .freezeWith(client)
    .sign(this.privKey!); // Sign with the first account's private key
  // Execute the transaction
  const ConsensusSubmitMessage = await tx.execute(client);
  const receipt = await ConsensusSubmitMessage.getReceipt(client);
  // Get the status of the transaction
  const transactionStatus = receipt.status;
  console.log("The message transaction status " + transactionStatus.toString());
  console.log(`Submitted message to topic ${this.topicId.toString()}`);
});

Then(/^The message "([^"]*)" is received by the topic and can be printed to the console$/, async function (expectedMessage: string) {
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // subscribe
  new TopicMessageQuery()
    .setTopicId(this.topicId!)
    .subscribe(client, null, (message) => {
      const messageAsString = Buffer.from(message.contents).toString("utf8");
      console.log(
        `${message.consensusTimestamp.toDate()} Received: ${messageAsString}`
      );
    });
});

When(/^A topic is created with the memo "([^"]*)" with the threshold key as the submit key$/, async function (memo: string) {
if (!this.privKey) throw new Error("first account private key not set");
const submitKey = this.thresholdKey.publicKey as PublicKey;
const transaction = new TopicCreateTransaction()
    .setTopicMemo(memo)
    .setSubmitKey(submitKey)
const txResponse = await transaction.execute(client);
const receipt = await txResponse.getReceipt(client);
const topicId = receipt.topicId;
this.topicId = topicId;
if (topicId) {
  console.log(`Created topic with ID: ${topicId.toString()}`);
} else {
  throw new Error("Failed to create topic: topicId is null");
}
});
