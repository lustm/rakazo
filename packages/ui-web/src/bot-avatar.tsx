import type { BotAvatarSet } from "@rakazo/contracts";
import type { AvatarEyes, BotColorDef, LogoAvatarActivity } from "@rakazo/core";
import {
  ACTIVE_RUN_STATUSES,
  avatarEyeRects,
  avatarIdentitySeed,
  BOT_AVATAR_COLORS,
  BOT_COLOR_LIST,
  botEyeTone,
  DEFAULT_BOT_AVATAR_COLOR,
  ORGANIC_AVATAR_EYES,
  ORGANIC_AVATAR_VIEWBOX,
  organicAvatarEyeTilt,
  organicAvatarPath,
  resolvePersonaColorDef,
  SHIPPED_BOT_AVATAR_EYES,
  SHIPPED_BOT_AVATAR_SHAPE_KEYS,
  SHIPPED_BOT_AVATAR_SHAPES,
  SHIPPED_BOT_AVATAR_VIEWBOX,
  shippedBotAvatarShapePath,
} from "@rakazo/core";
import type { ComponentProps } from "react";
import { memo, useId, useMemo, useRef } from "react";
import { useBotAvatarActivity } from "./bot-avatar-activity.js";
import type { AvatarLookRange } from "./hooks/use-avatar-look.js";
import { useAvatarLook } from "./hooks/use-avatar-look.js";
import { useAvatarMotionVisibility } from "./hooks/use-avatar-motion-visibility.js";
import { useOrganicMotion } from "./hooks/use-organic-motion.js";
import { cn } from "./lib/utils.js";
import { LogoAvatar } from "./logo-avatar.js";
import { organicFrame, restPose } from "./organic-motion.js";
import "./styles.css";

export type { BotColorDef };
export { BOT_AVATAR_COLORS, BOT_COLOR_LIST, DEFAULT_BOT_AVATAR_COLOR, resolvePersonaColorDef };

export const BOT_SHAPES = SHIPPED_BOT_AVATAR_SHAPES;
export const SHIPPED_SHAPE_KEYS = SHIPPED_BOT_AVATAR_SHAPE_KEYS;
const VIEWBOX = SHIPPED_BOT_AVATAR_VIEWBOX;

export const BOT_MASCOT_SHAPES = SHIPPED_SHAPE_KEYS.map(
  (k) => BOT_SHAPES[k] ?? FALLBACK_SHAPE_PATH,
);

const FALLBACK_SHAPE_PATH = BOT_SHAPES.hex ?? "";

/** How far the eyes travel toward the pointer, in each avatar's viewBox units. */
const SHAPE_LOOK_RANGE: AvatarLookRange = { x: 20, y: 14 };

export function parseBotAvatar(
  rawColor: string,
  _identity?: string,
): {
  color: string;
  shapeIndex?: number;
  isImage: boolean;
  imageUrl?: string;
} {
  if (!rawColor) return { color: "#F97316", isImage: false };
  // Only data: image URLs are rendered. Arbitrary http(s)/blob values in `color`
  // must not become <img src> (SSRF / tracking when other members view the bot).
  if (rawColor.startsWith("data:image/")) {
    return { color: "#F97316", isImage: true, imageUrl: rawColor };
  }
  if (rawColor.includes("::shape_")) {
    const parts = rawColor.split("::shape_");
    const rawShapeIdx = parts[1] ?? "0";
    const parsedShapeIdx = /^\d+$/.test(rawShapeIdx) ? Number(rawShapeIdx) : 0;
    const shapeIdx = Number.isSafeInteger(parsedShapeIdx) ? parsedShapeIdx : 0;
    return {
      color: parts[0] || "#F97316",
      shapeIndex: shapeIdx % SHIPPED_SHAPE_KEYS.length,
      isImage: false,
    };
  }
  return { color: rawColor, isImage: false };
}

const AVATAR_HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function defaultBotAvatarValue(rawColor: string): string {
  const parsed = parseBotAvatar(rawColor);
  if (rawColor && !parsed.isImage && AVATAR_HEX.test(parsed.color)) return parsed.color;
  return DEFAULT_BOT_AVATAR_COLOR;
}

export interface BotAvatarProps {
  color: string;
  avatarSet?: BotAvatarSet;
  activity?: LogoAvatarActivity;
  size?: number;
  status?: string;
  identity?: string;
  className?: string;
}

export const BotAvatar = memo(function BotAvatar({
  color,
  avatarSet,
  activity,
  size = 36,
  status,
  identity = "",
  className,
}: BotAvatarProps) {
  const id = useId().replace(/[^a-zA-Z0-9-_]/g, "");
  const isWorking = ACTIVE_RUN_STATUSES.some((s) => s === status);
  // Only the shape avatar below uses this; the organic and logo avatars watch the pointer themselves.
  const shapeRef = useRef<HTMLDivElement>(null);
  useAvatarLook(shapeRef, SHAPE_LOOK_RANGE, size >= 20);

  const parsed = useMemo(() => parseBotAvatar(color, identity), [color, identity]);
  const effectiveId = identity || parsed.color || "agent";

  const colorDef = useMemo(
    () => resolvePersonaColorDef(effectiveId, parsed.color),
    [effectiveId, parsed.color],
  );

  if (parsed.isImage && parsed.imageUrl) {
    return (
      <div
        className={cn("rakazo-bot-avatar relative shrink-0 select-none", className)}
        data-working={isWorking}
        style={{ width: size, height: size }}
      >
        <div className="rakazo-bot-avatar-picture relative flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-border bg-secondary">
          <img src={parsed.imageUrl} alt="" className="h-full w-full object-cover" />
        </div>
        {isWorking ? (
          <svg
            className="rakazo-bot-avatar-ring rakazo-bot-avatar-ring-working absolute pointer-events-none"
            style={{
              inset: -4,
              width: size + 8,
              height: size + 8,
            }}
            viewBox="0 0 48 48"
            fill="none"
            aria-hidden="true"
          >
            <circle
              cx="24"
              cy="24"
              r="22"
              className="stroke-status-working"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeDasharray="45 80"
            />
          </svg>
        ) : null}
      </div>
    );
  }

  if (parsed.shapeIndex === undefined && avatarSet === "rakazo") {
    const Avatar = activity === undefined ? LiveLogoAvatar : LogoAvatar;
    return (
      <Avatar
        avatarValue={color ? colorDef.hex : undefined}
        identity={effectiveId}
        size={size}
        activity={activity}
        status={status}
        className={className}
      />
    );
  }
  if (parsed.shapeIndex === undefined) {
    return (
      <OrganicAvatar
        color={colorDef.hex}
        identity={effectiveId}
        size={size}
        isWorking={isWorking}
        className={className}
      />
    );
  }

  return (
    <div
      ref={shapeRef}
      className={cn(
        "rakazo-bot-avatar bot-avatar-container relative inline-flex items-center justify-center shrink-0 select-none",
        className,
      )}
      style={{
        width: size,
        height: size,
      }}
      data-working={isWorking}
    >
      <svg
        className="rakazo-bot-avatar-ring absolute pointer-events-none"
        style={{
          inset: -4,
          width: size + 8,
          height: size + 8,
          filter: `drop-shadow(0 0 6px ${colorDef.hex}) drop-shadow(0 0 10px #ffffff)`,
        }}
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden="true"
      >
        <circle
          cx="24"
          cy="24"
          r="22"
          stroke={`url(#${id}-ring)`}
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeDasharray="45 80"
        />
        <circle cx="43" cy="24" r="2.8" fill="#ffffff" />
        <defs>
          <linearGradient id={`${id}-ring`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="60%" stopColor={colorDef.hex} stopOpacity="0.9" />
            <stop offset="100%" stopColor={colorDef.hex} stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <svg
        viewBox={VIEWBOX}
        aria-hidden="true"
        className={cn(
          "overflow-visible transition-transform duration-300",
          isWorking
            ? "animate-pulse scale-[1.04] motion-reduce:animate-none"
            : "hover:scale-[1.03] motion-reduce:hover:scale-100",
        )}
        // Inline size so a parent's icon sizing (Button sizes bare SVGs) cannot shrink it.
        style={{
          width: size,
          height: size,
          filter: isWorking
            ? `drop-shadow(0 0 8px ${colorDef.hex}) drop-shadow(0 0 2px #ffffff)`
            : "drop-shadow(0 2px 4px rgba(0,0,0,0.45))",
        }}
      >
        <g>
          <path d={shippedBotAvatarShapePath(parsed.shapeIndex)} fill={colorDef.hex} />
          <g className="rakazo-avatar-look">
            <g className={cn("bot-character-eyes", eyeFill(colorDef.hex))}>
              <BarEyes eyes={SHIPPED_BOT_AVATAR_EYES} />
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
});

/** Only live Rakazo consumers subscribe to public activity updates. */
function LiveLogoAvatar({
  status,
  ...props
}: ComponentProps<typeof LogoAvatar> & { status?: string }) {
  const activity = useBotAvatarActivity(props.identity ?? "", status);
  return <LogoAvatar {...props} activity={activity} />;
}

function OrganicAvatar({
  color,
  identity,
  size,
  isWorking,
  className,
}: {
  color: string;
  identity?: string;
  size: number;
  isWorking: boolean;
  className?: string;
}) {
  const id = useId().replace(/[^a-zA-Z0-9-_]/g, "");
  const canMove = size >= 20;
  const { ref, visible, reducedMotion } = useAvatarMotionVisibility(canMove);
  const seed = avatarIdentitySeed(identity || color || DEFAULT_BOT_AVATAR_COLOR);
  useOrganicMotion(ref, seed, isWorking, canMove && visible && !reducedMotion);
  const shape = organicAvatarPath(seed);
  // The resting pose; useOrganicMotion takes over these attributes while the avatar moves.
  const rest = organicFrame(restPose(isWorking));

  return (
    <svg
      ref={ref}
      viewBox={ORGANIC_AVATAR_VIEWBOX}
      aria-hidden="true"
      className={cn("rakazo-organic-avatar overflow-visible select-none", className)}
      data-working={isWorking}
      data-paused={!visible}
      data-shape-family={seed % 10}
      style={{
        width: size,
        height: size,
        flex: "none",
      }}
    >
      <defs>
        <clipPath id={`${id}-body`}>
          <path d={shape} />
        </clipPath>
      </defs>
      <g data-organic-body="" transform={rest.body} opacity={rest.bodyOpacity}>
        <path
          className="rakazo-organic-avatar-body"
          d={shape}
          fill={color}
          style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,.34))" }}
        />
        {/* Eyes ride the body and are cut off at its edge as they turn. */}
        <g
          data-organic-eyes=""
          clipPath={`url(#${id}-body)`}
          opacity={rest.eyesOpacity}
          className={cn("rakazo-organic-avatar-eyes", eyeFill(color))}
        >
          <g transform={`rotate(${organicAvatarEyeTilt(seed)})`}>
            {avatarEyeRects(ORGANIC_AVATAR_EYES).map((rect, index) => (
              <rect key={rect.x} data-organic-eye="" {...rect} transform={rest.eyes[index]} />
            ))}
          </g>
        </g>
      </g>
      {rest.dots.map((dot, index) => (
        <circle
          key={index}
          data-organic-dot=""
          cx={dot.cx}
          cy={dot.cy}
          r={dot.r}
          opacity={dot.opacity}
          fill={color}
        />
      ))}
    </svg>
  );
}

function BarEyes({ eyes }: { eyes: AvatarEyes }) {
  return avatarEyeRects(eyes).map((rect) => <rect key={rect.x} {...rect} />);
}

/** Eyes are cut-outs in the page color unless the body is nearly white or black. */
function eyeFill(bodyHex: string): string {
  const tone = botEyeTone(bodyHex);
  if (tone === "dark") return "fill-foreground dark:fill-background";
  if (tone === "light") return "fill-background dark:fill-foreground";
  return "fill-background";
}

export function BotShapePreview({
  shapeIndex,
  identity,
  label,
  color,
  selected,
  onClick,
}: {
  /** An Avatar Studio shape; omit it to draw the organic body `identity` gets. */
  shapeIndex?: number;
  identity?: string;
  label?: string;
  color: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  const key =
    shapeIndex === undefined
      ? undefined
      : (SHIPPED_SHAPE_KEYS[shapeIndex % SHIPPED_SHAPE_KEYS.length] ?? "hex");
  const colorDef = resolvePersonaColorDef("preview", color);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label ?? key}
      aria-pressed={selected ?? false}
      className={cn(
        "relative flex size-11 items-center justify-center rounded-xl transition-transform hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover",
        selected
          ? "ring-2 ring-primary ring-offset-2 ring-offset-popover bg-white/10"
          : "hover:bg-white/5",
      )}
    >
      {shapeIndex === undefined ? (
        <BotAvatar color={color} identity={identity} size={32} />
      ) : (
        <svg viewBox={VIEWBOX} className="size-8 overflow-visible" aria-hidden="true">
          <path d={shippedBotAvatarShapePath(shapeIndex)} fill={colorDef.hex} />
          <g className={eyeFill(colorDef.hex)}>
            <BarEyes eyes={SHIPPED_BOT_AVATAR_EYES} />
          </g>
        </svg>
      )}
    </button>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex h-11 w-11 items-center justify-center gap-1.5 rounded-full bg-card">
        <span className="h-4 w-[7px] rounded-full bg-primary" />
        <span className="h-4 w-[7px] rounded-full bg-primary" />
      </div>
      <span className="font-[Aeonik,ui-sans-serif] text-[28px] tracking-tight text-foreground">
        Rakazo
      </span>
    </div>
  );
}
