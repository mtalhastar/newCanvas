//// filepath: /D:/newcodenew/newCanvas/app/liveblocks.config.ts
import { createClient } from "@liveblocks/client";
import { createRoomContext } from "@liveblocks/react";

type Presence = {
  cursor: { x: number; y: number } | null;
};

const client = createClient({
    publicApiKey: process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY || "",
});

const {
  RoomProvider,
  useOthers,
  useUpdateMyPresence,
} = createRoomContext<Presence>(client);

export { RoomProvider, useOthers, useUpdateMyPresence };