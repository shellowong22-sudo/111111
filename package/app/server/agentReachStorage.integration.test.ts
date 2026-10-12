import { describe, expect, it } from "vitest";
import { browseAgentReachKnowledge, getAgentReachKnowledgeDetail, getTerminalStorageInventory } from "./agentReachStorage";

describe.skipIf(process.env.RUN_AGENT_REACH_DB_INTEGRATION !== "1")("Administrator database inventory (read only)", () => {
  it("counts canonical cleaned records without summing raw + processed copies", async () => {
    const inventory = await getTerminalStorageInventory();
    expect(inventory.tableCount).toBeGreaterThan(0);
    expect(inventory.schemaName).toBeTruthy();
    expect(inventory.exactStructuredDocuments).toBeGreaterThanOrEqual(inventory.exactAgentReachDocuments);
    expect(inventory.tables.some(table => table.tableName === "finance_world_dataset")).toBe(true);
    expect(inventory.allocatedBytes).toBeGreaterThanOrEqual(0);
    const page = await browseAgentReachKnowledge({
      page: 1, pageSize: 2, query: "", source: "all", approval: "all",
    });
    expect(page.items.length).toBeLessThanOrEqual(2);
    expect(page.total).toBe(inventory.exactAgentReachDocuments);
    if (page.items.length) {
      const detail = await getAgentReachKnowledgeDetail(page.items[0].id);
      expect(detail?.id).toBe(page.items[0].id);
      expect(detail?.cleanedContent).toBeDefined();
      expect(detail?.transformationSteps).toBeDefined();
    }
  }, 30_000);
});
