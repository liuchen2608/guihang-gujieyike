import FeedbackForm from "@/components/feedback-form";
import { Suspense } from "react";

export default function FeedbackPage() {
  return <Suspense fallback={<main>正在载入反馈表…</main>}><FeedbackForm /></Suspense>;
}
