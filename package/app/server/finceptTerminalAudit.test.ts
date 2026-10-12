import { describe, expect, it } from "vitest";
import {
  FINCEPT_TERMINAL_ARCHIVE_AUDIT,
  FINCEPT_TERMINAL_ARCHIVE_CATEGORIES,
  FINCEPT_TERMINAL_FRONTEND_SURFACES,
  assertFinceptTerminalAuditIntegrity,
} from "../shared/finceptTerminalAudit";
import { getFinceptTerminalStatus } from "./finceptTerminalAudit";

describe("FinceptTerminal archive audit", () => {
  it("keeps archive facts distinct from live runtime claims", () => {
    expect(assertFinceptTerminalAuditIntegrity()).toBe(true);
    expect(FINCEPT_TERMINAL_ARCHIVE_AUDIT.archiveEntryCount).toBe(3969);
    expect(FINCEPT_TERMINAL_ARCHIVE_AUDIT.pythonScriptCount).toBe(320);
    expect(FINCEPT_TERMINAL_ARCHIVE_AUDIT.pythonScriptTotalCount).toBe(1371);
    expect(FINCEPT_TERMINAL_ARCHIVE_AUDIT.qtScreenFileCount).toBe(850);
    expect(FINCEPT_TERMINAL_ARCHIVE_AUDIT.qtServiceFileCount).toBe(360);
    expect(FINCEPT_TERMINAL_FRONTEND_SURFACES.length).toBeGreaterThanOrEqual(20);
    expect(FINCEPT_TERMINAL_ARCHIVE_CATEGORIES.every(item => item.frontendPath.startsWith("/"))).toBe(true);
  });

  it("exposes one existing frontend owner per runtime capability", async () => {
    const status = await getFinceptTerminalStatus();
    expect(status.bindings).toHaveLength(10);
    expect(status.directBindingCount).toBe(2);
    expect(status.directDatasetCount).toBe(17);
    expect(status.bindings.find(binding => binding.id === "commodities")?.origin).toBe("mixed");
    expect(status.directDatasetChecks.find(item => item.id === "fincept-twse-equity-valuation")).toMatchObject({
      moduleId: "stock-eqs",
      dataContractId: "equity.twse.valuation.v1",
    });
    expect(status.existingPlatformBindingCount).toBe(6);
    expect(status.mixedBindingCount).toBe(2);
    expect(status.bindings.find(binding => binding.id === "equities")).toMatchObject({
      origin: "archive_direct",
    });
    expect(status.bindings.find(binding => binding.id === "macro")).toMatchObject({
      origin: "existing_platform",
    });
    expect(new Set(status.bindings.map(binding => binding.moduleId)).size).toBe(
      status.bindings.length
    );
    expect(status.bindings.find(binding => binding.id === "macro")).toMatchObject({
      moduleId: "economic-ecst",
      frontendPath: "/econ-hub?tab=ecst",
    });
    expect(status.bindings.find(binding => binding.id === "funds-etf")).toMatchObject({
      moduleId: "fund-browse",
      frontendPath: "/fund-browse",
    });
    expect(status.bindings.find(binding => binding.id === "futures")).toMatchObject({
      moduleId: "deri",
      frontendPath: "/deri",
    });
    expect(status.placeholderSlotCount).toBe(37);
    expect(status.replacedPlaceholderSlotCount).toBeGreaterThan(0);
    expect(status.placeholderBindings).toHaveLength(37);
    expect(new Set(status.placeholderBindings.map(binding => `${binding.category}|${binding.position}`)).size).toBe(37);
    expect(new Set(status.placeholderBindings.map(binding => `${binding.dataScopeKey}|${binding.viewKey}`)).size).toBe(37);
    expect(status.placeholderSlots.find(group => group.category === "衍生品")).toMatchObject({
      positions: [1, 4, 10, 11, 14, 15, 18, 22],
      status: "mapped",
    });
    expect(status.professionalApplications).toHaveLength(7);
    expect(status.professionalApplications.find(item => item.id === "portfolio-optimizer")).toMatchObject({
      frontendPath: "/portfolio-optimizer",
      liveData: false,
      apiOwner: "portfolio",
    });
    expect(status.professionalApplications.find(item => item.id === "industry-group")).toMatchObject({
      frontendPath: "/industry-group",
      liveData: false,
    });
  });
});
