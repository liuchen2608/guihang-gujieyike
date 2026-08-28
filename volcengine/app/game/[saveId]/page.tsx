import GameClient from "@/components/game-client";

export default async function GamePage({ params }: { params: Promise<{ saveId: string }> }) {
  const { saveId } = await params;
  return <GameClient saveId={saveId} />;
}
