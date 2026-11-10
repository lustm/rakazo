import type { BotAvatarSet } from "@rakazo/contracts";
import type { BotColorDef, LogoAvatarActivity } from "@rakazo/core";
import {
  ACTIVE_RUN_STATUSES,
  avatarIdentitySeed,
  BOT_AVATAR_COLORS,
  BOT_COLOR_LIST,
  botBodyShapePath,
  botEyeTone,
  DEFAULT_BOT_AVATAR_COLOR,
  ORGANIC_AVATAR_BODY_SIZE,
  ORGANIC_AVATAR_FAMILY_COUNT,
  ORGANIC_AVATAR_VIEWBOX,
  resolvePersonaColorDef,
  SHIPPED_BOT_AVATAR_SHAPE_KEYS,
  SHIPPED_BOT_AVATAR_SHAPES,
} from "@rakazo/core";
import type { ComponentProps } from "react";
import { memo, useId, useMemo } from "react";
import { useBotAvatarActivity } from "./bot-avatar-activity.js";
import { useAvatarMotionVisibility } from "./hooks/use-avatar-motion-visibility.js";
import { useOrganicMotion } from "./hooks/use-organic-motion.js";
import { cn } from "./lib/utils.js";
import { LogoAvatar } from "./logo-avatar.js";
import { organicFrame, restPose } from "./organic-motion.js";
import "./styles.css";

export type { BotColorDef };
export { BOT_AVATAR_COLORS, BOT_COLOR_LIST, DEFAULT_BOT_AVATAR_COLOR, resolvePersonaColorDef };

const SHIPPED_SHAPE_KEYS = SHIPPED_BOT_AVATAR_SHAPE_KEYS;

export const BOT_MASCOT_SHAPES = SHIPPED_SHAPE_KEYS.map(
  (key) => SHIPPED_BOT_AVATAR_SHAPES[key] ?? "",
);

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
  const isWorking = ACTIVE_RUN_STATUSES.some((s) => s === status);

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
  return (
    <OrganicAvatar
      color={colorDef.hex}
      identity={effectiveId}
      shapeIndex={parsed.shapeIndex}
      size={size}
      isWorking={isWorking}
      className={className}
    />
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
  shapeIndex,
  size,
  isWorking,
  className,
}: {
  color: string;
  identity?: string;
  /** A shape picked in Avatar Studio; otherwise the bot's id picks one. */
  shapeIndex?: number;
  size: number;
  isWorking: boolean;
  className?: string;
}) {
  const id = useId().replace(/[^a-zA-Z0-9-_]/g, "");
  const canMove = size >= 20;
  const { ref, visible, reducedMotion } = useAvatarMotionVisibility(canMove);
  const seed = avatarIdentitySeed(identity || color || DEFAULT_BOT_AVATAR_COLOR);
  const family = shapeIndex ?? seed % ORGANIC_AVATAR_FAMILY_COUNT;
  useOrganicMotion(ref, family, seed, isWorking, canMove && visible && !reducedMotion);
  const shape = botBodyShapePath(family, ORGANIC_AVATAR_BODY_SIZE);
  // The resting pose; useOrganicMotion takes over these attributes while the avatar moves.
  const rest = organicFrame(family, restPose());

  return (
    <svg
      ref={ref}
      viewBox={ORGANIC_AVATAR_VIEWBOX}
      aria-hidden="true"
      className={cn("rakazo-organic-avatar overflow-visible select-none", className)}
      data-working={isWorking}
      data-paused={!visible}
      data-shape-family={family}
      style={{
        width: size,
        height: size,
        flex: "none",
      }}
    >
      <defs>
        <clipPath id={`${id}-body`}>
          <path data-organic-body="" d={shape} transform={rest.body} />
        </clipPath>
      </defs>
      <g data-organic-turn="" transform={rest.turn}>
        <path
          data-organic-body=""
          className="rakazo-organic-avatar-body"
          d={shape}
          fill={color}
          transform={rest.body}
        />
        {/* Eyes ride the body and are cut off at its edge as they turn. */}
        <g
          clipPath={`url(#${id}-body)`}
          className={cn("rakazo-organic-avatar-eyes", eyeFill(color))}
        >
          <g data-organic-face="" transform={rest.face}>
            {rest.eyes.map((eye, index) => (
              <rect
                key={index === 0 ? "left" : "right"}
                data-organic-eye=""
                x={eye.x}
                y={eye.y}
                width={eye.width}
                height={eye.height}
                rx={eye.rx}
                transform={eye.transform}
                opacity={eye.opacity}
              />
            ))}
          </g>
        </g>
      </g>
    </svg>
  );
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
      : SHIPPED_SHAPE_KEYS[shapeIndex % SHIPPED_SHAPE_KEYS.length];
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
      <BotAvatar
        color={shapeIndex === undefined ? color : `${colorDef.hex}::shape_${shapeIndex}`}
        identity={identity}
        size={32}
      />
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
