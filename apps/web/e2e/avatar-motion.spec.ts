import { expect, test } from "@playwright/test";
import { captureScreenshot } from "./helpers";

test("photo working avatars show a visible ring while idle avatars stay plain", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/e2e/fixtures/avatar-motion.html");

  const working = page.locator(".avatar-working");
  await expect(working).toBeVisible();
  await expect(working).toHaveAttribute("data-working", "true");
  const picture = working.locator(".rakazo-bot-avatar-picture");
  const ring = working.locator(".rakazo-bot-avatar-ring");
  await expect(picture).toBeVisible();
  await expect(ring).toBeVisible();

  const overflow = await working.evaluate((el) => getComputedStyle(el).overflowX);
  const pictureOverflow = await picture.evaluate((el) => getComputedStyle(el).overflowX);
  const ringAnimation = await ring.evaluate((el: SVGElement) => getComputedStyle(el).animationName);
  const ringColor = await ring.locator("circle").evaluate((el) => getComputedStyle(el).stroke);
  const pictureAnimation = await picture.evaluate((el) => getComputedStyle(el).animationName);
  const workingColor = await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.color = "var(--status-working)";
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  });
  expect(overflow).not.toBe("hidden");
  expect(pictureOverflow).toBe("hidden");
  expect(ringAnimation).toBe("rakazo-avatar-spin");
  expect(ringColor).toBe(workingColor);
  expect(pictureAnimation).toBe("rakazo-avatar-breathe");
  const firstPictureTransform = await picture.evaluate((el) => getComputedStyle(el).transform);
  await page.waitForTimeout(300);
  const secondPictureTransform = await picture.evaluate((el) => getComputedStyle(el).transform);
  expect(secondPictureTransform).not.toBe(firstPictureTransform);

  const idle = page.locator(".avatar-idle");
  await expect(idle).toHaveAttribute("data-working", "false");
  await expect(idle.locator(".rakazo-bot-avatar-ring")).toHaveCount(0);
  await expect(idle.locator(".rakazo-bot-avatar-picture")).toHaveCSS("animation-name", "none");
  await captureScreenshot(page, testInfo, "avatar-photo-working-and-idle");
});

test("photo avatar animations stay still when reduced motion is enabled", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/e2e/fixtures/avatar-motion.html");

  const avatar = page.locator(".avatar-working");
  await expect(avatar).toBeVisible();
  await expect(avatar).toHaveAttribute("data-working", "true");

  const ring = avatar.locator(".rakazo-bot-avatar-ring");
  const picture = avatar.locator(".rakazo-bot-avatar-picture");
  await expect(ring).toBeVisible();
  const snapshot = () =>
    Promise.all([
      ring.evaluate((el: SVGElement) => ({
        animationName: getComputedStyle(el).animationName,
        transform: getComputedStyle(el).transform,
      })),
      picture.evaluate((el) => ({
        animationName: getComputedStyle(el).animationName,
        transform: getComputedStyle(el).transform,
      })),
    ]);
  const first = await snapshot();
  await page.waitForTimeout(300);
  const second = await snapshot();

  expect(first[0]?.animationName).toBe("none");
  expect(first[1]?.animationName).toBe("none");
  expect(second).toEqual(first);
});

test("organic avatars drift while idle, face a hovering pointer, act busy while working, and stop offscreen or hidden", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/e2e/fixtures/avatar-motion.html");
  const avatar = page.locator(".avatar-organic");
  await expect(avatar).toBeVisible();
  const pose = () =>
    avatar.evaluate((svg: SVGSVGElement) => ({
      turn: svg.querySelector("[data-organic-turn]")?.getAttribute("transform"),
      eyes: [...svg.querySelectorAll("[data-organic-eye]")].map((eye) =>
        eye.getAttribute("transform"),
      ),
    }));
  const moves = async () => {
    const before = await pose();
    await page.waitForTimeout(300);
    return JSON.stringify(await pose()) !== JSON.stringify(before);
  };

  // At rest the face drifts on its own, leaning back and looking up and right.
  expect(await moves()).toBe(true);
  expect((await pose()).turn).toMatch(/^rotate\(-1[0-9]/);

  // Hovering the avatar's centre turns it to face the pointer, upright.
  const box = (await avatar.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(async () => (await pose()).turn).toMatch(/^rotate\(-?0(\.\d+)?\)$/);
  await page.mouse.move(box.x + box.width + 200, box.y - 200);

  // Working keeps it moving.
  await avatar.evaluate((svg) => svg.parentElement!.querySelector("button")!.click());
  await expect(avatar).toHaveAttribute("data-working", "true");
  expect(await moves()).toBe(true);

  await avatar.evaluate((svg) => {
    svg.closest<HTMLElement>(".avatar-example")!.style.marginTop = "2200px";
  });
  await expect(avatar).toHaveAttribute("data-paused", "true");
  expect(await moves()).toBe(false);
  await avatar.evaluate((svg) => {
    svg.closest<HTMLElement>(".avatar-example")!.style.marginTop = "0";
  });
  await expect(avatar).toHaveAttribute("data-paused", "false");

  const setHidden = (hidden: boolean) =>
    page.evaluate((value) => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => value });
      document.dispatchEvent(new Event("visibilitychange"));
    }, hidden);
  await setHidden(true);
  await expect(avatar).toHaveAttribute("data-paused", "true");
  expect(await moves()).toBe(false);
  await setHidden(false);
  await expect(avatar).toHaveAttribute("data-paused", "false");
  expect(await moves()).toBe(true);
});
