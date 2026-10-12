import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const originals: Record<string, string> = {
  "client/src/components/LocalBondMenu.tsx":
    "7172f8bdea5c5c2370f237f970539f13f34ef455a5b96e8905b4ad2bbf7bcb2a",
  "client/src/components/MSRCPanel.tsx":
    "099a5d5db8f4ad97ed2c0b8db6704a3dfb58f5a0a6ca45bda37032907ff462af",
  "client/src/components/SMUNPanel.tsx":
    "7aeb79d10eb3fa157aee867344f5fbf51290b8dfd1e88865f175406b0067b7b7",
  "client/src/components/AAAPanel.tsx":
    "10b10485fc508ab03fabea5cffa371862ad5277912b07f5533b46dfe6becbfa0",
  "client/src/components/PICKPanel.tsx":
    "3194318f6daa065228016bde1c08efd97daabe048a68cf114e32589f494176a4",
  "client/src/components/MBWDPanel.tsx":
    "4835b3b787241effab840bdc65ae6c80c7a9af06a24e0f54f95eaf4819e1e0a1",
  "client/src/components/CDRNPanel.tsx":
    "4f5183e507479f59182ec35d218c69ae58992531ec3ea366ffba86e3e2b16f4d",
  "client/src/components/CDRCPanel.tsx":
    "9be6c67a972e4c43230cc7b8d6bd20221ec100e10c30e0c07f8471cffe3d5388",
  "client/src/components/CDRAPanel.tsx":
    "4f4bf95f83455ef726e6241917ea7f8125fb575e6554caecb3258782ebe3f79d",
  "client/src/components/CNDSPanel.tsx":
    "570a561862d4a291bdbbf1476e600b6f2fc4a680c9891c188e9099a148c29364",
  "client/src/components/CDRVPanel.tsx":
    "ca022ae52435cfccf0bc79fc1d4ce407829a01cb76bc81e588151bb18611f4d1",
  "client/src/components/DEALPanel.tsx":
    "a92adad120448a596d6edb541bdfac49aa0a914557ed7a3a2c2b20115e330457",
  "client/src/components/CACTPanel.tsx":
    "8f45133dbed00a3d649603402ad04c235e435058749d6a625e1650e597d3a1c0",
  "client/src/components/MCALPanel.tsx":
    "75483735a110b8c1a8e9f4c80a26432c6a133168f6248309629ff659b0b3f9c9",
  "client/src/components/MBIXPanel.tsx":
    "475d546521781802cbd7794b12dda75f0bbb8866c543fafdd1d1198d29978344",
  "client/src/components/VRDNPanel.tsx":
    "4f2ab89135020b14c395430c8a098696fb22ef06d1f18577322f8701d6f51ae5",
  "client/src/components/BMAPanel.tsx":
    "6309f1f6a76f600dcfbaf979cf06b140e5a56dd1b5e6f51417edfd7631266738",
  "client/src/components/BOOMPanel.tsx":
    "26bfc8222e977d472995f747cc1e21f6c4e772bc15050e3b71e06feb305b0ee0",
  "client/src/components/MSRBPanel.tsx":
    "24db72b96054391befa8d4a8a599ff8a7b88d0e2dc01541db1b33a8b27e5002a",
  "client/src/components/SLGSPanel.tsx":
    "38423217deb361c591e080a40057e3daca93556a6a5d3c642ec3da7f8e8123b1",
};

// MuniSecInfoPanel's fabricated dashboard was intentionally replaced. Its child
// navigation and manual analysis are covered by muniSecInfoRuntime.test.tsx.
describe("地方债未改动原内容 byte-for-byte 保护", () => {
  it("keeps the menu and the 19 other original local-bond panels unchanged", () => {
    for (const [relative, expectedHash] of Object.entries(originals)) {
      const bytes = fs.readFileSync(path.join(root, relative));
      expect(createHash("sha256").update(bytes).digest("hex"), relative).toBe(
        expectedHash
      );
    }
  });
});
