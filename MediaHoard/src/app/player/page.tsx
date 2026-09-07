import PlayerPageClient from "@player/player-page-client";
import { parsePlayerQuery } from "@player/query";
import type { PlayerQuery } from "@player/types";

type PlayerPageProps = {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PlayerPage({ searchParams }: PlayerPageProps) {
    const initialQuery: PlayerQuery = await parsePlayerQuery(searchParams);
    return (
        <>
            <style>{`
                html,
                body,
                body > div,
                main,
                section {
                    background: transparent !important;
                    background-color: transparent !important;
                }

                body {
                    overflow: hidden;
                }
            `}</style>
            <PlayerPageClient initialQuery={initialQuery} />
        </>
    );
}
