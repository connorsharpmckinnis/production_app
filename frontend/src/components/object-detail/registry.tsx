import type { ComponentType } from "react";
import CharacterDetailPanel from "@/components/object-detail/CharacterDetailPanel";
import CostumeDetailPanel from "@/components/object-detail/CostumeDetailPanel";
import CueCategoryDetailPanel from "@/components/object-detail/CueCategoryDetailPanel";
import CueDetailPanel from "@/components/object-detail/CueDetailPanel";
import GroupDetailPanel from "@/components/object-detail/GroupDetailPanel";
import PersonDetailPanel from "@/components/object-detail/PersonDetailPanel";
import PropDetailPanel from "@/components/object-detail/PropDetailPanel";
import SetPieceDetailPanel from "@/components/object-detail/SetPieceDetailPanel";
import SongDetailPanel from "@/components/object-detail/SongDetailPanel";
import type { ObjectDetailType } from "@/lib/objectDetail";

type PanelProps = {
  objectId: number;
  momentId?: number;
  sceneId?: number;
  sceneLabel?: string;
  sceneEndMomentId?: number;
};

const PANEL_BY_TYPE: Record<ObjectDetailType, ComponentType<PanelProps>> = {
  character: function CharacterPanelBridge({
    objectId,
    sceneId,
    sceneLabel,
    sceneEndMomentId,
  }) {
    return (
      <CharacterDetailPanel
        characterId={objectId}
        sceneId={sceneId}
        sceneLabel={sceneLabel}
        sceneEndMomentId={sceneEndMomentId}
      />
    );
  },
  prop: function PropPanelBridge({ objectId }) {
    return <PropDetailPanel propId={objectId} />;
  },
  song: function SongPanelBridge({ objectId }) {
    return <SongDetailPanel songId={objectId} />;
  },
  set_piece: function SetPiecePanelBridge({ objectId }) {
    return <SetPieceDetailPanel setPieceId={objectId} />;
  },
  costume: function CostumePanelBridge({ objectId }) {
    return <CostumeDetailPanel costumeId={objectId} />;
  },
  group: function GroupPanelBridge({ objectId }) {
    return <GroupDetailPanel groupId={objectId} />;
  },
  cue: function CuePanelBridge({ objectId, momentId }) {
    return <CueDetailPanel cueId={objectId} momentId={momentId} />;
  },
  person: function PersonPanelBridge({ objectId }) {
    return <PersonDetailPanel userId={objectId} />;
  },
  cue_category: function CueCategoryPanelBridge({ objectId }) {
    return <CueCategoryDetailPanel categoryId={objectId} />;
  },
};

export function ObjectDetailPanelBody({
  type,
  objectId,
  momentId,
  sceneId,
  sceneLabel,
  sceneEndMomentId,
}: {
  type: ObjectDetailType;
  objectId: number;
  momentId?: number;
  sceneId?: number;
  sceneLabel?: string;
  sceneEndMomentId?: number;
}) {
  const Panel = PANEL_BY_TYPE[type];
  return (
    <Panel
      objectId={objectId}
      momentId={momentId}
      sceneId={sceneId}
      sceneLabel={sceneLabel}
      sceneEndMomentId={sceneEndMomentId}
    />
  );
}
