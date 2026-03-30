import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/authContext";
import {
  fetchMyProfile,
  fetchPartnerProfiles,
  migrateLocalToSupabase,
  upsertUserProfile,
} from "@/lib/db";
import { saveMyProfile, savePerson, load as loadLocal, save as saveLocal } from "@/lib/storage";

export function useSupabaseSync(onSynced?: () => void) {
  const { user } = useAuth();
  const hasSynced = useRef(false);

  useEffect(() => {
    if (!user || hasSynced.current) return;
    hasSynced.current = true;

    (async () => {
      await upsertUserProfile(user);
      await migrateLocalToSupabase(user.id);

      const [myProfile, partners] = await Promise.all([
        fetchMyProfile(user.id),
        fetchPartnerProfiles(user.id),
      ]);

      const local = loadLocal();
      if (myProfile) {
        local.myProfile = myProfile;
        saveMyProfile(myProfile);
      }
      if (partners.length > 0) {
        local.people = partners;
        for (const p of partners) savePerson(p);
      }
      saveLocal(local);

      onSynced?.();
    })();
  }, [user, onSynced]);
}
