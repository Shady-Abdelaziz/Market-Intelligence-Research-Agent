import SpectrumLive from "@/components/spectrum/SpectrumLive";

// /jobs/<uuid>   → live SSE-driven view of that real job
// /jobs/demo     → scripted Coca-Cola design preview (for UX work without a backend)
export default function JobPage({ params }: { params: { id: string } }) {
  const isDemo = params.id === "demo";
  return <SpectrumLive jobId={isDemo ? undefined : params.id} />;
}
