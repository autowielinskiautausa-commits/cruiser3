import { createFileRoute } from "@tanstack/react-router";
import { CarForm } from "@/components/car-form";

export const Route = createFileRoute("/_authenticated/dashboard/new")({
  component: () => <CarForm />,
});
