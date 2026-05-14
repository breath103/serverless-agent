import { describe, it } from "node:test";

// TODO: test script needs env vars + a running local DynamoDB to wire end-to-end.

describe("agent registration", () => {
  it.todo("POST /api/agents requires auth");
  it.todo("POST /api/agents/exchange-otp rejects invalid OTP");
  it.todo("full flow: create agent → exchange OTP → use token");
  it.todo("deleted agent token stops working");
});
