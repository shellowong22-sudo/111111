import React from "react";

/** Keep the restored 22 original tools intact and remove the shared right rail. */
export default function IndustryGroupPreservedModule({
  moduleId,
  original,
}: {
  moduleId: string;
  original: React.ReactNode;
}) {
  return (
    <section
      className="h-full min-h-0 min-w-0 overflow-hidden bg-black"
      data-industry-original-workspace={moduleId}
    >
      {original}
    </section>
  );
}

