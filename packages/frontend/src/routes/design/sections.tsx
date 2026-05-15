import styles from "./design.module.css";

// All section components for the /design reference route. Lifted out of
// _route.tsx to keep the route file inside the project's 100-line limit.

export function Header() {
  return (
    <header className={styles.pageHeader}>
      <div className={styles.eyebrow}>phosphor // spectrum</div>
      <h1 className={`${styles.display} mt-2`}>Design Demo</h1>
      <p className={`${styles.body} mt-3`} style={{ color: "var(--cream-dim)", maxWidth: "640px" }}>
        A warmer, multi-channel evolution of terminal-HUD. Five subway-line hues, cream as the default
        foreground, tinted panel surfaces, lighter phosphor — same CRT DNA, less HUD theater.
      </p>
      <div className={styles.titleRule} />
    </header>
  );
}

function SectionHeader({ n, title }: { n: string; title: string }) {
  return (
    <div className={styles.sectionHeader}>
      <span className={styles.sectionNumber}>{n}</span>
      <span className={styles.sectionTitle}>{title}</span>
      <span className={styles.sectionRule} />
    </div>
  );
}

export function PaletteSection() {
  const canvas = [
    { name: "bg", hex: "#0E0A07", v: "--bg" },
    { name: "bg-elev", hex: "#17110C", v: "--bg-elev" },
  ];
  const cream = [
    { name: "cream", hex: "#EFE4CF", v: "--cream" },
    { name: "cream-dim", hex: "#A8997C", v: "--cream-dim" },
    { name: "cream-hair", hex: "#5C5440", v: "--cream-hair" },
  ];
  const channels: { name: string; hex: string; cls: string; varBase: string }[] = [
    { name: "cyan", hex: "#5BC8FF", cls: "channel-cyan", varBase: "--cyan" },
    { name: "magenta", hex: "#FF6FC8", cls: "channel-magenta", varBase: "--magenta" },
    { name: "coral", hex: "#FF7A55", cls: "channel-coral", varBase: "--coral" },
    { name: "amber", hex: "#FFC93B", cls: "channel-amber", varBase: "--amber" },
    { name: "mint", hex: "#6BE3A8", cls: "channel-mint", varBase: "--mint" },
  ];

  return (
    <section className={styles.section}>
      <SectionHeader n="01" title="Palette" />

      <div className={`${styles.label} mt-2`} style={{ marginBottom: "0.75rem" }}>Canvas</div>
      <div className={styles.swatchRow}>
        {canvas.map((s) => (
          <Swatch key={s.name} name={s.name} hex={s.hex} fill={`var(${s.v})`} border="var(--cream-hair)" />
        ))}
      </div>

      <div className={styles.label} style={{ margin: "1.75rem 0 0.75rem" }}>Neutral foreground</div>
      <div className={styles.swatchRow}>
        {cream.map((s) => (
          <Swatch key={s.name} name={s.name} hex={s.hex} fill={`var(${s.v})`} />
        ))}
      </div>

      <div className={styles.label} style={{ margin: "1.75rem 0 0.75rem" }}>Channel tiers</div>
      <div className={styles.channelStack}>
        {channels.map((c) => (
          <div key={c.name} className={`${styles.channelStrip} ${c.cls}`}>
            <span className={styles.channelStripLabel}>{c.name}</span>
            <div className={styles.tier} style={{ background: `var(${c.varBase})`, borderColor: `var(${c.varBase})` }}>
              <span className={styles.tierName} style={{ color: "var(--bg)" }}>full · {c.hex}</span>
            </div>
            <div className={styles.tier} style={{ background: `var(${c.varBase}-dim)`, borderColor: `var(${c.varBase}-dim)` }}>
              <span className={styles.tierName} style={{ color: "var(--bg)" }}>dim</span>
            </div>
            <div className={styles.tier} style={{ borderColor: `var(${c.varBase}-hair)`, color: `var(${c.varBase})` }}>
              <span className={styles.tierName} style={{ color: `var(${c.varBase})`, opacity: 0.75 }}>hair (border)</span>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.label} style={{ margin: "1.75rem 0 0.75rem" }}>Status (role-locked)</div>
      <div className={styles.swatchRow}>
        <Swatch name="success" hex="#6BE3A8" fill="var(--success)" />
        <Swatch name="warning" hex="#FFC93B" fill="var(--warning)" />
        <Swatch name="error" hex="#FF4D5A" fill="var(--error)" />
      </div>
    </section>
  );
}

function Swatch({ name, hex, fill, border }: { name: string; hex: string; fill: string; border?: string }) {
  return (
    <div className={styles.swatch} style={border ? { borderColor: border } : undefined}>
      <div className={styles.swatchBlock} style={{ background: fill }} />
      <span className={styles.swatchName}>{name}</span>
      <span className={styles.swatchHex}>{hex}</span>
    </div>
  );
}

export function TypographySection() {
  return (
    <section className={styles.section}>
      <SectionHeader n="02" title="Typography" />

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div>
          <div className={styles.eyebrow} style={{ marginBottom: "0.25rem" }}>display · chromatic aberration</div>
          <div className={styles.display}>2026 — System Online</div>
        </div>

        <div>
          <div className={styles.eyebrow} style={{ marginBottom: "0.25rem" }}>h1 · sentence case</div>
          <h2 className={styles.h1}>Welcome back, Kurt</h2>
        </div>

        <div>
          <div className={styles.eyebrow} style={{ marginBottom: "0.25rem" }}>h2 · sentence case</div>
          <h3 className={styles.h2}>Recent conversations</h3>
        </div>

        <div>
          <div className={styles.eyebrow} style={{ marginBottom: "0.25rem" }}>body · mixed case</div>
          <p className={styles.body} style={{ maxWidth: "640px" }}>
            The default foreground is cream. Channel hues only appear when they carry meaning — section identity,
            status, or active state. Mixed case is the default; ALL CAPS is reserved for labels and chips.
          </p>
        </div>

        <div>
          <div className={styles.eyebrow} style={{ marginBottom: "0.25rem" }}>caption · monospace, as-is</div>
          <span className={styles.caption}>last sync: 2026-05-15 08:40:01 utc · 12 records</span>
        </div>

        <div>
          <div className={styles.eyebrow} style={{ marginBottom: "0.5rem" }}>labels &amp; chips · uppercase</div>
          <div className={styles.btnRow}>
            <span className={styles.label}>SESSIONS [4]</span>
            <span className={styles.chip} style={{ color: "var(--cyan)" }}>NEW</span>
            <span className={styles.chip} style={{ color: "var(--cream)" }}>EDIT</span>
            <span className={styles.chip} style={{ color: "var(--error)" }}>DEL</span>
            <span className={styles.chip} style={{ color: "var(--success)" }}>OPERATIONAL</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ChannelRoutingSection() {
  const routes = [
    {
      cls: "channel-cyan",
      eyebrow: "dashboard / chat",
      title: "Conversations",
      body: "Cyan is the default data channel. Navigation, message threads, search results — anything that's primarily about routing through information.",
      meta: "12 sessions",
    },
    {
      cls: "channel-magenta",
      eyebrow: "dashboard / memory",
      title: "Memory",
      body: "Magenta marks identity-adjacent surfaces. Personal recall, saved notes, anything that's about you specifically.",
      meta: "128 records",
    },
    {
      cls: "channel-amber",
      eyebrow: "settings / skills",
      title: "Skills",
      body: "Amber covers configuration and capabilities. Installed skills, OAuth status, tool permissions.",
      meta: "5 installed",
    },
  ];
  return (
    <section className={styles.section}>
      <SectionHeader n="03" title="Channel routing — subway-line model" />
      <p className={styles.body} style={{ color: "var(--cream-dim)", marginBottom: "1.25rem", maxWidth: "640px" }}>
        Each section gets a permanent channel hue. Same component, different channel — and the chrome follows.
      </p>
      <div className={styles.routingGrid}>
        {routes.map((r) => (
          <div key={r.cls} className={`${styles.routeCard} ${r.cls}`}>
            <div className={styles.routeCardEyebrow}>{r.eyebrow}</div>
            <div className={styles.routeCardTitle}>{r.title}</div>
            <div className={styles.routeCardRule} />
            <p className={styles.routeCardBody}>{r.body}</p>
            <div className={styles.routeCardFooter}>
              <span className={styles.routeCardMeta}>{r.meta}</span>
              <span className={styles.chip} style={{ color: "var(--success)" }}>● ACTIVE</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SurfaceVariantsSection() {
  // Three card-surface treatments, all rendered in the same channel (cyan)
  // so the comparison is only about surface, not hue. A second row in
  // magenta verifies they all read at other channels too.
  const variants = [
    {
      cls: styles.variantA,
      name: "A · transparent + top bar",
      eyebrow: "current direction",
      title: "Conversations",
      caption: "Canvas shows through. Card defined by 1px cream-hair sides + 2px channel top bar with phosphor halo. Most concept-faithful — CRT-native.",
    },
    {
      cls: styles.variantB,
      name: "B · per-section canvas tint",
      eyebrow: "warakami84 mode",
      title: "Conversations",
      caption: "No card chrome at all. The whole region is tinted in the channel hue (~16% mix). The tint IS the section. Mimics Google84 / Windows84 — each screen has its own colored canvas.",
    },
    {
      cls: styles.variantC,
      name: "C · diagonal hatch",
      eyebrow: "engineering fill",
      title: "Conversations",
      caption: "Card fill is a diagonal-hatch pattern in channel color at low opacity. Top bar + cream-hair sides as in A. Reads as technical-drawing infill.",
    },
  ];

  return (
    <section className={`${styles.section} channel-cyan`}>
      <SectionHeader n="04" title="Surface variants — compare side by side" />
      <p
        className={styles.body}
        style={{ color: "var(--cream-dim)", marginBottom: "1.5rem", maxWidth: "640px" }}
      >
        All three rendered in cyan so the only varying axis is the card surface itself.
        The magenta row below shows each variant carries through at other channels.
      </p>

      <div className={styles.variantsGrid}>
        {variants.map((v) => (
          <div key={v.name}>
            <div className={styles.variantLabel}>{v.name}</div>
            <div className={v.cls}>
              <div className={styles.variantEyebrow}>{v.eyebrow}</div>
              <div className={styles.variantTitle}>{v.title}</div>
              <p className={styles.variantBody}>
                Cyan is the default data channel. Navigation, message threads, search results.
              </p>
              <div className={styles.variantFooter}>
                <span>12 sessions</span>
                <span className={styles.chip} style={{ color: "var(--success)" }}>● ACTIVE</span>
              </div>
            </div>
            <div className={styles.variantCaption}>{v.caption}</div>
          </div>
        ))}
      </div>

      <div className={`${styles.variantsGrid} channel-magenta`} style={{ marginTop: "1.5rem" }}>
        {variants.map((v) => (
          <div key={`m-${v.name}`}>
            <div className={v.cls}>
              <div className={styles.variantEyebrow}>dashboard / memory</div>
              <div className={styles.variantTitle}>Memory</div>
              <p className={styles.variantBody}>
                Same variant rendered in magenta to confirm it carries across channels.
              </p>
              <div className={styles.variantFooter}>
                <span>128 records</span>
                <span className={styles.chip} style={{ color: "var(--success)" }}>● ACTIVE</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SidebarSection() {
  return (
    <section className={styles.section}>
      <SectionHeader n="05" title="Sidebar — active item carries channel color" />
      <div className={`${styles.sidebarMock} channel-magenta`}>
        <nav className={styles.sidebarMockNav}>
          <div className={styles.sidebarBrand}>serverless // agent</div>
          <a className={`${styles.sidebarItem} channel-cyan`}><PxIcon kind="chat" />Chat</a>
          <a className={`${styles.sidebarItem} channel-magenta ${styles.sidebarItemActive}`}><PxIcon kind="memory" />Memory</a>
          <a className={`${styles.sidebarItem} channel-amber`}><PxIcon kind="skills" />Skills</a>
          <a className={styles.sidebarItem}><PxIcon kind="profile" />Profile</a>
        </nav>
        <div className={styles.sidebarMockBody}>
          <div className={styles.eyebrow}>dashboard / memory</div>
          <h3 className={`${styles.h1} mt-2`} style={{ color: "var(--magenta)" }}>Memory</h3>
          <div className={styles.titleRule} style={{ background: "var(--magenta)", marginTop: "0.75rem" }} />
          <p className={`${styles.body} mt-3`} style={{ color: "var(--cream)", maxWidth: "440px" }}>
            The active sidebar item is filled with its channel hue. The body wash and title carry the same hue so
            the screen reads as the magenta line.
          </p>
        </div>
      </div>
    </section>
  );
}

export function PanelsSection() {
  return (
    <section className={styles.section}>
      <SectionHeader n="06" title="Panels — tinted surface, quiet border" />
      <p className={styles.body} style={{ color: "var(--cream-dim)", marginBottom: "1.25rem", maxWidth: "640px" }}>
        Panel background is the canvas mixed with ~8% of its channel. Border stays quiet (30% channel) unless
        the panel is active / focused / operational.
      </p>
      <div className={styles.panelGrid}>
        <div className={`${styles.panel} channel-cyan`}>
          <div className={styles.panelTitle}>Sessions [4]</div>
          <div className={styles.panelRow}><span>가벼운 인사</span><span className={styles.panelValue}>just now</span></div>
          <div className={styles.panelRow}><span>Budget plan draft</span><span className={styles.panelValue}>2h</span></div>
          <div className={styles.panelRow}><span>Berlin trip ideas</span><span className={styles.panelValue}>yesterday</span></div>
        </div>
        <div className={`${styles.panel} channel-magenta`}>
          <div className={styles.panelTitle}>Pinned memories</div>
          <div className={styles.panelRow}><span>preferred coffee</span><span className={styles.panelValue}>1 line</span></div>
          <div className={styles.panelRow}><span>laptop setup</span><span className={styles.panelValue}>14 lines</span></div>
          <div className={styles.panelRow}><span>workout split</span><span className={styles.panelValue}>3 lines</span></div>
        </div>
        <div className={`${styles.panel} channel-amber`}>
          <div className={styles.panelTitle}>Installed skills</div>
          <div className={styles.panelRow}><span>web-search</span><span className={styles.panelValue} style={{ color: "var(--success)" }}>OPERATIONAL</span></div>
          <div className={styles.panelRow}><span>memory</span><span className={styles.panelValue} style={{ color: "var(--success)" }}>OPERATIONAL</span></div>
          <div className={styles.panelRow}><span>google-calendar</span><span className={styles.panelValue} style={{ color: "var(--warning)" }}>REFRESHING</span></div>
        </div>
      </div>
    </section>
  );
}

export function ButtonsSection() {
  return (
    <section className={styles.section}>
      <SectionHeader n="07" title="Buttons" />
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div>
          <div className={styles.eyebrow} style={{ marginBottom: "0.5rem" }}>cyan channel (default)</div>
          <div className={`${styles.btnRow} channel-cyan`}>
            <button className={styles.btnPrimary}>Send message</button>
            <button className={styles.btnSecondary}>Cancel</button>
            <button className={styles.btnDashed}>+ New session</button>
            <span className={styles.chip} style={{ color: "var(--cyan)" }}>EDIT</span>
            <span className={styles.chip} style={{ color: "var(--error)" }}>DEL</span>
          </div>
        </div>
        <div>
          <div className={styles.eyebrow} style={{ marginBottom: "0.5rem" }}>magenta channel</div>
          <div className={`${styles.btnRow} channel-magenta`}>
            <button className={styles.btnPrimary}>Save memory</button>
            <button className={styles.btnSecondary}>Pin</button>
            <button className={styles.btnDashed}>+ Add record</button>
          </div>
        </div>
        <div>
          <div className={styles.eyebrow} style={{ marginBottom: "0.5rem" }}>amber channel</div>
          <div className={`${styles.btnRow} channel-amber`}>
            <button className={styles.btnPrimary}>Install</button>
            <button className={styles.btnSecondary}>Configure</button>
            <button className={styles.btnDashed}>+ Add skill</button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FormsSection() {
  return (
    <section className={`${styles.section} channel-cyan`}>
      <SectionHeader n="08" title="Forms" />
      <div className={styles.formGrid}>
        <div className={styles.formField}>
          <label className={styles.formLabel}>Username</label>
          <input className={styles.input} defaultValue="kurt" />
        </div>
        <div className={styles.formField}>
          <label className={styles.formLabel}>Workspace</label>
          <input className={styles.input} placeholder="my-workspace" />
        </div>
        <div className={styles.formField}>
          <label className={styles.formLabel}>API key</label>
          <input className={`${styles.input} ${styles.inputError}`} defaultValue="sk-…" />
          <span className={styles.helperError}>! invalid key format</span>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-4">
        <label className={styles.checkboxRow}>
          <span className={`${styles.checkbox} ${styles.checkboxOn}`} />
          <span className={styles.body}>Stream responses</span>
        </label>
        <label className={styles.checkboxRow}>
          <span className={styles.checkbox} />
          <span className={styles.body} style={{ color: "var(--cream-dim)" }}>Show debug panel</span>
        </label>
      </div>
    </section>
  );
}

export function StatusSection() {
  return (
    <section className={styles.section}>
      <SectionHeader n="09" title="Status — icon + word + color, role-locked" />
      <div className={styles.statusGrid}>
        <StatusCell color="var(--success)" word="OPERATIONAL" caption="all systems nominal" glyph={<StatusGlyph kind="op" />} />
        <StatusCell color="var(--warning)" word="DEGRADED" caption="latency above target" glyph={<StatusGlyph kind="warn" />} />
        <StatusCell color="var(--error)" word="FAILURE" caption="token refresh rejected" glyph={<StatusGlyph kind="fail" />} />
        <StatusCell color="var(--cream-dim)" word="PENDING" caption="waiting on first run" glyph={<StatusGlyph kind="pending" />} />
      </div>
    </section>
  );
}

function StatusCell({ color, word, caption, glyph }: { color: string; word: string; caption: string; glyph: React.ReactNode }) {
  return (
    <div className={styles.statusCell} style={{ "--statusColor": color } as React.CSSProperties}>
      {glyph}
      <div>
        <div className={styles.statusWord}>{word}</div>
        <div className={styles.statusCaption}>{caption}</div>
      </div>
    </div>
  );
}

export function IconsSection() {
  return (
    <section className={styles.section}>
      <SectionHeader n="10" title="Pixel-art glyphs — illustrative" />
      <p className={styles.body} style={{ color: "var(--cream-dim)", marginBottom: "1.25rem", maxWidth: "640px" }}>
        Glyphs inherit <code>currentColor</code> so they pick up the surrounding channel. Below are hand-drawn
        16×16 samples; a real Pixelarticons-style library would slot in the same way.
      </p>
      <div className={styles.iconRow}>
        <IconCell label="chat" channel="channel-cyan"><PxIcon kind="chat" size={32} /></IconCell>
        <IconCell label="memory" channel="channel-magenta"><PxIcon kind="memory" size={32} /></IconCell>
        <IconCell label="skills" channel="channel-amber"><PxIcon kind="skills" size={32} /></IconCell>
        <IconCell label="profile" channel="channel-cream"><PxIcon kind="profile" size={32} /></IconCell>
        <IconCell label="send" channel="channel-mint"><PxIcon kind="send" size={32} /></IconCell>
        <IconCell label="search" channel="channel-coral"><PxIcon kind="search" size={32} /></IconCell>
      </div>
    </section>
  );
}

function IconCell({ label, channel, children }: { label: string; channel: string; children: React.ReactNode }) {
  return (
    <div className={`${styles.iconCell} ${channel}`} style={{ color: "var(--accent-1)" }}>
      {children}
      <span className={styles.iconLabel}>{label}</span>
    </div>
  );
}

// Hand-drawn 16×16 pixel shapes. Stand-ins for a real pixel-art icon library.
function PxIcon({ kind, size = 16 }: { kind: "chat" | "memory" | "skills" | "profile" | "send" | "search"; size?: number }) {
  const paths: Record<typeof kind, string> = {
    chat: "M2 3h12v8H6l-3 3v-3H2z",
    memory: "M3 3h10v3H3zM3 7h10v3H3zM3 11h10v2H3z",
    skills: "M5 2h6v3H5zM3 6h10v3H3zM5 10h6v3H5zM7 13h2v2H7z",
    profile: "M6 3h4v4H6zM4 8h8v5H4z",
    send: "M2 8L14 2 9 14 8 9z",
    search: "M3 3h6v6H3zM10 10l3 3M9 9l1 1",
  };
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: "crispEdges" }}>
      <path
        d={paths[kind]}
        stroke={kind === "search" ? "currentColor" : "none"}
        strokeWidth={kind === "search" ? 1.5 : 0}
      />
    </svg>
  );
}

function StatusGlyph({ kind }: { kind: "op" | "warn" | "fail" | "pending" }) {
  const size = 18;
  if (kind === "op") return <svg width={size} height={size} viewBox="0 0 16 16"><rect x="3" y="3" width="10" height="10" fill="currentColor" /></svg>;
  if (kind === "warn") return <svg width={size} height={size} viewBox="0 0 16 16"><polygon points="8,2 14,13 2,13" fill="currentColor" /></svg>;
  if (kind === "fail") return <svg width={size} height={size} viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="currentColor" /></svg>;
  return <svg width={size} height={size} viewBox="0 0 16 16"><rect x="3" y="3" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>;
}
