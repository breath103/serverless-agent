import { createRoute } from "@tanstack/react-router";

import { rootRoute } from "../__root";
import styles from "./design.module.css";
import {
  ButtonsSection,
  ChannelRoutingSection,
  FormsSection,
  Header,
  IconsSection,
  PaletteSection,
  PanelsSection,
  SidebarSection,
  StatusSection,
  SurfaceVariantsSection,
  TypographySection,
} from "./sections";

// Phosphor Spectrum design reference — every primitive in every state, plus
// the channel-routing decisions and surface variants we considered. Used for
// visual QA and onboarding to the design system. Tokens cascade from the
// global :root; this route only adds composition (palette swatches, sample
// cards, etc.) on top.
export const designRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/design",
  component: DesignPage,
});

function DesignPage() {
  return (
    <div className={`${styles.page} channel-cyan`}>
      <Header />
      <PaletteSection />
      <TypographySection />
      <ChannelRoutingSection />
      <SurfaceVariantsSection />
      <SidebarSection />
      <PanelsSection />
      <ButtonsSection />
      <FormsSection />
      <StatusSection />
      <IconsSection />
    </div>
  );
}
