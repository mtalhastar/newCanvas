import { createClient, JsonObject } from "@liveblocks/client";
import { createRoomContext } from "@liveblocks/react";

type Presence = {
  cursor: { x: number; y: number } | null;
  [key: string]: JsonObject | null;
};

type Storage = {
  images: Array<{
    id: string;
    url: string;
    x: number;
    y: number;
  }>;
  shapes: Array<{
    id: string;
    type: "rectangle" | "circle";
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    strokeWidth: number;
  }>;
  lines: Array<{
    id: string;
    points: number[];
    color: string;
    width: number;
  }>;
};

const client = createClient({
  publicApiKey: process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY!,
  throttle: 16,
});

export type { Storage, Presence };

export const {
  RoomProvider,
  useStorage,
  useMutation,
  useOthers,
  useUpdateMyPresence,
  useSelf,
} = createRoomContext<Presence, Storage>(client);
