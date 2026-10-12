import { describe, expect, it } from 'vitest';
import { extractFedResearchBodyText, extractResearchEvidence } from './routers/moneyMarketPolicy';

const officialResearchFixture = `
  <nav>Federal Reserve Act Holding Company Resources</nav>
  <!-- Content Area -->
  <div class="col-lg-8 col-md-8 col-sm-12 col-xs-12">
    <p>August 2026</p>
    <h3>Research title</h3>
    <p><strong>Abstract:</strong></p>
    <p>I propose a method using a model and data. The results show evidence of a reported finding.</p>
  </div>
  <div class="col-xs-12 col-md-12 footnotes feds-note">Footnotes</div>
  <footer>Site navigation</footer>
`;

describe('FEDS 官方研究正文提取', () => {
  it('只提取研究内容区，不把导航或页脚用作研究证据', () => {
    const text = extractFedResearchBodyText(officialResearchFixture);
    expect(text).toContain('I propose a method using a model and data.');
    expect(text).not.toContain('Holding Company Resources');
    expect(text).not.toContain('Site navigation');
  });

  it('从已提取正文中分别定位研究问题、方法与报告发现的原文上下文', () => {
    const highlights = extractResearchEvidence(extractFedResearchBodyText(officialResearchFixture));
    expect(highlights.map((item) => item.category)).toEqual(expect.arrayContaining(['research_question', 'method', 'reported_finding']));
    expect(highlights.every((item) => item.context.includes('Holding Company Resources'))).toBe(false);
  });
});
