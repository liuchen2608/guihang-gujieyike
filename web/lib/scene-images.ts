import type { GamePhase } from "./game";

export type SceneImage = {
  src: string;
  position: string;
  mobileSrc?: string;
  mobilePosition?: string;
};

/**
 * Each illustration belongs to exactly one story phase; all 24 phases have
 * unique artwork. Mobile derivatives preserve the same phase ownership.
 */
export const SCENE_IMAGES = {
  desert_wake: { src: "/images/t01-huangsha-awakening.png", position: "center 48%" },
  oasis_route: { src: "/images/act1-ch02-oasis-route.png", position: "center 50%" },
  clan_gate: { src: "/images/act1-ch03-qingsha-gate.png", position: "center 45%" },
  waterworks: { src: "/images/t02-qingsha-clan.png", position: "center 48%" },
  hope_well: { src: "/images/t03-aperture-awakening.png", position: "center 43%" },
  first_gu: { src: "/images/act1-ch06-first-gu.png", position: "center 47%" },
  wolf_attack: { src: "/images/t04-uncontrolled-victory.png", position: "center 48%" },
  well_fragment: { src: "/images/act1-ch08-well-fragment.png", position: "center 48%" },
  dream_entry: { src: "/images/t05-consciousness-overlap.png", position: "center 45%" },
  thief_past: { src: "/images/act2-ch02-thief-past.png", position: "center 45%" },
  waiting_people: { src: "/images/t06-the-one-who-waits.png", position: "center 46%" },
  thief_fall: { src: "/images/act2-ch04-thief-fall.png", position: "center 50%" },
  young_thief: { src: "/images/t07-young-thief.png", position: "center 45%" },
  dream_battle: { src: "/images/act2-ch06-dream-battle.png", position: "center 45%" },
  return_cost: { src: "/images/t08-cost-of-return.png", position: "center 47%" },
  identity_test: { src: "/images/act2-ch08-identity-test.png", position: "center 45%" },
  thief_will: { src: "/images/t09-first-beacon.png", position: "center 44%" },
  dream_wake: { src: "/images/act2-ch10-dream-wake.png", position: "center 48%" },
  forge_council: { src: "/images/t10-well-trial.png", position: "center 48%" },
  gu_mech_blueprint: { src: "/images/act3-ch02-gu-mech-blueprint.png", position: "center 50%" },
  material_bargain: { src: "/images/act3-ch03-material-bargain.png", position: "center 46%" },
  first_forging: { src: "/images/t11-material-cost.png", position: "center 46%" },
  resonance_test: { src: "/images/act3-ch05-resonance-test.png", position: "center 48%" },
  signal_choice: { src: "/images/t12-her-voiceprint.png", position: "center 44%" },
} satisfies Record<GamePhase, SceneImage>;

// Keep the important subject in view when a landscape illustration is covered
// by the tall mobile conversation viewport. The original art is never cropped.
const MOBILE_FOCAL_POINTS: Partial<Record<GamePhase, string>> = {
  oasis_route: "68% 50%",
  clan_gate: "0% 45%",
  waterworks: "62% 48%",
  hope_well: "62% 43%",
  signal_choice: "56% 44%",
};

export function sceneImageFor(phase: GamePhase): SceneImage {
  const image = SCENE_IMAGES[phase];
  return { ...image, mobileSrc: image.src.replace("/images/", "/images/mobile/").replace(/\.png$/, ".webp"), mobilePosition: MOBILE_FOCAL_POINTS[phase] || image.position };
}
