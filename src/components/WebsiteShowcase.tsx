import EducationExperience from "@/components/showcase/EducationExperience";
import FinanceExperience from "@/components/showcase/FinanceExperience";
import ScienceExperience from "@/components/showcase/ScienceExperience";
import type { WebsiteShowcase as WebsiteShowcaseData } from "@/data/creations";

type WebsiteShowcaseProps = Readonly<{
  showcase: WebsiteShowcaseData;
}>;

export function WebsiteShowcase({ showcase }: WebsiteShowcaseProps) {
  if (showcase.sector === "Scientific research") {
    return <ScienceExperience showcase={showcase} />;
  }

  if (showcase.sector === "Finance") {
    return <FinanceExperience showcase={showcase} />;
  }

  return <EducationExperience showcase={showcase} />;
}
