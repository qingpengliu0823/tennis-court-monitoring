import { getCourts } from "../actions/courts";
import { CourtsExplorer } from "@/components/CourtsExplorer";

export const dynamic = "force-dynamic";

export default async function CourtsPage() {
  const courts = await getCourts();
  return <CourtsExplorer courts={courts} />;
}
