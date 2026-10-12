export default function PortfolioRiskPreservedModule({ moduleId, children }: { moduleId: string; children: React.ReactNode }) {
  return <div className="min-h-full" data-preserved-portfolio-module={moduleId}><div data-preserved-portfolio-workspace="true">{children}</div></div>;
}
