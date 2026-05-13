import type { Metadata } from "next";
import BodyMeasurementClient from "./BodyMeasurementClient";

export const metadata: Metadata = {
  title: "CalBot Body Measurements",
  description: "CalBot body measurements history and editor."
};

export default function BodyMeasurementPage() {
  return <BodyMeasurementClient />;
}
