/**
 * Editable, named opening choreography for theme "pearl-lace" v1.
 * Times in seconds, angles in degrees.
 *
 * Physical model (matches the customer's reference video and images 1→5): a four-flap pocket
 * envelope lying on the card. The seal stays attached to the TOP flap. On touch the seal presses,
 * then the flaps FOLD BACK about their outer hinges like opening a real envelope: they compress
 * toward the edges (foreshortening under perspective), the top flap carries the seal up to the top
 * edge, the side flaps slide off the left/right edges and the bottom flap folds down. The lace card
 * underneath is revealed IN PLACE (no zoom) while light floods in; then the names are written.
 *
 * Flaps rotate AWAY from the viewer (< 90°), so their back faces are never seen and no surface can
 * pass through another. The card is rendered on its own layer beneath the 3D envelope.
 */
export const PEARL_LACE_TIMELINE = {
  name: "pearl-lace-opening@2",
  perspective: 3.0, // × viewport height
  idle: { swayX: 0.5, swayY: 0.6, period: 6 },
  // the seal is always the TOP layer (never under a flap); it rides the top flap's tip
  seal: { pressDur: 0.28, pressScale: 0.93, releaseDur: 0.5, liftScale: 1.04, ease: "back.out(2)" },
  tulle: { start: 0.35, dur: 1.25 },
  flaps: {
    // angle sign = direction AWAY from the viewer for each hinge; light = how much the face darkens (+) or catches light (−) as it tilts
    // eases follow the reference video: the released top flap moves first and quickly, then settles
    top: { start: 0.45, dur: 2.45, angle: -86, ease: "sine.out", origin: "50% 0%", z: 3.2, light: -0.14 },
    left: { start: 0.75, dur: 2.35, angle: 86, ease: "sine.inOut", origin: "0% 50%", z: 2.4, light: 0.08 },
    right: { start: 0.81, dur: 2.35, angle: -86, ease: "sine.inOut", origin: "100% 50%", z: 2.4, light: 0.08 },
    bottom: { start: 0.95, dur: 2.35, angle: 86, ease: "sine.inOut", origin: "50% 100%", z: 2, light: 0.1 },
  },
  sealExit: { start: 2.55, dur: 0.75, distance: 0.34 /* × viewport height */ },
  flapsFade: { start: 2.8, dur: 0.5 }, // the thin folded strips dissolve at the edges
  camera: { pushStart: 0.4, pushDur: 2.6, pushScale: 1.03, returnDur: 0.4 },
  card: { riseStart: 0.8, riseDur: 2.6, fromScale: 0.986 },
  // inside the envelope starts in shadow and brightens as light floods in
  light: { shadowFrom: 0.36, shadowStart: 0.55, shadowDur: 2.6, vignetteFrom: 0.5, vignetteStart: 0.8, vignetteDur: 2.6, bloomStart: 1.5, bloomPeak: 0.32, bloomUp: 0.9, bloomDown: 1.1 },
  end: 3.35,
  text: { stagger: 0.16, dur: 0.8, writeDur: 1.1 },
} as const;

export type PearlLaceTimelineConfig = typeof PEARL_LACE_TIMELINE;
export type FlapName = keyof typeof PEARL_LACE_TIMELINE.flaps;
