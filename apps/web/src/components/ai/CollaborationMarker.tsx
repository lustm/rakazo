import type { BotAvatarSet } from "@rakazo/contracts";
import { splitPeerLabel } from "@rakazo/core";
import type { GroupAvatarMember } from "@rakazo/ui-web";
import { BotAvatar, GroupAvatar } from "@rakazo/ui-web";

export function CollaborationMarker({
  color,
  avatarSet,
  identity,
  label,
  peerName,
  onClick,
}: {
  color: string;
  avatarSet?: BotAvatarSet;
  identity: string;
  label: string;
  peerName: string;
  onClick: () => void;
}) {
  const parts = splitPeerLabel(label, peerName);
  return (
    <div className="flex min-w-0 max-w-full justify-center py-1">
      <button
        type="button"
        data-testid="peer-receipt-chip"
        aria-label={label}
        onClick={onClick}
        className="inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground/75 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
      >
        {parts.before ? <span className="whitespace-pre-wrap">{parts.before}</span> : null}
        <BotAvatar avatarSet={avatarSet} color={color} identity={identity} size={16} />
        {parts.name ? (
          <span dir="auto" className="truncate font-medium">
            {parts.name}
          </span>
        ) : null}
        {parts.after ? <span className="whitespace-pre-wrap">{parts.after}</span> : null}
      </button>
    </div>
  );
}

/**
 * The working bot with what it is doing right now, such as its current tool call. Its eyes glance
 * around while it works (rk-working-glyph), a highlight sweeps the phrase and rests (rk-sheen), and
 * a new phrase fades in (keyed by its text) instead of swapping in place.
 */
export function ActiveBotGlyph({ bots, label }: { bots: GroupAvatarMember[]; label: string }) {
  return (
    <div role="status" className="rk-working-glyph flex min-h-10 min-w-0 items-center gap-2.5 px-1">
      <GroupAvatar members={bots} size={28} />
      <span key={label} dir="auto" className="rk-sheen rk-phrase-in min-w-0 truncate text-[15px]">
        {label}
      </span>
    </div>
  );
}
