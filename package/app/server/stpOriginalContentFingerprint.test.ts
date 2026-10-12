import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const expected: Record<string, string> = {
  'client/src/pages/STPProcessing.tsx': 'f911220c5d18a76f5f39307eb7de6c5570da0450ddb0aab176196819731778e0',
  'client/src/components/stp/AlexPanel.tsx': '7eecb3a834d4fee613d23a1e4a660c9954e7f9d0156958a7b0e6696ef8867a71',
  'client/src/components/stp/AlobPanel.tsx': 'a493c1ad73609e78d728c2c0b36d7cd840ff3df31ccf316f28a34916da3fb238',
  'client/src/components/stp/AlosPanel.tsx': 'b59ddd56b31b2adead3e18b8f39b394f46a0586864d5832cd3630f48eb7cb230',
  'client/src/components/stp/BlotPanel.tsx': '5fed735415f3eb755fd6694921a255f6ad8f0e3eaf306f6cf97dce8ad4be372d',
  'client/src/components/stp/BrrsPanel.tsx': 'e4212c643a0a52d87658f2064cbaea45e44584a182bbb0db7d6bf3b55c6b482c',
  'client/src/components/stp/DtcpPanel.tsx': '7cf122a5f0b839a5974f0112cc723233bd013d3c81372da47402440136007db4',
  'client/src/components/stp/EstpPanel.tsx': 'a218922be63620ce817440e708f88c6e5f1404af0636a287fcfcefe96be3cc80',
  'client/src/components/stp/FstnPanel.tsx': 'e5fc0a9e3db9b5e0ffe3df3a48576f5e9df475a119a996ef24ce5514f84865b6',
  'client/src/components/stp/FxssPanel.tsx': '649856703a4c204234473f96f88c751d8ea0755320ef779f6dee115ac8f47789',
  'client/src/components/stp/FxtbPanel.tsx': '2f3c405e1ae672f3e01f5e87b2e6d7758e905f3066921abca16c02c14913c8c5',
  'client/src/components/stp/IbPanel.tsx': '6ec432a9ec4e0ba76b697fb6ab1ef5cbd4e8bfc417692f8a6a2a2c58b925b9d6',
  'client/src/components/stp/MifiPanel.tsx': 'f634e5903ce4717fa19025b05b972c25c05c33f2058828dcf5f2f04a835af3ce',
  'client/src/components/stp/PostPanel.tsx': '5a3619979f8efa9d25302579cbe491650746062b5dad3cacab301f230eca63e2',
  'client/src/components/stp/ResdPanel.tsx': '4dab16ba17b78be6d3d58d8e8404851132b2199615adc5a2a01a949663c6a47a',
  'client/src/components/stp/RhabPanel.tsx': 'd3689422a4acd0c66633d1f495ebc71f49851335d0075ce1af074c277591d5b7',
  'client/src/components/stp/RhadPanel.tsx': 'ea2519e53180b46b70029f7957d5e70f324d80a166940232982cbee90ad9eaf6',
  'client/src/components/stp/RhubPanel.tsx': '0b2ae86e0e3c0924c1e259f75f2ca0893765fb8dfd47944d806b5ef21becbcff',
  'client/src/components/stp/RhudPanel.tsx': '4e75fc8e0aefb24ee62842aaeace6caf00beff2abf9c4e7533f7560b015e91c3',
  'client/src/components/stp/SpdlPanel.tsx': '177bba8933e455b12d946656f702a7faa00248182429ef5688e4e72789456a50',
  'client/src/components/stp/SrefPanel.tsx': '5703c2515ae644e07ebf447591a4429b0eb030610ad090663f2be4f0fa52d7c6',
  'client/src/components/stp/StpePanel.tsx': 'c19c00addf47332510721ca0af840b69524a8523a7a8a41c3d085b6db24d4955',
  'client/src/components/stp/TrpvPanel.tsx': '6971700c2a75ba63f872f6228344eccee092da19d65fc55ea2377cc3a9124a3f',
  'client/src/components/stp/VcadPanel.tsx': '2f965d143c2c6bc7cc6d573d92fa7a71f01b8bcf42aa6f6f41ced77f38abd567',
  'client/src/components/stp/VconPanel.tsx': '8a4764b9874ecd85ed890287752c0b718fec4743d1c7f5f02b79df2c1baa10f1',
};

describe('STP 原内容字节级保护', () => {
  it('keeps the original page and all 24 existing STP panels byte-for-byte unchanged', () => {
    for (const [relative, fingerprint] of Object.entries(expected)) {
      const actual = createHash('sha256').update(readFileSync(resolve(process.cwd(), relative))).digest('hex');
      expect(actual, relative).toBe(fingerprint);
    }
  });
});
