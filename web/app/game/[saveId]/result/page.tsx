import ResultClient from "@/components/result-client";

export default async function ResultPage({ params }: { params: Promise<{ saveId: string }> }) {
  const { saveId } = await params;
  return <ResultClient saveId={saveId} />;
}
