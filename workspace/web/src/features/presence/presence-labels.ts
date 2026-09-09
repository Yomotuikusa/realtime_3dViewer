export const PRESENCE_HEADING = "参加者";
export const SELF_SUFFIX = "あなた";
export const FOLLOW_LABEL = "視点に入る";
export const UNFOLLOW_LABEL = "追従を解除";

export function presenceHeading(count: number): string {
  return `${PRESENCE_HEADING} (${count})`;
}
