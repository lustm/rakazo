import { BotAvatarValueSchema, parseBotAvatarValue } from "@rakazo/contracts";
import { lightTokens } from "@rakazo/ui-tokens";
import {
  avatarIdentitySeed,
  ORGANIC_AVATAR_BODY_SIZE,
  ORGANIC_AVATAR_FAMILY_COUNT,
  ORGANIC_AVATAR_VIEWBOX,
} from "./avatar-shape.js";
import { botEyeInk, resolvePersonaColorDef } from "./bot-avatar-colors.js";
import { botBodyShapePath } from "./bot-body-shapes.js";
import {
  LOGO_AVATAR_BODY_Y,
  LOGO_AVATAR_EYES,
  LOGO_AVATAR_VIEWBOX,
  LOGO_BODY_PATH,
  logoAvatarEyeInk,
} from "./logo-avatar-art.js";
import { logoAvatarTraits } from "./logo-avatar-traits.js";
import { organicRestEyes } from "./organic-face.js";

/** A static notification portrait, with the same identity, saved photo and silhouette as chat. */
export function notificationAvatarSource(bot: {
  id: string;
  color: string;
  avatarSet?: string | null;
}): string {
  const parsed = BotAvatarValueSchema.safeParse(bot.color).success
    ? parseBotAvatarValue(bot.color)
    : null;
  if (parsed?.kind === "image") return parsed.imageUrl;
  const color = resolvePersonaColorDef(
    bot.id,
    parsed && "color" in parsed ? parsed.color : bot.color,
  ).hex;
  // The push is flattened onto white, so the eyes are inked for a light page.
  let viewBox: string;
  let body: string;
  if (bot.avatarSet === "rakazo" && parsed?.kind !== "shape") {
    const fill = logoAvatarTraits(bot.id, color).color;
    const { width, height, leftCx, rightCx, cy } = LOGO_AVATAR_EYES;
    const eyes = [leftCx, rightCx]
      .map((cx) => `<ellipse cx="${cx}" cy="${cy}" rx="${width / 2}" ry="${height / 2}"/>`)
      .join("");
    viewBox = LOGO_AVATAR_VIEWBOX;
    body = `<g transform="translate(0 ${LOGO_AVATAR_BODY_Y})"><path d="${LOGO_BODY_PATH}" fill="${fill}"/><g fill="${logoAvatarEyeInk(fill, lightTokens)}">${eyes}</g></g>`;
  } else {
    // A studio shape or the body the bot's id picks, wearing the chat avatar's resting face.
    const pick = parsed?.kind === "shape" ? parsed.shapeIndex : avatarIdentitySeed(bot.id);
    const family = pick % ORGANIC_AVATAR_FAMILY_COUNT;
    const eyes = organicRestEyes(family)
      .map(({ d }) => `<path d="${d}"/>`)
      .join("");
    viewBox = ORGANIC_AVATAR_VIEWBOX;
    body = `<path d="${botBodyShapePath(family, ORGANIC_AVATAR_BODY_SIZE)}" fill="${color}"/><g fill="${botEyeInk(color, lightTokens)}">${eyes}</g>`;
  }
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="${viewBox}">${body}</svg>`)}`;
}
