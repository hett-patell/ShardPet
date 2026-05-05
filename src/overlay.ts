import overlayStylesText from "./overlay.css?raw";

export type OverlayHandles = {
  destroy: () => void;
};

export function mountOverlay(args: {
  spriteDataUrl: string;
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

  const sprite = document.createElement("img");
  sprite.className = "nag-sprite";
  sprite.src = args.spriteDataUrl;
  sprite.alt = "";
  sprite.draggable = false;

  const title = document.createElement("div");
  title.className = "nag-title";
  title.textContent = "Get back to work!";

  const subtitle = document.createElement("div");
  subtitle.className = "nag-subtitle";
  subtitle.textContent = `${args.hostname} isn't on your allowlist. You've been here ${args.thresholdMinutes}+ minutes.`;

  const button = document.createElement("button");
  button.className = "nag-dismiss";
  button.type = "button";
  button.textContent = "Dismiss (Esc)";

  card.appendChild(sprite);
  card.appendChild(title);
  card.appendChild(subtitle);
  card.appendChild(button);

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
