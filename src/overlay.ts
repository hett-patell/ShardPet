import overlayStylesText from "./overlay.css?raw";

export type OverlayHandles = {
  destroy: () => void;
};

function shuffled<T>(arr: ReadonlyArray<T>): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}

export function mountOverlay(args: {
  spriteDataUrls: ReadonlyArray<string>;
  hostname: string;
  thresholdMinutes: number;
  onDismiss: () => void;
}): OverlayHandles {
  const host = document.createElement("div");
  host.id = "shardpet-nag-host";
  host.style.cssText =
    "all: initial; position: fixed; inset: 0; z-index: 2147483647;";
  const shadow = host.attachShadow({ mode: "closed" });

  const style = document.createElement("style");
  style.textContent = overlayStylesText;
  shadow.appendChild(style);

  const backdrop = document.createElement("div");
  backdrop.className = "nag-backdrop";

  const card = document.createElement("div");
  card.className = "nag-card";

  const title = document.createElement("div");
  title.className = "nag-title";
  title.textContent = "Get back to work!";

  const subtitle = document.createElement("div");
  subtitle.className = "nag-subtitle";
  subtitle.textContent = `${args.hostname} isn't on your allowlist. You've been here ${args.thresholdMinutes}+ minutes.`;

  const scatter = document.createElement("div");
  scatter.className = "nag-scatter";
  const urls = shuffled(args.spriteDataUrls);
  const n = urls.length;

  const cols = Math.min(6, Math.max(3, Math.ceil(Math.sqrt(n * 1.6))));
  const rows = Math.max(2, Math.ceil(n / cols));

  const padPct = 6;
  const usableW = 100 - padPct * 2;
  const usableH = 100 - padPct * 2;
  const cellW = usableW / cols;
  const cellH = usableH / rows;

  const cells: Array<{ r: number; c: number }> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({ r, c });
    }
  }
  const shuffledCells = shuffled(cells);

  for (let i = 0; i < n; i++) {
    const cell = shuffledCells[i];
    if (!cell) break;
    const img = document.createElement("img");
    img.className = "nag-scatter-sprite";
    img.src = urls[i] as string;
    img.alt = "";
    img.draggable = false;

    const cx = padPct + (cell.c + 0.5) * cellW;
    const cy = padPct + (cell.r + 0.5) * cellH;
    const jitterX = (Math.random() - 0.5) * cellW * 0.55;
    const jitterY = (Math.random() - 0.5) * cellH * 0.55;
    const left = cx + jitterX;
    const top = cy + jitterY;

    const scale = 0.85 + Math.random() * 0.45;
    const rot = (Math.random() - 0.5) * 14;
    const delay = Math.random() * 1400;

    img.style.cssText =
      `top: ${top}%; left: ${left}%;` +
      ` --scatter-rot: ${rot}deg; --scatter-scale: ${scale};` +
      ` animation-delay: ${delay}ms;`;
    scatter.appendChild(img);
  }

  const button = document.createElement("button");
  button.className = "nag-dismiss";
  button.type = "button";
  button.textContent = "Dismiss (Esc)";

  card.appendChild(title);
  card.appendChild(subtitle);
  card.appendChild(button);

  backdrop.appendChild(scatter);
  backdrop.appendChild(card);
  shadow.appendChild(backdrop);

  document.documentElement.appendChild(host);

  let destroyed = false;
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    document.removeEventListener("keydown", onKey, true);
    host.remove();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      handleDismiss();
    }
  };

  const handleDismiss = () => {
    destroy();
    args.onDismiss();
  };

  backdrop.addEventListener("click", e => {
    if (e.target === backdrop || e.target === card) handleDismiss();
  });
  button.addEventListener("click", handleDismiss);
  document.addEventListener("keydown", onKey, true);

  return { destroy };
}
