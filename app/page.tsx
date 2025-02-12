'use client' 
import Canva from "./components/canva";
import { RoomProvider } from "./liveblocks.config";

export default function Home() {
  const roomId = "default-canvas-room"; // You can modify this to get from wherever you need

  return (
    <RoomProvider 
      id={roomId}
      initialPresence={{ cursor: null, lastUpdate: Date.now() }}
      initialStorage={{
        images: [],
        shapes: [],
        lines: []
      }}
    >
      <Canva roomId={roomId} />
    </RoomProvider>
  );
}
