import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AccountReceipt } from "../../src/contracts/accountCommands.ts";
import type { PersonalView } from "../../server/personal/repository.ts";
import { AuthBrowser, type authHarness } from "./auth.ts";

export class PersonalClient {
  readonly browser: AuthBrowser;
  revision = 0;
  owner = "";
  email = "";
  constructor(harness: Awaited<ReturnType<typeof authHarness>>) { this.browser = new AuthBrowser(harness); }
  async login() { const result = await this.browser.login(); this.owner = result.session.json().account.id; this.email = result.email; return result.email; }
  async read(): Promise<PersonalView> {
    const response = await this.browser.request("personal"); assert.equal(response.statusCode, 200, "personal_read_status");
    const view = response.json<PersonalView>(); this.revision = view.revision; return view;
  }
  async command(command: object, baseRevision = this.revision, operationId = randomUUID()): Promise<AccountReceipt> {
    const response = await this.browser.request("personal/commands", { protocolVersion: 1, operationId, baseRevision, command });
    assert.equal(response.statusCode, 200, `personal_command_status:${response.json().error?.code ?? "ok"}`);
    const receipt = response.json<AccountReceipt>(); this.revision = receipt.operationRevision; return receipt;
  }
  async initialize() { await this.login(); await this.command({ kind: "account.initialize", name: "Synthetic account", timezone: "UTC", language: "en" }); }
}
