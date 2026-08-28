const SELF_DIRECTED_ACTION = /(强行|偷取|抢夺|夺取|潜入|自行|自己|独自|不需要援助|接入驾驶服|观察.*真元路径|让归航|归航.*监测)/;
const NPC_ASSISTANCE_REQUEST = /(请|要求|拜托|让).*(乌岩|长老|守卫|族人)|(?:演示|指导|协助|帮助|教我)/;

export function actionRequiresNpcAid(phase: string, aid: string | undefined, text: string) {
  if (aid !== "withheld" || !["hope_well", "first_gu"].includes(phase)) return false;
  if (SELF_DIRECTED_ACTION.test(text)) return false;
  return NPC_ASSISTANCE_REQUEST.test(text);
}
