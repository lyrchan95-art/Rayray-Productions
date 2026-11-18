import { notFound } from "next/navigation";
import { Suspense } from "react";
import { IdeaWorkspace } from "@/components/IdeaWorkspace";
import { requirePageUser } from "@/lib/auth";
import { activePublication, getIdea, getVersion, listMessages, listVersions } from "@/lib/repo";

export default async function IdeaPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const idea = getIdea(user.id, id);
  if (!idea) notFound();
  const current = idea.currentVersion ? getVersion(id, idea.currentVersion) : null;
  return (
    <Suspense>
      <IdeaWorkspace
        key={idea.id}
        idea={idea}
        messages={listMessages(id)}
        versions={listVersions(id)}
        currentHtml={current?.html ?? null}
        publication={activePublication(id)}
      />
    </Suspense>
  );
}
