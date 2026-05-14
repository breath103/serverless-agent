import { createRoute } from "@tanstack/react-router";

import { rootRoute } from "../__root";
import {
  AnimationsSection,
  ButtonsSection,
  ColorsSection,
  IconsSection,
  InputsSection,
  PanelsSection,
  SelectableSection,
  TypographySection,
} from "./sections";

// Public, unauthenticated route. Renders every primitive in every state so
// design changes can be eyeballed (or e2e-screenshotted) without juggling
// real data. Not a feature surface — a development tool.
export const designCheckRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/design-check",
  component: DesignCheckPage,
});

function DesignCheckPage() {
  return (
    <div className="min-h-full bg-background px-8 py-6">
      <header className="mb-8 border-b border-amber pb-4">
        <div className="hud-eyebrow">SERVERLESS // AGENT</div>
        <h1 className="mt-1 hud-title" style={{ fontSize: "1.875rem" }}>
          DESIGN CHECK
        </h1>
        <p className="mt-2 hud-caption">
          EVERY PRIMITIVE × EVERY STATE. USE FOR VISUAL QA.
        </p>
      </header>

      <div className="flex flex-col gap-10">
        <Section title="COLOR" id="colors"><ColorsSection /></Section>
        <Section title="TYPOGRAPHY" id="typography"><TypographySection /></Section>
        <Section title="BUTTONS" id="buttons"><ButtonsSection /></Section>
        <Section title="INPUTS" id="inputs"><InputsSection /></Section>
        <Section title="SELECTABLE ROWS" id="selectable"><SelectableSection /></Section>
        <Section title="PANELS" id="panels"><PanelsSection /></Section>
        <Section title="STATUS ICONS" id="icons"><IconsSection /></Section>
        <Section title="ANIMATIONS" id="animations"><AnimationsSection /></Section>
      </div>
    </div>
  );
}

function Section({
  title,
  id,
  children,
}: {
  title: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} data-test-section={id}>
      <div className="mb-3 flex items-center gap-3">
        <h2 className="hud-label" style={{ fontSize: "0.875rem" }}>{title}</h2>
        <div className="hud-rule flex-1" />
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}
