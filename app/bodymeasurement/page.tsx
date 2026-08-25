import type { Metadata } from "next";
import BodyMeasurementClient from "./BodyMeasurementClient";

export const metadata: Metadata = {
  title: "Вимірювання тіла — CalBot",
  description: "Історія та редагування вимірювань тіла в CalBot."
};

export default function BodyMeasurementPage() {
  return <BodyMeasurementClient />;
}
