import type { Metadata } from "next";
import BodyMeasurementClient from "./BodyMeasurementClient";

export const metadata: Metadata = {
  title: "Body measurements — CalBot",
  description: "View and edit your body measurement history in CalBot."
};

export default function BodyMeasurementPage() {
  return <BodyMeasurementClient />;
}
