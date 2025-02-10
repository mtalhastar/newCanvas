'use client' 
import Canva from "./components/canva";
import { RoomProvider } from "./liveblocks.config";

export default function Home() {
  return (
    <RoomProvider 
      id="my-canvas-room" 
      initialPresence={{ cursor: null, lastUpdate: Date.now() }}
      initialStorage={{
        images: [],
        shapes: [],
        lines: []
      }}
    >
      <Canva />
    </RoomProvider>
  );
}
