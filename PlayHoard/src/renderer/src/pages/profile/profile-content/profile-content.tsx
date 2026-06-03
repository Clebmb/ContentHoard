import { userProfileContext } from "@renderer/context";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ProfileHero } from "../profile-hero/profile-hero";
import { useAppDispatch } from "@renderer/hooks";
import { setHeaderTitle } from "@renderer/features";
import type { ProfileTabType } from "./profile-tabs";
import { GAME_STATS_ANIMATION_DURATION_IN_MS } from "./profile-animations";
import { LibraryTab } from "./library-tab";
import { ProfileSection } from "../profile-section/profile-section";
import { RecentGamesBox } from "./recent-games-box";
import { UserStatsBox } from "./user-stats-box";
import { BadgesBox } from "./badges-box";
import "./profile-content.scss";

type SortOption = "playtime" | "achievementCount" | "playedRecently";

export function ProfileContent() {
  const {
    userProfile,
    isMe,
    userStats,
    libraryGames,
    pinnedGames,
    getUserLibraryGames,
    loadMoreLibraryGames,
    hasMoreLibraryGames,
    isLoadingLibraryGames,
  } = useContext(userProfileContext);
  const [statsIndex, setStatsIndex] = useState(0);
  const [sortBy, setSortBy] = useState<SortOption>("playedRecently");
  const [activeTab] = useState<ProfileTabType>("library");
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(setHeaderTitle(""));

    if (userProfile) {
      dispatch(setHeaderTitle(userProfile.displayName));
    }
  }, [userProfile, dispatch]);

  useEffect(() => {
    if (userProfile) {
      getUserLibraryGames(sortBy, true);
    }
  }, [sortBy, getUserLibraryGames, userProfile]);

  const handleLoadMore = useCallback(() => {
    if (
      activeTab === "library" &&
      hasMoreLibraryGames &&
      !isLoadingLibraryGames
    ) {
      loadMoreLibraryGames(sortBy);
    }
  }, [
    activeTab,
    hasMoreLibraryGames,
    isLoadingLibraryGames,
    loadMoreLibraryGames,
    sortBy,
  ]);

  useEffect(() => {
    const interval = window.setInterval(
      () => setStatsIndex((index) => index + 1),
      GAME_STATS_ANIMATION_DURATION_IN_MS
    );

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const content = useMemo(() => {
    if (!userProfile) return null;

    const hasRightContent =
      Boolean(userStats) ||
      userProfile.badges.length > 0 ||
      userProfile.recentGames.length > 0;

    return (
      <section className="profile-content__section">
        <div className="profile-content__main">
          <div className="profile-content__tab-panels">
            <LibraryTab
              sortBy={sortBy}
              onSortChange={setSortBy}
              pinnedGames={pinnedGames}
              libraryGames={libraryGames}
              hasMoreLibraryGames={hasMoreLibraryGames}
              statsIndex={statsIndex}
              userStats={userStats}
              onLoadMore={handleLoadMore}
              isMe={isMe}
            />
          </div>
        </div>

        {hasRightContent && (
          <div className="profile-content__right-content">
            {userStats && (
              <ProfileSection title="Stats" defaultOpen={true}>
                <UserStatsBox />
              </ProfileSection>
            )}
            {userProfile.badges.length > 0 && (
              <ProfileSection
                title="Badges"
                count={userProfile.badges.length}
                defaultOpen={true}
              >
                <BadgesBox />
              </ProfileSection>
            )}
            {userProfile.recentGames.length > 0 && (
              <ProfileSection title="Activity" defaultOpen={true}>
                <RecentGamesBox />
              </ProfileSection>
            )}
          </div>
        )}
      </section>
    );
  }, [
    userProfile,
    userStats,
    statsIndex,
    libraryGames,
    pinnedGames,
    sortBy,
    hasMoreLibraryGames,
    handleLoadMore,
    isMe,
  ]);

  return (
    <div>
      <ProfileHero />

      {content}
    </div>
  );
}
