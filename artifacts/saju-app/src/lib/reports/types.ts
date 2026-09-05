import type { CompatibilityResult, CompatibilityTone } from "../compatibilityScore";
import type { RelationshipType } from "../storage";
import type { FiveElementCount } from "../sajuEngine";

export interface BaseCompatibilityReport {
  tone: CompatibilityTone;
  toneColor: string;
  toneDesc: string;
  scoreResult: CompatibilityResult;
  relType: RelationshipType;
  
  elementComp: {
    p1Lacks: string[];
    p2Lacks: string[];
    p1Comps: string[];
    p2Comps: string[];
    desc: string;
  };
  
  stemRel: {
    label: string;
    desc: string;
    me2other: string | null;
    other2me: string | null;
    me2otherDesc: string;
    other2meDesc: string;
    elRel: string;
  };
  
  crossBranch: {
    positive: { desc: string; type: string; label: string }[];
    negative: { desc: string; type: string; label: string }[];
    overallDesc: string;
  };

  stemHarmony: {
    combines: string[];
    clashes: string[];
    overallDesc: string;
  };

  conflictPoints: string[];
  harmonyPoints: string[];
  tips: string[];
}

export interface LoverCompatibilityReport extends BaseCompatibilityReport {
  type: "lover" | "spouse" | "interest";
  
  branchComp: {
    myBranch: string;
    otherBranch: string;
    relations: string[];
    tone: string;
    desc: string;
    stability: string;
    myPalaceTitle: string;
    otherPalaceTitle: string;
  };
  
  styleComp: {
    person1Style: string;
    person2Style: string;
    dynamicsDesc: string;
  };
  
  marriageView: {
    type: string;
    typeColor: string;
    desc: string;
  };
}

export interface CoworkerCompatibilityReport extends BaseCompatibilityReport {
  type: "coworker";
  
  workStyleComp: {
    person1Style: string;
    person2Style: string;
    synergyDesc: string;
  };
  
  monthBranchComp: {
    myMonth: string;
    otherMonth: string;
    relations: string[];
    desc: string;
  };
}

export interface FamilyFriendCompatibilityReport extends BaseCompatibilityReport {
  type: "family" | "friend" | "other";
  
  branchComp: {
    myBranch: string;
    otherBranch: string;
    relations: string[];
    tone: string;
    desc: string;
    stability: string;
  };
  
  dynamicsComp: {
    person1Style: string;
    person2Style: string;
    desc: string;
  };
}

export type AnyCompatibilityReport = 
  | LoverCompatibilityReport 
  | CoworkerCompatibilityReport 
  | FamilyFriendCompatibilityReport;
