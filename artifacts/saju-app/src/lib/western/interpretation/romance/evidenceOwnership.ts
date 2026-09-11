import type { WesternAspect, WesternPoint } from "../../types.js";
import { aspectEvidence, placementEvidence } from "../evidence.js";
import type { RelationshipEvidence, RelationshipSectionKey } from "./types.js";

export class RelationshipEvidenceAllocator {
  private readonly owners = new Map<string, RelationshipSectionKey>();

  claimPlacement(point: WesternPoint, owner: RelationshipSectionKey, role?: RelationshipEvidence["role"]): RelationshipEvidence | null {
    const base = placementEvidence(point);
    return this.claim({ ...base, kind: "placement", primaryOwnerSection: owner, role });
  }

  claimAspect(aspect: WesternAspect, owner: RelationshipSectionKey): RelationshipEvidence | null {
    const base = aspectEvidence(aspect);
    return this.claim({ ...base, kind: "aspect", primaryOwnerSection: owner });
  }

  claimCusp(number: 5 | 7, sign: string, owner: RelationshipSectionKey): RelationshipEvidence | null {
    return this.claim({ id: number === 7 ? "angle:descendant" : "cusp:5", kind: number === 7 ? "angle" : "cusp", label: number === 7 ? `7H cusp / DSC ${sign}` : `5H cusp ${sign}`, sourcePointIds: [], primaryOwnerSection: owner });
  }

  private claim(evidence: RelationshipEvidence): RelationshipEvidence | null {
    if (this.owners.has(evidence.id)) return null;
    this.owners.set(evidence.id, evidence.primaryOwnerSection);
    return evidence;
  }
}
